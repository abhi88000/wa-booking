// ============================================================
// Cron Runner — Scheduled Jobs (Self-Healing)
// ============================================================
// Run this as: node src/cron.js
// Or use Docker/PM2 to manage it alongside the main server
//
// JOBS:
// 1. Reminders          — Every 60s   — Send appointment reminders
// 2. Stuck conversations — Every 15min — Auto-reset abandoned booking flows
// 3. WA token validation — Every 1h    — Check if any tenant's WA token died
// 4. Cleanup old data    — Every 24h   — Clean up old audit logs, mark stale data

require('dotenv').config();
const logger = require('./utils/logger');
const reminderService = require('./services/reminders');
const tenantHealth = require('./services/tenantHealth');
const pool = require('./db/pool');

let isShuttingDown = false;

// ── Graceful Shutdown ─────────────────────────────────────
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

async function gracefulShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info(`Cron worker received ${signal}, shutting down gracefully...`);
  await pool.end();
  process.exit(0);
}

// ── Job Runner (with isolation) ───────────────────────────
async function runJob(name, fn) {
  if (isShuttingDown) return;
  const start = Date.now();
  try {
    const result = await fn();
    const elapsed = Date.now() - start;
    if (result !== undefined) {
      logger.info(`Cron [${name}] completed in ${elapsed}ms`, { result });
    }
  } catch (err) {
    logger.error(`Cron [${name}] FAILED:`, { error: err.message, stack: err.stack });
    // Job failure is isolated — never crashes the process
  }
}

// ════════════════════════════════════════════════════════════
// JOB 1: Send Reminders (every 60s)
// ════════════════════════════════════════════════════════════
function startReminderJob() {
  setInterval(() => runJob('reminders', async () => {
    const count = await reminderService.processPendingReminders();
    return count > 0 ? `sent ${count}` : undefined;
  }), 60 * 1000);
}

// ════════════════════════════════════════════════════════════
// JOB 2: Reset Stuck Conversations (every 15min)
// ════════════════════════════════════════════════════════════
function startStuckConversationJob() {
  setInterval(() => runJob('stuck-conversations', async () => {
    const count = await tenantHealth.resetStuckConversations();
    return count > 0 ? `reset ${count}` : undefined;
  }), 15 * 60 * 1000);
}

// ════════════════════════════════════════════════════════════
// JOB 3: WA Token Validation (every 1h)
// ════════════════════════════════════════════════════════════
function startWATokenCheckJob() {
  setInterval(() => runJob('wa-token-check', async () => {
    // Only check tenants that are connected (avoid unnecessary API calls)
    const { rows: tenants } = await pool.query(`
      SELECT id, business_name, wa_phone_number_id 
      FROM tenants 
      WHERE wa_status = 'connected' AND is_active = true AND wa_access_token IS NOT NULL
    `);

    let broken = 0;
    for (const t of tenants) {
      const result = await tenantHealth.validateWAToken(t.id);
      if (!result.valid) {
        broken++;
        logger.error(`WA token broken for ${t.business_name} (${t.id}): ${result.error}`, {
          tenantId: t.id
        });
      }
      // Rate limit our own API calls to Meta
      await new Promise(r => setTimeout(r, 2000));
    }

    return broken > 0 ? `${broken}/${tenants.length} broken tokens` : `${tenants.length} tokens OK`;
  }), 60 * 60 * 1000);
}

// ════════════════════════════════════════════════════════════
// JOB 4: Cleanup (every 24h)
// ════════════════════════════════════════════════════════════
function startCleanupJob() {
  setInterval(() => runJob('cleanup', async () => {
    // Remove audit logs older than 90 days
    const { rowCount: auditDeleted } = await pool.query(
      `DELETE FROM audit_log WHERE created_at < NOW() - INTERVAL '90 days'`
    );

    // Remove chat messages older than 6 months for inactive tenants
    const { rowCount: msgsDeleted } = await pool.query(
      `DELETE FROM chat_messages WHERE created_at < NOW() - INTERVAL '180 days'
       AND tenant_id IN (SELECT id FROM tenants WHERE is_active = false)`
    );

    return `audit: -${auditDeleted}, old msgs: -${msgsDeleted}`;
  }), 24 * 60 * 60 * 1000);
}

// ════════════════════════════════════════════════════════════
// JOB 5: Daily Summary for Doctors (every 60s, fires at ~8 AM)
// ════════════════════════════════════════════════════════════
let dailySummarySentToday = null; // Track which date we already sent for

function startDailySummaryJob() {
  setInterval(() => runJob('daily-summary', async () => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const hour = now.getHours();

    // Send once per day, after 8 AM
    if (hour >= 8 && dailySummarySentToday !== todayStr) {
      dailySummarySentToday = todayStr;
      const count = await reminderService.sendDailySummaries();
      return count > 0 ? `sent to ${count} doctors` : 'no doctors with appointments';
    }
  }), 60 * 1000);
}

// ════════════════════════════════════════════════════════════
// START ALL JOBS
// ════════════════════════════════════════════════════════════

async function startCron() {
  logger.info('═══════════════════════════════════════════');
  logger.info('Cron Worker starting...');
  logger.info('═══════════════════════════════════════════');

  // Verify DB connection
  try {
    const { rows } = await pool.query('SELECT NOW() as now, COUNT(*) as tenants FROM tenants');
    logger.info(`Database connected. ${rows[0].tenants} tenants in system.`);
  } catch (err) {
    logger.error('Database connection failed:', err.message);
    process.exit(1);
  }

  // Initial runs
  await runJob('reminders (initial)', () => reminderService.processPendingReminders());
  await runJob('stuck-conversations (initial)', () => tenantHealth.resetStuckConversations());

  // Start all recurring jobs
  startReminderJob();
  startStuckConversationJob();
  startWATokenCheckJob();
  startCleanupJob();
  startDailySummaryJob();

  logger.info('All cron jobs scheduled:');
  logger.info('  • Reminders:          every 60s');
  logger.info('  • Stuck conversations: every 15min');
  logger.info('  • WA token validation: every 1h');
  logger.info('  • Data cleanup:        every 24h');
  logger.info('  • Daily summary:       once at 8 AM');
}

startCron();
