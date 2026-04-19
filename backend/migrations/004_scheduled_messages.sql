-- ============================================================
-- Migration 004: Scheduled Messages (Generic Outbound)
-- ============================================================
-- Extends the system beyond appointment reminders to support:
--   - Follow-up messages after data capture
--   - Drip sequences (send X after Y hours)
--   - Campaign blasts (future)
--
-- The existing `reminders` table stays untouched for backward compat.
-- This table handles ALL non-appointment scheduled outbound.

CREATE TABLE IF NOT EXISTS scheduled_messages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contact_phone   VARCHAR(20) NOT NULL,      -- recipient phone
  patient_id      UUID REFERENCES patients(id) ON DELETE SET NULL,

  -- What to send
  message_type    VARCHAR(20) NOT NULL DEFAULT 'text',  -- text, template
  message_body    TEXT,                                   -- for text messages (within 24h window)
  template_name   VARCHAR(100),                           -- for template messages (outside 24h)
  template_params JSONB DEFAULT '[]',                     -- template parameter values

  -- When to send
  send_at         TIMESTAMPTZ NOT NULL,
  sent            BOOLEAN DEFAULT false,
  sent_at         TIMESTAMPTZ,

  -- Retry handling
  retry_count     INT DEFAULT 0,
  max_retries     INT DEFAULT 3,
  last_error      TEXT,

  -- Categorization
  trigger_type    VARCHAR(30) NOT NULL DEFAULT 'followup',  -- followup, reminder, campaign, drip
  source          VARCHAR(30),                               -- flow_action, manual, api
  record_id       UUID,                                      -- optional: link to tenant_record that triggered this
  metadata        JSONB DEFAULT '{}',                        -- extra context

  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for the cron poller (most important query)
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_pending 
  ON scheduled_messages (send_at) 
  WHERE sent = false AND retry_count < 3;

CREATE INDEX IF NOT EXISTS idx_scheduled_messages_tenant 
  ON scheduled_messages (tenant_id, trigger_type);

-- RLS
ALTER TABLE scheduled_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY scheduled_messages_tenant_isolation ON scheduled_messages
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON scheduled_messages TO app_user;
