// ============================================================
// PostgreSQL Connection Pool
// ============================================================

const { Pool } = require('pg');
const logger = require('../utils/logger');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'wa_booking_saas',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  max: parseInt(process.env.DB_POOL_MAX || '20'),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});

// Warn if using default credentials in production
if (process.env.NODE_ENV === 'production' && (!process.env.DB_USER || !process.env.DB_PASSWORD)) {
  logger.warn('Using default DB credentials in production! Set DB_USER and DB_PASSWORD.');
}

pool.on('error', (err) => {
  logger.error('Unexpected PG pool error:', err);
});

module.exports = pool;
