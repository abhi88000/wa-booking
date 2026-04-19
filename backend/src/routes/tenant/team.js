// ============================================================
// Team Routes — User Management (RBAC)
// ============================================================
// 4 routes: list, create, update, delete team members.
// Roles: owner (cannot be modified), admin, staff, doctor.
// Only owners can create/modify/delete team members.

const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const pool = require('../../db/pool');
const { requireRole } = require('../../middleware/auth');

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

module.exports = router;
