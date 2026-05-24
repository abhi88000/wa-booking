// ============================================================
// Alerts \u2014 self-hosted error & uptime notifications via Telegram
// ============================================================
// No third-party SaaS. Set TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID
// in .env. To get them:
//   1. Talk to @BotFather on Telegram \u2192 /newbot \u2192 save the token.
//   2. Send any message to your new bot.
//   3. curl https://api.telegram.org/bot<TOKEN>/getUpdates \u2192 copy chat.id
//
// If the env vars are missing this module is a silent no-op so dev
// works without any setup.

const axios = require('axios');
const logger = require('./logger');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';
const ENABLED = Boolean(TOKEN && CHAT_ID);

// Dedup so a hot error loop doesn't send 1000 messages.
// key = error.message \u2192 last-sent timestamp
const lastSent = new Map();
const DEDUP_WINDOW_MS = 5 * 60 * 1000; // 5 min

if (ENABLED) {
  logger.info('Telegram alerts enabled');
} else {
  logger.info('Telegram alerts disabled (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID not set)');
}

function shouldSend(key) {
  const now = Date.now();
  const last = lastSent.get(key);
  if (last && now - last < DEDUP_WINDOW_MS) return false;
  lastSent.set(key, now);
  // Bounded map \u2014 evict if too big
  if (lastSent.size > 500) {
    const oldest = [...lastSent.entries()].sort((a, b) => a[1] - b[1]).slice(0, 100);
    for (const [k] of oldest) lastSent.delete(k);
  }
  return true;
}

async function sendTelegram(text) {
  if (!ENABLED) return;
  try {
    await axios.post(
      `https://api.telegram.org/bot${TOKEN}/sendMessage`,
      { chat_id: CHAT_ID, text, parse_mode: 'Markdown', disable_web_page_preview: true },
      { timeout: 5000 }
    );
  } catch (err) {
    // Never let alerting break the request
    logger.warn(`Telegram alert failed: ${err.message}`);
  }
}

/**
 * Report an unexpected error.
 * @param {Error} err
 * @param {{tenantId?:string, path?:string, method?:string, extra?:object}} context
 */
function captureException(err, context = {}) {
  if (!ENABLED) return;
  const key = `${err.name}:${err.message}`.slice(0, 120);
  if (!shouldSend(key)) return;

  const env = process.env.NODE_ENV || 'development';
  const lines = [
    `\ud83d\udea8 *${env}* error`,
    '```',
    (err.stack || err.message || String(err)).split('\n').slice(0, 8).join('\n'),
    '```'
  ];
  if (context.path) lines.push(`\u2022 path: \`${context.method || 'GET'} ${context.path}\``);
  if (context.tenantId) lines.push(`\u2022 tenant: \`${String(context.tenantId).slice(0, 8)}\``);
  if (context.extra) {
    try { lines.push('\u2022 extra: `' + JSON.stringify(context.extra).slice(0, 300) + '`'); }
    catch (_) { /* ignore */ }
  }
  sendTelegram(lines.join('\n'));
}

/**
 * Send a plain ops alert (uptime, cron failure, etc).
 */
function notify(text, { dedupKey } = {}) {
  if (!ENABLED) return;
  if (dedupKey && !shouldSend(dedupKey)) return;
  sendTelegram(text);
}

// Express middleware shims so we can keep the same wiring shape.
function requestHandler() { return (req, res, next) => next(); }
function errorHandlerMw() { return (err, req, res, next) => next(err); }

module.exports = { captureException, notify, requestHandler, errorHandlerMw, enabled: () => ENABLED };
