-- Migration 007: Dedicated application DB role
-- ============================================================
-- App should NOT connect as `postgres` superuser. This creates a
-- least-privileged `wa_app` role with CRUD on all current and
-- future tables but no DDL / no superuser rights.
--
-- After running:
--   ALTER USER wa_app WITH PASSWORD '<strong>';
--   then set DB_USER=wa_app + DB_PASSWORD=<strong> in backend .env
--   and restart backend.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'wa_app') THEN
    CREATE ROLE wa_app LOGIN PASSWORD 'change-me-on-rotation';
  END IF;
END $$;

GRANT CONNECT ON DATABASE wa_booking_saas TO wa_app;
GRANT USAGE ON SCHEMA public TO wa_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO wa_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO wa_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO wa_app;

-- Future tables / sequences / functions automatically get the same grants
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO wa_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO wa_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO wa_app;
