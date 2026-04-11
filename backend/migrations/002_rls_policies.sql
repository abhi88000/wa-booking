-- ============================================================
-- Row-Level Security Policies
-- ============================================================
-- Enforces tenant data isolation at the database level.
-- Even if application code forgets WHERE tenant_id = $1,
-- PostgreSQL itself blocks cross-tenant data access.
--
-- How it works:
--   1. Before each query, app sets: SET app.tenant_id = 'uuid'
--   2. RLS policy checks: row.tenant_id = current_setting('app.tenant_id')
--   3. Rows from other tenants are invisible
--
-- IMPORTANT: Superuser (postgres) bypasses RLS by default.
-- This is fine — only the application user needs enforcement.
-- ============================================================

-- Create a non-superuser role for the application
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user LOGIN PASSWORD 'app_user_secure_2026';
  END IF;
END
$$;

-- Grant necessary permissions to app_user
GRANT CONNECT ON DATABASE wa_booking_saas TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_user;

-- ── RLS Policies ──────────────────────────────────────────

-- Drop any existing policies first (idempotent)
DROP POLICY IF EXISTS tenant_isolation ON doctors;
DROP POLICY IF EXISTS tenant_isolation ON services;
DROP POLICY IF EXISTS tenant_isolation ON patients;
DROP POLICY IF EXISTS tenant_isolation ON appointments;
DROP POLICY IF EXISTS tenant_isolation ON payments;
DROP POLICY IF EXISTS tenant_isolation ON chat_messages;
DROP POLICY IF EXISTS tenant_isolation ON reminders;
DROP POLICY IF EXISTS tenant_isolation ON tenant_users;
DROP POLICY IF EXISTS tenant_isolation ON doctor_availability;
DROP POLICY IF EXISTS tenant_isolation ON doctor_breaks;
DROP POLICY IF EXISTS tenant_isolation ON doctor_services;

-- Create isolation policies
CREATE POLICY tenant_isolation ON doctors
  USING (tenant_id::text = current_setting('app.tenant_id', true));

CREATE POLICY tenant_isolation ON services
  USING (tenant_id::text = current_setting('app.tenant_id', true));

CREATE POLICY tenant_isolation ON patients
  USING (tenant_id::text = current_setting('app.tenant_id', true));

CREATE POLICY tenant_isolation ON appointments
  USING (tenant_id::text = current_setting('app.tenant_id', true));

CREATE POLICY tenant_isolation ON payments
  USING (tenant_id::text = current_setting('app.tenant_id', true));

CREATE POLICY tenant_isolation ON chat_messages
  USING (tenant_id::text = current_setting('app.tenant_id', true));

CREATE POLICY tenant_isolation ON reminders
  USING (tenant_id::text = current_setting('app.tenant_id', true));

CREATE POLICY tenant_isolation ON tenant_users
  USING (tenant_id::text = current_setting('app.tenant_id', true));

CREATE POLICY tenant_isolation ON doctor_availability
  USING (tenant_id::text = current_setting('app.tenant_id', true));

CREATE POLICY tenant_isolation ON doctor_breaks
  USING (tenant_id::text = current_setting('app.tenant_id', true));

CREATE POLICY tenant_isolation ON doctor_services
  USING (tenant_id::text = current_setting('app.tenant_id', true));
