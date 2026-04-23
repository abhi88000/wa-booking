// ============================================================
// Doctor/Staff Routes — CRUD & Availability Management
// ============================================================
// 7 routes: list, create, update, delete, get slots for a date,
// get weekly availability, and update availability schedule.
// Supports multi-clinic mapping: one doctor → many clinics.
// Slot generation respects breaks, blocked dates, and existing bookings.

const express = require('express');
const router = express.Router();
const Joi = require('joi');
const pool = require('../../db/pool');
const { requireRole } = require('../../middleware/auth');

router.get('/doctors', async (req, res, next) => {
  try {
    const { clinic } = req.query;
    const clinicFilter = clinic && clinic !== 'all' ? clinic : null;

    let where = 'd.tenant_id = $1';
    const params = [req.tenantId];

    if (clinicFilter) {
      where += ` AND (EXISTS (SELECT 1 FROM doctor_clinics dc WHERE dc.doctor_id = d.id AND dc.clinic_label = $2) OR NOT EXISTS (SELECT 1 FROM doctor_clinics dc2 WHERE dc2.doctor_id = d.id))`;
      params.push(clinicFilter);
    }

    const { rows } = await pool.query(
      `SELECT d.*, 
        (SELECT json_agg(json_build_object('day', da.day, 'start_time', da.start_time, 'end_time', da.end_time, 'clinic_label', da.clinic_label))
         FROM doctor_availability da WHERE da.doctor_id = d.id AND da.is_active = true) as availability,
        (SELECT json_agg(dc.clinic_label) FROM doctor_clinics dc WHERE dc.doctor_id = d.id) as clinics
       FROM doctors d WHERE ${where} ORDER BY d.name`,
      params
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
      clinics: Joi.array().items(Joi.string()).default([]),
      availability: Joi.array().items(Joi.object({
        day: Joi.string().required(),
        startTime: Joi.string().required(),
        endTime: Joi.string().required()
      }))
    });

    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    // Normalize: clinics array
    const clinicList = value.clinics;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows } = await client.query(
        `INSERT INTO doctors (tenant_id, name, specialization, phone, email, consultation_fee, slot_duration)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [req.tenantId, value.name, value.specialization, value.phone, value.email, value.consultationFee, value.slotDuration]
      );

      // Insert clinic mappings
      for (const cl of clinicList) {
        await client.query(
          `INSERT INTO doctor_clinics (tenant_id, doctor_id, clinic_label) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
          [req.tenantId, rows[0].id, cl]
        );
      }

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
      rows[0].clinics = clinicList;
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
    const schema = Joi.object({
      name: Joi.string(),
      specialization: Joi.string().allow('', null),
      phone: Joi.string().allow('', null),
      email: Joi.string().email().allow('', null),
      consultationFee: Joi.number(),
      slotDuration: Joi.number(),
      isActive: Joi.boolean(),
      clinics: Joi.array().items(Joi.string())
    });
    const { error, value } = schema.validate(req.body, { stripUnknown: true });
    if (error) return res.status(400).json({ error: error.details[0].message });

    const { name, specialization, phone, email, consultationFee, slotDuration, isActive, clinics: clinicList } = value;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows } = await client.query(
        `UPDATE doctors SET 
          name = COALESCE($1, name), specialization = COALESCE($2, specialization),
          phone = COALESCE($3, phone), email = COALESCE($4, email),
          consultation_fee = COALESCE($5, consultation_fee), 
          slot_duration = COALESCE($6, slot_duration),
          is_active = COALESCE($7, is_active)
         WHERE id = $8 AND tenant_id = $9 RETURNING *`,
        [name, specialization, phone, email, consultationFee, slotDuration, isActive, req.params.id, req.tenantId]
      );

      if (rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Doctor not found' });
      }

      // Update clinic mappings if provided
      if (Array.isArray(clinicList)) {
        await client.query(`DELETE FROM doctor_clinics WHERE doctor_id = $1`, [req.params.id]);
        for (const cl of clinicList) {
          if (cl) {
            await client.query(
              `INSERT INTO doctor_clinics (tenant_id, doctor_id, clinic_label) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
              [req.tenantId, req.params.id, cl]
            );
          }
        }
      }

      await client.query('COMMIT');

      // Return updated clinics
      const { rows: dcRows } = await pool.query(`SELECT clinic_label FROM doctor_clinics WHERE doctor_id = $1`, [req.params.id]);
      rows[0].clinics = dcRows.map(r => r.clinic_label);
      res.json(rows[0]);
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
    const { date, clinic } = req.query;
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

    // Fetch availability — prefer clinic-specific, fall back to global
    let avail;
    if (clinic && clinic !== 'all') {
      const { rows } = await pool.query(
        `SELECT start_time, end_time FROM doctor_availability 
         WHERE doctor_id = $1 AND tenant_id = $2 AND day = $3 AND is_active = true AND clinic_label = $4`,
        [doctorId, req.tenantId, dayName, clinic]
      );
      avail = rows;
    }
    if (!avail || avail.length === 0) {
      const { rows } = await pool.query(
        `SELECT start_time, end_time FROM doctor_availability 
         WHERE doctor_id = $1 AND tenant_id = $2 AND day = $3 AND is_active = true AND clinic_label IS NULL`,
        [doctorId, req.tenantId, dayName]
      );
      avail = rows;
    }

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
    for (const block of avail) {
      let current = toMin(block.start_time);
      const end = toMin(block.end_time);

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
    }

    res.json({ slots, duration, day: dayName });
  } catch (err) {
    next(err);
  }
});

// ── Doctor Availability ───────────────────────────────────

router.get('/doctors/:id/availability', async (req, res, next) => {
  try {
    const { clinic } = req.query;
    const clinicFilter = clinic && clinic !== 'all' ? clinic : null;

    let availQuery = `SELECT id, day, start_time, end_time, is_active, clinic_label
       FROM doctor_availability WHERE doctor_id = $1 AND tenant_id = $2`;
    const availParams = [req.params.id, req.tenantId];
    if (clinicFilter) {
      availQuery += ` AND (clinic_label = $3 OR clinic_label IS NULL)`;
      availParams.push(clinicFilter);
    }
    availQuery += ` ORDER BY CASE day WHEN 'monday' THEN 1 WHEN 'tuesday' THEN 2 WHEN 'wednesday' THEN 3 
       WHEN 'thursday' THEN 4 WHEN 'friday' THEN 5 WHEN 'saturday' THEN 6 WHEN 'sunday' THEN 7 END`;

    const { rows: avail } = await pool.query(availQuery, availParams);
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
    const { rows: docClinics } = await pool.query(
      `SELECT clinic_label FROM doctor_clinics WHERE doctor_id = $1`, [req.params.id]
    );
    res.json({
      availability: avail, breaks,
      slotDuration: doctor[0]?.slot_duration || 30,
      timezone: tenant[0]?.timezone || 'Asia/Kolkata',
      clinics: docClinics.map(r => r.clinic_label)
    });
  } catch (err) {
    next(err);
  }
});

router.put('/doctors/:id/availability', requireRole('owner', 'admin'), async (req, res, next) => {
  try {
    const { availability, breaks, slotDuration, timezone, clinicLabel } = req.body;
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
        // Check for time overlaps at OTHER clinics for the same days
        const enabledSlots = availability.filter(a => a.isActive !== false);
        if (enabledSlots.length > 0 && clinicLabel) {
          for (const a of enabledSlots) {
            const { rows: conflicts } = await client.query(
              `SELECT clinic_label, start_time, end_time FROM doctor_availability
               WHERE doctor_id = $1 AND tenant_id = $2 AND day = $3
               AND clinic_label IS DISTINCT FROM $4
               AND start_time < $6::time AND end_time > $5::time`,
              [doctorId, tenantId, a.day, clinicLabel, a.startTime, a.endTime]
            );
            if (conflicts.length > 0) {
              await client.query('ROLLBACK');
              const c = conflicts[0];
              return res.status(409).json({
                error: `Schedule conflict on ${a.day}: ${a.startTime}–${a.endTime} overlaps with ${c.clinic_label} (${c.start_time.substring(0,5)}–${c.end_time.substring(0,5)}). A doctor can't be at two clinics at the same time.`
              });
            }
          }
        }

        // Delete only for this clinic (or global if no clinicLabel)
        if (clinicLabel) {
          await client.query(
            `DELETE FROM doctor_availability WHERE doctor_id = $1 AND tenant_id = $2 AND clinic_label = $3`,
            [doctorId, tenantId, clinicLabel]
          );
        } else {
          await client.query(
            `DELETE FROM doctor_availability WHERE doctor_id = $1 AND tenant_id = $2 AND clinic_label IS NULL`,
            [doctorId, tenantId]
          );
        }
        for (const a of enabledSlots) {
          await client.query(
            `INSERT INTO doctor_availability (tenant_id, doctor_id, day, start_time, end_time, is_active, clinic_label)
             VALUES ($1, $2, $3, $4, $5, true, $6)`,
            [tenantId, doctorId, a.day, a.startTime, a.endTime, clinicLabel || null]
          );
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
