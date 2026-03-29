// ============================================================
// Tenant Admin Routes — Each Business's Dashboard API
// ============================================================
// Every request here is scoped to the authenticated tenant

const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const Joi = require('joi');
const pool = require('../db/pool');
const { authTenant, requireRole } = require('../middleware/auth');
const { loadTenantContext, requireFeature, checkAppointmentLimit } = require('../middleware/tenantContext');
const logger = require('../utils/logger');

// All tenant routes require auth + tenant context
router.use(authTenant, loadTenantContext);

// ── DASHBOARD ─────────────────────────────────────────────

router.get('/dashboard', async (req, res, next) => {
  try {
    const tid = req.tenantId;

    const [stats, recent, todayAppts] = await Promise.all([
      pool.query(`
        SELECT 
          (SELECT COUNT(*) FROM appointments WHERE tenant_id = $1 AND status = 'confirmed' AND appointment_date >= CURRENT_DATE) as upcoming,
          (SELECT COUNT(*) FROM appointments WHERE tenant_id = $1 AND appointment_date = CURRENT_DATE AND status NOT IN ('cancelled', 'rescheduled')) as today,
          (SELECT COUNT(*) FROM patients WHERE tenant_id = $1) as total_patients,
          (SELECT COUNT(*) FROM appointments WHERE tenant_id = $1 AND EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM NOW())) as month_appointments,
          (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE tenant_id = $1 AND status = 'paid' AND EXTRACT(MONTH FROM paid_at) = EXTRACT(MONTH FROM NOW())) as month_revenue
      `, [tid]),
      pool.query(`
        SELECT a.id, a.appointment_date, a.start_time, a.status, 
               d.name as doctor_name, p.name as patient_name, p.phone as patient_phone
        FROM appointments a
        LEFT JOIN doctors d ON d.id = a.doctor_id
        LEFT JOIN patients p ON p.id = a.patient_id
        WHERE a.tenant_id = $1 AND a.appointment_date >= CURRENT_DATE
        ORDER BY a.appointment_date, a.start_time LIMIT 10
      `, [tid]),
      pool.query(`
        SELECT a.*, d.name as doctor_name, p.name as patient_name
        FROM appointments a
        LEFT JOIN doctors d ON d.id = a.doctor_id
        LEFT JOIN patients p ON p.id = a.patient_id
        WHERE a.tenant_id = $1 AND a.appointment_date = CURRENT_DATE
        ORDER BY a.start_time
      `, [tid])
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
    const { status, date, doctor_id, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    let where = 'WHERE a.tenant_id = $1';
    const params = [req.tenantId];
    let idx = 2;

    if (status) { where += ` AND a.status = $${idx++}`; params.push(status); }
    if (date) { where += ` AND a.appointment_date = $${idx++}`; params.push(date); }
    if (doctor_id) { where += ` AND a.doctor_id = $${idx++}`; params.push(doctor_id); }

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
    const { status } = req.body;
    const validStatuses = ['confirmed', 'completed', 'cancelled', 'no_show'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Use: ${validStatuses.join(', ')}` });
    }

    const { rows } = await pool.query(
      `UPDATE appointments SET status = $1, updated_at = NOW() 
       WHERE id = $2 AND tenant_id = $3 RETURNING *`,
      [status, req.params.id, req.tenantId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
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
        `INSERT INTO doctors (tenant_id, name, specialization, phone, email, consultation_fee, slot_duration)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [req.tenantId, value.name, value.specialization, value.phone, value.email, value.consultationFee, value.slotDuration]
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
    const { name, specialization, phone, email, consultationFee, slotDuration, isActive } = req.body;
    const { rows } = await pool.query(
      `UPDATE doctors SET 
        name = COALESCE($1, name), specialization = COALESCE($2, specialization),
        phone = COALESCE($3, phone), email = COALESCE($4, email),
        consultation_fee = COALESCE($5, consultation_fee), 
        slot_duration = COALESCE($6, slot_duration),
        is_active = COALESCE($7, is_active)
       WHERE id = $8 AND tenant_id = $9 RETURNING *`,
      [name, specialization, phone, email, consultationFee, slotDuration, isActive, req.params.id, req.tenantId]
    );

    if (rows.length === 0) return res.status(404).json({ error: 'Doctor not found' });
    res.json(rows[0]);
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
    const { name, description, duration, price } = req.body;
    if (!name) return res.status(400).json({ error: 'Service name required' });

    const { rows } = await pool.query(
      `INSERT INTO services (tenant_id, name, description, duration, price)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.tenantId, name, description, duration || 30, price || 0]
    );
    res.status(201).json(rows[0]);
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
        (SELECT MAX(appointment_date) FROM appointments WHERE patient_id = p.id AND tenant_id = $1) as last_visit
       FROM patients p ${where}
       ORDER BY p.created_at DESC LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, limit, offset]
    );

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// ── PAYMENTS ──────────────────────────────────────────────

router.get('/payments', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT pay.*, p.name as patient_name, p.phone as patient_phone,
              a.appointment_date, d.name as doctor_name
       FROM payments pay
       LEFT JOIN patients p ON p.id = pay.patient_id
       LEFT JOIN appointments a ON a.id = pay.appointment_id
       LEFT JOIN doctors d ON d.id = a.doctor_id
       WHERE pay.tenant_id = $1
       ORDER BY pay.created_at DESC LIMIT 50`,
      [req.tenantId]
    );
    res.json(rows);
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

module.exports = router;
