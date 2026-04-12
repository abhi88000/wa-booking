-- ============================================================
-- WhatsApp Appointment Booking SaaS
-- Multi-Tenant Database Schema — PostgreSQL
-- ============================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUM TYPES
-- ============================================================

CREATE TYPE appointment_status AS ENUM (
  'pending', 'confirmed', 'completed', 'cancelled', 'no_show', 'rescheduled'
);

CREATE TYPE payment_status AS ENUM (
  'pending', 'paid', 'refunded', 'failed'
);

CREATE TYPE day_of_week AS ENUM (
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'
);

CREATE TYPE subscription_plan AS ENUM (
  'trial', 'starter', 'professional', 'enterprise'
);

CREATE TYPE subscription_status AS ENUM (
  'trial', 'active', 'past_due', 'cancelled', 'expired'
);

CREATE TYPE onboarding_status AS ENUM (
  'registered', 'whatsapp_pending', 'whatsapp_connected', 'setup_complete', 'active'
);

-- ============================================================
-- PLATFORM-LEVEL TABLES (Super Admin)
-- ============================================================

-- 1. Tenants (each business is a tenant)
CREATE TABLE tenants (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Business info
  business_name   VARCHAR(200) NOT NULL,
  business_type   VARCHAR(50) DEFAULT 'clinic',   -- clinic, salon, consulting, etc.
  slug            VARCHAR(100) UNIQUE NOT NULL,    -- URL-friendly: "dr-sharma-clinic"
  email           VARCHAR(150) NOT NULL,
  phone           VARCHAR(20),
  address         TEXT,
  city            VARCHAR(100),
  country         VARCHAR(50) DEFAULT 'IN',
  timezone        VARCHAR(50) DEFAULT 'Asia/Kolkata',
  logo_url        VARCHAR(500),
  
  -- WhatsApp configuration
  wa_phone_number_id    VARCHAR(50),        -- Their WhatsApp phone number ID
  wa_business_account_id VARCHAR(50),       -- Their WABA ID
  wa_access_token       TEXT,               -- Their encrypted access token
  wa_phone_number       VARCHAR(20),        -- Display number e.g. +919876543210
  wa_webhook_verified   BOOLEAN DEFAULT false,
  wa_status            VARCHAR(20) DEFAULT 'disconnected',  -- disconnected, pending, connected
  
  -- Onboarding
  onboarding_status  onboarding_status DEFAULT 'registered',
  onboarding_data    JSONB DEFAULT '{}',
  
  -- Feature flags
  features          JSONB DEFAULT '{
    "booking": true,
    "payment_collection": false,
    "ai_chatbot": false,
    "broadcast": false,
    "multi_doctor": true,
    "reminders": true,
    "analytics": false,
    "custom_branding": false
  }',
  
  -- Settings
  settings          JSONB DEFAULT '{
    "booking_window_days": 14,
    "max_bookings_per_day": 50,
    "auto_confirm": true,
    "welcome_message": "Welcome! How can I help you today?",
    "business_hours_note": "",
    "currency": "INR"
  }',
  
  -- Limits
  max_doctors       INTEGER DEFAULT 3,
  max_appointments_month INTEGER DEFAULT 100,
  
  is_active         BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Subscriptions
CREATE TABLE subscriptions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  
  plan            subscription_plan DEFAULT 'trial',
  status          subscription_status DEFAULT 'trial',
  
  -- Billing
  amount          DECIMAL(10, 2) DEFAULT 0,
  currency        VARCHAR(3) DEFAULT 'INR',
  billing_cycle   VARCHAR(10) DEFAULT 'monthly',     -- monthly, yearly
  
  -- Gateway
  gateway         VARCHAR(20) DEFAULT 'razorpay',
  gateway_subscription_id VARCHAR(100),
  gateway_customer_id     VARCHAR(100),
  
  -- Dates
  trial_ends_at   TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days'),
  current_period_start TIMESTAMPTZ,
  current_period_end   TIMESTAMPTZ,
  cancelled_at    TIMESTAMPTZ,
  
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Subscription Plans (configurable pricing)
CREATE TABLE plans (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            subscription_plan UNIQUE NOT NULL,
  display_name    VARCHAR(50) NOT NULL,
  
  -- Pricing
  monthly_price   DECIMAL(10, 2) NOT NULL,
  yearly_price    DECIMAL(10, 2) NOT NULL,
  
  -- Limits
  max_doctors     INTEGER NOT NULL,
  max_appointments_month INTEGER NOT NULL,
  max_services    INTEGER NOT NULL,
  
  -- Features included
  features        JSONB NOT NULL,
  
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Platform admin users (Super Admins — YOUR team)
CREATE TABLE platform_admins (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name          VARCHAR(150),
  role          VARCHAR(20) DEFAULT 'admin',    -- super_admin, admin, support
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 5. WhatsApp Number Registry (maps incoming phone numbers to tenants)
CREATE TABLE wa_number_registry (
  wa_phone_number_id  VARCHAR(50) PRIMARY KEY,    -- Meta's phone number ID
  tenant_id           UUID REFERENCES tenants(id) ON DELETE CASCADE,
  phone_number        VARCHAR(20),                 -- Display number
  is_active           BOOLEAN DEFAULT true,
  registered_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TENANT-SCOPED TABLES (Each Business's Data)
-- ============================================================

-- 6. Tenant Admin Users (staff for each business)
CREATE TABLE tenant_users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID REFERENCES tenants(id) ON DELETE CASCADE,
  email         VARCHAR(100) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name          VARCHAR(150),
  role          VARCHAR(20) DEFAULT 'staff',   -- owner, admin, staff, doctor
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, email)
);

-- 7. Doctors / Practitioners
CREATE TABLE doctors (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name            VARCHAR(150) NOT NULL,
  specialization  VARCHAR(100),
  phone           VARCHAR(20),
  email           VARCHAR(100),
  consultation_fee DECIMAL(10, 2) DEFAULT 0,
  slot_duration    INTEGER DEFAULT 30,
  bio             TEXT,
  avatar_url      VARCHAR(500),
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Doctor Availability
CREATE TABLE doctor_availability (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID REFERENCES tenants(id) ON DELETE CASCADE,
  doctor_id   UUID REFERENCES doctors(id) ON DELETE CASCADE,
  day         day_of_week NOT NULL,
  start_time  TIME NOT NULL,
  end_time    TIME NOT NULL,
  is_active   BOOLEAN DEFAULT true,
  UNIQUE(doctor_id, day)
);

-- 9. Doctor Breaks / Holidays
CREATE TABLE doctor_breaks (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID REFERENCES tenants(id) ON DELETE CASCADE,
  doctor_id   UUID REFERENCES doctors(id) ON DELETE CASCADE,
  break_date  DATE,
  start_time  TIME,
  end_time    TIME,
  reason      VARCHAR(200),
  is_full_day BOOLEAN DEFAULT false
);

-- 10. Services
CREATE TABLE services (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name          VARCHAR(150) NOT NULL,
  description   TEXT,
  duration      INTEGER DEFAULT 30,
  price         DECIMAL(10, 2) DEFAULT 0,
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Doctor-Service mapping
CREATE TABLE doctor_services (
  tenant_id   UUID REFERENCES tenants(id) ON DELETE CASCADE,
  doctor_id   UUID REFERENCES doctors(id) ON DELETE CASCADE,
  service_id  UUID REFERENCES services(id) ON DELETE CASCADE,
  PRIMARY KEY (doctor_id, service_id)
);

-- 12. Patients (scoped per tenant — same person can be patient at multiple clinics)
CREATE TABLE patients (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name            VARCHAR(150),
  phone           VARCHAR(20) NOT NULL,
  email           VARCHAR(100),
  date_of_birth   DATE,
  gender          VARCHAR(10),
  notes           TEXT,
  wa_conversation_state JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, phone)
);

-- 13. Appointments
CREATE TABLE appointments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id      UUID REFERENCES patients(id) ON DELETE SET NULL,
  doctor_id       UUID REFERENCES doctors(id) ON DELETE SET NULL,
  service_id      UUID REFERENCES services(id) ON DELETE SET NULL,
  
  appointment_date DATE NOT NULL,
  start_time       TIME NOT NULL,
  end_time         TIME NOT NULL,
  
  status           appointment_status DEFAULT 'pending',
  notes            TEXT,
  
  google_event_id  VARCHAR(255),
  rescheduled_from UUID REFERENCES appointments(id),
  
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- 14. Payments
CREATE TABLE payments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  appointment_id  UUID REFERENCES appointments(id) ON DELETE CASCADE,
  patient_id      UUID REFERENCES patients(id) ON DELETE SET NULL,
  
  amount          DECIMAL(10, 2) NOT NULL,
  currency        VARCHAR(3) DEFAULT 'INR',
  status          payment_status DEFAULT 'pending',
  
  gateway         VARCHAR(20) DEFAULT 'razorpay',
  gateway_payment_id   VARCHAR(100),
  gateway_order_id     VARCHAR(100),
  gateway_signature    VARCHAR(255),
  
  paid_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 15. Chat Messages
CREATE TABLE chat_messages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id      UUID REFERENCES patients(id) ON DELETE SET NULL,
  phone           VARCHAR(20) NOT NULL,
  direction       VARCHAR(10) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  message_type    VARCHAR(20) DEFAULT 'text',
  content         TEXT,
  wa_message_id   VARCHAR(100),
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 16. Reminders
CREATE TABLE reminders (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  appointment_id  UUID REFERENCES appointments(id) ON DELETE CASCADE,
  remind_at       TIMESTAMPTZ NOT NULL,
  type            VARCHAR(20) DEFAULT '24h',
  sent            BOOLEAN DEFAULT false,
  sent_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 17. Platform subscription invoices
CREATE TABLE invoices (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id),
  
  amount          DECIMAL(10, 2) NOT NULL,
  currency        VARCHAR(3) DEFAULT 'INR',
  status          VARCHAR(20) DEFAULT 'pending',    -- pending, paid, failed
  
  gateway_invoice_id VARCHAR(100),
  invoice_url        VARCHAR(500),
  
  period_start    TIMESTAMPTZ,
  period_end      TIMESTAMPTZ,
  paid_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 18. Audit Log (track important actions for compliance)
CREATE TABLE audit_log (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID,
  user_id         UUID,
  user_type       VARCHAR(20),        -- platform_admin, tenant_user, system
  action          VARCHAR(100) NOT NULL,
  entity_type     VARCHAR(50),
  entity_id       UUID,
  details         JSONB DEFAULT '{}',
  ip_address      VARCHAR(45),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES (Performance-critical for multi-tenant queries)
-- ============================================================

-- Tenant-scoped indexes (CRITICAL: every query filters by tenant_id)
CREATE INDEX idx_doctors_tenant ON doctors(tenant_id);
CREATE INDEX idx_services_tenant ON services(tenant_id);
CREATE INDEX idx_patients_tenant ON patients(tenant_id);
CREATE INDEX idx_patients_tenant_phone ON patients(tenant_id, phone);
CREATE INDEX idx_appointments_tenant ON appointments(tenant_id);
CREATE INDEX idx_appointments_tenant_date ON appointments(tenant_id, appointment_date);
CREATE INDEX idx_appointments_doctor ON appointments(doctor_id, appointment_date);
CREATE INDEX idx_appointments_patient ON appointments(patient_id);
CREATE INDEX idx_appointments_status ON appointments(tenant_id, status);
CREATE INDEX idx_payments_tenant ON payments(tenant_id);
CREATE INDEX idx_payments_appointment ON payments(appointment_id);
CREATE INDEX idx_chat_messages_tenant ON chat_messages(tenant_id, phone);
CREATE INDEX idx_reminders_pending ON reminders(remind_at) WHERE sent = false;
CREATE INDEX idx_reminders_tenant ON reminders(tenant_id);
CREATE INDEX idx_subscriptions_tenant ON subscriptions(tenant_id);
CREATE INDEX idx_tenant_users_tenant ON tenant_users(tenant_id);
CREATE INDEX idx_doctor_availability_doctor ON doctor_availability(doctor_id);
CREATE INDEX idx_audit_log_tenant ON audit_log(tenant_id, created_at);

-- WhatsApp routing
CREATE INDEX idx_wa_registry_tenant ON wa_number_registry(tenant_id);

-- Tenant lookup
CREATE INDEX idx_tenants_slug ON tenants(slug);
CREATE INDEX idx_tenants_active ON tenants(is_active) WHERE is_active = true;

-- ============================================================
-- ROW LEVEL SECURITY (Optional but recommended for extra safety)
-- ============================================================

-- Enable RLS on tenant-scoped tables
ALTER TABLE doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_users ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- SEED DATA
-- ============================================================

-- Subscription Plans
INSERT INTO plans (name, display_name, monthly_price, yearly_price, max_doctors, max_appointments_month, max_services, features) VALUES
  ('trial', 'Free Trial', 0, 0, 2, 50, 5, '{
    "ai_chatbot": true, "google_calendar": false, "payment_collection": false,
    "custom_branding": false, "multi_doctor": false, "reminders": true,
    "analytics": false, "priority_support": false
  }'),
  ('starter', 'Starter', 999, 9990, 3, 200, 10, '{
    "ai_chatbot": true, "google_calendar": true, "payment_collection": true,
    "custom_branding": false, "multi_doctor": true, "reminders": true,
    "analytics": false, "priority_support": false
  }'),
  ('professional', 'Professional', 2499, 24990, 10, 1000, 25, '{
    "ai_chatbot": true, "google_calendar": true, "payment_collection": true,
    "custom_branding": true, "multi_doctor": true, "reminders": true,
    "analytics": true, "priority_support": true
  }'),
  ('enterprise', 'Enterprise', 7999, 79990, 50, 10000, 100, '{
    "ai_chatbot": true, "google_calendar": true, "payment_collection": true,
    "custom_branding": true, "multi_doctor": true, "reminders": true,
    "analytics": true, "priority_support": true
  }');

-- ============================================================
-- INVITE CODES (Single-use registration codes)
-- ============================================================
CREATE TABLE IF NOT EXISTS invite_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(30) NOT NULL UNIQUE,
  created_by UUID REFERENCES platform_admins(id),
  used_by_tenant_id UUID REFERENCES tenants(id),
  used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  note VARCHAR(200),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_invite_codes_code ON invite_codes(code);

-- Create your platform admin after deployment:
-- INSERT INTO platform_admins (email, password_hash, name, role)
-- VALUES ('admin@yourdomain.com', crypt('yourpassword', gen_salt('bf', 10)), 'Admin', 'super_admin');
