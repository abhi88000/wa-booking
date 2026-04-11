-- ============================================================
-- Baseline Migration
-- ============================================================
-- This marks the existing schema as the starting point.
-- All tables already exist from init-saas.sql.
-- Future migrations will be numbered 002, 003, etc.
-- 
-- To apply: npm run migrate
-- To rollback: npm run migrate:down
-- ============================================================

-- Migration tracking table (node-pg-migrate creates this automatically,
-- but we document it here for clarity)

-- No schema changes in baseline — existing DB is already up to date.
SELECT 1;
