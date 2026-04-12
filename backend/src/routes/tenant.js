// ============================================================
// Tenant Admin Routes — Each Business's Dashboard API
// ============================================================
// Every request here is scoped to the authenticated tenant

const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const Joi = require('joi');
const axios = require('axios');
const pool = require('../db/pool');
const { authTenant, requireRole } = require('../middleware/auth');
const { loadTenantContext } = require('../middleware/tenantContext');
const logger = require('../utils/logger');
const WhatsAppService = require('../services/whatsapp');

// Ensure clinic column exists on doctors table (safe to run multiple times)
pool.query(`ALTER TABLE doctors ADD COLUMN IF NOT EXISTS clinic VARCHAR(200)`)
  .catch(err => logger.error('Failed to ensure clinic column:', err.message));

// All tenant routes require auth + tenant context
router.use(authTenant, loadTenantContext);

// ── DASHBOARD ─────────────────────────────────────────────

router.get('/dashboard', async (req, res, next) => {
  try {
    const tid = req.tenantId;
    const { clinic } = req.query;
    const clinicFilter = clinic && clinic !== 'all' ? clinic : null;

    const [stats, recent, todayAppts] = await Promise.all([
      // Stats — individual counts with optional clinic filter via doctor join
      (async () => {
        const p = clinicFilter ? [tid, clinicFilter] : [tid];
        const cf = clinicFilter ? 'AND (d.clinic = $2 OR d.clinic IS NULL)' : '';
        const dJoin = clinicFilter ? 'JOIN doctors d ON d.id = a.doctor_id' : '';
        const upcoming = await pool.query(`SELECT COUNT(*) FROM appointments a ${dJoin} WHERE a.tenant_id = $1 AND a.status = 'confirmed' AND a.appointment_date >= CURRENT_DATE ${cf}`, p);
        const today = await pool.query(`SELECT COUNT(*) FROM appointments a ${dJoin} WHERE a.tenant_id = $1 AND a.appointment_date = CURRENT_DATE AND a.status NOT IN ('cancelled', 'rescheduled') ${cf}`, p);
        const patients = await pool.query(`SELECT COUNT(*) FROM patients WHERE tenant_id = $1`, [tid]);
        const dcf = clinicFilter ? 'AND (clinic = $2 OR clinic IS NULL)' : '';
        const docs = await pool.query(`SELECT COUNT(*) FROM doctors WHERE tenant_id = $1 AND is_active = true ${dcf}`, clinicFilter ? [tid, clinicFilter] : [tid]);
        const month = await pool.query(`SELECT COUNT(*) FROM appointments a ${dJoin} WHERE a.tenant_id = $1 AND EXTRACT(MONTH FROM a.created_at) = EXTRACT(MONTH FROM NOW()) ${cf}`, p);
        return { rows: [{ upcoming: upcoming.rows[0].count, today: today.rows[0].count, total_patients: patients.rows[0].count, active_doctors: docs.rows[0].count, month_appointments: month.rows[0].count }] };
      })(),
      pool.query(`
        SELECT a.id, a.appointment_date, a.start_time, a.status, 
               d.name as doctor_name, p.name as patient_name, p.phone as patient_phone
        FROM appointments a
        LEFT JOIN doctors d ON d.id = a.doctor_id
        LEFT JOIN patients p ON p.id = a.patient_id
        WHERE a.tenant_id = $1 AND a.appointment_date >= CURRENT_DATE
        ${clinicFilter ? 'AND (d.clinic = $2 OR d.clinic IS NULL)' : ''}
        ORDER BY a.appointment_date, a.start_time LIMIT 10
      `, clinicFilter ? [tid, clinicFilter] : [tid]),
      pool.query(`
        SELECT a.*, d.name as doctor_name, p.name as patient_name
        FROM appointments a
        LEFT JOIN doctors d ON d.id = a.doctor_id
        LEFT JOIN patients p ON p.id = a.patient_id
        WHERE a.tenant_id = $1 AND a.appointment_date = CURRENT_DATE
        ${clinicFilter ? 'AND (d.clinic = $2 OR d.clinic IS NULL)' : ''}
        ORDER BY a.start_time
      `, clinicFilter ? [tid, clinicFilter] : [tid])
    ]);

    res.json({
      stats: stats.rows[0],
      upcoming: recent.rows,
      today: todayAppts.rows,
      plan: req.tenant.plan || 'trial',
      limits: {
        maxDoctors: req.tenant.max_doctors,
        maxAppointmentsMonth: req.tenant.max_appointments_month,
        usedAppointmentsMonth: parseInt(stats.rows[0].month_appointments)
      }
    });
  } catch (err) {
    next(err);
  }
});

// ── APPOINTMENTS ──────────────────────────────────────────

router.get('/appointments', async (req, res, next) => {
  try {
    const { status, date, doctor_id, clinic, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    let where = 'WHERE a.tenant_id = $1';
    const params = [req.tenantId];
    let idx = 2;

    if (status) { where += ` AND a.status = $${idx++}`; params.push(status); }
    if (date) { where += ` AND a.appointment_date = $${idx++}`; params.push(date); }
    if (doctor_id) { where += ` AND a.doctor_id = $${idx++}`; params.push(doctor_id); }
    if (clinic && clinic !== 'all') { where += ` AND (d.clinic = $${idx} OR d.clinic IS NULL)`; idx++; params.push(clinic); }

    // Need JOIN on doctors when filtering by clinic
    const needsDoctorJoin = clinic && clinic !== 'all';

    const [countResult, dataResult] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM appointments a ${needsDoctorJoin ? 'JOIN doctors d ON d.id = a.doctor_id' : ''} ${where}`, params),
      pool.query(`
        SELECT a.*, d.name as doctor_name, p.name as patient_name, p.phone as patient_phone,
               s.name as service_name
        FROM appointments a
        LEFT JOIN doctors d ON d.id = a.doctor_id
        LEFT JOIN patients p ON p.id = a.patient_id
        LEFT JOIN services s ON s.id = a.service_id
        ${where}
        ORDER BY a.appointment_date DESC, a.start_time DESC
        LIMIT $${idx++} OFFSET $${idx++}
      `, [...params, limit, offset])
    ]);

    res.json({
      appointments: dataResult.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      totalPages: Math.ceil(countResult.rows[0].count / limit)
    });
  } catch (err) {
    next(err);
  }
});

router.patch('/appointments/:id/status', async (req, res, next) => {
  try {
    const { status, comment } = req.body;
    const validStatuses = ['confirmed', 'completed', 'cancelled', 'no_show'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Use: ${validStatuses.join(', ')}` });
    }

    // Get full appointment details before updating
    const { rows: apptRows } = await pool.query(
      `SELECT a.*, d.name as doctor_name, p.phone as patient_phone, p.name as patient_name,
              s.name as service_name
       FROM appointments a
       LEFT JOIN doctors d ON d.id = a.doctor_id
       LEFT JOIN patients p ON p.id = a.patient_id
       LEFT JOIN services s ON s.id = a.service_id
       WHERE a.id = $1 AND a.tenant_id = $2`,
      [req.params.id, req.tenantId]
    );
    if (apptRows.length === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    const appt = apptRows[0];

    // Update status + optional comment
    const { rows } = await pool.query(
      `UPDATE appointments SET status = $1, notes = COALESCE($4, notes), updated_at = NOW() 
       WHERE id = $2 AND tenant_id = $3 RETURNING *`,
      [status, req.params.id, req.tenantId, comment || null]
    );

    // Send WhatsApp notification to patient on cancel
    if (status === 'cancelled' && appt.patient_phone && req.tenant?.wa_status === 'connected') {
      try {
        const wa = new WhatsAppService(req.tenant);
        const time = formatTime12(appt.start_time);
        const date = formatDateDD(appt.appointment_date);
        // Try template first (works outside 24h window), fall back to sendText
        const tmplResult = await wa.sendTemplate(appt.patient_phone, 'appointment_cancelled', 'en', [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: appt.patient_name || 'there' },
              { type: 'text', text: appt.doctor_name || 'the doctor' },
              { type: 'text', text: date },
              { type: 'text', text: time },
              { type: 'text', text: req.tenant.business_name },
              { type: 'text', text: comment || 'No reason provided' }
            ]
          }
        ]);
        // Template returned null = failed silently, fall back to plain text
        if (!tmplResult) {
          logger.warn('Cancel template failed, falling back to sendText');
          let msg = `Your appointment with ${appt.doctor_name || 'the doctor'} on ${date} at ${time} has been cancelled by ${req.tenant.business_name}.`;
          if (comment) msg += `\n\nReason: ${comment}`;
          msg += `\n\nReply "book" to schedule a new appointment.`;
          await wa.sendText(appt.patient_phone, msg);
        }
      } catch (waErr) {
        logger.warn('Failed to send cancel notification:', waErr.message);
      }
    }

    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// ── CREATE APPOINTMENT (MANUAL) ───────────────────────────

router.post('/appointments', requireRole('owner', 'admin', 'staff'), async (req, res, next) => {
  try {
    const schema = Joi.object({
      doctorId: Joi.number().required(),
      serviceId: Joi.number().allow(null),
      patientId: Joi.number().allow(null),
      patientName: Joi.string().allow('', null),
      patientPhone: Joi.string().allow('', null),
      appointmentDate: Joi.string().required(),
      startTime: Joi.string().required(),
      endTime: Joi.string().required(),
      notes: Joi.string().allow('', null),
      status: Joi.string().valid('pending', 'confirmed').default('confirmed')
    });

    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      let patientId = value.patientId;

      // Create patient if phone provided but no patientId
      if (!patientId && value.patientPhone) {
        const { rows: existing } = await client.query(
          `SELECT id FROM patients WHERE phone = $1 AND tenant_id = $2`,
          [value.patientPhone, req.tenantId]
        );
        if (existing.length > 0) {
          patientId = existing[0].id;
        } else {
          const { rows: newP } = await client.query(
            `INSERT INTO patients (tenant_id, phone, name) VALUES ($1, $2, $3) RETURNING id`,
            [req.tenantId, value.patientPhone, value.patientName || 'Walk-in']
          );
          patientId = newP[0].id;
        }
      }

      // Check for double-booking
      const { rows: conflict } = await client.query(
        `SELECT id FROM appointments 
         WHERE doctor_id = $1 AND tenant_id = $2 AND appointment_date = $3
         AND status NOT IN ('cancelled', 'rescheduled')
         AND start_time < $5 AND end_time > $4`,
        [value.doctorId, req.tenantId, value.appointmentDate, value.startTime, value.endTime]
      );
      if (conflict.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Time slot already booked' });
      }

      const { rows } = await client.query(
        `INSERT INTO appointments (tenant_id, doctor_id, service_id, patient_id, appointment_date, start_time, end_time, status, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [req.tenantId, value.doctorId, value.serviceId, patientId, value.appointmentDate, value.startTime, value.endTime, value.status, value.notes]
      );

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

// ── APPOINTMENT DETAIL ────────────────────────────────────

router.get('/appointments/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT a.*, d.name as doctor_name, p.name as patient_name, p.phone as patient_phone, p.email as patient_email,
              s.name as service_name, s.duration as service_duration, s.price as service_price
       FROM appointments a
       LEFT JOIN doctors d ON d.id = a.doctor_id
       LEFT JOIN patients p ON p.id = a.patient_id
       LEFT JOIN services s ON s.id = a.service_id
       WHERE a.id = $1 AND a.tenant_id = $2`,
      [req.params.id, req.tenantId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// ── RESCHEDULE APPOINTMENT ────────────────────────────────

router.patch('/appointments/:id/reschedule', requireRole('owner', 'admin', 'staff'), async (req, res, next) => {
  try {
    const { appointmentDate, startTime, endTime, comment } = req.body;
    if (!appointmentDate || !startTime || !endTime) {
      return res.status(400).json({ error: 'Date, startTime, endTime required' });
    }

    const { rows: appt } = await pool.query(
      `SELECT a.*, d.name as doctor_name, p.phone as patient_phone, p.name as patient_name
       FROM appointments a
       LEFT JOIN doctors d ON d.id = a.doctor_id
       LEFT JOIN patients p ON p.id = a.patient_id
       WHERE a.id = $1 AND a.tenant_id = $2`,
      [req.params.id, req.tenantId]
    );
    if (appt.length === 0) return res.status(404).json({ error: 'Not found' });

    // Check conflicts
    const { rows: conflict } = await pool.query(
      `SELECT id FROM appointments 
       WHERE doctor_id = $1 AND tenant_id = $2 AND appointment_date = $3 AND id != $6
       AND status NOT IN ('cancelled', 'rescheduled')
       AND start_time < $5 AND end_time > $4`,
      [appt[0].doctor_id, req.tenantId, appointmentDate, startTime, endTime, req.params.id]
    );
    if (conflict.length > 0) {
      return res.status(409).json({ error: 'Time slot already booked' });
    }

    const { rows } = await pool.query(
      `UPDATE appointments SET appointment_date = $1, start_time = $2, end_time = $3, 
       status = 'confirmed', notes = COALESCE($6, notes), updated_at = NOW()
       WHERE id = $4 AND tenant_id = $5 RETURNING *`,
      [appointmentDate, startTime, endTime, req.params.id, req.tenantId, comment || null]
    );

    // Send WhatsApp notification to patient
    if (appt[0].patient_phone && req.tenant?.wa_status === 'connected') {
      try {
        const wa = new WhatsAppService(req.tenant);
        const oldTime = formatTime12(appt[0].start_time);
        const oldDate = formatDateDD(appt[0].appointment_date);
        const newTime = formatTime12(startTime);
        const newDate = formatDateDD(appointmentDate);
        // Try template first (works outside 24h window), fall back to sendText
        const tmplResult = await wa.sendTemplate(appt[0].patient_phone, 'appointment_rescheduled', 'en', [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: appt[0].patient_name || 'there' },
              { type: 'text', text: appt[0].doctor_name || 'the doctor' },
              { type: 'text', text: req.tenant.business_name },
              { type: 'text', text: oldDate },
              { type: 'text', text: oldTime },
              { type: 'text', text: newDate },
              { type: 'text', text: newTime }
            ]
          }
        ]);
        if (tmplResult) {
          // Template sent — set patient state to handle Accept/Decline
          await pool.query(
            `UPDATE patients SET wa_conversation_state = $1 WHERE phone = $2 AND tenant_id = $3`,
            [JSON.stringify({
              state: 'awaiting_reschedule_response',
              appointmentId: req.params.id,
              newDate: appointmentDate,
              newTime: startTime
            }), appt[0].patient_phone, req.tenantId]
          );
        } else {
          // Template failed — fall back to plain text
          logger.warn('Reschedule template failed, falling back to sendText');
          let msg = `Your appointment with ${appt[0].doctor_name || 'the doctor'} has been rescheduled to ${newDate} at ${newTime} by ${req.tenant.business_name}.`;
          if (comment) msg += `\n\nNote: ${comment}`;
          await wa.sendText(appt[0].patient_phone, msg);
        }
      } catch (waErr) {
        logger.warn('Failed to send reschedule notification:', waErr.message);
      }
    }

    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// ── DOCTORS ───────────────────────────────────────────────

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
    // Check doctor limit
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
    // Soft delete — deactivate and remove future appointments
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE doctors SET is_active = false WHERE id = $1 AND tenant_id = $2`,
        [req.params.id, req.tenantId]
      );
      // Cancel future appointments
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

      // Update slot duration
      if (slotDuration) {
        await client.query(
          `UPDATE doctors SET slot_duration = $1 WHERE id = $2 AND tenant_id = $3`,
          [slotDuration, doctorId, tenantId]
        );
      }

      // Update tenant timezone
      if (timezone) {
        await client.query(
          `UPDATE tenants SET timezone = $1 WHERE id = $2`,
          [timezone, tenantId]
        );
      }

      // Replace availability
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

      // Replace breaks (daily + date-specific blocks)
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

// ── SERVICES ──────────────────────────────────────────────

router.get('/services', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM services WHERE tenant_id = $1 ORDER BY name',
      [req.tenantId]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post('/services', requireRole('owner', 'admin'), async (req, res, next) => {
  try {
    const { name, description, price } = req.body;
    if (!name) return res.status(400).json({ error: 'Service name required' });

    const { rows } = await pool.query(
      `INSERT INTO services (tenant_id, name, description, price)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.tenantId, name, description, price || 0]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.put('/services/:id', requireRole('owner', 'admin'), async (req, res, next) => {
  try {
    const { name, description, price, isActive } = req.body;
    const { rows } = await pool.query(
      `UPDATE services SET 
        name = COALESCE($1, name), description = COALESCE($2, description),
        price = COALESCE($3, price),
        is_active = COALESCE($4, is_active), updated_at = NOW()
       WHERE id = $5 AND tenant_id = $6 RETURNING *`,
      [name, description, price, isActive, req.params.id, req.tenantId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Service not found' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.delete('/services/:id', requireRole('owner', 'admin'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `UPDATE services SET is_active = false, updated_at = NOW() WHERE id = $1 AND tenant_id = $2 RETURNING id`,
      [req.params.id, req.tenantId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Service not found' });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ── PATIENTS ──────────────────────────────────────────────

router.get('/patients', async (req, res, next) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let where = 'WHERE p.tenant_id = $1';
    const params = [req.tenantId];
    let idx = 2;

    if (search) {
      where += ` AND (p.name ILIKE $${idx} OR p.phone ILIKE $${idx})`;
      params.push(`%${search}%`);
      idx++;
    }

    const { rows } = await pool.query(
      `SELECT p.*, 
        (SELECT COUNT(*) FROM appointments WHERE patient_id = p.id AND tenant_id = $1) as total_appointments,
        (SELECT TO_CHAR(MAX(appointment_date), 'DD Mon YYYY') FROM appointments WHERE patient_id = p.id AND tenant_id = $1 AND appointment_date <= CURRENT_DATE AND status NOT IN ('cancelled', 'rescheduled')) as last_visit
       FROM patients p ${where}
       ORDER BY p.created_at DESC LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, limit, offset]
    );

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post('/patients', requireRole('owner', 'admin', 'staff'), async (req, res, next) => {
  try {
    const { name, phone, email } = req.body;
    if (!phone) return res.status(400).json({ error: 'Phone number required' });

    // Check for duplicate phone
    const { rows: existing } = await pool.query(
      `SELECT id FROM patients WHERE phone = $1 AND tenant_id = $2`,
      [phone, req.tenantId]
    );
    if (existing.length > 0) return res.status(409).json({ error: 'Patient with this phone already exists' });

    const { rows } = await pool.query(
      `INSERT INTO patients (tenant_id, name, phone, email) VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.tenantId, name || 'Patient', phone, email]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.put('/patients/:id', requireRole('owner', 'admin', 'staff'), async (req, res, next) => {
  try {
    const { name, email, phone } = req.body;
    const { rows } = await pool.query(
      `UPDATE patients SET name = COALESCE($1, name), email = COALESCE($2, email), phone = COALESCE($3, phone), updated_at = NOW()
       WHERE id = $4 AND tenant_id = $5 RETURNING *`,
      [name, email, phone, req.params.id, req.tenantId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Patient not found' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.get('/patients/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.*,
        (SELECT COUNT(*) FROM appointments WHERE patient_id = p.id AND tenant_id = $2) as total_appointments,
        (SELECT TO_CHAR(MAX(appointment_date), 'DD Mon YYYY') FROM appointments WHERE patient_id = p.id AND tenant_id = $2 AND appointment_date <= CURRENT_DATE AND status NOT IN ('cancelled', 'rescheduled')) as last_visit
       FROM patients p WHERE p.id = $1 AND p.tenant_id = $2`,
      [req.params.id, req.tenantId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });

    // Get appointment history
    const { rows: appts } = await pool.query(
      `SELECT a.id, TO_CHAR(a.appointment_date, 'DD Mon YYYY') as appointment_date, a.start_time, a.end_time, a.status, d.name as doctor_name, s.name as service_name
       FROM appointments a
       LEFT JOIN doctors d ON d.id = a.doctor_id
       LEFT JOIN services s ON s.id = a.service_id
       WHERE a.patient_id = $1 AND a.tenant_id = $2
       ORDER BY a.appointment_date DESC LIMIT 20`,
      [req.params.id, req.tenantId]
    );

    res.json({ ...rows[0], appointments: appts });
  } catch (err) {
    next(err);
  }
});

// ── CHAT HISTORY ──────────────────────────────────────────

router.get('/chats/:patientId', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM chat_messages 
       WHERE tenant_id = $1 AND patient_id = $2
       ORDER BY created_at DESC LIMIT 100`,
      [req.tenantId, req.params.patientId]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// ── SETTINGS ──────────────────────────────────────────────

router.get('/settings', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT business_name, business_type, email, phone, address, city, timezone,
              logo_url, wa_phone_number, wa_status, onboarding_status, 
              features, settings, max_doctors, max_appointments_month
       FROM tenants WHERE id = $1`,
      [req.tenantId]
    );
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.patch('/settings', requireRole('owner', 'admin'), async (req, res, next) => {
  try {
    const allowed = ['business_name', 'phone', 'address', 'city', 'timezone', 'settings'];
    const updates = [];
    const values = [];
    let idx = 1;

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        updates.push(`${key} = $${idx++}`);
        values.push(key === 'settings' ? JSON.stringify(req.body[key]) : req.body[key]);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    values.push(req.tenantId);
    const { rows } = await pool.query(
      `UPDATE tenants SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $${idx} RETURNING *`,
      values
    );

    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// ── WHATSAPP CONNECTION ────────────────────────────────────

router.patch('/whatsapp', requireRole('owner', 'admin'), async (req, res, next) => {
  try {
    const schema = Joi.object({
      phoneNumberId: Joi.string().required(),
      businessAccountId: Joi.string().required(),
      accessToken: Joi.string().required(),
      displayPhone: Joi.string().required()
    });

    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    // Verify credentials with Meta API
    try {
      const verifyResp = await axios.get(
        `https://graph.facebook.com/v21.0/${value.phoneNumberId}`,
        { headers: { Authorization: `Bearer ${value.accessToken}` } }
      );
      if (!verifyResp.data?.id) {
        return res.status(400).json({ error: 'Invalid WhatsApp credentials' });
      }
    } catch (verifyErr) {
      logger.error('WA credential verification failed:', verifyErr.response?.data);
      return res.status(400).json({
        error: 'Could not verify WhatsApp credentials',
        details: verifyErr.response?.data?.error?.message
      });
    }

    // Check if phone number is used by another tenant
    const { rows: existing } = await pool.query(
      'SELECT tenant_id FROM wa_number_registry WHERE wa_phone_number_id = $1',
      [value.phoneNumberId]
    );
    if (existing.length > 0 && existing[0].tenant_id !== req.tenantId) {
      return res.status(409).json({ error: 'This WhatsApp number is already connected to another business' });
    }

    // Update tenant
    await pool.query(
      `UPDATE tenants SET
        wa_phone_number_id = $1, wa_business_account_id = $2,
        wa_access_token = $3, wa_phone_number = $4,
        wa_status = 'connected', updated_at = NOW()
       WHERE id = $5`,
      [value.phoneNumberId, value.businessAccountId, value.accessToken, value.displayPhone, req.tenantId]
    );

    // Upsert phone number registry
    await pool.query(
      `INSERT INTO wa_number_registry (wa_phone_number_id, tenant_id, phone_number)
       VALUES ($1, $2, $3)
       ON CONFLICT (wa_phone_number_id)
       DO UPDATE SET tenant_id = $2, phone_number = $3, is_active = true`,
      [value.phoneNumberId, req.tenantId, value.displayPhone]
    );

    logger.info(`WhatsApp updated for tenant ${req.tenantId}: ${value.displayPhone}`);
    res.json({ success: true, message: 'WhatsApp connection updated!' });
  } catch (err) {
    next(err);
  }
});

// ── TEAM MANAGEMENT ───────────────────────────────────────

router.get('/team', requireRole('owner', 'admin'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, email, name, role, is_active, created_at 
       FROM tenant_users WHERE tenant_id = $1 ORDER BY created_at`,
      [req.tenantId]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post('/team', requireRole('owner'), async (req, res, next) => {
  try {
    const { email, name, password, role } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const validRoles = ['admin', 'staff', 'doctor'];
    if (role && !validRoles.includes(role)) {
      return res.status(400).json({ error: `Invalid role. Use: ${validRoles.join(', ')}` });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      `INSERT INTO tenant_users (tenant_id, email, password_hash, name, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, name, role, created_at`,
      [req.tenantId, email, passwordHash, name, role || 'staff']
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.constraint) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }
    next(err);
  }
});

router.put('/team/:id', requireRole('owner'), async (req, res, next) => {
  try {
    const { name, role, isActive } = req.body;
    const validRoles = ['admin', 'staff', 'doctor'];
    if (role && !validRoles.includes(role)) {
      return res.status(400).json({ error: `Invalid role. Use: ${validRoles.join(', ')}` });
    }
    const { rows } = await pool.query(
      `UPDATE tenant_users SET name = COALESCE($1, name), role = COALESCE($2, role), is_active = COALESCE($3, is_active)
       WHERE id = $4 AND tenant_id = $5 AND role != 'owner' RETURNING id, email, name, role, is_active`,
      [name, role, isActive, req.params.id, req.tenantId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Team member not found or cannot modify owner' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.delete('/team/:id', requireRole('owner'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `DELETE FROM tenant_users WHERE id = $1 AND tenant_id = $2 AND role != 'owner' RETURNING id`,
      [req.params.id, req.tenantId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Team member not found or cannot delete owner' });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ── Helpers ───────────────────────────────────────────────
function formatTime12(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.toString().split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour12}:${(m || 0).toString().padStart(2, '0')} ${period}`;
}

function formatDateDD(dateVal) {
  if (!dateVal) return '';
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const d = new Date(dateVal);
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

module.exports = router;
