// ============================================================
// Main Entry Point — Multi-Tenant SaaS Backend
// ============================================================

require('dotenv').config();

// ── Startup Validation ─────────────────────────────────────
const REQUIRED_ENV = ['JWT_SECRET'];
const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length > 0) {
  console.error(`FATAL: Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}
if (process.env.NODE_ENV === 'production' && !process.env.CORS_ORIGINS) {
  console.warn('WARNING: CORS_ORIGINS not set in production — will allow all origins');
}
if (!process.env.WA_VERIFY_TOKEN) {
  console.warn('WARNING: WA_VERIFY_TOKEN not set — WhatsApp webhook verification will fail');
}

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const logger = require('./utils/logger');
const pool = require('./db/pool');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 4000;

// ── Global Middleware ──────────────────────────────────────
app.use(helmet());
app.use(compression());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cors({
  origin: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',').map(s => s.trim()) : true,
  credentials: true
}));
app.use(morgan('combined', {
  stream: { write: (msg) => logger.info(msg.trim()) }
}));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 min
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' }
});
app.use('/api/', apiLimiter);

// WhatsApp webhook has a higher limit (Meta sends many requests)
const webhookLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,  // 1 min
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/webhook/', webhookLimiter);

// ── Routes ─────────────────────────────────────────────────

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// WhatsApp Webhook (central — routes to correct tenant)
app.use('/webhook', require('./routes/webhook'));

// Public APIs (tenant onboarding)
app.use('/api/v1/auth', require('./routes/auth'));
app.use('/api/v1/onboarding', require('./routes/onboarding'));

// Platform Admin APIs (Super Admin)
app.use('/api/v1/platform', require('./routes/platform'));

// Tenant Admin APIs (each business's admin panel)
app.use('/api/v1/tenant', require('./routes/tenant'));

// ── Backward-compatible aliases (remove after frontend migration) ──
app.use('/api/auth', require('./routes/auth'));
app.use('/api/onboarding', require('./routes/onboarding'));
app.use('/api/platform', require('./routes/platform'));
app.use('/api/tenant', require('./routes/tenant'));

// ── Error Handling ─────────────────────────────────────────

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' });
});

// Global error handler (centralized)
app.use(errorHandler);

// ── Start Server ───────────────────────────────────────────

async function start() {
  try {
    // Verify DB connection
    const result = await pool.query('SELECT NOW()');
    logger.info(`Database connected: ${result.rows[0].now}`);

    const server = app.listen(PORT, () => {
      logger.info(`SaaS Backend running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });

    // Graceful shutdown
    const shutdown = async (signal) => {
      logger.info(`${signal} received — shutting down gracefully`);
      server.close(async () => {
        await pool.end();
        logger.info('Database pool closed');
        process.exit(0);
      });
      // Force exit after 10s if connections won't close
      setTimeout(() => { process.exit(1); }, 10000);
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (err) {
    logger.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();

module.exports = app;  // For testing
