// ── Records Routes ────────────────────────────────────────
const express = require('express');
const router = express.Router();
const pool = require('../../db/pool');
const { requireRole } = require('../../middleware/auth');

// List records (with type filter, search, pagination)
router.get('/records', async (req, res, next) => {
  try {
    const { type, status, search, page = 1, limit = 30 } = req.query;
    const offset = (page - 1) * limit;
    let where = 'WHERE tenant_id = $1';
    const params = [req.tenantId];
    let idx = 2;

    if (type) { where += ` AND record_type = $${idx++}`; params.push(type); }
    if (status) { where += ` AND status = $${idx++}`; params.push(status); }
    if (search) { where += ` AND (phone ILIKE $${idx} OR data::text ILIKE $${idx})`; params.push(`%${search}%`); idx++; }

    const countResult = await pool.query(`SELECT COUNT(*) FROM tenant_records ${where}`, params);
    params.push(Number(limit), Number(offset));
    const { rows } = await pool.query(
      `SELECT * FROM tenant_records ${where} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx}`,
      params
    );

    res.json({
      records: rows,
      total: parseInt(countResult.rows[0].count),
      page: Number(page),
      totalPages: Math.ceil(countResult.rows[0].count / limit)
    });
  } catch (err) { next(err); }
});

// Get single record
router.get('/records/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM tenant_records WHERE id = $1 AND tenant_id = $2',
      [req.params.id, req.tenantId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Record not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// Update record status
router.patch('/records/:id', requireRole('owner', 'admin', 'staff'), async (req, res, next) => {
  try {
    const { status, assigned_to, data } = req.body;
    const updates = [];
    const params = [];
    let idx = 1;

    if (status) { updates.push(`status = $${idx++}`); params.push(status); }
    if (assigned_to !== undefined) { updates.push(`assigned_to = $${idx++}`); params.push(assigned_to); }
    if (data) { updates.push(`data = data || $${idx++}::jsonb`); params.push(JSON.stringify(data)); }

    if (updates.length === 0) return res.status(400).json({ error: 'Nothing to update' });

    updates.push(`updated_at = NOW()`);
    params.push(req.params.id, req.tenantId);

    const { rows } = await pool.query(
      `UPDATE tenant_records SET ${updates.join(', ')} WHERE id = $${idx++} AND tenant_id = $${idx} RETURNING *`,
      params
    );
    if (!rows.length) return res.status(404).json({ error: 'Record not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// Delete record
router.delete('/records/:id', requireRole('owner', 'admin'), async (req, res, next) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM tenant_records WHERE id = $1 AND tenant_id = $2',
      [req.params.id, req.tenantId]
    );
    if (!rowCount) return res.status(404).json({ error: 'Record not found' });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// Get record type summary (counts per type)
router.get('/records-summary', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT record_type, status, COUNT(*)::int as count
       FROM tenant_records WHERE tenant_id = $1
       GROUP BY record_type, status ORDER BY record_type, status`,
      [req.tenantId]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

module.exports = router;
