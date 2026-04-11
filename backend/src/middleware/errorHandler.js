// ============================================================
// Centralized Error Handler Middleware
// ============================================================
// Catches all errors thrown/next(err)'d in routes.
// AppError = operational (expected) → clean response
// Other errors = programmer bugs → 500 + logged

const logger = require('../utils/logger');
const { AppError } = require('../utils/errors');

function errorHandler(err, req, res, _next) {
  // Joi validation errors
  if (err.isJoi) {
    return res.status(400).json({
      error: err.details?.[0]?.message || 'Validation failed',
      code: 'VALIDATION_ERROR'
    });
  }

  // Our custom AppError (expected operational errors)
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message,
      code: err.code
    });
  }

  // PostgreSQL unique constraint violation
  if (err.code === '23505') {
    return res.status(409).json({
      error: 'A record with this value already exists',
      code: 'DUPLICATE'
    });
  }

  // PostgreSQL foreign key violation
  if (err.code === '23503') {
    return res.status(400).json({
      error: 'Referenced record does not exist',
      code: 'FK_VIOLATION'
    });
  }

  // Everything else = unexpected bug → log full stack, return generic message
  logger.error('Unhandled error:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    tenantId: req.tenantId || null
  });

  res.status(500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message,
    code: 'INTERNAL_ERROR'
  });
}

module.exports = errorHandler;
