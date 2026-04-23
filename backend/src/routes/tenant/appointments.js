// ============================================================
// Appointment Routes — Booking CRUD & Management
// ============================================================
// 6 routes: list, create, update status, reschedule, follow-up,
// and single appointment detail. Supports pagination, filters,
// WhatsApp notifications on booking/cancellation, and
// appointment limit enforcement per tenant plan.

const express = require('express');
const router = express.Router();
const Joi = require('joi');
const pool = require('../../db/pool');
const { requireRole } = require('../../middleware/auth');
const { checkAppointmentLimit } = require('../../middleware/tenantContext');
const logger = require('../../utils/logger');
const WhatsAppService = require('../../services/whatsapp');
const { formatTime12, formatDateDD } = require('./helpers');

router.get('/appointments', async (req, res, next) => {
  try {
    const { status, date, doctor_id, clinic, hideCancelled, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    let where = 'WHERE a.tenant_id = $1';
    const params = [req.tenantId];
    let idx = 2;

    if (status) { where += ` AND a.status = $${idx++}`; params.push(status); }
    else if (hideCancelled === 'true') { where += ` AND a.status != 'cancelled'`; }
    if (date) { where += ` AND a.appointment_date = $${idx++}`; params.push(date); }
    if (doctor_id) { where += ` AND a.doctor_id = $${idx++}`; params.push(doctor_id); }
    if (clinic && clinic !== 'all') { where += ` AND (EXISTS (SELECT 1 FROM doctor_clinics dc WHERE dc.doctor_id = a.doctor_id AND dc.clinic_label = $${idx}) OR NOT EXISTS (SELECT 1 FROM doctor_clinics dc2 WHERE dc2.doctor_id = a.doctor_id))`; idx++; params.push(clinic); }

    const [countResult, dataResult] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM appointments a ${where}`, params),
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

    const { rows } = await pool.query(
      `UPDATE appointments SET status = $1, notes = COALESCE($4, notes), updated_at = NOW() 
       WHERE id = $2 AND tenant_id = $3 RETURNING *`,
      [status, req.params.id, req.tenantId, comment || null]
    );

    // Send WhatsApp notification to patient on confirm
    if (status === 'confirmed' && appt.patient_phone && req.tenant?.wa_status === 'connected') {
      try {
        const wa = new WhatsAppService(req.tenant);
        const time = formatTime12(appt.start_time);
        const date = formatDateDD(appt.appointment_date);
        const locationLine = req.tenant.settings?.google_maps_url
          ? `\n📍 Location: ${req.tenant.settings.google_maps_url}\n` : '';
        await wa.sendText(appt.patient_phone,
          `✅ *Appointment Confirmed*\n\n` +
          `👨‍⚕️ ${appt.doctor_name || 'Doctor'}\n` +
          `📅 ${date} at ${time}\n` +
          locationLine +
          `\nYour appointment has been confirmed by ${req.tenant.business_name}. See you there!`
        );
      } catch (waErr) {
        logger.warn('Failed to send confirm notification:', waErr.message);
      }
    }

    // Send WhatsApp notification to patient on cancel
    if (status === 'cancelled' && appt.patient_phone && req.tenant?.wa_status === 'connected') {
      try {
        const wa = new WhatsAppService(req.tenant);
        const time = formatTime12(appt.start_time);
        const date = formatDateDD(appt.appointment_date);
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

router.post('/appointments', requireRole('owner', 'admin', 'staff'), checkAppointmentLimit, async (req, res, next) => {
  try {
    const schema = Joi.object({
      doctorId: Joi.string().required(),
      serviceId: Joi.string().allow(null, ''),
      patientId: Joi.string().allow(null, ''),
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

      const newAppt = rows[0];

      // Notify doctor
      if (req.tenant?.wa_status === 'connected') {
        try {
          const { rows: docRow } = await pool.query(
            `SELECT phone, name FROM doctors WHERE id = $1 AND tenant_id = $2`,
            [value.doctorId, req.tenantId]
          );
          const doctorPhone = docRow[0]?.phone;
          if (doctorPhone) {
            const wa = new WhatsAppService(req.tenant);
            const pName = value.patientName || 'Walk-in';
            await wa.sendText(doctorPhone,
              `📋 *New Appointment Booked*\n\n` +
              `Patient: ${pName}\n` +
              `📅 ${formatDateDD(value.appointmentDate)}\n` +
              `🕐 ${formatTime12(value.startTime)}\n\n` +
              `Booked via dashboard by ${req.user?.name || 'staff'}.`
            );
          }
        } catch (waErr) {
          logger.warn('Failed to notify doctor on manual booking:', waErr.message);
        }

        // Notify patient
        const patientPhone = value.patientPhone || null;
        if (patientPhone) {
          try {
            const wa = new WhatsAppService(req.tenant);
            const { rows: docRow2 } = await pool.query(
              `SELECT name FROM doctors WHERE id = $1 AND tenant_id = $2`,
              [value.doctorId, req.tenantId]
            );
            const docName = docRow2[0]?.name || 'Doctor';
            const locationLine = req.tenant.settings?.google_maps_url
              ? `\n📍 Location: ${req.tenant.settings.google_maps_url}\n` : '';
            await wa.sendText(patientPhone,
              `✅ *Appointment Confirmed*\n\n` +
              `Hi ${value.patientName || 'there'}, your appointment has been booked:\n\n` +
              `👨‍⚕️ ${docName}\n` +
              `📅 ${formatDateDD(value.appointmentDate)}\n` +
              `🕐 ${formatTime12(value.startTime)}\n` +
              locationLine +
              `\nYou'll receive a reminder before your appointment.\n` +
              `— ${req.tenant.business_name}`
            );
          } catch (waErr) {
            logger.warn('Failed to notify patient on manual booking:', waErr.message);
          }
        }
      }

      res.status(201).json(newAppt);
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

    if (appt[0].patient_phone && req.tenant?.wa_status === 'connected') {
      try {
        const wa = new WhatsAppService(req.tenant);
        const oldTime = formatTime12(appt[0].start_time);
        const oldDate = formatDateDD(appt[0].appointment_date);
        const newTime = formatTime12(startTime);
        const newDate = formatDateDD(appointmentDate);
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

// ── FOLLOW-UP APPOINTMENT ─────────────────────────────────

router.post('/appointments/:id/followup', requireRole('owner', 'admin', 'staff'), checkAppointmentLimit, async (req, res, next) => {
  try {
    const { appointmentDate, startTime, endTime, notes } = req.body;
    if (!appointmentDate || !startTime || !endTime) {
      return res.status(400).json({ error: 'Date, startTime, endTime required' });
    }

    const { rows: appt } = await pool.query(
      `SELECT a.*, d.name as doctor_name, p.phone as patient_phone, p.name as patient_name,
              s.name as service_name
       FROM appointments a
       LEFT JOIN doctors d ON d.id = a.doctor_id
       LEFT JOIN patients p ON p.id = a.patient_id
       LEFT JOIN services s ON s.id = a.service_id
       WHERE a.id = $1 AND a.tenant_id = $2`,
      [req.params.id, req.tenantId]
    );
    if (appt.length === 0) return res.status(404).json({ error: 'Appointment not found' });

    const orig = appt[0];

    const { rows: conflict } = await pool.query(
      `SELECT id FROM appointments 
       WHERE doctor_id = $1 AND tenant_id = $2 AND appointment_date = $3
       AND status NOT IN ('cancelled', 'rescheduled')
       AND start_time < $5 AND end_time > $4`,
      [orig.doctor_id, req.tenantId, appointmentDate, startTime, endTime]
    );
    if (conflict.length > 0) {
      return res.status(409).json({ error: 'Time slot already booked' });
    }

    const { rows } = await pool.query(
      `INSERT INTO appointments (tenant_id, patient_id, doctor_id, service_id,
       appointment_date, start_time, end_time, status, notes, rescheduled_from)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'confirmed', $8, $9) RETURNING *`,
      [req.tenantId, orig.patient_id, orig.doctor_id, orig.service_id,
       appointmentDate, startTime, endTime, notes || `Follow-up from ${orig.appointment_date}`, req.params.id]
    );

    const newAppt = rows[0];

    // Create reminders
    const appointmentDateTime = new Date(`${appointmentDate}T${startTime}`);
    const now = new Date();
    const remind24h = new Date(appointmentDateTime); remind24h.setHours(remind24h.getHours() - 24);
    const remind1h = new Date(appointmentDateTime); remind1h.setHours(remind1h.getHours() - 1);
    const reminders = [];
    if (remind24h > now) reminders.push({ time: remind24h, type: '24h' });
    if (remind1h > now) reminders.push({ time: remind1h, type: '1h' });
    if (reminders.length > 0) {
      const vals = reminders.map((_, i) => `($1, $2, $${i*2+3}, $${i*2+4})`).join(', ');
      const params = [req.tenantId, newAppt.id];
      reminders.forEach(r => { params.push(r.time, r.type); });
      await pool.query(`INSERT INTO reminders (tenant_id, appointment_id, remind_at, type) VALUES ${vals}`, params);
    }

    // Notify patient
    if (orig.patient_phone && req.tenant?.wa_status === 'connected') {
      try {
        const wa = new WhatsAppService(req.tenant);
        const date = formatDateDD(appointmentDate);
        const time = formatTime12(startTime);
        await wa.sendText(orig.patient_phone,
          `📋 *Follow-up Appointment Scheduled*\n\n` +
          `Hi ${orig.patient_name || 'there'}, your doctor has scheduled a follow-up visit:\n\n` +
          `👨‍⚕️ ${orig.doctor_name || 'Doctor'}\n` +
          `📅 ${date}\n` +
          `🕐 ${time}\n\n` +
          `If you need to reschedule, reply "reschedule".\n` +
          `— ${req.tenant.business_name}`
        );
      } catch (waErr) {
        logger.warn('Failed to send follow-up notification:', waErr.message);
      }
    }

    res.status(201).json(newAppt);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
