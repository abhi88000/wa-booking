// ============================================================
// JWT Authentication Middleware
// ============================================================

const jwt = require('jsonwebtoken');
const pool = require('../db/pool');

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-in-production';

/**
 * Authenticate platform admin (Super Admin)
 */
function authPlatform(req, res, next) {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.type !== 'platform_admin') {
      return res.status(403).json({ error: 'Platform admin access required' });
    }
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Authenticate tenant user (business admin/staff)
 * Automatically sets req.tenantId from the JWT
 */
function authTenant(req, res, next) {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.type !== 'tenant_user') {
      return res.status(403).json({ error: 'Tenant access required' });
    }
    req.user = decoded;
    req.tenantId = decoded.tenantId;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Check specific tenant role
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: `Role ${roles.join(' or ')} required` });
    }
    next();
  };
}

/**
 * Generate JWT for platform admin
 */
function signPlatformToken(admin) {
  return jwt.sign(
    { id: admin.id, email: admin.email, role: admin.role, type: 'platform_admin' },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

/**
 * Generate JWT for tenant user
 */
function signTenantToken(user, tenantId) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, tenantId, type: 'tenant_user' },
    JWT_SECRET,
    { expiresIn: '12h' }
  );
}

function extractToken(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
}

module.exports = { authPlatform, authTenant, requireRole, signPlatformToken, signTenantToken };
