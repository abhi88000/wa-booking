// ============================================================
// Main Entry Point — Multi-Tenant SaaS Backend
// ============================================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const logger = require('./utils/logger');
const pool = require('./db/pool');

const app = express();
const PORT = process.env.PORT || 4000;

// ── Global Middleware ──────────────────────────────────────
app.use(helmet());
app.use(compression());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cors({
  origin: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : '*',
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
app.use('/api/auth', require('./routes/auth'));
app.use('/api/onboarding', require('./routes/onboarding'));

// Platform Admin APIs (Super Admin)
app.use('/api/platform', require('./routes/platform'));

// Tenant Admin APIs (each business's admin panel)
app.use('/api/tenant', require('./routes/tenant'));

// Subscription & Billing webhooks
app.use('/api/billing', require('./routes/billing'));

// ── Error Handling ─────────────────────────────────────────

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', { 
    message: err.message, 
    stack: err.stack,
    path: req.path 
  });
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message
  });
});

// ── Start Server ───────────────────────────────────────────

async function start() {
  try {
    // Verify DB connection
    const result = await pool.query('SELECT NOW()');
    logger.info(`Database connected: ${result.rows[0].now}`);

    app.listen(PORT, () => {
      logger.info(`SaaS Backend running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (err) {
    logger.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();

module.exports = app;  // For testing
