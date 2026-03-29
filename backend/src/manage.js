#!/usr/bin/env node
// ============================================================
// BookingBot CLI — Your Command Center
// ============================================================
// Usage:
//   node src/manage.js list                  — List all tenants
//   node src/manage.js add                   — Add new tenant interactively
//   node src/manage.js health                — Check health of all tenants
//   node src/manage.js health <tenant-id>    — Check specific tenant's health
//   node src/manage.js logs <tenant-id>      — View recent activity for a tenant
//   node src/manage.js fix-wa <tenant-id>    — Update a tenant's WA credentials
//   node src/manage.js deactivate <tenant-id>— Deactivate a tenant
//   node src/manage.js activate <tenant-id>  — Reactivate a tenant
//   node src/manage.js reset-chat <phone>    — Reset stuck conversation state
//   node src/manage.js stats                 — Platform-wide statistics
//   node src/manage.js create-admin          — Create a new platform admin
//   node src/manage.js db-check              — Check database connectivity + tables

require('dotenv').config();
const pool = require('./db/pool');
const bcrypt = require('bcrypt');
const readline = require('readline');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise(resolve => rl.question(q, resolve));

// ── Color helpers for terminal output ─────────────────────
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

function ok(msg) { console.log(`${GREEN}✓${RESET} ${msg}`); }
function warn(msg) { console.log(`${YELLOW}⚠${RESET} ${msg}`); }
function err(msg) { console.log(`${RED}✗${RESET} ${msg}`); }
function info(msg) { console.log(`${CYAN}ℹ${RESET} ${msg}`); }
function heading(msg) { console.log(`\n${BOLD}${msg}${RESET}\n${'─'.repeat(60)}`); }

// ── TABLE FORMATTER ───────────────────────────────────────
function table(rows, columns) {
  if (rows.length === 0) { warn('No data'); return; }
  const widths = {};
  columns.forEach(c => widths[c.key] = c.label.length);
  rows.forEach(r => {
    columns.forEach(c => {
      const val = String(r[c.key] ?? '');
      widths[c.key] = Math.max(widths[c.key], val.length);
    });
  });
  
  const header = columns.map(c => c.label.padEnd(widths[c.key])).join('  ');
  console.log(`${DIM}${header}${RESET}`);
  console.log(columns.map(c => '─'.repeat(widths[c.key])).join('──'));
  
  rows.forEach(r => {
    const line = columns.map(c => {
      let val = String(r[c.key] ?? '');
      if (c.color) val = `${c.color}${val}${RESET}`;
      return val.padEnd(widths[c.key] + (c.color ? c.color.length + RESET.length : 0));
    }).join('  ');
    console.log(line);
  });
}

// ════════════════════════════════════════════════════════════
// COMMANDS
// ════════════════════════════════════════════════════════════

async function cmdList() {
  heading('All Tenants');
  const { rows } = await pool.query(`
    SELECT t.id, t.business_name, t.business_type, t.email, t.wa_status, 
           t.is_active, t.onboarding_status, t.created_at,
           s.plan, s.status as sub_status,
           (SELECT COUNT(*) FROM appointments WHERE tenant_id = t.id) as total_appts,
           (SELECT COUNT(*) FROM patients WHERE tenant_id = t.id) as total_patients,
           (SELECT COUNT(*) FROM doctors WHERE tenant_id = t.id AND is_active = true) as doctors
    FROM tenants t
    LEFT JOIN subscriptions s ON s.tenant_id = t.id
    ORDER BY t.created_at DESC
  `);

  if (rows.length === 0) {
    warn('No tenants yet. Use "node src/manage.js add" to create one.');
    return;
  }

  rows.forEach(t => {
    const active = t.is_active ? `${GREEN}active${RESET}` : `${RED}inactive${RESET}`;
    const wa = t.wa_status === 'connected' ? `${GREEN}WA connected${RESET}` : 
               t.wa_status === 'pending' ? `${YELLOW}WA pending${RESET}` : `${RED}WA disconnected${RESET}`;
    
    console.log(`${BOLD}${t.business_name}${RESET} ${DIM}(${t.business_type})${RESET}`);
    console.log(`  ID:       ${t.id}`);
    console.log(`  Email:    ${t.email}`);
    console.log(`  Status:   ${active} | ${wa} | Onboarding: ${t.onboarding_status}`);
    console.log(`  Plan:     ${t.plan || 'trial'} (${t.sub_status || 'unknown'})`);
    console.log(`  Usage:    ${t.doctors} doctors | ${t.total_patients} patients | ${t.total_appts} appointments`);
    console.log(`  Since:    ${new Date(t.created_at).toLocaleDateString()}`);
    console.log();
  });

  info(`Total: ${rows.length} tenants`);
}

async function cmdAdd() {
  heading('Add New Tenant');
  info('Fill in the business details:\n');

  const businessName = await ask('Business name: ');
  const businessType = await ask('Business type (clinic/salon/dental/spa/consulting) [clinic]: ') || 'clinic';
  const email = await ask('Owner email: ');
  const phone = await ask('Owner phone: ');
  const ownerName = await ask('Owner name: ');
  const city = await ask('City: ');
  const password = await ask('Temporary password: ');

  if (!businessName || !email || !ownerName || !password) {
    err('Business name, email, owner name, and password are required.');
    return;
  }

  const slugify = require('slugify');
  let slug = slugify(businessName, { lower: true, strict: true });
  const { rows: slugCheck } = await pool.query('SELECT id FROM tenants WHERE slug = $1', [slug]);
  if (slugCheck.length > 0) slug = `${slug}-${Date.now().toString(36)}`;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: tenant } = await client.query(
      `INSERT INTO tenants (business_name, business_type, slug, email, phone, city)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [businessName, businessType, slug, email, phone, city]
    );
    const tenantId = tenant[0].id;

    const passwordHash = await bcrypt.hash(password, 10);
    await client.query(
      `INSERT INTO tenant_users (tenant_id, email, password_hash, name, role)
       VALUES ($1, $2, $3, $4, 'owner')`,
      [tenantId, email, passwordHash, ownerName]
    );

    await client.query(
      `INSERT INTO subscriptions (tenant_id, plan, status, trial_ends_at)
       VALUES ($1, 'trial', 'trial', NOW() + INTERVAL '14 days')`,
      [tenantId]
    );

    await client.query('COMMIT');

    ok(`Tenant created: ${businessName}`);
    info(`ID:    ${tenantId}`);
    info(`Slug:  ${slug}`);
    info(`Login: ${email} / ${password}`);
    console.log();
    info('Next: Have them log in and complete onboarding (connect WhatsApp + add doctors).');
    info(`Or update WA credentials with: node src/manage.js fix-wa ${tenantId}`);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function cmdHealth(tenantId) {
  if (tenantId) {
    return await checkTenantHealth(tenantId);
  }

  heading('Health Check — All Tenants');
  const { rows } = await pool.query(`
    SELECT t.id, t.business_name, t.wa_status, t.wa_phone_number_id, 
           t.wa_access_token, t.is_active, t.onboarding_status,
           s.status as sub_status, s.trial_ends_at, s.plan
    FROM tenants t
    LEFT JOIN subscriptions s ON s.tenant_id = t.id
    WHERE t.is_active = true
    ORDER BY t.business_name
  `);

  let healthy = 0, warnings = 0, critical = 0;

  for (const t of rows) {
    const issues = [];

    // WhatsApp status
    if (t.wa_status !== 'connected') issues.push(`WA ${t.wa_status}`);
    if (!t.wa_phone_number_id) issues.push('No WA phone configured');
    if (!t.wa_access_token) issues.push('No WA access token');

    // Subscription
    if (t.sub_status === 'trial') {
      const daysLeft = Math.ceil((new Date(t.trial_ends_at) - new Date()) / (1000*60*60*24));
      if (daysLeft < 0) issues.push(`Trial expired ${Math.abs(daysLeft)} days ago`);
      else if (daysLeft <= 3) issues.push(`Trial expires in ${daysLeft} days`);
    }
    if (t.sub_status === 'expired' || t.sub_status === 'cancelled') {
      issues.push(`Subscription ${t.sub_status}`);
    }

    // Onboarding
    if (t.onboarding_status !== 'active' && t.onboarding_status !== 'setup_complete') {
      issues.push(`Onboarding: ${t.onboarding_status}`);
    }

    // Recent errors (check last 24h)
    const { rows: recentErrors } = await pool.query(`
      SELECT COUNT(*) as err_count FROM audit_log 
      WHERE tenant_id = $1 AND action LIKE '%error%' AND created_at >= NOW() - INTERVAL '24 hours'
    `, [t.id]);
    const errCount = parseInt(recentErrors[0]?.err_count || 0);
    if (errCount > 0) issues.push(`${errCount} errors in last 24h`);

    // Recent activity
    const { rows: recentMsg } = await pool.query(`
      SELECT MAX(created_at) as last_msg FROM chat_messages WHERE tenant_id = $1
    `, [t.id]);
    const lastMsg = recentMsg[0]?.last_msg;
    if (t.wa_status === 'connected' && lastMsg) {
      const daysSince = Math.floor((new Date() - new Date(lastMsg)) / (1000*60*60*24));
      if (daysSince > 7) issues.push(`No messages in ${daysSince} days`);
    }

    // Report
    if (issues.length === 0) {
      ok(`${t.business_name} (${t.plan || 'trial'}) — All good`);
      healthy++;
    } else {
      const severity = issues.some(i => i.includes('expired') || i.includes('No WA')) ? RED : YELLOW;
      console.log(`${severity}⚠${RESET} ${t.business_name} (${t.plan || 'trial'})`);
      issues.forEach(i => console.log(`    → ${i}`));
      if (severity === RED) critical++; else warnings++;
    }
  }

  console.log();
  heading('Summary');
  ok(`${healthy} healthy`);
  if (warnings) warn(`${warnings} with warnings`);
  if (critical) err(`${critical} critical`);
}

async function checkTenantHealth(tenantId) {
  heading('Tenant Health Check');

  const { rows } = await pool.query(`
    SELECT t.*, s.plan, s.status as sub_status, s.trial_ends_at
    FROM tenants t
    LEFT JOIN subscriptions s ON s.tenant_id = t.id
    WHERE t.id = $1
  `, [tenantId]);

  if (rows.length === 0) { err(`Tenant not found: ${tenantId}`); return; }
  const t = rows[0];

  console.log(`${BOLD}${t.business_name}${RESET} (${t.business_type})\n`);

  // 1. Account status
  t.is_active ? ok('Account active') : err('Account DEACTIVATED');

  // 2. Subscription
  if (t.sub_status === 'active') ok(`Plan: ${t.plan} (active)`);
  else if (t.sub_status === 'trial') {
    const daysLeft = Math.ceil((new Date(t.trial_ends_at) - new Date()) / (1000*60*60*24));
    daysLeft > 3 ? ok(`Trial: ${daysLeft} days left`) : warn(`Trial: ${daysLeft} days left!`);
  } else err(`Subscription: ${t.sub_status}`);

  // 3. WhatsApp
  if (t.wa_status === 'connected' && t.wa_phone_number_id && t.wa_access_token) {
    ok(`WhatsApp connected (${t.wa_phone_number || t.wa_phone_number_id})`);
    
    // Test WA API connection
    const axios = require('axios');
    try {
      const resp = await axios.get(
        `https://graph.facebook.com/v21.0/${t.wa_phone_number_id}`,
        { headers: { Authorization: `Bearer ${t.wa_access_token}` }, timeout: 10000 }
      );
      ok(`WA API responding (verified_name: ${resp.data.verified_name || 'N/A'})`);
    } catch (waErr) {
      const errMsg = waErr.response?.data?.error?.message || waErr.message;
      err(`WA API ERROR: ${errMsg}`);
      warn('Fix: node src/manage.js fix-wa ' + tenantId);
    }
  } else {
    err(`WhatsApp not connected (status: ${t.wa_status})`);
  }

  // 4. Data check
  const { rows: counts } = await pool.query(`
    SELECT 
      (SELECT COUNT(*) FROM doctors WHERE tenant_id = $1 AND is_active = true) as doctors,
      (SELECT COUNT(*) FROM services WHERE tenant_id = $1 AND is_active = true) as services,
      (SELECT COUNT(*) FROM patients WHERE tenant_id = $1) as patients,
      (SELECT COUNT(*) FROM appointments WHERE tenant_id = $1) as total_appts,
      (SELECT COUNT(*) FROM appointments WHERE tenant_id = $1 AND status = 'confirmed' AND appointment_date >= CURRENT_DATE) as upcoming,
      (SELECT COUNT(*) FROM reminders WHERE tenant_id = $1 AND sent = false AND remind_at <= NOW()) as pending_reminders,
      (SELECT MAX(created_at) FROM chat_messages WHERE tenant_id = $1) as last_message,
      (SELECT MAX(created_at) FROM appointments WHERE tenant_id = $1) as last_appointment
  `, [tenantId]);
  const c = counts[0];

  parseInt(c.doctors) > 0 ? ok(`Doctors: ${c.doctors}`) : warn('No doctors set up');
  parseInt(c.services) > 0 ? ok(`Services: ${c.services}`) : warn('No services set up');
  info(`Patients: ${c.patients} | Appointments: ${c.total_appts} (${c.upcoming} upcoming)`);
  
  if (parseInt(c.pending_reminders) > 0) {
    warn(`${c.pending_reminders} unsent reminders (cron worker may be down)`);
  }

  if (c.last_message) {
    const ago = Math.floor((new Date() - new Date(c.last_message)) / (1000*60*60));
    info(`Last WA message: ${ago < 24 ? `${ago}h ago` : `${Math.floor(ago/24)}d ago`}`);
  } else {
    warn('No messages received yet');
  }

  // 5. Check for stuck conversations
  const { rows: stuck } = await pool.query(`
    SELECT phone, wa_conversation_state FROM patients 
    WHERE tenant_id = $1 
    AND wa_conversation_state->>'state' NOT IN ('new', 'idle')
    AND updated_at < NOW() - INTERVAL '2 hours'
  `, [tenantId]);

  if (stuck.length > 0) {
    warn(`${stuck.length} stuck conversations (no activity for 2h+):`);
    stuck.forEach(s => console.log(`    → ${s.phone} (state: ${s.wa_conversation_state?.state})`));
    info(`Fix: node src/manage.js reset-chat <phone>`);
  }
}

async function cmdLogs(tenantId) {
  if (!tenantId) { err('Usage: node src/manage.js logs <tenant-id>'); return; }

  heading('Recent Activity');

  const { rows: tenant } = await pool.query('SELECT business_name FROM tenants WHERE id = $1', [tenantId]);
  if (tenant.length === 0) { err('Tenant not found'); return; }
  console.log(`Tenant: ${tenant[0].business_name}\n`);

  // Last 20 messages
  const { rows: msgs } = await pool.query(`
    SELECT cm.direction, cm.phone, cm.content, cm.created_at, cm.message_type,
           p.name as patient_name
    FROM chat_messages cm
    LEFT JOIN patients p ON p.id = cm.patient_id
    WHERE cm.tenant_id = $1
    ORDER BY cm.created_at DESC LIMIT 20
  `, [tenantId]);

  if (msgs.length > 0) {
    console.log(`${BOLD}Last 20 Messages:${RESET}`);
    msgs.reverse().forEach(m => {
      const dir = m.direction === 'inbound' ? `${CYAN}IN ${RESET}` : `${GREEN}OUT${RESET}`;
      const time = new Date(m.created_at).toLocaleString();
      const who = m.patient_name || m.phone;
      const content = (m.content || '').substring(0, 80).replace(/\n/g, ' ');
      console.log(`  ${DIM}${time}${RESET} ${dir} ${who}: ${content}`);
    });
  } else {
    warn('No messages yet');
  }

  // Last 10 appointments
  console.log();
  const { rows: appts } = await pool.query(`
    SELECT a.appointment_date, a.start_time, a.status, d.name as doctor_name, 
           p.name as patient_name, p.phone as patient_phone, a.created_at
    FROM appointments a
    LEFT JOIN doctors d ON d.id = a.doctor_id
    LEFT JOIN patients p ON p.id = a.patient_id
    WHERE a.tenant_id = $1
    ORDER BY a.created_at DESC LIMIT 10
  `, [tenantId]);

  if (appts.length > 0) {
    console.log(`${BOLD}Last 10 Appointments:${RESET}`);
    appts.forEach(a => {
      const statusColor = a.status === 'confirmed' ? GREEN : 
                          a.status === 'cancelled' ? RED : YELLOW;
      console.log(`  ${a.appointment_date} ${a.start_time} | ${a.doctor_name || 'N/A'} | ${a.patient_name || a.patient_phone} | ${statusColor}${a.status}${RESET}`);
    });
  }
}

async function cmdFixWA(tenantId) {
  if (!tenantId) { err('Usage: node src/manage.js fix-wa <tenant-id>'); return; }

  heading('Update WhatsApp Credentials');

  const { rows } = await pool.query('SELECT * FROM tenants WHERE id = $1', [tenantId]);
  if (rows.length === 0) { err('Tenant not found'); return; }
  const t = rows[0];

  console.log(`Tenant: ${t.business_name}`);
  console.log(`Current WA status: ${t.wa_status}`);
  console.log(`Current phone: ${t.wa_phone_number || 'none'}\n`);

  const phoneNumberId = await ask('WhatsApp Phone Number ID: ');
  const wabaId = await ask('WhatsApp Business Account ID: ');
  const accessToken = await ask('Access Token: ');
  const displayPhone = await ask('Display phone number (e.g. +919876543210): ');

  if (!phoneNumberId || !accessToken) {
    err('Phone Number ID and Access Token are required.');
    return;
  }

  // Validate with Meta API
  info('Validating credentials with Meta API...');
  const axios = require('axios');
  try {
    const resp = await axios.get(
      `https://graph.facebook.com/v21.0/${phoneNumberId}`,
      { headers: { Authorization: `Bearer ${accessToken}` }, timeout: 10000 }
    );
    ok(`Meta API verified! Verified name: ${resp.data.verified_name || 'N/A'}`);
  } catch (waErr) {
    err(`Meta API validation failed: ${waErr.response?.data?.error?.message || waErr.message}`);
    const proceed = await ask('Continue anyway? (y/n): ');
    if (proceed.toLowerCase() !== 'y') return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Remove old registry entry
    await client.query('DELETE FROM wa_number_registry WHERE tenant_id = $1', [tenantId]);

    // Update tenant
    await client.query(
      `UPDATE tenants SET 
        wa_phone_number_id = $1, wa_business_account_id = $2, 
        wa_access_token = $3, wa_phone_number = $4,
        wa_status = 'connected', wa_webhook_verified = true, updated_at = NOW()
       WHERE id = $5`,
      [phoneNumberId, wabaId, accessToken, displayPhone, tenantId]
    );

    // Register number
    await client.query(
      `INSERT INTO wa_number_registry (wa_phone_number_id, tenant_id, phone_number, is_active)
       VALUES ($1, $2, $3, true)
       ON CONFLICT (wa_phone_number_id) DO UPDATE SET tenant_id = $2, is_active = true`,
      [phoneNumberId, tenantId, displayPhone]
    );

    await client.query('COMMIT');
    ok('WhatsApp credentials updated successfully!');
    info('New messages to this number will now route to this tenant.');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function cmdDeactivate(tenantId) {
  if (!tenantId) { err('Usage: node src/manage.js deactivate <tenant-id>'); return; }
  const { rows } = await pool.query('SELECT business_name FROM tenants WHERE id = $1', [tenantId]);
  if (rows.length === 0) { err('Tenant not found'); return; }

  const confirm = await ask(`Deactivate "${rows[0].business_name}"? This stops all WA processing. (y/n): `);
  if (confirm.toLowerCase() !== 'y') return;

  await pool.query('UPDATE tenants SET is_active = false, updated_at = NOW() WHERE id = $1', [tenantId]);
  await pool.query('UPDATE wa_number_registry SET is_active = false WHERE tenant_id = $1', [tenantId]);
  ok(`Deactivated: ${rows[0].business_name}`);
}

async function cmdActivate(tenantId) {
  if (!tenantId) { err('Usage: node src/manage.js activate <tenant-id>'); return; }
  await pool.query('UPDATE tenants SET is_active = true, updated_at = NOW() WHERE id = $1', [tenantId]);
  await pool.query('UPDATE wa_number_registry SET is_active = true WHERE tenant_id = $1', [tenantId]);
  ok('Tenant reactivated.');
}

async function cmdResetChat(phone) {
  if (!phone) { err('Usage: node src/manage.js reset-chat <phone>'); return; }

  const { rows } = await pool.query(
    `UPDATE patients SET wa_conversation_state = '{"state": "idle"}', updated_at = NOW()
     WHERE phone = $1 RETURNING tenant_id, name, phone`,
    [phone]
  );

  if (rows.length === 0) {
    err(`No patient found with phone: ${phone}`);
  } else {
    rows.forEach(r => ok(`Reset conversation for ${r.name || r.phone} (tenant: ${r.tenant_id})`));
  }
}

async function cmdStats() {
  heading('Platform Statistics');

  const { rows: stats } = await pool.query(`
    SELECT 
      (SELECT COUNT(*) FROM tenants) as total_tenants,
      (SELECT COUNT(*) FROM tenants WHERE is_active = true) as active_tenants,
      (SELECT COUNT(*) FROM tenants WHERE wa_status = 'connected' AND is_active = true) as live_tenants,
      (SELECT COUNT(*) FROM subscriptions WHERE status = 'active') as paid_subs,
      (SELECT COUNT(*) FROM subscriptions WHERE status = 'trial') as trial_subs,
      (SELECT COUNT(*) FROM patients) as total_patients,
      (SELECT COUNT(*) FROM appointments) as total_appointments,
      (SELECT COUNT(*) FROM appointments WHERE created_at >= NOW() - INTERVAL '24 hours') as appts_24h,
      (SELECT COUNT(*) FROM chat_messages WHERE created_at >= NOW() - INTERVAL '24 hours') as msgs_24h,
      (SELECT COUNT(*) FROM reminders WHERE sent = false AND remind_at <= NOW()) as pending_reminders,
      (SELECT COALESCE(SUM(amount), 0) FROM invoices WHERE status = 'paid') as total_revenue
  `);

  const s = stats[0];
  console.log(`  Tenants:       ${s.total_tenants} total | ${s.active_tenants} active | ${s.live_tenants} live (WA connected)`);
  console.log(`  Subscriptions: ${s.paid_subs} paid | ${s.trial_subs} trial`);
  console.log(`  Patients:      ${s.total_patients} total`);
  console.log(`  Appointments:  ${s.total_appointments} total | ${s.appts_24h} in last 24h`);
  console.log(`  Messages:      ${s.msgs_24h} in last 24h`);
  console.log(`  Revenue:       ₹${parseFloat(s.total_revenue).toLocaleString()}`);
  
  if (parseInt(s.pending_reminders) > 0) {
    console.log();
    warn(`${s.pending_reminders} unsent reminders — check if cron worker is running!`);
  }
}

async function cmdCreateAdmin() {
  heading('Create Platform Admin');
  const email = await ask('Email: ');
  const name = await ask('Name: ');
  const password = await ask('Password: ');
  
  if (!email || !password) { err('Email and password required'); return; }

  const hash = await bcrypt.hash(password, 10);
  await pool.query(
    `INSERT INTO platform_admins (email, password_hash, name, role)
     VALUES ($1, $2, $3, 'super_admin')
     ON CONFLICT (email) DO UPDATE SET password_hash = $2, name = $3`,
    [email, hash, name]
  );
  ok(`Admin created: ${email}`);
}

async function cmdDbCheck() {
  heading('Database Health Check');

  try {
    const { rows: version } = await pool.query('SELECT version()');
    ok(`PostgreSQL: ${version[0].version.split(',')[0]}`);
  } catch (e) {
    err(`Cannot connect to database: ${e.message}`);
    return;
  }

  // Check all required tables exist
  const requiredTables = [
    'tenants', 'subscriptions', 'plans', 'platform_admins', 'wa_number_registry',
    'tenant_users', 'doctors', 'doctor_availability', 'doctor_breaks', 'services',
    'doctor_services', 'patients', 'appointments', 'payments', 'chat_messages',
    'reminders', 'invoices', 'audit_log'
  ];

  const { rows: tables } = await pool.query(
    `SELECT table_name FROM information_schema.tables 
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`
  );
  const existing = new Set(tables.map(t => t.table_name));

  requiredTables.forEach(t => {
    existing.has(t) ? ok(`Table: ${t}`) : err(`MISSING table: ${t}`);
  });

  // Check pool stats
  const { totalCount, idleCount, waitingCount } = pool;
  console.log();
  info(`Connection pool: ${totalCount} total | ${idleCount} idle | ${waitingCount} waiting`);
}

// ════════════════════════════════════════════════════════════
// MAIN
// ════════════════════════════════════════════════════════════

const HELP = `
${BOLD}BookingBot CLI — Management Tool${RESET}

Usage: node src/manage.js <command> [args]

${BOLD}Commands:${RESET}
  list                    List all tenants with status
  add                     Add a new tenant (interactive)
  health                  Health check all tenants
  health <tenant-id>      Health check specific tenant
  logs <tenant-id>        View recent messages & appointments
  fix-wa <tenant-id>      Update WhatsApp credentials
  deactivate <tenant-id>  Deactivate a tenant
  activate <tenant-id>    Reactivate a tenant
  reset-chat <phone>      Reset a stuck conversation
  stats                   Platform-wide statistics
  create-admin            Create/update platform admin
  db-check                Check database connectivity
`;

async function main() {
  const [cmd, arg] = process.argv.slice(2);

  if (!cmd || cmd === 'help' || cmd === '--help') {
    console.log(HELP);
    process.exit(0);
  }

  try {
    switch (cmd) {
      case 'list': await cmdList(); break;
      case 'add': await cmdAdd(); break;
      case 'health': await cmdHealth(arg); break;
      case 'logs': await cmdLogs(arg); break;
      case 'fix-wa': await cmdFixWA(arg); break;
      case 'deactivate': await cmdDeactivate(arg); break;
      case 'activate': await cmdActivate(arg); break;
      case 'reset-chat': await cmdResetChat(arg); break;
      case 'stats': await cmdStats(); break;
      case 'create-admin': await cmdCreateAdmin(); break;
      case 'db-check': await cmdDbCheck(); break;
      default:
        err(`Unknown command: ${cmd}`);
        console.log(HELP);
    }
  } catch (e) {
    err(e.message);
    if (process.env.DEBUG) console.error(e);
  } finally {
    rl.close();
    await pool.end();
  }
}

main();
