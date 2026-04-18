// ── Settings Routes ───────────────────────────────────────
const express = require('express');
const router = express.Router();
const Joi = require('joi');
const axios = require('axios');
const pool = require('../../db/pool');
const { requireRole } = require('../../middleware/auth');
const logger = require('../../utils/logger');
const tenantCache = require('../../services/tenantCache');

router.get('/settings', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT business_name, business_type, email, phone, address, city, timezone,
              logo_url, wa_phone_number, wa_status, onboarding_status, 
              features, settings, max_doctors, max_appointments_month
       FROM tenants WHERE id = $1`,
      [req.tenantId]
    );
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.patch('/settings', requireRole('owner', 'admin'), async (req, res, next) => {
  try {
    const allowed = ['business_name', 'phone', 'address', 'city', 'timezone', 'settings'];
    const updates = [];
    const values = [];
    let idx = 1;

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        updates.push(`${key} = $${idx++}`);
        values.push(key === 'settings' ? JSON.stringify(req.body[key]) : req.body[key]);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    values.push(req.tenantId);
    const { rows } = await pool.query(
      `UPDATE tenants SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $${idx} RETURNING *`,
      values
    );

    // Invalidate cache so next request picks up new settings
    tenantCache.invalidate(req.tenantId);

    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// ── WHATSAPP CONNECTION ────────────────────────────────────

router.patch('/whatsapp', requireRole('owner', 'admin'), async (req, res, next) => {
  try {
    const schema = Joi.object({
      phoneNumberId: Joi.string().required(),
      businessAccountId: Joi.string().required(),
      accessToken: Joi.string().required(),
      displayPhone: Joi.string().required()
    });

    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    // Verify credentials with Meta API
    try {
      const verifyResp = await axios.get(
        `https://graph.facebook.com/v21.0/${value.phoneNumberId}`,
        { headers: { Authorization: `Bearer ${value.accessToken}` } }
      );
      if (!verifyResp.data?.id) {
        return res.status(400).json({ error: 'Invalid WhatsApp credentials' });
      }
    } catch (verifyErr) {
      logger.error('WA credential verification failed:', verifyErr.response?.data);
      return res.status(400).json({
        error: 'Could not verify WhatsApp credentials',
        details: verifyErr.response?.data?.error?.message
      });
    }

    // Check if phone number is used by another tenant
    const { rows: existing } = await pool.query(
      'SELECT tenant_id FROM wa_number_registry WHERE wa_phone_number_id = $1',
      [value.phoneNumberId]
    );
    if (existing.length > 0 && existing[0].tenant_id !== req.tenantId) {
      return res.status(409).json({ error: 'This WhatsApp number is already connected to another business' });
    }

    await pool.query(
      `UPDATE tenants SET
        wa_phone_number_id = $1, wa_business_account_id = $2,
        wa_access_token = $3, wa_phone_number = $4,
        wa_status = 'connected', updated_at = NOW()
       WHERE id = $5`,
      [value.phoneNumberId, value.businessAccountId, value.accessToken, value.displayPhone, req.tenantId]
    );

    await pool.query(
      `INSERT INTO wa_number_registry (wa_phone_number_id, tenant_id, phone_number)
       VALUES ($1, $2, $3)
       ON CONFLICT (wa_phone_number_id)
       DO UPDATE SET tenant_id = $2, phone_number = $3, is_active = true`,
      [value.phoneNumberId, req.tenantId, value.displayPhone]
    );

    // Invalidate cache so webhook picks up new WA credentials
    tenantCache.invalidate(req.tenantId);

    logger.info(`WhatsApp updated for tenant ${req.tenantId}: ${value.displayPhone}`);
    res.json({ success: true, message: 'WhatsApp connection updated!' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
