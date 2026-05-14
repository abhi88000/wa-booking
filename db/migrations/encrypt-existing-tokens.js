#!/usr/bin/env node
// ============================================================
// One-time migration: Encrypt existing plaintext WA access tokens
// ============================================================
// Usage: ENCRYPTION_KEY=your-key node db/migrations/encrypt-existing-tokens.js
//
// This script reads all plaintext tokens, encrypts them, and updates the DB.
// Safe to run multiple times — skips already-encrypted tokens.

require('dotenv').config();
const pool = require('../../backend/src/db/pool');
const { encrypt } = require('../../backend/src/utils/encryption');

const ENCRYPTED_PATTERN = /^[0-9a-f]{32}:[0-9a-f]{32}:[0-9a-f]+$/;

async function main() {
  if (!process.env.ENCRYPTION_KEY) {
    console.error('ERROR: ENCRYPTION_KEY env var is required');
    process.exit(1);
  }

  const { rows } = await pool.query(
    'SELECT id, business_name, wa_access_token FROM tenants WHERE wa_access_token IS NOT NULL'
  );

  console.log(`Found ${rows.length} tenants with WA tokens`);

  let encrypted = 0;
  let skipped = 0;

  for (const tenant of rows) {
    if (ENCRYPTED_PATTERN.test(tenant.wa_access_token)) {
      console.log(`  SKIP ${tenant.business_name} — already encrypted`);
      skipped++;
      continue;
    }

    const encryptedToken = encrypt(tenant.wa_access_token);
    await pool.query(
      'UPDATE tenants SET wa_access_token = $1, updated_at = NOW() WHERE id = $2',
      [encryptedToken, tenant.id]
    );
    console.log(`  OK   ${tenant.business_name} — token encrypted`);
    encrypted++;
  }

  console.log(`\nDone: ${encrypted} encrypted, ${skipped} skipped`);
  await pool.end();
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
