// ============================================================
// Tenant Context Middleware
// ============================================================
// Ensures every tenant-scoped query is filtered by tenant_id. 
// This is the SINGLE MOST IMPORTANT security layer in a SaaS.

const pool = require('../db/pool');
const logger = require('../utils/logger');

/**
 * Load full tenant profile and check it's active.
 * Called after authTenant so req.tenantId is already set.
 */
async function loadTenantContext(req, res, next) {
  try {
    const { rows } = await pool.query(
      `SELECT t.*, s.plan, s.status as sub_status, s.trial_ends_at
       FROM tenants t
       LEFT JOIN subscriptions s ON s.tenant_id = t.id
       WHERE t.id = $1 AND t.is_active = true
       ORDER BY s.created_at DESC LIMIT 1`,
      [req.tenantId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Tenant not found or inactive' });
    }

    const tenant = rows[0];

    // Check subscription validity
    if (tenant.sub_status === 'trial' && new Date(tenant.trial_ends_at) < new Date()) {
      return res.status(402).json({ 
        error: 'Trial expired', 
        message: 'Please upgrade to continue using the service' 
      });
    }

    if (tenant.sub_status === 'expired' || tenant.sub_status === 'cancelled') {
      return res.status(402).json({ 
        error: 'Subscription inactive',
        message: 'Please renew your subscription' 
      });
    }

    req.tenant = tenant;
    next();
  } catch (err) {
    logger.error('loadTenantContext error:', err);
    next(err);
  }
}

/**
 * Check if a specific feature is enabled for this tenant
 */
function requireFeature(featureName) {
  return (req, res, next) => {
    if (!req.tenant) {
      return res.status(500).json({ error: 'Tenant context not loaded' });
    }
    const features = req.tenant.features || {};
    if (!features[featureName]) {
      return res.status(403).json({ 
        error: `Feature "${featureName}" not available on your plan`,
        upgrade: true
      });
    }
    next();
  };
}

/**
 * Check appointment limits for the current month
 */
async function checkAppointmentLimit(req, res, next) {
  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*) as count FROM appointments 
       WHERE tenant_id = $1 
       AND EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM NOW())
       AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW())`,
      [req.tenantId]
    );
    
    const count = parseInt(rows[0].count);
    if (count >= req.tenant.max_appointments_month) {
      return res.status(429).json({
        error: 'Monthly appointment limit reached',
        limit: req.tenant.max_appointments_month,
        current: count,
        upgrade: true
      });
    }
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { loadTenantContext, requireFeature, checkAppointmentLimit };
