// ============================================================
// Winston Logger — Structured, Per-Tenant Friendly
// ============================================================
// All logs include 'service' and optionally 'tenantId' metadata.
// In production, logs go to files AND can be easily filtered
// by tenantId for debugging specific customers.
//
// Usage:
//   logger.info('message')                         — basic
//   logger.info('message', { tenantId: 'uuid' })   — tenant-tagged
//   logger.child({ tenantId: 'uuid' })              — tenant-scoped logger

const winston = require('winston');

// Custom format: always show tenantId when present
const tenantFormat = winston.format.printf(({ timestamp, level, message, tenantId, service, ...meta }) => {
  const tenant = tenantId ? ` [tenant:${tenantId.substring(0, 8)}]` : '';
  const extras = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
  return `${timestamp} [${level}]${tenant}: ${message}${extras}`;
});

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'wa-booking-saas' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        tenantFormat
      )
    })
  ]
});

// In production, also log to files (easily searchable)
if (process.env.NODE_ENV === 'production') {
  // Main log — everything
  logger.add(new winston.transports.File({ 
    filename: 'logs/combined.log',
    maxsize: 10 * 1024 * 1024, // 10MB rotation
    maxFiles: 10,
    tailable: true
  }));

  // Error log — errors only, for quick scanning
  logger.add(new winston.transports.File({ 
    filename: 'logs/error.log', 
    level: 'error',
    maxsize: 10 * 1024 * 1024,
    maxFiles: 5,
    tailable: true
  }));
}

module.exports = logger;
