// ============================================================
// Auth Routes — Signup, Login (Tenant + Platform)
// ============================================================

const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const Joi = require('joi');
const slugify = require('slugify');
const pool = require('../db/pool');
const { signPlatformToken, signTenantToken } = require('../middleware/auth');
const logger = require('../utils/logger');

// ── Valid invite codes (manage via super admin or env) ─────
const VALID_INVITE_CODES = new Set(
  (process.env.INVITE_CODES || 'FZMINDS2026').split(',').map(c => c.trim().toUpperCase())
);

// ── Tenant Signup (Business Registration) ─────────────────
router.post('/signup', async (req, res, next) => {
  try {
    const schema = Joi.object({
      businessName: Joi.string().min(2).max(200).required(),
      businessType: Joi.string().valid('clinic', 'salon', 'spa', 'consulting', 'dental', 'veterinary', 'physiotherapy', 'other').default('clinic'),
      email: Joi.string().email().required(),
      phone: Joi.string().min(10).max(20),
      ownerName: Joi.string().min(2).max(150).required(),
      password: Joi.string().min(8).max(100).required(),
      inviteCode: Joi.string().required(),
      city: Joi.string().max(100),
      country: Joi.string().max(50).default('IN'),
      timezone: Joi.string().default('Asia/Kolkata')
    });

    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    // Validate invite code
    if (!VALID_INVITE_CODES.has(value.inviteCode.trim().toUpperCase())) {
      return res.status(403).json({ error: 'Invalid invite code. Contact us to get access.' });
    }

    // Check duplicate email
    const { rows: existingTenants } = await pool.query(
      'SELECT id FROM tenants WHERE email = $1', [value.email]
    );
    if (existingTenants.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    // Generate unique slug
    let slug = slugify(value.businessName, { lower: true, strict: true });
    const { rows: slugCheck } = await pool.query(
      'SELECT id FROM tenants WHERE slug = $1', [slug]
    );
    if (slugCheck.length > 0) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    // Create tenant
    const { rows: tenant } = await pool.query(
      `INSERT INTO tenants (business_name, business_type, slug, email, phone, city, country, timezone)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [value.businessName, value.businessType, slug, value.email, value.phone, value.city, value.country, value.timezone]
    );

    const tenantId = tenant[0].id;

    // Create owner user
    const passwordHash = await bcrypt.hash(value.password, 10);
    const { rows: user } = await pool.query(
      `INSERT INTO tenant_users (tenant_id, email, password_hash, name, role)
       VALUES ($1, $2, $3, $4, 'owner') RETURNING id, email, name, role`,
      [tenantId, value.email, passwordHash, value.ownerName]
    );

    // Create trial subscription
    await pool.query(
      `INSERT INTO subscriptions (tenant_id, plan, status, trial_ends_at)
       VALUES ($1, 'trial', 'trial', NOW() + INTERVAL '14 days')`,
      [tenantId]
    );

    // Generate token
    const token = signTenantToken(user[0], tenantId);

    logger.info(`New tenant registered: ${value.businessName} (${tenantId})`);

    res.status(201).json({
      message: 'Account created successfully! Your 14-day free trial has started.',
      token,
      tenant: {
        id: tenantId,
        businessName: tenant[0].business_name,
        slug: tenant[0].slug,
        onboardingStatus: tenant[0].onboarding_status
      },
      user: user[0]
    });
  } catch (err) {
    next(err);
  }
});

// ── Tenant Login ──────────────────────────────────────────
router.post('/login', async (req, res, next) => {
  try {
    const schema = Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().required()
    });

    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    // Find user across all tenants
    const { rows } = await pool.query(
      `SELECT u.*, t.id as tenant_id, t.business_name, t.is_active as tenant_active
       FROM tenant_users u
       JOIN tenants t ON t.id = u.tenant_id
       WHERE u.email = $1 AND u.is_active = true`,
      [value.email]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = rows[0];

    if (!user.tenant_active) {
      return res.status(403).json({ error: 'Your business account has been deactivated' });
    }

    const validPassword = await bcrypt.compare(value.password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = signTenantToken(
      { id: user.id, email: user.email, role: user.role },
      user.tenant_id
    );

    res.json({
      token,
      tenant: { id: user.tenant_id, businessName: user.business_name },
      user: { id: user.id, email: user.email, name: user.name, role: user.role }
    });
  } catch (err) {
    next(err);
  }
});

// ── Platform Admin Login (Super Admin) ────────────────────
router.post('/platform/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const { rows } = await pool.query(
      'SELECT * FROM platform_admins WHERE email = $1 AND is_active = true',
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const admin = rows[0];
    const valid = await bcrypt.compare(password, admin.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = signPlatformToken(admin);
    res.json({
      token,
      admin: { id: admin.id, email: admin.email, name: admin.name, role: admin.role }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
