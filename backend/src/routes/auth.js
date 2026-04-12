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

// ── Valid invite codes — checked against DB first, env fallback ─────
const VALID_INVITE_CODES = new Set(
  (process.env.INVITE_CODES || '').split(',').map(c => c.trim().toUpperCase()).filter(Boolean)
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

    // Validate invite code — check DB first, then env fallback
    const codeUpper = value.inviteCode.trim().toUpperCase();
    let inviteCodeId = null;

    const { rows: dbCodes } = await pool.query(
      `SELECT id FROM invite_codes
       WHERE UPPER(code) = $1 AND is_active = true AND used_by_tenant_id IS NULL
         AND (expires_at IS NULL OR expires_at > NOW())`,
      [codeUpper]
    );

    if (dbCodes.length > 0) {
      inviteCodeId = dbCodes[0].id;
    } else if (!VALID_INVITE_CODES.has(codeUpper)) {
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

    // Mark invite code as used (single-use)
    if (inviteCodeId) {
      await pool.query(
        `UPDATE invite_codes SET used_by_tenant_id = $1, used_at = NOW() WHERE id = $2`,
        [tenantId, inviteCodeId]
      );
    }

    // Create owner user
    const passwordHash = await bcrypt.hash(value.password, 10);
    const { rows: user } = await pool.query(
      `INSERT INTO tenant_users (tenant_id, email, password_hash, name, role)
       VALUES ($1, $2, $3, $4, 'owner') RETURNING id, email, name, role`,
      [tenantId, value.email, passwordHash, value.ownerName]
    );

    // Generate token
    const token = signTenantToken(user[0], tenantId);

    logger.info(`New tenant registered: ${value.businessName} (${tenantId})`);

    res.status(201).json({
      message: 'Account created successfully!',
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
      `SELECT u.*, t.id as tenant_id, t.business_name, t.is_active as tenant_active, t.features
       FROM tenant_users u
       JOIN tenants t ON t.id = u.tenant_id
       WHERE u.email = $1 AND u.is_active = true`,
      [value.email]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Verify password against first match (same password hash across tenants)
    const user = rows[0];

    if (!user.tenant_active) {
      return res.status(403).json({ error: 'Your business account has been deactivated' });
    }

    const validPassword = await bcrypt.compare(value.password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Build list of all tenants this user belongs to
    const tenants = rows
      .filter(r => r.tenant_active)
      .map(r => ({ id: r.tenant_id, businessName: r.business_name, features: r.features || {} }));

    // If user has multiple tenants and no tenantId specified, return tenant list
    if (tenants.length > 1 && !req.body.tenantId) {
      return res.json({
        requiresBranchSelection: true,
        tenants,
        user: { id: user.id, email: user.email, name: user.name, role: user.role }
      });
    }

    // Select specific tenant (or default to first)
    const selectedTenantId = req.body.tenantId || tenants[0].id;
    const selectedTenant = tenants.find(t => t.id === selectedTenantId);
    if (!selectedTenant) {
      return res.status(400).json({ error: 'Invalid branch selected' });
    }

    const token = signTenantToken(
      { id: user.id, email: user.email, role: user.role },
      selectedTenantId
    );

    res.json({
      token,
      tenant: selectedTenant,
      tenants,
      user: { id: user.id, email: user.email, name: user.name, role: user.role }
    });
  } catch (err) {
    next(err);
  }
});

// ── Switch Branch (get new token for a different tenant) ──
router.post('/switch-branch', async (req, res, next) => {
  try {
    const { tenantId, email } = req.body;
    if (!tenantId || !email) return res.status(400).json({ error: 'tenantId and email required' });

    const { rows } = await pool.query(
      `SELECT u.*, t.business_name, t.features, t.is_active as tenant_active
       FROM tenant_users u
       JOIN tenants t ON t.id = u.tenant_id
       WHERE u.email = $1 AND u.tenant_id = $2 AND u.is_active = true`,
      [email, tenantId]
    );

    if (rows.length === 0 || !rows[0].tenant_active) {
      return res.status(403).json({ error: 'Access denied to this branch' });
    }

    const user = rows[0];
    const token = signTenantToken({ id: user.id, email: user.email, role: user.role }, tenantId);

    // Get all tenants for this user
    const { rows: allTenants } = await pool.query(
      `SELECT t.id, t.business_name, t.features FROM tenant_users u
       JOIN tenants t ON t.id = u.tenant_id
       WHERE u.email = $1 AND u.is_active = true AND t.is_active = true`,
      [email]
    );

    res.json({
      token,
      tenant: { id: tenantId, businessName: user.business_name, features: user.features || {} },
      tenants: allTenants.map(t => ({ id: t.id, businessName: t.business_name, features: t.features || {} })),
      user: { id: user.id, email: user.email, name: user.name, role: user.role }
    });
  } catch (err) {
    next(err);
  }
});

// ── Add Branch (create new tenant for existing user) ──────
router.post('/add-branch', async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Authentication required' });

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (jwtErr) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    if (decoded.type !== 'tenant_user') return res.status(403).json({ error: 'Invalid token type' });

    const schema = Joi.object({
      businessName: Joi.string().min(2).max(200).required(),
      businessType: Joi.string().valid('clinic', 'salon', 'spa', 'consulting', 'dental', 'veterinary', 'physiotherapy', 'other').default('clinic'),
      phone: Joi.string().max(20).allow('', null),
      city: Joi.string().max(100).allow('', null),
    });

    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    // Get user's existing details from current tenant
    const { rows: existingUser } = await pool.query(
      'SELECT password_hash, name, email FROM tenant_users WHERE id = $1',
      [decoded.id]
    );
    if (existingUser.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get current tenant for copying timezone/country defaults
    const { rows: currentTenant } = await pool.query(
      'SELECT timezone, country FROM tenants WHERE id = $1', [decoded.tenantId]
    );

    let slug = slugify(value.businessName, { lower: true, strict: true });
    if (!slug) slug = `branch-${Date.now().toString(36)}`;
    const { rows: slugCheck } = await pool.query('SELECT id FROM tenants WHERE slug = $1', [slug]);
    if (slugCheck.length > 0) slug = `${slug}-${Date.now().toString(36)}`;

    const tz = currentTenant.length > 0 ? currentTenant[0].timezone : 'Asia/Kolkata';
    const country = currentTenant.length > 0 ? currentTenant[0].country : 'IN';

    // Create new tenant (branch) — each branch gets its own WA number, doctors, settings
    const { rows: tenant } = await pool.query(
      `INSERT INTO tenants (business_name, business_type, slug, email, phone, city, timezone, country)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [value.businessName, value.businessType, slug, decoded.email, value.phone || null, value.city || null, tz, country]
    );

    const newTenantId = tenant[0].id;

    // Create same user in new tenant (same name, email, password — only tenant_id differs)
    await pool.query(
      `INSERT INTO tenant_users (tenant_id, email, password_hash, name, role)
       VALUES ($1, $2, $3, $4, 'owner')`,
      [newTenantId, decoded.email, existingUser[0].password_hash, existingUser[0].name]
    );

    // Get all tenants for response
    const { rows: allTenants } = await pool.query(
      `SELECT t.id, t.business_name, t.features FROM tenant_users u
       JOIN tenants t ON t.id = u.tenant_id
       WHERE u.email = $1 AND u.is_active = true AND t.is_active = true`,
      [decoded.email]
    );

    logger.info(`New branch created: ${value.businessName} (${newTenantId}) by user ${decoded.email}`);

    res.status(201).json({
      tenant: { id: newTenantId, businessName: tenant[0].business_name, features: tenant[0].features || {} },
      tenants: allTenants.map(t => ({ id: t.id, businessName: t.business_name, features: t.features || {} }))
    });
  } catch (err) {
    logger.error('Add branch error:', err);
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
