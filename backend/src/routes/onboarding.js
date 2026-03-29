// ============================================================
// Onboarding Routes — Connect WhatsApp + Setup Business
// ============================================================

const express = require('express');
const router = express.Router();
const Joi = require('joi');
const axios = require('axios');
const pool = require('../db/pool');
const { authTenant } = require('../middleware/auth');
const logger = require('../utils/logger');

// All onboarding routes require tenant auth
router.use(authTenant);

// ── Get Onboarding Status ─────────────────────────────────
router.get('/status', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT onboarding_status, onboarding_data, wa_status FROM tenants WHERE id = $1',
      [req.tenantId]
    );
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// ── Connect WhatsApp Number ───────────────────────────────
// The business provides their WhatsApp Cloud API credentials
router.post('/connect-whatsapp', async (req, res, next) => {
  try {
    const schema = Joi.object({
      phoneNumberId: Joi.string().required(),
      businessAccountId: Joi.string().required(),
      accessToken: Joi.string().required(),
      displayPhone: Joi.string().required()
    });

    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    // Verify the credentials by calling Meta API
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

    // Check if this phone number is already used by another tenant
    const { rows: existing } = await pool.query(
      'SELECT tenant_id FROM wa_number_registry WHERE wa_phone_number_id = $1',
      [value.phoneNumberId]
    );

    if (existing.length > 0 && existing[0].tenant_id !== req.tenantId) {
      return res.status(409).json({ 
        error: 'This WhatsApp number is already connected to another business' 
      });
    }

    // Update tenant with WhatsApp credentials
    await pool.query(
      `UPDATE tenants SET 
        wa_phone_number_id = $1, wa_business_account_id = $2, 
        wa_access_token = $3, wa_phone_number = $4,
        wa_status = 'connected', onboarding_status = 'whatsapp_connected',
        updated_at = NOW()
       WHERE id = $5`,
      [value.phoneNumberId, value.businessAccountId, value.accessToken, value.displayPhone, req.tenantId]
    );

    // Register in phone number registry
    await pool.query(
      `INSERT INTO wa_number_registry (wa_phone_number_id, tenant_id, phone_number)
       VALUES ($1, $2, $3)
       ON CONFLICT (wa_phone_number_id) 
       DO UPDATE SET tenant_id = $2, phone_number = $3, is_active = true`,
      [value.phoneNumberId, req.tenantId, value.displayPhone]
    );

    logger.info(`WhatsApp connected for tenant ${req.tenantId}: ${value.displayPhone}`);

    res.json({ 
      success: true, 
      message: 'WhatsApp connected successfully!',
      webhookUrl: `${process.env.APP_URL || 'https://yourdomain.com'}/webhook/whatsapp`,
      verifyToken: process.env.WA_VERIFY_TOKEN || 'bookingbot-verify-2024',
      instruction: 'Configure this webhook URL in your Meta Developer portal under WhatsApp > Configuration'
    });
  } catch (err) {
    next(err);
  }
});

// ── Setup Business Details (Doctors, Services) ────────────
router.post('/setup-business', async (req, res, next) => {
  try {
    const schema = Joi.object({
      doctors: Joi.array().items(Joi.object({
        name: Joi.string().required(),
        specialization: Joi.string(),
        consultationFee: Joi.number().default(0),
        slotDuration: Joi.number().default(30),
        availability: Joi.array().items(Joi.object({
          day: Joi.string().valid('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday').required(),
          startTime: Joi.string().required(),
          endTime: Joi.string().required()
        }))
      })).min(1).required(),
      services: Joi.array().items(Joi.object({
        name: Joi.string().required(),
        duration: Joi.number().default(30),
        price: Joi.number().default(0)
      })).min(1).required()
    });

    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Insert doctors
      for (const doc of value.doctors) {
        const { rows } = await client.query(
          `INSERT INTO doctors (tenant_id, name, specialization, consultation_fee, slot_duration)
           VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          [req.tenantId, doc.name, doc.specialization, doc.consultationFee, doc.slotDuration]
        );

        // Insert availability
        if (doc.availability) {
          for (const avail of doc.availability) {
            await client.query(
              `INSERT INTO doctor_availability (tenant_id, doctor_id, day, start_time, end_time)
               VALUES ($1, $2, $3, $4, $5)`,
              [req.tenantId, rows[0].id, avail.day, avail.startTime, avail.endTime]
            );
          }
        }
      }

      // Insert services
      for (const svc of value.services) {
        await client.query(
          `INSERT INTO services (tenant_id, name, duration, price)
           VALUES ($1, $2, $3, $4)`,
          [req.tenantId, svc.name, svc.duration, svc.price]
        );
      }

      // Update onboarding status
      await client.query(
        `UPDATE tenants SET onboarding_status = 'setup_complete', updated_at = NOW() WHERE id = $1`,
        [req.tenantId]
      );

      await client.query('COMMIT');

      res.json({ success: true, message: 'Business setup complete!' });
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
});

// ── Mark Onboarding Complete ──────────────────────────────
router.post('/complete', async (req, res, next) => {
  try {
    await pool.query(
      `UPDATE tenants SET onboarding_status = 'active', updated_at = NOW() WHERE id = $1`,
      [req.tenantId]
    );
    res.json({ success: true, message: 'Onboarding complete! Your booking system is live.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
