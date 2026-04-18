// ============================================================
// Tenant Cache — In-Memory with TTL
// ============================================================
// Prevents redundant DB lookups for tenant config on every
// inbound WhatsApp message and every dashboard API call.
//
// Two caches:
//   byId:      tenantId      → tenant row (dashboard API requests)
//   byPhoneId: phoneNumberId → tenant row (webhook messages)
//
// TTL: 5 minutes. Invalidate on settings/config save.

const pool = require('../db/pool');
const logger = require('../utils/logger');

const TTL_MS = 5 * 60 * 1000; // 5 minutes

const cacheById = new Map();     // tenantId → { data, expiresAt }
const cacheByPhone = new Map();  // phoneNumberId → { data, expiresAt }

function isValid(entry) {
  return entry && entry.expiresAt > Date.now();
}

/**
 * Get tenant by ID (for dashboard API calls)
 */
async function getById(tenantId) {
  const cached = cacheById.get(tenantId);
  if (isValid(cached)) return cached.data;

  const { rows } = await pool.query(
    `SELECT * FROM tenants WHERE id = $1 AND is_active = true`,
    [tenantId]
  );
  const tenant = rows[0] || null;
  if (tenant) {
    cacheById.set(tenantId, { data: tenant, expiresAt: Date.now() + TTL_MS });
  }
  return tenant;
}

/**
 * Get tenant by WA phone_number_id (for webhook)
 */
async function getByPhoneNumberId(phoneNumberId) {
  const cached = cacheByPhone.get(phoneNumberId);
  if (isValid(cached)) return cached.data;

  const { rows } = await pool.query(
    `SELECT t.* FROM tenants t
     JOIN wa_number_registry r ON r.tenant_id = t.id
     WHERE r.wa_phone_number_id = $1 AND r.is_active = true AND t.is_active = true`,
    [phoneNumberId]
  );
  const tenant = rows[0] || null;
  if (tenant) {
    cacheByPhone.set(phoneNumberId, { data: tenant, expiresAt: Date.now() + TTL_MS });
  }
  return tenant;
}

/**
 * Invalidate cache for a specific tenant (call after settings/config save)
 */
function invalidate(tenantId) {
  cacheById.delete(tenantId);
  // Also clear any phone entries pointing to this tenant
  for (const [phoneId, entry] of cacheByPhone.entries()) {
    if (entry.data?.id === tenantId) {
      cacheByPhone.delete(phoneId);
    }
  }
  logger.info(`Tenant cache invalidated: ${tenantId}`);
}

/**
 * Clear entire cache (for testing or admin operations)
 */
function clearAll() {
  cacheById.clear();
  cacheByPhone.clear();
}

module.exports = { getById, getByPhoneNumberId, invalidate, clearAll };
