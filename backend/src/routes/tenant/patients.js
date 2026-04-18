// ── Patient Routes ────────────────────────────────────────
const express = require('express');
const router = express.Router();
const pool = require('../../db/pool');
const { requireRole } = require('../../middleware/auth');

router.get('/patients', async (req, res, next) => {
  try {
    const { search, page = 1, limit = 30, sort = 'recent' } = req.query;
    const offset = (page - 1) * limit;

    let where = 'WHERE p.tenant_id = $1';
    const params = [req.tenantId];
    let idx = 2;

    if (search) {
      where += ` AND (p.name ILIKE $${idx} OR p.phone ILIKE $${idx})`;
      params.push(`%${search}%`);
      idx++;
    }

    const countParams = [...params];
    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*) FROM patients p ${where}`, countParams
    );
    const total = parseInt(countRows[0].count, 10);

    let orderBy = 'p.created_at DESC';
    if (sort === 'name') orderBy = 'p.name ASC NULLS LAST';
    else if (sort === 'visits') orderBy = 'total_appointments DESC';
    else if (sort === 'last_visit') orderBy = 'last_visit_raw DESC NULLS LAST';

    const { rows } = await pool.query(
      `SELECT p.*, 
        (SELECT COUNT(*) FROM appointments WHERE patient_id = p.id AND tenant_id = $1) as total_appointments,
        (SELECT TO_CHAR(MAX(appointment_date), 'DD Mon YYYY') FROM appointments WHERE patient_id = p.id AND tenant_id = $1 AND appointment_date <= CURRENT_DATE AND status NOT IN ('cancelled', 'rescheduled')) as last_visit,
        (SELECT MAX(appointment_date) FROM appointments WHERE patient_id = p.id AND tenant_id = $1 AND appointment_date <= CURRENT_DATE AND status NOT IN ('cancelled', 'rescheduled')) as last_visit_raw
       FROM patients p ${where}
       ORDER BY ${orderBy} LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, parseInt(limit), offset]
    );

    res.json({ patients: rows, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    next(err);
  }
});

router.post('/patients', requireRole('owner', 'admin', 'staff'), async (req, res, next) => {
  try {
    const { name, phone, email } = req.body;
    if (!phone) return res.status(400).json({ error: 'Phone number required' });

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

module.exports = router;
