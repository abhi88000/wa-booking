// ============================================================
// Platform Admin Routes (Super Admin — YOUR team)
// ============================================================
// Manage all tenants, billing, analytics from a single panel

const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
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
        (SELECT COUNT(*) FROM appointments WHERE created_at >= NOW() - INTERVAL '24 hours') as appointments_24h,
        (SELECT COUNT(DISTINCT tenant_id) FROM appointments WHERE created_at >= NOW() - INTERVAL '24 hours') as active_tenants_24h
    `);

    res.json(stats[0]);
  } catch (err) {
    next(err);
  }
});

// ── List All Tenants ──────────────────────────────────────
router.get('/tenants', async (req, res, next) => {
  try {
    const { status, search, page = 1, limit = 25 } = req.query;
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

    const { rows } = await pool.query(
      `SELECT t.id, t.business_name, t.slug, t.email, t.phone, t.city, 
              t.business_type, t.wa_status, t.onboarding_status, t.is_active,
              t.created_at,
              s.plan, s.status as sub_status,
              (SELECT COUNT(*) FROM appointments WHERE tenant_id = t.id) as total_appointments,
              (SELECT COUNT(*) FROM patients WHERE tenant_id = t.id) as total_patients,
              (SELECT COUNT(*) FROM doctors WHERE tenant_id = t.id) as total_doctors,
              (SELECT COUNT(*) FROM appointments WHERE tenant_id = t.id AND created_at >= NOW() - INTERVAL '7 days') as appointments_7d,
              (SELECT MAX(created_at) FROM appointments WHERE tenant_id = t.id) as last_appointment_at
       FROM tenants t
       LEFT JOIN subscriptions s ON s.tenant_id = t.id
       ${where}
       ORDER BY t.created_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, limit, offset]
    );

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM tenants t ${where}`,
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
        s.plan, s.status as sub_status, s.trial_ends_at,
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

// ── Update Tenant Features ────────────────────────────────
router.patch('/tenants/:id/features', async (req, res, next) => {
  try {
    const { features } = req.body;
    if (!features || typeof features !== 'object') {
      return res.status(400).json({ error: 'features object required' });
    }

    // Only allow known feature keys
    const allowed = ['booking', 'payment_collection', 'ai_chatbot', 'broadcast',
                     'multi_doctor', 'reminders', 'analytics', 'custom_branding', 'google_calendar'];
    const sanitized = {};
    for (const key of allowed) {
      if (features[key] !== undefined) {
        sanitized[key] = Boolean(features[key]);
      }
    }

    const { rows } = await pool.query(
      `UPDATE tenants SET features = features || $1::jsonb, updated_at = NOW()
       WHERE id = $2 RETURNING id, business_name, features`,
      [JSON.stringify(sanitized), req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Tenant not found' });

    logger.info(`Tenant ${rows[0].id} features updated:`, sanitized);
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// ── Update Tenant Plan ────────────────────────────────────
router.patch('/tenants/:id/plan', async (req, res, next) => {
  try {
    const { plan, status } = req.body;
    const validPlans = ['trial', 'starter', 'pro', 'enterprise'];
    const validStatuses = ['trial', 'active', 'cancelled', 'expired'];
    if (plan && !validPlans.includes(plan)) return res.status(400).json({ error: 'Invalid plan' });
    if (status && !validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status' });

    const { rows } = await pool.query(
      `UPDATE subscriptions SET 
        plan = COALESCE($1, plan), 
        status = COALESCE($2, status),
        trial_ends_at = CASE WHEN $2 = 'active' THEN NULL ELSE trial_ends_at END
       WHERE tenant_id = $3 RETURNING *`,
      [plan || null, status || null, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Subscription not found' });

    logger.info(`Tenant ${req.params.id} plan updated: ${plan || 'unchanged'}, status: ${status || 'unchanged'}`);
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// ── Update Tenant Limits ───────────────────────────────────
router.patch('/tenants/:id/limits', async (req, res, next) => {
  try {
    const { max_doctors, max_appointments_month } = req.body;
    if (max_doctors !== undefined && (!Number.isInteger(max_doctors) || max_doctors < 1)) {
      return res.status(400).json({ error: 'max_doctors must be a positive integer' });
    }
    if (max_appointments_month !== undefined && (!Number.isInteger(max_appointments_month) || max_appointments_month < 1)) {
      return res.status(400).json({ error: 'max_appointments_month must be a positive integer' });
    }

    const { rows } = await pool.query(
      `UPDATE tenants SET 
        max_doctors = COALESCE($1, max_doctors),
        max_appointments_month = COALESCE($2, max_appointments_month),
        updated_at = NOW()
       WHERE id = $3 RETURNING id, business_name, max_doctors, max_appointments_month`,
      [max_doctors || null, max_appointments_month || null, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Tenant not found' });

    logger.info(`Tenant ${rows[0].id} limits updated: max_doctors=${rows[0].max_doctors}, max_appts=${rows[0].max_appointments_month}`);
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// ── Update Tenant WhatsApp Config ─────────────────────────
router.patch('/tenants/:id/wa-config', async (req, res, next) => {
  try {
    const { wa_phone_number_id, wa_business_account_id, wa_access_token, wa_phone_number } = req.body;

    const updates = [];
    const params = [];
    let idx = 1;

    if (wa_phone_number_id !== undefined) { updates.push(`wa_phone_number_id = $${idx++}`); params.push(wa_phone_number_id); }
    if (wa_business_account_id !== undefined) { updates.push(`wa_business_account_id = $${idx++}`); params.push(wa_business_account_id); }
    if (wa_access_token !== undefined) { updates.push(`wa_access_token = $${idx++}`); params.push(wa_access_token); }
    if (wa_phone_number !== undefined) { updates.push(`wa_phone_number = $${idx++}`); params.push(wa_phone_number); }

    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

    // If all 3 required fields are set, mark as connected
    if (wa_phone_number_id && wa_business_account_id && wa_access_token) {
      updates.push(`wa_status = 'connected'`);
      updates.push(`onboarding_status = 'active'`);
    }
    updates.push('updated_at = NOW()');

    const { rows } = await pool.query(
      `UPDATE tenants SET ${updates.join(', ')} WHERE id = $${idx} RETURNING id, business_name, wa_status, wa_phone_number, onboarding_status`,
      [...params, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Tenant not found' });

    logger.info(`Tenant ${rows[0].id} WA config updated by platform admin`);
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// ── Delete Tenant ─────────────────────────────────────────
router.delete('/tenants/:id', async (req, res, next) => {
  try {
    const { rows: tenant } = await pool.query('SELECT id, business_name FROM tenants WHERE id = $1', [req.params.id]);
    if (tenant.length === 0) return res.status(404).json({ error: 'Tenant not found' });

    const tid = req.params.id;
    // Cascade delete in order (respecting foreign keys)
    await pool.query('DELETE FROM reminders WHERE appointment_id IN (SELECT id FROM appointments WHERE tenant_id = $1)', [tid]);
    await pool.query('DELETE FROM appointments WHERE tenant_id = $1', [tid]);
    await pool.query('DELETE FROM patients WHERE tenant_id = $1', [tid]);
    await pool.query('DELETE FROM services WHERE tenant_id = $1', [tid]);
    await pool.query('DELETE FROM doctors WHERE tenant_id = $1', [tid]);
    await pool.query('DELETE FROM subscriptions WHERE tenant_id = $1', [tid]);
    await pool.query('DELETE FROM tenant_users WHERE tenant_id = $1', [tid]);
    await pool.query('DELETE FROM audit_log WHERE tenant_id = $1', [tid]);
    await pool.query('DELETE FROM tenants WHERE id = $1', [tid]);

    logger.info(`Tenant ${tenant[0].business_name} (${tid}) DELETED by platform admin`);
    res.json({ success: true, deleted: tenant[0].business_name });
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

// ── INVITE CODES ──────────────────────────────────────────


// Generate a new invite code
router.post('/invite-codes', async (req, res, next) => {
  try {
    const { note, expiresInDays } = req.body;
    // Generate code: FZM-XXXX-XXXX
    const rand = crypto.randomBytes(4).toString('hex').toUpperCase();
    const code = `FZM-${rand.slice(0, 4)}-${rand.slice(4, 8)}`;

    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 86400000)
      : null;

    const { rows } = await pool.query(
      `INSERT INTO invite_codes (code, created_by, expires_at, note)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [code, req.admin.id, expiresAt, note || null]
    );

    logger.info(`Invite code generated: ${code} by admin ${req.admin.email}`);
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// List all invite codes
router.get('/invite-codes', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT ic.*, t.business_name as used_by_business
      FROM invite_codes ic
      LEFT JOIN tenants t ON t.id = ic.used_by_tenant_id
      ORDER BY ic.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Delete (deactivate) an invite code
router.delete('/invite-codes/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `UPDATE invite_codes SET is_active = false WHERE id = $1 AND used_by_tenant_id IS NULL RETURNING id`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Code not found or already used' });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
