-- ============================================================
-- Production Hardening Migration
-- Run on EC2: docker compose -f docker-compose.saas.yml exec postgres psql -U postgres -d wa_booking_saas -f /tmp/prod-hardening.sql
-- ============================================================

-- 1. Add missing indexes for performance
CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_messages_wa_msg_id
  ON chat_messages(wa_message_id) WHERE wa_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_chat_messages_patient_id
  ON chat_messages(patient_id);

CREATE INDEX IF NOT EXISTS idx_appointments_patient_id
  ON appointments(patient_id);

-- 2. Remove RLS without policies (security theater)
ALTER TABLE doctors DISABLE ROW LEVEL SECURITY;
ALTER TABLE services DISABLE ROW LEVEL SECURITY;
ALTER TABLE patients DISABLE ROW LEVEL SECURITY;
ALTER TABLE appointments DISABLE ROW LEVEL SECURITY;
ALTER TABLE payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE reminders DISABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_users DISABLE ROW LEVEL SECURITY;

-- Done
SELECT 'Production hardening migration complete' AS status;
