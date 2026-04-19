// ============================================================
// Inbox Routes — WhatsApp Conversation Management
// ============================================================
// 4 routes: legacy chat lookup, conversation list (grouped by
// patient with unread counts), message history, and manual reply.
// Reply route sends via WhatsApp API and logs with delivery status.

const express = require('express');
const router = express.Router();
const pool = require('../../db/pool');
const WhatsAppService = require('../../services/whatsapp');

// Legacy chat endpoint
router.get('/chats/:patientId', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM chat_messages 
       WHERE tenant_id = $1 AND patient_id = $2
       ORDER BY created_at DESC LIMIT 100`,
      [req.tenantId, req.params.patientId]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// List all conversations (grouped by patient)
router.get('/conversations', async (req, res, next) => {
  try {
    const { search, page = 1, limit = 30 } = req.query;
    const offset = (page - 1) * limit;
    let where = 'WHERE p.tenant_id = $1';
    const params = [req.tenantId];
    let idx = 2;

    if (search) {
      where += ` AND (p.name ILIKE $${idx} OR p.phone ILIKE $${idx})`;
      params.push(`%${search}%`);
      idx++;
    }

    const { rows } = await pool.query(`
      SELECT p.id as patient_id, p.name, p.phone,
        last_msg.content as last_message,
        last_msg.direction as last_direction,
        last_msg.created_at as last_message_at,
        msg_count.total as message_count,
        unread.count as unread_count
      FROM patients p
      JOIN LATERAL (
        SELECT content, direction, created_at FROM chat_messages
        WHERE tenant_id = $1 AND patient_id = p.id
        ORDER BY created_at DESC LIMIT 1
      ) last_msg ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int as total FROM chat_messages
        WHERE tenant_id = $1 AND patient_id = p.id
      ) msg_count ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int as count FROM chat_messages
        WHERE tenant_id = $1 AND patient_id = p.id AND direction = 'inbound'
        AND created_at > COALESCE(
          (SELECT MAX(created_at) FROM chat_messages WHERE tenant_id = $1 AND patient_id = p.id AND direction = 'outbound'),
          '1970-01-01'
        )
      ) unread ON true
      ${where}
      ORDER BY last_msg.created_at DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `, [...params, parseInt(limit), parseInt(offset)]);

    res.json({ conversations: rows });
  } catch (err) {
    next(err);
  }
});

// Get messages for a specific conversation
router.get('/conversations/:patientId/messages', async (req, res, next) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    const [messages, patient] = await Promise.all([
      pool.query(
        `SELECT id, direction, message_type, content, metadata, created_at
         FROM chat_messages
         WHERE tenant_id = $1 AND patient_id = $2
         ORDER BY created_at DESC
         LIMIT $3 OFFSET $4`,
        [req.tenantId, req.params.patientId, parseInt(limit), parseInt(offset)]
      ),
      pool.query(
        `SELECT id, name, phone, created_at FROM patients WHERE id = $1 AND tenant_id = $2`,
        [req.params.patientId, req.tenantId]
      )
    ]);

    res.json({
      patient: patient.rows[0] || null,
      messages: messages.rows.reverse()
    });
  } catch (err) {
    next(err);
  }
});

// Send a manual reply from the dashboard
router.post('/conversations/:patientId/reply', async (req, res, next) => {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const { rows: patients } = await pool.query(
      'SELECT id, phone FROM patients WHERE id = $1 AND tenant_id = $2',
      [req.params.patientId, req.tenantId]
    );
    if (patients.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const patient = patients[0];
    const wa = new WhatsAppService(req.tenant);
    const waMessageId = await wa.sendText(patient.phone, message.trim());
    const status = waMessageId ? 'sent' : 'failed';

    await pool.query(
      `INSERT INTO chat_messages (tenant_id, patient_id, phone, direction, message_type, content, wa_message_id, status)
       VALUES ($1, $2, $3, 'outbound', 'text', $4, $5, $6)`,
      [req.tenantId, patient.id, patient.phone, message.trim(), waMessageId, status]
    ).catch(() => {
      // Fallback if status column doesn't exist yet
      return pool.query(
        `INSERT INTO chat_messages (tenant_id, patient_id, phone, direction, message_type, content, wa_message_id)
         VALUES ($1, $2, $3, 'outbound', 'text', $4, $5)`,
        [req.tenantId, patient.id, patient.phone, message.trim(), waMessageId]
      );
    });

    if (!waMessageId) {
      return res.status(502).json({ error: 'Message saved but WhatsApp delivery failed' });
    }

    res.json({ success: true, wa_message_id: waMessageId });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
