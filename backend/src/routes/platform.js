// ============================================================
// Platform Admin Routes (Super Admin — YOUR team)
// ============================================================
// Manage all tenants, billing, analytics from a single panel

const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { authPlatform } = require('../middleware/auth');
const logger = require('../utils/logger');

// All platform routes require super admin auth
router.use(authPlatform);

// ── Platform Dashboard ────────────────────────────────────
router.get('/dashboard', async (req, res, next) => {
  try {
    const { rows: stats } = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM tenants) as total_tenants,
        (SELECT COUNT(*) FROM tenants WHERE is_active = true) as active_tenants,
        (SELECT COUNT(*) FROM tenants WHERE onboarding_status = 'active') as live_tenants,
        (SELECT COUNT(*) FROM tenants WHERE created_at >= NOW() - INTERVAL '30 days') as new_tenants_30d,
        (SELECT COUNT(*) FROM subscriptions WHERE status = 'active') as paid_subs,
        (SELECT COUNT(*) FROM subscriptions WHERE status = 'trial') as trial_subs,
        (SELECT COALESCE(SUM(amount), 0) FROM invoices WHERE status = 'paid' AND EXTRACT(MONTH FROM paid_at) = EXTRACT(MONTH FROM NOW())) as mrr,
        (SELECT COUNT(*) FROM appointments WHERE created_at >= NOW() - INTERVAL '24 hours') as appointments_24h,
        (SELECT COUNT(DISTINCT tenant_id) FROM appointments WHERE created_at >= NOW() - INTERVAL '24 hours') as active_tenants_24h
    `);

    res.json(stats.rows ? stats.rows[0] : stats[0]);
  } catch (err) {
    next(err);
  }
});

// ── List All Tenants ──────────────────────────────────────
router.get('/tenants', async (req, res, next) => {
  try {
    const { status, search, plan, page = 1, limit = 25 } = req.query;
    const offset = (page - 1) * limit;
    let where = 'WHERE 1=1';
    const params = [];
    let idx = 1;

    if (status === 'active') { where += ' AND t.is_active = true'; }
    if (status === 'inactive') { where += ' AND t.is_active = false'; }
    if (search) { 
      where += ` AND (t.business_name ILIKE $${idx} OR t.email ILIKE $${idx})`; 
      params.push(`%${search}%`); idx++; 
    }
    if (plan) { where += ` AND s.plan = $${idx++}`; params.push(plan); }

    const { rows } = await pool.query(
      `SELECT t.id, t.business_name, t.slug, t.email, t.phone, t.city, 
              t.business_type, t.wa_status, t.onboarding_status, t.is_active,
              t.created_at,
              s.plan, s.status as sub_status, s.trial_ends_at,
              (SELECT COUNT(*) FROM appointments WHERE tenant_id = t.id) as total_appointments,
              (SELECT COUNT(*) FROM patients WHERE tenant_id = t.id) as total_patients,
              (SELECT COUNT(*) FROM doctors WHERE tenant_id = t.id) as total_doctors
       FROM tenants t
       LEFT JOIN subscriptions s ON s.tenant_id = t.id
       ${where}
       ORDER BY t.created_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, limit, offset]
    );

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM tenants t LEFT JOIN subscriptions s ON s.tenant_id = t.id ${where}`,
      params
    );

    res.json({
      tenants: rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      totalPages: Math.ceil(countResult.rows[0].count / limit)
    });
  } catch (err) {
    next(err);
  }
});

// ── Get Single Tenant Details ─────────────────────────────
router.get('/tenants/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT t.*, 
        s.plan, s.status as sub_status, s.trial_ends_at, s.amount as sub_amount,
        (SELECT COUNT(*) FROM appointments WHERE tenant_id = t.id) as total_appointments,
        (SELECT COUNT(*) FROM patients WHERE tenant_id = t.id) as total_patients,
        (SELECT COUNT(*) FROM doctors WHERE tenant_id = t.id AND is_active = true) as active_doctors
       FROM tenants t
       LEFT JOIN subscriptions s ON s.tenant_id = t.id
       WHERE t.id = $1`,
      [req.params.id]
    );

    if (rows.length === 0) return res.status(404).json({ error: 'Tenant not found' });
    
    // Don't expose raw access token
    rows[0].wa_access_token = rows[0].wa_access_token ? '***' : null;
    
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// ── Toggle Tenant Active/Inactive ─────────────────────────
router.patch('/tenants/:id/toggle', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `UPDATE tenants SET is_active = NOT is_active, updated_at = NOW()
       WHERE id = $1 RETURNING id, business_name, is_active`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Tenant not found' });

    logger.info(`Tenant ${rows[0].id} toggled: is_active=${rows[0].is_active}`);
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// ── Update Tenant Plan/Limits ─────────────────────────────
router.patch('/tenants/:id/plan', async (req, res, next) => {
  try {
    const { plan, maxDoctors, maxAppointmentsMonth } = req.body;
    
    if (plan) {
      await pool.query(
        `UPDATE subscriptions SET plan = $1, status = 'active', updated_at = NOW()
         WHERE tenant_id = $2`,
        [plan, req.params.id]
      );
    }

    if (maxDoctors || maxAppointmentsMonth) {
      const updates = [];
      const values = [];
      let idx = 1;
      if (maxDoctors) { updates.push(`max_doctors = $${idx++}`); values.push(maxDoctors); }
      if (maxAppointmentsMonth) { updates.push(`max_appointments_month = $${idx++}`); values.push(maxAppointmentsMonth); }
      values.push(req.params.id);
      
      await pool.query(
        `UPDATE tenants SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${idx}`,
        values
      );
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ── Platform Analytics ────────────────────────────────────
router.get('/analytics', async (req, res, next) => {
  try {
    // Signups per day (last 30 days)
    const signups = await pool.query(`
      SELECT DATE(created_at) as date, COUNT(*) as signups
      FROM tenants WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at) ORDER BY date
    `);

    // Revenue per month
    const revenue = await pool.query(`
      SELECT DATE_TRUNC('month', paid_at) as month, SUM(amount) as revenue
      FROM invoices WHERE status = 'paid' AND paid_at >= NOW() - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', paid_at) ORDER BY month
    `);

    // Plan distribution
    const plans = await pool.query(`
      SELECT s.plan, COUNT(*) as count
      FROM subscriptions s
      JOIN tenants t ON t.id = s.tenant_id AND t.is_active = true
      GROUP BY s.plan
    `);

    // Top tenants by appointments
    const topTenants = await pool.query(`
      SELECT t.business_name, t.city, COUNT(a.id) as appointments
      FROM tenants t
      JOIN appointments a ON a.tenant_id = t.id
      WHERE a.created_at >= NOW() - INTERVAL '30 days'
      GROUP BY t.id, t.business_name, t.city
      ORDER BY appointments DESC LIMIT 10
    `);

    res.json({
      signups: signups.rows,
      revenue: revenue.rows,
      planDistribution: plans.rows,
      topTenants: topTenants.rows
    });
  } catch (err) {
    next(err);
  }
});

// ── HEALTH MONITORING ─────────────────────────────────────
// Returns health status for all active tenants in one call

const tenantHealth = require('../services/tenantHealth');

router.get('/health', async (req, res, next) => {
  try {
    const results = await tenantHealth.checkAll();
    
    const summary = {
      total: results.length,
      healthy: results.filter(r => r.status === 'healthy').length,
      warning: results.filter(r => r.status === 'warning').length,
      critical: results.filter(r => r.status === 'critical').length
    };

    res.json({ summary, tenants: results });
  } catch (err) {
    next(err);
  }
});

// Health check for a single tenant
router.get('/health/:tenantId', async (req, res, next) => {
  try {
    const report = await tenantHealth.checkOne(req.params.tenantId);
    res.json(report);
  } catch (err) {
    next(err);
  }
});

// Validate a tenant's WhatsApp token (live API call to Meta)
router.post('/health/:tenantId/validate-wa', async (req, res, next) => {
  try {
    const result = await tenantHealth.validateWAToken(req.params.tenantId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// View recent errors for a tenant
router.get('/errors/:tenantId', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT id, action, entity_type, details, created_at
      FROM audit_log
      WHERE tenant_id = $1 AND action LIKE '%error%'
      ORDER BY created_at DESC
      LIMIT 50
    `, [req.params.tenantId]);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Force reset stuck conversations for a tenant
router.post('/fix/:tenantId/reset-conversations', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      UPDATE patients SET 
        wa_conversation_state = '{"state": "idle", "auto_reset": true}',
        updated_at = NOW()
      WHERE tenant_id = $1
        AND wa_conversation_state->>'state' NOT IN ('new', 'idle', '')
        AND updated_at < NOW() - INTERVAL '2 hours'
      RETURNING id, phone
    `, [req.params.tenantId]);
    
    res.json({ fixed: rows.length, patients: rows });
  } catch (err) {
    next(err);
  }
});

// ── Reset Tenant User Password ────────────────────────────
const bcrypt = require('bcrypt');

router.post('/tenants/:id/reset-password', async (req, res, next) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const { rows: users } = await pool.query(
      `SELECT id, email FROM tenant_users WHERE tenant_id = $1 AND role = 'owner' LIMIT 1`,
      [req.params.id]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'No owner user found for this tenant' });
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query(
      `UPDATE tenant_users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
      [hash, users[0].id]
    );

    logger.info(`Password reset for tenant ${req.params.id} user ${users[0].email} by platform admin`);
    res.json({ success: true, email: users[0].email });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
