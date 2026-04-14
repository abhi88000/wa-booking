// ============================================================
// WhatsApp Webhook Router (Multi-Tenant, Fault Tolerant)
// ============================================================
// Central webhook that receives ALL WhatsApp messages from ALL
// tenants and routes them to the correct tenant's processing.
//
// ISOLATION GUARANTEE: One tenant's error NEVER affects another.
// Each tenant's message is processed in its own try/catch.
// Failed messages are logged to audit_log for investigation.

const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const logger = require('../utils/logger');
const WhatsAppService = require('../services/whatsapp');
const MessageRouter = require('../services/messageRouter');

// ── In-memory circuit breaker (resets on restart) ─────────
// Prevents hammering a tenant whose WA token is broken
const circuitBreakers = new Map(); // tenantId -> { failures, lastFailure, state }
const CIRCUIT_THRESHOLD = 5;       // failures before opening circuit
const CIRCUIT_RESET_MS = 5 * 60 * 1000;  // 5 min cooldown

function checkCircuit(tenantId) {
  const cb = circuitBreakers.get(tenantId);
  if (!cb) return true; // no record = allowed
  if (cb.state === 'open') {
    // Check if cooldown has passed
    if (Date.now() - cb.lastFailure > CIRCUIT_RESET_MS) {
      cb.state = 'half-open';
      return true; // allow one attempt
    }
    return false; // still in cooldown
  }
  return true;
}

function recordSuccess(tenantId) {
  circuitBreakers.delete(tenantId);
}

function recordFailure(tenantId) {
  const cb = circuitBreakers.get(tenantId) || { failures: 0, lastFailure: 0, state: 'closed' };
  cb.failures++;
  cb.lastFailure = Date.now();
  if (cb.failures >= CIRCUIT_THRESHOLD) {
    cb.state = 'open';
    logger.error(`Circuit OPEN for tenant ${tenantId} after ${cb.failures} failures (5min cooldown)`);
  }
  circuitBreakers.set(tenantId, cb);
}

// ── Webhook Verification (GET) ────────────────────────────
// Meta sends a GET request to verify the webhook URL
router.get('/whatsapp', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const VERIFY_TOKEN = process.env.WA_VERIFY_TOKEN;
  if (!VERIFY_TOKEN) {
    logger.error('WA_VERIFY_TOKEN not set — webhook verification will fail');
    return res.sendStatus(500);
  }

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    logger.info('WhatsApp webhook verified successfully');
    return res.status(200).send(challenge);
  }
  
  logger.warn('WhatsApp webhook verification failed', { mode, token });
  return res.status(403).send('Forbidden');
});

// ── Message Handler (POST) ────────────────────────────────
router.post('/whatsapp', async (req, res) => {
  // ALWAYS respond 200 immediately to Meta (they retry on failure)
  res.status(200).send('EVENT_RECEIVED');

  try {
    const body = req.body;

    // Validate it's a WhatsApp message event
    if (body.object !== 'whatsapp_business_account') return;

    const entries = body.entry || [];
    for (const entry of entries) {
      const changes = entry.changes || [];
      for (const change of changes) {
        if (change.field !== 'messages') continue;

        const value = change.value;
        const phoneNumberId = value?.metadata?.phone_number_id;
        const messages = value?.messages || [];
        const contacts = value?.contacts || [];

        if (!phoneNumberId || messages.length === 0) continue;

        // ── TENANT LOOKUP ──
        let tenant;
        try {
          tenant = await resolveTenant(phoneNumberId);
        } catch (lookupErr) {
          logger.error(`Tenant lookup crashed for ${phoneNumberId}:`, lookupErr);
          continue;
        }

        if (!tenant) {
          logger.warn(`No tenant found for phone_number_id: ${phoneNumberId}`);
          continue;
        }

        // ── CIRCUIT BREAKER CHECK ──
        if (!checkCircuit(tenant.id)) {
          logger.warn(`Circuit OPEN: skipping messages for tenant ${tenant.business_name} (${tenant.id})`);
          continue;
        }

        // ── PROCESS EACH MESSAGE (isolated per message) ──
        for (let i = 0; i < messages.length; i++) {
          const msg = messages[i];
          const contact = contacts[i] || contacts[0];

          try {
            await processMessage(tenant, msg, contact, phoneNumberId);
            recordSuccess(tenant.id);
          } catch (msgErr) {
            recordFailure(tenant.id);
            logger.error(`Message processing failed for tenant ${tenant.business_name}:`, {
              tenantId: tenant.id,
              from: msg.from,
              error: msgErr.message,
              stack: msgErr.stack
            });

            // Dead-letter: log to audit_log for investigation
            try {
              await pool.query(
                `INSERT INTO audit_log (tenant_id, user_type, action, entity_type, details)
                 VALUES ($1, 'system', 'webhook_error', 'message', $2)`,
                [tenant.id, JSON.stringify({
                  from: msg.from,
                  type: msg.type,
                  error: msgErr.message,
                  timestamp: new Date().toISOString()
                })]
              );
            } catch (_) { /* audit log failure is non-critical */ }
          }
        }
      }
    }
  } catch (err) {
    // This outer catch should NEVER fire because each tenant is isolated above.
    // If it does, it's a structural bug — log loudly.
    logger.error('CRITICAL: Unhandled webhook error (this should not happen):', err);
  }
});

// ── Resolve Tenant from Phone Number ID ───────────────────
async function resolveTenant(phoneNumberId) {
  try {
    const { rows } = await pool.query(
      `SELECT t.* FROM tenants t
       JOIN wa_number_registry r ON r.tenant_id = t.id
       WHERE r.wa_phone_number_id = $1 AND r.is_active = true AND t.is_active = true`,
      [phoneNumberId]
    );
    return rows[0] || null;
  } catch (err) {
    logger.error('resolveTenant error:', err);
    return null;
  }
}

// ── Process a Single Message ──────────────────────────────
async function processMessage(tenant, msg, contact, phoneNumberId) {
  const senderPhone = msg.from;             // e.g. "919876543210"
  const senderName = contact?.profile?.name || 'Unknown';
  const messageType = msg.type;             // text, interactive, image, etc.
  const waMessageId = msg.id;

  // ── IDEMPOTENCY CHECK ──
  // Meta can retry webhooks — prevent processing the same message twice
  if (waMessageId) {
    const { rows: existing } = await pool.query(
      'SELECT id FROM chat_messages WHERE wa_message_id = $1 LIMIT 1',
      [waMessageId]
    );
    if (existing.length > 0) {
      logger.info(`Duplicate message skipped: ${waMessageId}`);
      return;
    }
  }

  logger.info(`Message from ${senderPhone} for tenant ${tenant.business_name}`, {
    tenantId: tenant.id,
    type: messageType
  });

  // Extract message content based on type
  let content = '';
  let interactiveData = null;

  switch (messageType) {
    case 'text':
      content = msg.text?.body || '';
      break;
    case 'interactive':
      if (msg.interactive?.type === 'list_reply') {
        content = msg.interactive.list_reply.id;
        interactiveData = msg.interactive.list_reply;
      } else if (msg.interactive?.type === 'button_reply') {
        content = msg.interactive.button_reply.id;
        interactiveData = msg.interactive.button_reply;
      }
      break;
    case 'button':
      content = msg.button?.text || msg.button?.payload || '';
      break;
    default:
      // Skip non-actionable message types (reactions, images, stickers, etc.)
      logger.info(`Ignoring ${messageType} message from ${senderPhone} — not actionable`);
      return;
  }

  // Get or create patient record (scoped to this tenant)
  const patient = await getOrCreatePatient(tenant.id, senderPhone, senderName);

  // Log incoming message
  await logMessage(tenant.id, patient.id, senderPhone, 'inbound', messageType, content, waMessageId);

  // Route to message router (decides which module handles it)
  const wa = new WhatsAppService(tenant);
  const router = new MessageRouter(tenant, patient, wa);
  
  await router.handleMessage(content, messageType, interactiveData);
}

// ── Get Or Create Patient ─────────────────────────────────
async function getOrCreatePatient(tenantId, phone, name) {
  // Try to find existing patient
  const { rows: existing } = await pool.query(
    'SELECT * FROM patients WHERE tenant_id = $1 AND phone = $2',
    [tenantId, phone]
  );

  if (existing.length > 0) {
    // Update name if it changed
    if (name !== 'Unknown' && existing[0].name !== name) {
      await pool.query(
        'UPDATE patients SET name = $1, updated_at = NOW() WHERE id = $2',
        [name, existing[0].id]
      );
    }
    return existing[0];
  }

  // Create new patient
  const { rows: created } = await pool.query(
    `INSERT INTO patients (tenant_id, phone, name, wa_conversation_state)
     VALUES ($1, $2, $3, '{"state": "new"}')
     RETURNING *`,
    [tenantId, phone, name]
  );

  logger.info(`New patient created for tenant ${tenantId}: ${phone}`);
  return created[0];
}

// ── Log Message ───────────────────────────────────────────
async function logMessage(tenantId, patientId, phone, direction, type, content, waMessageId) {
  try {
    await pool.query(
      `INSERT INTO chat_messages (tenant_id, patient_id, phone, direction, message_type, content, wa_message_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [tenantId, patientId, phone, direction, type, content, waMessageId]
    );
  } catch (err) {
    logger.error('logMessage error:', err);
  }
}

module.exports = router;
