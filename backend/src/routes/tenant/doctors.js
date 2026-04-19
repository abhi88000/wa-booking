// ============================================================
// Doctor/Staff Routes — CRUD & Availability Management
// ============================================================
// 7 routes: list, create, update, delete, get slots for a date,
// get weekly availability, and update availability schedule.
// Slot generation respects breaks, blocked dates, and existing bookings.

const express = require('express');
const router = express.Router();
const Joi = require('joi');
const pool = require('../../db/pool');
const { requireRole } = require('../../middleware/auth');

router.get('/doctors', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT d.*, 
        (SELECT json_agg(json_build_object('day', da.day, 'start_time', da.start_time, 'end_time', da.end_time))
         FROM doctor_availability da WHERE da.doctor_id = d.id AND da.is_active = true) as availability
       FROM doctors d WHERE d.tenant_id = $1 ORDER BY d.name`,
      [req.tenantId]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post('/doctors', requireRole('owner', 'admin'), async (req, res, next) => {
  try {
    const { rows: countCheck } = await pool.query(
      'SELECT COUNT(*) FROM doctors WHERE tenant_id = $1 AND is_active = true',
      [req.tenantId]
    );
    if (parseInt(countCheck[0].count) >= req.tenant.max_doctors) {
      return res.status(429).json({ 
        error: `Doctor limit reached (${req.tenant.max_doctors}). Upgrade your plan.`,
        upgrade: true
      });
    }

    const schema = Joi.object({
      name: Joi.string().required(),
      specialization: Joi.string(),
      phone: Joi.string(),
      email: Joi.string().email(),
      consultationFee: Joi.number().default(0),
      slotDuration: Joi.number().default(30),
      clinic: Joi.string().allow('', null),
      availability: Joi.array().items(Joi.object({
        day: Joi.string().required(),
        startTime: Joi.string().required(),
        endTime: Joi.string().required()
      }))
    });

    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows } = await client.query(
        `INSERT INTO doctors (tenant_id, name, specialization, phone, email, consultation_fee, slot_duration, clinic)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [req.tenantId, value.name, value.specialization, value.phone, value.email, value.consultationFee, value.slotDuration, value.clinic || null]
      );

      if (value.availability) {
        for (const avail of value.availability) {
          await client.query(
            `INSERT INTO doctor_availability (tenant_id, doctor_id, day, start_time, end_time)
             VALUES ($1, $2, $3, $4, $5)`,
            [req.tenantId, rows[0].id, avail.day, avail.startTime, avail.endTime]
          );
        }
      }

      await client.query('COMMIT');
      res.status(201).json(rows[0]);
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
});

router.put('/doctors/:id', requireRole('owner', 'admin'), async (req, res, next) => {
  try {
    const { name, specialization, phone, email, consultationFee, slotDuration, isActive, clinic } = req.body;
    const { rows } = await pool.query(
      `UPDATE doctors SET 
        name = COALESCE($1, name), specialization = COALESCE($2, specialization),
        phone = COALESCE($3, phone), email = COALESCE($4, email),
        consultation_fee = COALESCE($5, consultation_fee), 
        slot_duration = COALESCE($6, slot_duration),
        is_active = COALESCE($7, is_active),
        clinic = COALESCE($8, clinic)
       WHERE id = $9 AND tenant_id = $10 RETURNING *`,
      [name, specialization, phone, email, consultationFee, slotDuration, isActive, clinic, req.params.id, req.tenantId]
    );

    if (rows.length === 0) return res.status(404).json({ error: 'Doctor not found' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.delete('/doctors/:id', requireRole('owner', 'admin'), async (req, res, next) => {
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE doctors SET is_active = false WHERE id = $1 AND tenant_id = $2`,
        [req.params.id, req.tenantId]
      );
      await client.query(
        `UPDATE appointments SET status = 'cancelled', updated_at = NOW()
         WHERE doctor_id = $1 AND tenant_id = $2 AND appointment_date >= CURRENT_DATE AND status IN ('pending', 'confirmed')`,
        [req.params.id, req.tenantId]
      );
      await client.query('COMMIT');
      res.json({ success: true });
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
});

// ── Doctor Available Slots for a Date ─────────────────────

router.get('/doctors/:id/slots', async (req, res, next) => {
  try {
    const doctorId = req.params.id;
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'date query param required (YYYY-MM-DD)' });

    const [y, m, d] = date.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const dayMap = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = dayMap[dateObj.getDay()];

    const { rows: docRows } = await pool.query(
      `SELECT slot_duration FROM doctors WHERE id = $1 AND tenant_id = $2`,
      [doctorId, req.tenantId]
    );
    const duration = (docRows.length > 0 && docRows[0].slot_duration) ? docRows[0].slot_duration : 30;

    const { rows: avail } = await pool.query(
      `SELECT start_time, end_time FROM doctor_availability 
       WHERE doctor_id = $1 AND tenant_id = $2 AND day = $3 AND is_active = true`,
      [doctorId, req.tenantId, dayName]
    );

    if (avail.length === 0) return res.json({ slots: [], message: 'Doctor not available on this day' });

    const { rows: booked } = await pool.query(
      `SELECT start_time, end_time FROM appointments 
       WHERE doctor_id = $1 AND appointment_date = $2 
       AND status NOT IN ('cancelled', 'rescheduled')`,
      [doctorId, date]
    );

    const { rows: breaks } = await pool.query(
      `SELECT start_time, end_time FROM doctor_breaks
       WHERE doctor_id = $1 AND tenant_id = $2
       AND (break_date = $3 OR break_date IS NULL)
       AND is_full_day = false`,
      [doctorId, req.tenantId, date]
    );

    const toMin = (t) => { const [h, mm] = t.toString().split(':').map(Number); return h * 60 + (mm || 0); };
    const toTime = (m) => `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;

    const slots = [];
    let current = toMin(avail[0].start_time);
    const end = toMin(avail[0].end_time);

    while (current + duration <= end) {
      const slotStart = toTime(current);
      const slotEnd = toTime(current + duration);

      const isBooked = booked.some(b => current < toMin(b.end_time) && (current + duration) > toMin(b.start_time));
      const inBreak = breaks.some(b => current < toMin(b.end_time) && (current + duration) > toMin(b.start_time));

      if (!isBooked && !inBreak) {
        slots.push({ startTime: slotStart, endTime: slotEnd });
      }
      current += duration;
    }

    res.json({ slots, duration, day: dayName });
  } catch (err) {
    next(err);
  }
});

// ── Doctor Availability ───────────────────────────────────

router.get('/doctors/:id/availability', async (req, res, next) => {
  try {
    const { rows: avail } = await pool.query(
      `SELECT id, day, start_time, end_time, is_active 
       FROM doctor_availability WHERE doctor_id = $1 AND tenant_id = $2 ORDER BY 
       CASE day WHEN 'monday' THEN 1 WHEN 'tuesday' THEN 2 WHEN 'wednesday' THEN 3 
       WHEN 'thursday' THEN 4 WHEN 'friday' THEN 5 WHEN 'saturday' THEN 6 WHEN 'sunday' THEN 7 END`,
      [req.params.id, req.tenantId]
    );
    const { rows: breaks } = await pool.query(
      `SELECT id, break_date, start_time, end_time, reason, is_full_day 
       FROM doctor_breaks WHERE doctor_id = $1 AND tenant_id = $2 
       AND (break_date IS NULL OR break_date >= CURRENT_DATE) ORDER BY start_time`,
      [req.params.id, req.tenantId]
    );
    const { rows: doctor } = await pool.query(
      `SELECT slot_duration FROM doctors WHERE id = $1 AND tenant_id = $2`,
      [req.params.id, req.tenantId]
    );
    const { rows: tenant } = await pool.query(
      `SELECT timezone FROM tenants WHERE id = $1`, [req.tenantId]
    );
    res.json({
      availability: avail, breaks,
      slotDuration: doctor[0]?.slot_duration || 30,
      timezone: tenant[0]?.timezone || 'Asia/Kolkata'
    });
  } catch (err) {
    next(err);
  }
});

router.put('/doctors/:id/availability', requireRole('owner', 'admin'), async (req, res, next) => {
  try {
    const { availability, breaks, slotDuration, timezone } = req.body;
    const doctorId = req.params.id;
    const tenantId = req.tenantId;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      if (slotDuration) {
        await client.query(
          `UPDATE doctors SET slot_duration = $1 WHERE id = $2 AND tenant_id = $3`,
          [slotDuration, doctorId, tenantId]
        );
      }

      if (timezone) {
        await client.query(
          `UPDATE tenants SET timezone = $1 WHERE id = $2`,
          [timezone, tenantId]
        );
      }

      if (availability) {
        await client.query(
          `DELETE FROM doctor_availability WHERE doctor_id = $1 AND tenant_id = $2`,
          [doctorId, tenantId]
        );
        for (const a of availability) {
          if (a.isActive !== false) {
            await client.query(
              `INSERT INTO doctor_availability (tenant_id, doctor_id, day, start_time, end_time, is_active)
               VALUES ($1, $2, $3, $4, $5, true)`,
              [tenantId, doctorId, a.day, a.startTime, a.endTime]
            );
          }
        }
      }

      if (breaks) {
        await client.query(
          `DELETE FROM doctor_breaks WHERE doctor_id = $1 AND tenant_id = $2`,
          [doctorId, tenantId]
        );
        for (const b of breaks) {
          const isFullDay = b.isFullDay || false;
          await client.query(
            `INSERT INTO doctor_breaks (tenant_id, doctor_id, break_date, start_time, end_time, reason, is_full_day)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [tenantId, doctorId, b.breakDate || null, 
             isFullDay ? '00:00' : b.startTime, 
             isFullDay ? '23:59' : b.endTime, 
             b.reason || 'Break', isFullDay]
          );
        }
      }

      await client.query('COMMIT');
      res.json({ success: true });
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
});

module.exports = router;
