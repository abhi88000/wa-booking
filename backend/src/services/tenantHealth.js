// ============================================================
// Tenant Health Check Service
// ============================================================
// Monitors each tenant's vital signs and flags issues before
// they become customer-facing problems.

const pool = require('../db/pool');
const logger = require('../utils/logger');
const axios = require('axios');

const WA_API_BASE = 'https://graph.facebook.com/v21.0';

class TenantHealthService {

  /**
   * Run health checks on ALL active tenants.
   * Returns an array of { tenantId, name, status, issues[] }
   */
  async checkAll() {
    const { rows: tenants } = await pool.query(`
      SELECT t.id, t.business_name, t.email, t.wa_status, t.wa_phone_number_id,
             t.wa_access_token, t.is_active, t.onboarding_status, t.max_doctors,
             t.max_appointments_month, t.features, t.settings,
             s.plan, s.status as sub_status, s.trial_ends_at
      FROM tenants t
      LEFT JOIN subscriptions s ON s.tenant_id = t.id
      WHERE t.is_active = true
      ORDER BY t.business_name
    `);

    const results = [];
    for (const tenant of tenants) {
      const report = await this.checkOne(tenant);
      results.push(report);
    }
    return results;
  }

  /**
   * Check a single tenant (pass DB row or tenant ID)
   */
  async checkOne(tenantOrId) {
    let tenant = tenantOrId;
    if (typeof tenantOrId === 'string') {
      const { rows } = await pool.query(`
        SELECT t.*, s.plan, s.status as sub_status, s.trial_ends_at
        FROM tenants t LEFT JOIN subscriptions s ON s.tenant_id = t.id
        WHERE t.id = $1
      `, [tenantOrId]);
      tenant = rows[0];
      if (!tenant) return { tenantId: tenantOrId, name: 'UNKNOWN', status: 'critical', issues: ['Tenant not found'] };
    }

    const issues = [];
    let status = 'healthy'; // healthy | warning | critical

    // ── 1. Subscription Check ──
    if (tenant.sub_status === 'expired' || tenant.sub_status === 'cancelled') {
      issues.push({ level: 'critical', msg: `Subscription ${tenant.sub_status}` });
    } else if (tenant.sub_status === 'trial') {
      const daysLeft = Math.ceil((new Date(tenant.trial_ends_at) - new Date()) / 86400000);
      if (daysLeft < 0) issues.push({ level: 'critical', msg: 'Trial expired' });
      else if (daysLeft <= 3) issues.push({ level: 'warning', msg: `Trial expires in ${daysLeft}d` });
    }

    // ── 2. WhatsApp Connection ──
    if (!tenant.wa_phone_number_id || !tenant.wa_access_token) {
      issues.push({ level: 'warning', msg: 'WhatsApp not configured' });
    } else if (tenant.wa_status !== 'connected') {
      issues.push({ level: 'critical', msg: `WA status: ${tenant.wa_status}` });
    }

    // ── 3. Data Readiness ──
    const { rows: counts } = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM doctors WHERE tenant_id = $1 AND is_active = true) as doctors,
        (SELECT COUNT(*) FROM services WHERE tenant_id = $1 AND is_active = true) as services,
        (SELECT COUNT(*) FROM reminders WHERE tenant_id = $1 AND sent = false AND remind_at < NOW() - INTERVAL '10 minutes') as overdue_reminders,
        (SELECT COUNT(*) FROM patients WHERE tenant_id = $1 
         AND wa_conversation_state->>'state' NOT IN ('new', 'idle', '')
         AND updated_at < NOW() - INTERVAL '2 hours') as stuck_conversations
    `, [tenant.id]);
    const c = counts[0];

    if (parseInt(c.doctors) === 0) issues.push({ level: 'warning', msg: 'No active doctors' });
    if (parseInt(c.services) === 0) issues.push({ level: 'warning', msg: 'No active services' });
    if (parseInt(c.overdue_reminders) > 0) issues.push({ level: 'warning', msg: `${c.overdue_reminders} overdue reminders` });
    if (parseInt(c.stuck_conversations) > 0) issues.push({ level: 'warning', msg: `${c.stuck_conversations} stuck conversations` });

    // ── 4. Appointment Limit Check ──
    const { rows: apptCount } = await pool.query(`
      SELECT COUNT(*) as cnt FROM appointments 
      WHERE tenant_id = $1 AND EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM NOW())
    `, [tenant.id]);
    const used = parseInt(apptCount[0].cnt);
    const max = tenant.max_appointments_month || 9999;
    if (used >= max) {
      issues.push({ level: 'critical', msg: 'Monthly appointment limit reached' });
    } else if (used >= max * 0.9) {
      issues.push({ level: 'warning', msg: `${Math.round(used/max*100)}% of monthly appointment limit used` });
    }

    // Determine overall status
    if (issues.some(i => i.level === 'critical')) status = 'critical';
    else if (issues.some(i => i.level === 'warning')) status = 'warning';

    return {
      tenantId: tenant.id,
      name: tenant.business_name,
      email: tenant.email,
      plan: tenant.plan || 'trial',
      waStatus: tenant.wa_status,
      onboarding: tenant.onboarding_status,
      status,
      issues
    };
  }

  /**
   * Validate a tenant's WhatsApp token by calling Meta API.
   * Returns { valid: boolean, error?: string, details?: object }
   */
  async validateWAToken(tenantId) {
    const { rows } = await pool.query(
      'SELECT wa_phone_number_id, wa_access_token FROM tenants WHERE id = $1',
      [tenantId]
    );
    if (rows.length === 0) return { valid: false, error: 'Tenant not found' };
    const { wa_phone_number_id, wa_access_token } = rows[0];

    if (!wa_phone_number_id || !wa_access_token) {
      return { valid: false, error: 'WA credentials not configured' };
    }

    try {
      const resp = await axios.get(
        `${WA_API_BASE}/${wa_phone_number_id}`,
        { headers: { Authorization: `Bearer ${wa_access_token}` }, timeout: 10000 }
      );
      return { valid: true, details: resp.data };
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.message;
      const code = err.response?.data?.error?.code || err.code;

      // Mark tenant as disconnected if token is invalid
      if (err.response?.status === 401 || code === 190) {
        await pool.query(
          `UPDATE tenants SET wa_status = 'disconnected', updated_at = NOW() WHERE id = $1`,
          [tenantId]
        );
        logger.error(`WA token invalid for tenant ${tenantId}, marked as disconnected`);
      }

      return { valid: false, error: msg, code };
    }
  }

  /**
   * Auto-fix stuck conversations older than 2 hours
   */
  async resetStuckConversations() {
    const { rows } = await pool.query(`
      UPDATE patients SET 
        wa_conversation_state = '{"state": "idle", "auto_reset": true}',
        updated_at = NOW()
      WHERE wa_conversation_state->>'state' NOT IN ('new', 'idle', '')
        AND updated_at < NOW() - INTERVAL '2 hours'
      RETURNING id, tenant_id, phone, wa_conversation_state
    `);

    if (rows.length > 0) {
      logger.info(`Auto-reset ${rows.length} stuck conversations`);
    }
    return rows.length;
  }
}

module.exports = new TenantHealthService();
