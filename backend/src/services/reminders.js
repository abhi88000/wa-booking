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
   * Send a single reminder
   */
  async sendReminder(reminder) {
    const tenant = {
      id: reminder.tenant_id,
      wa_phone_number_id: reminder.wa_phone_number_id,
      wa_access_token: reminder.wa_access_token,
      business_name: reminder.business_name
    };

    const wa = new WhatsAppService(tenant);

    let message = '';
    switch (reminder.type) {
      case '24h':
        message = 
          `📅 *Appointment Reminder*\n\n` +
          `Hi ${reminder.patient_name || 'there'},\n\n` +
          `This is a reminder for your appointment tomorrow:\n\n` +
          `👨‍⚕️ ${reminder.doctor_name}\n` +
          `📅 ${reminder.appointment_date}\n` +
          `🕐 ${this.formatTime(reminder.start_time)}\n` +
          `🏥 ${reminder.business_name}\n\n` +
          `Reply "cancel" to cancel or "reschedule" to change the time.`;
        break;

      case '1h':
        message = 
          `⏰ *Your appointment is in 1 hour!*\n\n` +
          `👨‍⚕️ ${reminder.doctor_name}\n` +
          `🕐 ${this.formatTime(reminder.start_time)}\n` +
          `🏥 ${reminder.business_name}\n\n` +
          `See you soon! 👋`;
        break;

      case 'followup':
        message =
          `Hi ${reminder.patient_name || 'there'},\n\n` +
          `Thank you for visiting ${reminder.business_name}!\n` +
          `We hope you had a good experience. 😊\n\n` +
          `Would you like to book another appointment? Just type "book"!`;
        break;

      default:
        message = `Reminder: Your appointment at ${reminder.business_name} is on ${reminder.appointment_date}.`;
    }

    await wa.sendText(reminder.patient_phone, message);

    // Mark as sent
    await pool.query(
      'UPDATE reminders SET sent = true, sent_at = NOW() WHERE id = $1',
      [reminder.id]
    );

    logger.info(`Reminder sent: ${reminder.id} (${reminder.type}) to ${reminder.patient_phone}`);
  }

  formatTime(timeStr) {
    if (!timeStr) return '';
    const [h, m] = timeStr.toString().split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${hour12}:${(m || 0).toString().padStart(2, '0')} ${period}`;
  }
}

module.exports = new ReminderService();
