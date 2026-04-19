-- ============================================================
-- Migration 003: Generic Tenant Records + Flow Variables
-- ============================================================
-- Adds a flexible data store for non-appointment use cases
-- (leads, orders, feedback, surveys, etc.)
-- Fully backward compatible — existing appointment tables untouched.

-- Generic records table
CREATE TABLE IF NOT EXISTS tenant_records (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  record_type     VARCHAR(50) NOT NULL,          -- 'lead', 'order', 'feedback', 'survey', etc.
  phone           VARCHAR(20),                    -- customer's WhatsApp number
  data            JSONB DEFAULT '{}',             -- flexible key-value data
  status          VARCHAR(30) DEFAULT 'new',      -- new, in_progress, done, cancelled
  assigned_to     UUID REFERENCES tenant_users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_tenant_records_tenant ON tenant_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_records_type ON tenant_records(tenant_id, record_type);
CREATE INDEX IF NOT EXISTS idx_tenant_records_phone ON tenant_records(tenant_id, phone);
CREATE INDEX IF NOT EXISTS idx_tenant_records_status ON tenant_records(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_tenant_records_created ON tenant_records(tenant_id, created_at DESC);

-- RLS policy
ALTER TABLE tenant_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON tenant_records
  FOR ALL
  USING (tenant_id::text = current_setting('app.tenant_id', true));

-- Grant access to app_user role (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON tenant_records TO app_user;
  END IF;
END $$;
