// ============================================================
// Scheduled Message Service — Generic Outbound Messages
// ============================================================
// Processes scheduled_messages table for:
//   - Follow-ups after flow completion
//   - Drip sequences
//   - Campaigns (future)
//
// Uses WhatsApp templates for messages outside 24h window.
// Uses plain text for messages within 24h window.

const pool = require('../db/pool');
const logger = require('../utils/logger');
const WhatsAppService = require('./whatsapp');

const CAT = { category: 'scheduled-messages' };

class ScheduledMessageService {

  /**
   * Process all pending scheduled messages across all tenants.
   * Called by cron every 60s.
   */
  async processPending() {
    try {
      const { rows: messages } = await pool.query(`
        SELECT sm.*,
               t.business_name, t.wa_phone_number_id, t.wa_access_token, t.wa_status,
               t.settings as tenant_settings
        FROM scheduled_messages sm
        JOIN tenants t ON t.id = sm.tenant_id
        WHERE sm.sent = false
          AND sm.send_at <= NOW()
          AND sm.retry_count < sm.max_retries
          AND t.is_active = true
          AND t.wa_status = 'connected'
        ORDER BY sm.send_at
        LIMIT 100
      `);

      if (messages.length === 0) return 0;

      logger.info(`Processing ${messages.length} scheduled messages`, CAT);

      let sent = 0;
      for (const msg of messages) {
        try {
          await this.sendMessage(msg);
          await pool.query(
            'UPDATE scheduled_messages SET sent = true, sent_at = NOW() WHERE id = $1',
            [msg.id]
          );
          sent++;
        } catch (err) {
          const retries = (msg.retry_count || 0) + 1;
          await pool.query(
            'UPDATE scheduled_messages SET retry_count = $1, last_error = $2 WHERE id = $3',
            [retries, err.message, msg.id]
          );
          if (retries >= msg.max_retries) {
            logger.error(`Scheduled message ${msg.id} permanently failed: ${err.message}`, CAT);
          } else {
            logger.warn(`Scheduled message ${msg.id} failed (attempt ${retries}): ${err.message}`, CAT);
          }
        }
      }

      return sent;
    } catch (err) {
      logger.error('processPending error:', err, CAT);
      throw err;
    }
  }

  /**
   * Send a single scheduled message.
   */
  async sendMessage(msg) {
    const wa = new WhatsAppService({
      id: msg.tenant_id,
      wa_phone_number_id: msg.wa_phone_number_id,
      wa_access_token: msg.wa_access_token,
      business_name: msg.business_name,
    });

    if (msg.message_type === 'template' && msg.template_name) {
      const lang = msg.tenant_settings?.wa_template_language || 'en';
      await wa.sendTemplate(msg.contact_phone, msg.template_name, msg.template_params || [], lang);
    } else {
      // Plain text — only works within 24h window
      const result = await wa.sendText(msg.contact_phone, msg.message_body);
      if (!result) throw new Error('sendText returned null — likely outside 24h window');
    }
  }

  /**
   * Schedule a message (called from flow actions, API, etc.)
   */
  static async schedule({ tenantId, phone, patientId, body, templateName, templateParams,
                           sendAt, triggerType = 'followup', source = 'flow_action', recordId, metadata }) {
    const { rows } = await pool.query(`
      INSERT INTO scheduled_messages 
        (tenant_id, contact_phone, patient_id, message_type, message_body, 
         template_name, template_params, send_at, trigger_type, source, record_id, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id
    `, [
      tenantId, phone, patientId || null,
      templateName ? 'template' : 'text',
      body || null, templateName || null, JSON.stringify(templateParams || []),
      sendAt, triggerType, source, recordId || null, JSON.stringify(metadata || {})
    ]);
    return rows[0].id;
  }
}

module.exports = ScheduledMessageService;
