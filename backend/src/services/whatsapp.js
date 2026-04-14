// ============================================================
// WhatsApp Service (Tenant-Scoped, Fault Tolerant)
// ============================================================
// Each tenant has their own WA token + phone_number_id.
// This service wraps the WhatsApp Cloud API for a specific tenant.
//
// RESILIENCE: Retries on network errors, detects invalid tokens,
// gracefully handles rate limits. One tenant's WA failure never
// affects another tenant.

const axios = require('axios');
const logger = require('../utils/logger');
const pool = require('../db/pool');

const WA_API_BASE = 'https://graph.facebook.com/v21.0';

// Retry config
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

class WhatsAppService {
  constructor(tenant) {
    this.tenant = tenant;
    this.phoneNumberId = tenant.wa_phone_number_id;
    this.accessToken = tenant.wa_access_token;
    this.apiUrl = `${WA_API_BASE}/${this.phoneNumberId}/messages`;
    this.tenantLabel = `[${tenant.business_name || tenant.id}]`;
  }

  // ── Send Text Message ──────────────────────────────────
  async sendText(to, text) {
    return this._send(to, {
      type: 'text',
      text: { body: text, preview_url: false }
    });
  }

  // ── Send Interactive List ──────────────────────────────
  async sendList(to, { headerText, bodyText, footerText, buttonText, sections }) {
    return this._send(to, {
      type: 'interactive',
      interactive: {
        type: 'list',
        header: headerText ? { type: 'text', text: headerText } : undefined,
        body: { text: bodyText },
        footer: footerText ? { text: footerText } : undefined,
        action: {
          button: buttonText || 'Choose',
          sections
        }
      }
    });
  }

  // ── Send Interactive Buttons ───────────────────────────
  async sendButtons(to, { bodyText, footerText, buttons }) {
    return this._send(to, {
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: bodyText },
        footer: footerText ? { text: footerText } : undefined,
        action: {
          buttons: buttons.map((b, i) => ({
            type: 'reply',
            reply: { id: b.id || `btn_${i}`, title: b.title.substring(0, 20) }
          }))
        }
      }
    });
  }

  // ── Send Template (for 24h+ window) ───────────────────
  async sendTemplate(to, templateName, languageCode = 'en', components = []) {
    return this._send(to, {
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        components
      }
    });
  }

  // ── Mark as Read ───────────────────────────────────────
  async markRead(messageId) {
    try {
      await axios.post(this.apiUrl, {
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId
      }, {
        headers: { Authorization: `Bearer ${this.accessToken}` }
      });
    } catch (err) {
      // Non-critical, don't throw
      logger.warn('markRead failed:', err.message);
    }
  }

  // ── Internal Send (with retry) ──────────────────────────
  async _send(to, messagePayload, retryCount = 0) {
    try {
      // Pre-flight check: do we even have credentials?
      if (!this.accessToken || !this.phoneNumberId) {
        logger.error(`${this.tenantLabel} WA send failed: no credentials configured`);
        return null; // Silently fail — don't crash the booking flow
      }

      const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        ...messagePayload
      };

      const response = await axios.post(this.apiUrl, payload, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000 // 15s timeout
      });

      const waMessageId = response.data?.messages?.[0]?.id;
      logger.info(`${this.tenantLabel} WA sent to ${to}`, { type: messagePayload.type, waMessageId });
      return waMessageId;

    } catch (err) {
      const status = err.response?.status;
      const errorData = err.response?.data?.error || {};
      const errorMsg = errorData.message || err.message;
      const errorCode = errorData.code;

      // ── Token expired or invalid (401 / code 190) ──
      if (status === 401 || errorCode === 190) {
        logger.error(`${this.tenantLabel} WA TOKEN INVALID — marking as disconnected`);
        try {
          await pool.query(
            `UPDATE tenants SET wa_status = 'disconnected', updated_at = NOW() WHERE id = $1`,
            [this.tenant.id]
          );
          await pool.query(
            `INSERT INTO audit_log (tenant_id, user_type, action, entity_type, details)
             VALUES ($1, 'system', 'wa_token_expired', 'tenant', $2)`,
            [this.tenant.id, JSON.stringify({ error: errorMsg, timestamp: new Date().toISOString() })]
          );
        } catch (_) { /* non-critical */ }
        return null; // Don't retry, don't crash
      }

      // ── Rate limited (429) ──
      if (status === 429) {
        const retryAfter = parseInt(err.response?.headers?.['retry-after'] || '5');
        logger.warn(`${this.tenantLabel} WA rate limited, waiting ${retryAfter}s`);
        if (retryCount < MAX_RETRIES) {
          await this._sleep(retryAfter * 1000);
          return this._send(to, messagePayload, retryCount + 1);
        }
        logger.error(`${this.tenantLabel} WA rate limit: max retries exhausted`);
        return null;
      }

      // ── Network / timeout errors (retry-worthy) ──
      if (!err.response && retryCount < MAX_RETRIES) {
        logger.warn(`${this.tenantLabel} WA network error, retrying (${retryCount + 1}/${MAX_RETRIES})...`);
        await this._sleep(RETRY_DELAY_MS * (retryCount + 1));
        return this._send(to, messagePayload, retryCount + 1);
      }

      // ── Other errors: log but don't crash ──
      logger.error(`${this.tenantLabel} WA send error to ${to}:`, {
        status, errorCode, errorMsg,
        retryCount
      });

      // Log to audit for investigation
      try {
        await pool.query(
          `INSERT INTO audit_log (tenant_id, user_type, action, entity_type, details)
           VALUES ($1, 'system', 'wa_send_error', 'message', $2)`,
          [this.tenant.id, JSON.stringify({ to, error: errorMsg, code: errorCode, status })]
        );
      } catch (_) { /* non-critical */ }

      return null; // Graceful failure — never crash the caller
    }
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

}

module.exports = WhatsAppService;
