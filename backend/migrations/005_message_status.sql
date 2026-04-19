-- Migration 005: Add message status tracking
-- Adds status column to chat_messages for send tracking (pending → sent → failed)

ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'received';

-- received = inbound message from customer
-- sent     = outbound message delivered to WhatsApp API
-- failed   = outbound message send failed
-- pending  = outbound message queued (for scheduled messages)

CREATE INDEX IF NOT EXISTS idx_chat_messages_status ON chat_messages(tenant_id, status) WHERE status IN ('pending', 'failed');

COMMENT ON COLUMN chat_messages.status IS 'Message status: received (inbound), sent, failed, pending';
