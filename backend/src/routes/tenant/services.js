// ── Service Routes ────────────────────────────────────────
const express = require('express');
const router = express.Router();
const pool = require('../../db/pool');
const { requireRole } = require('../../middleware/auth');

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
        is_active = COALESCE($4, is_active)
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
      `UPDATE services SET is_active = false WHERE id = $1 AND tenant_id = $2 RETURNING id`,
      [req.params.id, req.tenantId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Service not found' });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
