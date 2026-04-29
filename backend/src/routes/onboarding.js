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
      verifyToken: process.env.WA_VERIFY_TOKEN ? '***configured***' : 'NOT SET — add WA_VERIFY_TOKEN to .env',
      instruction: 'Configure this webhook URL in your Meta Developer portal under WhatsApp > Configuration'
    });
  } catch (err) {
    next(err);
  }
});

// ── Connect WhatsApp via Embedded Signup (OAuth Code Exchange) ──
// The frontend sends the auth code from FB.login() and we:
// 1. Exchange code for access token
// 2. Fetch WABA ID + phone number ID from the token
// 3. Subscribe WABA to webhooks
// 4. Register the phone number for messaging
// 5. Save everything to tenant
router.post('/connect-whatsapp-embedded', async (req, res, next) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Authorization code is required' });

    const FB_APP_ID = process.env.FB_APP_ID;
    const FB_APP_SECRET = process.env.FB_APP_SECRET;
    if (!FB_APP_ID || !FB_APP_SECRET) {
      return res.status(500).json({ error: 'Facebook App credentials not configured on server' });
    }

    // Step 1: Exchange code for access token
    logger.info(`Exchanging auth code for tenant ${req.tenantId}`);
    const tokenResp = await axios.get('https://graph.facebook.com/v21.0/oauth/access_token', {
      params: {
        client_id: FB_APP_ID,
        client_secret: FB_APP_SECRET,
        code
      }
    });
    const accessToken = tokenResp.data.access_token;
    if (!accessToken) {
      return res.status(400).json({ error: 'Failed to get access token from Meta' });
    }

    // Step 2: Get shared WABA ID(s) — list WABAs the user shared with our app
    logger.info(`Fetching shared WABAs for tenant ${req.tenantId}`);
    const debugResp = await axios.get('https://graph.facebook.com/v21.0/debug_token', {
      params: { input_token: accessToken, access_token: `${FB_APP_ID}|${FB_APP_SECRET}` }
    });
    const grantedScopes = debugResp.data?.data?.scopes || [];
    logger.info(`Granted scopes: ${grantedScopes.join(', ')}`, { tenantId: req.tenantId });

    // Get the Business ID from the shared assets
    const sharedWabaResp = await axios.get(
      `https://graph.facebook.com/v21.0/${FB_APP_ID}/subscribed_apps_info`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    ).catch(() => null);

    // Alternative: fetch WABAs directly via the user token
    let wabaId = null;
    let phoneNumberId = null;
    let displayPhone = null;

    // Try fetching business ID from the token, then get WABAs
    const businessResp = await axios.get(
      'https://graph.facebook.com/v21.0/me/businesses',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    ).catch(() => null);

    // Fetch WABAs shared with our app
    const wabaListResp = await axios.get(
      `https://graph.facebook.com/v21.0/me/whatsapp_business_accounts`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    ).catch(() => null);

    if (!wabaListResp?.data?.data?.length) {
      // Try via business ID
      const bizId = businessResp?.data?.data?.[0]?.id;
      if (bizId) {
        const bizWabaResp = await axios.get(
          `https://graph.facebook.com/v21.0/${bizId}/owned_whatsapp_business_accounts`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        ).catch(() => null);
        if (bizWabaResp?.data?.data?.length) {
          wabaId = bizWabaResp.data.data[0].id;
        }
      }
    } else {
      wabaId = wabaListResp.data.data[0].id;
    }

    if (!wabaId) {
      return res.status(400).json({ 
        error: 'No WhatsApp Business Account found. Please complete the WhatsApp setup in the popup and verify your phone number.' 
      });
    }

    // Step 3: Get phone number(s) from WABA
    logger.info(`Found WABA ${wabaId}, fetching phone numbers`);
    const phoneResp = await axios.get(
      `https://graph.facebook.com/v21.0/${wabaId}/phone_numbers`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const phones = phoneResp.data?.data || [];
    if (phones.length === 0) {
      return res.status(400).json({ 
        error: 'No phone number found on the WhatsApp Business Account. Please add a phone number in the Meta setup.' 
      });
    }
    phoneNumberId = phones[0].id;
    displayPhone = phones[0].display_phone_number;

    // Step 4: Subscribe WABA to our app for webhooks
    logger.info(`Subscribing WABA ${wabaId} to app webhooks`);
    await axios.post(
      `https://graph.facebook.com/v21.0/${wabaId}/subscribed_apps`,
      {},
      { headers: { Authorization: `Bearer ${accessToken}` } }
    ).catch(err => {
      logger.warn(`Failed to subscribe WABA to webhooks: ${err.response?.data?.error?.message || err.message}`);
    });

    // Step 5: Register phone number for messaging (Cloud API)
    logger.info(`Registering phone ${phoneNumberId} for Cloud API messaging`);
    await axios.post(
      `https://graph.facebook.com/v21.0/${phoneNumberId}/register`,
      { messaging_product: 'whatsapp', pin: '123456' },
      { headers: { Authorization: `Bearer ${accessToken}` } }
    ).catch(err => {
      // May fail if already registered — that's OK
      logger.warn(`Phone register call: ${err.response?.data?.error?.message || err.message}`);
    });

    // Step 6: Check for duplicate phone number
    const { rows: existing } = await pool.query(
      'SELECT tenant_id FROM wa_number_registry WHERE wa_phone_number_id = $1',
      [phoneNumberId]
    );
    if (existing.length > 0 && existing[0].tenant_id !== req.tenantId) {
      return res.status(409).json({ 
        error: 'This WhatsApp number is already connected to another business' 
      });
    }

    // Step 7: Save credentials to tenant
    await pool.query(
      `UPDATE tenants SET 
        wa_phone_number_id = $1, wa_business_account_id = $2, 
        wa_access_token = $3, wa_phone_number = $4,
        wa_status = 'connected', onboarding_status = 'whatsapp_connected',
        updated_at = NOW()
       WHERE id = $5`,
      [phoneNumberId, wabaId, accessToken, displayPhone, req.tenantId]
    );

    // Register in phone number registry
    await pool.query(
      `INSERT INTO wa_number_registry (wa_phone_number_id, tenant_id, phone_number)
       VALUES ($1, $2, $3)
       ON CONFLICT (wa_phone_number_id) 
       DO UPDATE SET tenant_id = $2, phone_number = $3, is_active = true`,
      [phoneNumberId, req.tenantId, displayPhone]
    );

    logger.info(`WhatsApp connected via Embedded Signup for tenant ${req.tenantId}: ${displayPhone} (WABA: ${wabaId})`);

    res.json({ 
      success: true, 
      message: 'WhatsApp connected successfully!',
      phone: displayPhone,
      wabaId
    });
  } catch (err) {
    logger.error('Embedded Signup exchange failed:', err.response?.data || err.message);
    const metaError = err.response?.data?.error?.message;
    if (metaError) {
      return res.status(400).json({ error: `Meta API: ${metaError}` });
    }
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
