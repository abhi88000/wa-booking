#!/usr/bin/env node
// ============================================================
// WA Booking SaaS — Full System Validation Script
// ============================================================
// Tests every endpoint, frontend URL, DB connection, and webhook.
// Run: node scripts/validate.js [BASE_URL]
//
// Examples:
//   node scripts/validate.js                          # localhost
//   node scripts/validate.js https://api.futurezminds.in  # production

try { require('dotenv').config(); } catch (_) { /* dotenv optional */ }
const http = require('http');
const https = require('https');

const BASE = process.argv[2] || 'http://localhost:4000';
const TENANT_URL = process.argv[3] || (BASE.includes('futurezminds') ? 'https://booking.futurezminds.in' : 'http://localhost:3000');
const ADMIN_URL = process.argv[4] || (BASE.includes('futurezminds') ? 'https://hub.futurezminds.in' : 'http://localhost:3001');

// ── State ──
let tenantToken = null;
let platformToken = null;
let tenantId = null;
let passed = 0;
let failed = 0;
let skipped = 0;
const failures = [];

// ── HTTP Helper ──
function request(method, url, body = null, token = null) {
  return new Promise((resolve) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;
    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method,
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000,
    };
    if (token) options.headers['Authorization'] = `Bearer ${token}`;

    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (_) {}
        resolve({ status: res.statusCode, data: json, raw: data });
      });
    });
    req.on('error', (err) => resolve({ status: 0, error: err.message }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, error: 'TIMEOUT' }); });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// ── Test Runner ──
async function test(name, fn) {
  try {
    const result = await fn();
    if (result === 'SKIP') {
      skipped++;
      console.log(`  ⊘  ${name} (skipped)`);
    } else {
      passed++;
      console.log(`  ✓  ${name}`);
    }
  } catch (err) {
    failed++;
    const msg = err.message || String(err);
    failures.push({ name, error: msg });
    console.log(`  ✗  ${name} — ${msg}`);
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg);
}

// ============================================================
// TEST SUITES
// ============================================================

async function run() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  WA Booking SaaS — Validation`);
  console.log(`  API:      ${BASE}`);
  console.log(`  Tenant:   ${TENANT_URL}`);
  console.log(`  Admin:    ${ADMIN_URL}`);
  console.log(`${'='.repeat(60)}\n`);

  // ── 1. BACKEND HEALTH ──
  console.log('── Backend Health ──');

  await test('GET /health returns ok', async () => {
    const r = await request('GET', `${BASE}/health`);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(r.data?.status === 'ok', 'Missing status: ok');
  });

  // ── 2. WEBHOOK ──
  console.log('\n── Webhook ──');

  await test('GET /webhook/whatsapp — bad token returns 403', async () => {
    const r = await request('GET', `${BASE}/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=WRONG&hub.challenge=test123`);
    assert(r.status === 403, `Expected 403, got ${r.status}`);
  });

  await test('GET /webhook/whatsapp — correct token returns challenge', async () => {
    const token = process.env.WA_VERIFY_TOKEN;
    if (!token) return 'SKIP';
    const r = await request('GET', `${BASE}/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=${token}&hub.challenge=validation_ok`);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(r.raw === 'validation_ok', `Expected challenge echo, got: ${r.raw}`);
  });

  await test('POST /webhook/whatsapp — empty body returns 200', async () => {
    const r = await request('POST', `${BASE}/webhook/whatsapp`, { object: 'whatsapp_business_account', entry: [] });
    assert(r.status === 200, `Expected 200, got ${r.status}`);
  });

  // ── 3. AUTH ──
  console.log('\n── Auth ──');

  await test('POST /api/auth/login — bad creds returns 401', async () => {
    const r = await request('POST', `${BASE}/api/auth/login`, { email: 'nobody@test.com', password: 'wrong' });
    assert(r.status === 401 || r.status === 400, `Expected 401/400, got ${r.status}`);
  });

  await test('POST /api/auth/platform/login — bad creds returns 401', async () => {
    const r = await request('POST', `${BASE}/api/auth/platform/login`, { email: 'nobody@test.com', password: 'wrong' });
    assert(r.status === 401 || r.status === 400, `Expected 401/400, got ${r.status}`);
  });

  // Try real platform login if env vars are set
  const adminEmail = process.env.PLATFORM_ADMIN_EMAIL;
  const adminPass = process.env.PLATFORM_ADMIN_PASSWORD;

  if (adminEmail && adminPass) {
    await test('POST /api/auth/platform/login — real admin login', async () => {
      const r = await request('POST', `${BASE}/api/auth/platform/login`, { email: adminEmail, password: adminPass });
      assert(r.status === 200, `Expected 200, got ${r.status}: ${JSON.stringify(r.data)}`);
      assert(r.data?.token, 'No token returned');
      platformToken = r.data.token;
    });
  } else {
    await test('Platform admin login (skipped — set PLATFORM_ADMIN_EMAIL & PLATFORM_ADMIN_PASSWORD)', async () => 'SKIP');
  }

  const tenantEmail = process.env.TENANT_EMAIL;
  const tenantPass = process.env.TENANT_PASSWORD;

  if (tenantEmail && tenantPass) {
    await test('POST /api/auth/login — real tenant login', async () => {
      const r = await request('POST', `${BASE}/api/auth/login`, { email: tenantEmail, password: tenantPass });
      assert(r.status === 200, `Expected 200, got ${r.status}: ${JSON.stringify(r.data)}`);
      assert(r.data?.token, 'No token returned');
      tenantToken = r.data.token;
    });
  } else {
    await test('Tenant login (skipped — set TENANT_EMAIL & TENANT_PASSWORD)', async () => 'SKIP');
  }

  // ── 4. UNAUTHENTICATED ACCESS ──
  console.log('\n── Auth Guards ──');

  await test('GET /api/tenant/dashboard — no token returns 401', async () => {
    const r = await request('GET', `${BASE}/api/tenant/dashboard`);
    assert(r.status === 401, `Expected 401, got ${r.status}`);
  });

  await test('GET /api/platform/dashboard — no token returns 401', async () => {
    const r = await request('GET', `${BASE}/api/platform/dashboard`);
    assert(r.status === 401, `Expected 401, got ${r.status}`);
  });

  await test('GET /api/onboarding/status — no token returns 401', async () => {
    const r = await request('GET', `${BASE}/api/onboarding/status`);
    assert(r.status === 401, `Expected 401, got ${r.status}`);
  });

  // ── 5. PLATFORM ADMIN ENDPOINTS ──
  console.log('\n── Platform Admin Endpoints ──');

  if (!platformToken) {
    await test('Platform endpoints (skipped — no admin token)', async () => 'SKIP');
  } else {
    await test('GET /api/platform/dashboard', async () => {
      const r = await request('GET', `${BASE}/api/platform/dashboard`, null, platformToken);
      assert(r.status === 200, `Expected 200, got ${r.status}`);
      assert(r.data?.total_tenants !== undefined, 'Missing total_tenants');
    });

    await test('GET /api/platform/tenants', async () => {
      const r = await request('GET', `${BASE}/api/platform/tenants`, null, platformToken);
      assert(r.status === 200, `Expected 200, got ${r.status}`);
      assert(Array.isArray(r.data?.tenants), 'tenants should be an array');
      if (r.data.tenants.length > 0) tenantId = r.data.tenants[0].id;
    });

    await test('GET /api/platform/tenants/:id', async () => {
      if (!tenantId) return 'SKIP';
      const r = await request('GET', `${BASE}/api/platform/tenants/${tenantId}`, null, platformToken);
      assert(r.status === 200, `Expected 200, got ${r.status}`);
      assert(r.data?.business_name, 'Missing business_name');
    });

    await test('GET /api/platform/analytics', async () => {
      const r = await request('GET', `${BASE}/api/platform/analytics`, null, platformToken);
      assert(r.status === 200, `Expected 200, got ${r.status}`);
      assert(r.data?.signups !== undefined, 'Missing signups data');
    });

    await test('GET /api/platform/health', async () => {
      const r = await request('GET', `${BASE}/api/platform/health`, null, platformToken);
      assert(r.status === 200, `Expected 200, got ${r.status}`);
      assert(r.data?.summary !== undefined, 'Missing summary');
    });

    await test('GET /api/platform/invite-codes', async () => {
      const r = await request('GET', `${BASE}/api/platform/invite-codes`, null, platformToken);
      assert(r.status === 200, `Expected 200, got ${r.status}`);
      assert(Array.isArray(r.data), 'Should be an array');
    });

    await test('GET /api/platform/errors/:tenantId', async () => {
      if (!tenantId) return 'SKIP';
      const r = await request('GET', `${BASE}/api/platform/errors/${tenantId}`, null, platformToken);
      assert(r.status === 200, `Expected 200, got ${r.status}`);
    });
  }

  // ── 6. TENANT ENDPOINTS ──
  console.log('\n── Tenant Endpoints ──');

  if (!tenantToken) {
    await test('Tenant endpoints (skipped — no tenant token)', async () => 'SKIP');
  } else {
    await test('GET /api/tenant/dashboard', async () => {
      const r = await request('GET', `${BASE}/api/tenant/dashboard`, null, tenantToken);
      assert(r.status === 200, `Expected 200, got ${r.status}`);
    });

    await test('GET /api/tenant/appointments', async () => {
      const r = await request('GET', `${BASE}/api/tenant/appointments`, null, tenantToken);
      assert(r.status === 200, `Expected 200, got ${r.status}`);
      assert(Array.isArray(r.data?.appointments), 'appointments should be array');
    });

    await test('GET /api/tenant/doctors', async () => {
      const r = await request('GET', `${BASE}/api/tenant/doctors`, null, tenantToken);
      assert(r.status === 200, `Expected 200, got ${r.status}`);
      assert(Array.isArray(r.data), 'Should be an array');
    });

    await test('GET /api/tenant/services', async () => {
      const r = await request('GET', `${BASE}/api/tenant/services`, null, tenantToken);
      assert(r.status === 200, `Expected 200, got ${r.status}`);
      assert(Array.isArray(r.data), 'Should be an array');
    });

    await test('GET /api/tenant/patients', async () => {
      const r = await request('GET', `${BASE}/api/tenant/patients`, null, tenantToken);
      assert(r.status === 200, `Expected 200, got ${r.status}`);
      assert(Array.isArray(r.data?.patients), 'patients should be array');
    });

    await test('GET /api/tenant/settings', async () => {
      const r = await request('GET', `${BASE}/api/tenant/settings`, null, tenantToken);
      assert(r.status === 200, `Expected 200, got ${r.status}`);
      assert(r.data?.business_name, 'Missing business_name');
    });

    await test('GET /api/tenant/team', async () => {
      const r = await request('GET', `${BASE}/api/tenant/team`, null, tenantToken);
      assert(r.status === 200, `Expected 200, got ${r.status}`);
    });

    await test('GET /api/onboarding/status', async () => {
      const r = await request('GET', `${BASE}/api/onboarding/status`, null, tenantToken);
      assert(r.status === 200, `Expected 200, got ${r.status}`);
    });
  }

  // ── 7. FRONTEND PAGES ──
  console.log('\n── Frontend Pages ──');

  await test(`Tenant dashboard loads (${TENANT_URL})`, async () => {
    const r = await request('GET', TENANT_URL);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(r.raw?.includes('<html') || r.raw?.includes('<!DOCTYPE'), 'Not HTML');
  });

  await test(`Tenant /privacy page`, async () => {
    const r = await request('GET', `${TENANT_URL}/privacy`);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
  });

  await test(`Tenant /terms page`, async () => {
    const r = await request('GET', `${TENANT_URL}/terms`);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
  });

  await test(`Tenant /data-deletion page`, async () => {
    const r = await request('GET', `${TENANT_URL}/data-deletion`);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
  });

  await test(`Super admin loads (${ADMIN_URL})`, async () => {
    const r = await request('GET', ADMIN_URL);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(r.raw?.includes('<html') || r.raw?.includes('<!DOCTYPE'), 'Not HTML');
  });

  // ── 8. 404 HANDLING ──
  console.log('\n── Error Handling ──');

  await test('GET /api/nonexistent returns 404', async () => {
    const r = await request('GET', `${BASE}/api/nonexistent-route-xyz`);
    assert(r.status === 404, `Expected 404, got ${r.status}`);
  });

  await test('POST /api/auth/signup — missing fields returns 400', async () => {
    const r = await request('POST', `${BASE}/api/auth/signup`, { email: 'test' });
    assert(r.status === 400, `Expected 400, got ${r.status}`);
  });

  // ── RESULTS ──
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  RESULTS: ${passed} passed, ${failed} failed, ${skipped} skipped`);
  console.log(`${'='.repeat(60)}`);

  if (failures.length > 0) {
    console.log('\n  FAILURES:');
    failures.forEach((f, i) => {
      console.log(`    ${i + 1}. ${f.name}`);
      console.log(`       ${f.error}`);
    });
  }

  console.log('');
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('Validation script crashed:', err);
  process.exit(1);
});
