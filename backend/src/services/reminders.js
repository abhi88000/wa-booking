// ============================================================
// Reminder Cron — Sends Appointment Reminders (All Tenants)
// ============================================================
// Runs as a separate process or called from a scheduled job

const pool = require('../db/pool');
const logger = require('../utils/logger');
const WhatsAppService = require('./whatsapp');

class ReminderService {
  
  /**
   * Process all pending reminders across all tenants
   */
  async processPendingReminders() {
    try {
      // Fetch all due reminders with tenant + appointment data
      const { rows: reminders } = await pool.query(
        `SELECT r.*, 
                a.appointment_date, a.start_time, a.status as appt_status,
                d.name as doctor_name,
                p.phone as patient_phone, p.name as patient_name,
                t.business_name, t.wa_phone_number_id, t.wa_access_token, t.wa_status,
                t.id as tenant_id, t.settings as tenant_settings, t.features
         FROM reminders r
         JOIN appointments a ON a.id = r.appointment_id
         JOIN patients p ON p.id = a.patient_id
         LEFT JOIN doctors d ON d.id = a.doctor_id
         JOIN tenants t ON t.id = r.tenant_id
         WHERE r.sent = false 
           AND r.remind_at <= NOW()
           AND a.status IN ('pending', 'confirmed')
           AND t.is_active = true
           AND t.wa_status = 'connected'
         ORDER BY r.remind_at
         LIMIT 100`
      );

      logger.info(`Processing ${reminders.length} pending reminders`);

      for (const reminder of reminders) {
        try {
          await this.sendReminder(reminder);
        } catch (err) {
          logger.error(`Failed to send reminder ${reminder.id}:`, err.message);
        }
      }

      return reminders.length;
    } catch (err) {
      logger.error('processPendingReminders error:', err);
      throw err;
    }
  }

  /**
   * Send a single reminder using WhatsApp template messages.
   * Templates are required because reminders are sent outside
   * the 24-hour messaging window (Meta policy).
   *
   * Approved templates (with named parameters):
   *   - appointment_reminder  (24h reminder)
   *   - appointment_cancelled (doctor cancels)
   *   - appointment_rescheduled (doctor reschedules)
   */
  async sendReminder(reminder) {
    const tenant = {
      id: reminder.tenant_id,
      wa_phone_number_id: reminder.wa_phone_number_id,
      wa_access_token: reminder.wa_access_token,
      business_name: reminder.business_name
    };

    const wa = new WhatsAppService(tenant);
    const tenantSettings = reminder.tenant_settings || {};
    const lang = tenantSettings.wa_template_language || 'en';

    // Template config: maps reminder type → template name + named parameters
    // These use named params matching the approved Meta templates
    const TEMPLATE_CONFIG = {
      '24h': {
        name: tenantSettings.template_appointment_reminder || 'appointment_reminder',
        params: [
          { type: 'text', text: reminder.patient_name || 'there' },
          { type: 'text', text: reminder.doctor_name || 'your doctor' },
          { type: 'text', text: this.formatDate(reminder.appointment_date) },
          { type: 'text', text: this.formatTime(reminder.start_time) },
          { type: 'text', text: reminder.business_name }
        ]
      },
      '1h': {
        name: tenantSettings.template_appointment_reminder || 'appointment_reminder',
        params: [
          { type: 'text', text: reminder.patient_name || 'there' },
          { type: 'text', text: reminder.doctor_name || 'your doctor' },
          { type: 'text', text: this.formatDate(reminder.appointment_date) },
          { type: 'text', text: this.formatTime(reminder.start_time) },
          { type: 'text', text: reminder.business_name }
        ]
      },
      'followup': {
        name: tenantSettings.template_appointment_followup || 'appointment_followup',
        params: [
          { type: 'text', text: reminder.patient_name || 'there' },
          { type: 'text', text: reminder.business_name }
        ]
      }
    };

    const templateConfig = TEMPLATE_CONFIG[reminder.type];

    if (!templateConfig) {
      logger.warn(`Unknown reminder type: ${reminder.type}, skipping`);
      return;
    }

    // Build template components with named body parameters
    const components = [{
      type: 'body',
      parameters: templateConfig.params
    }];

    await wa.sendTemplate(reminder.patient_phone, templateConfig.name, lang, components);

    // Mark as sent
    await pool.query(
      'UPDATE reminders SET sent = true, sent_at = NOW() WHERE id = $1',
      [reminder.id]
    );

    logger.info(`Reminder sent via template: ${reminder.id} (${reminder.type} → ${templateConfig.name}) to ${reminder.patient_phone}`);
  }

  formatTime(timeStr) {
    if (!timeStr) return '';
    const [h, m] = timeStr.toString().split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${hour12}:${(m || 0).toString().padStart(2, '0')} ${period}`;
  }

  formatDate(dateVal) {
    if (!dateVal) return '';
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const d = new Date(dateVal);
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  }
}

module.exports = new ReminderService();
