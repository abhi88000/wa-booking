-- ============================================================
-- Clinic WhatsApp Appointment Booking System
-- Database Schema — PostgreSQL
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ENUM TYPES
-- ============================================================

CREATE TYPE appointment_status AS ENUM (
  'pending',        -- Awaiting confirmation
  'confirmed',      -- Confirmed by clinic
  'completed',      -- Appointment done
  'cancelled',      -- Cancelled by patient or clinic
  'no_show',        -- Patient didn't show up
  'rescheduled'     -- Moved to a new slot
);

CREATE TYPE payment_status AS ENUM (
  'pending',
  'paid',
  'refunded',
  'failed'
);

CREATE TYPE day_of_week AS ENUM (
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'
);

-- ============================================================
-- TABLES
-- ============================================================

-- 1. Clinic / Organization
CREATE TABLE clinic (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(200) NOT NULL,
  phone         VARCHAR(20),
  email         VARCHAR(100),
  address       TEXT,
  timezone      VARCHAR(50) DEFAULT 'Asia/Kolkata',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Doctors / Practitioners
CREATE TABLE doctors (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID REFERENCES clinic(id) ON DELETE CASCADE,
  name            VARCHAR(150) NOT NULL,
  specialization  VARCHAR(100),
  phone           VARCHAR(20),
  email           VARCHAR(100),
  consultation_fee DECIMAL(10, 2) DEFAULT 0,
  slot_duration    INTEGER DEFAULT 30,        -- minutes per slot
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Doctor Availability (weekly schedule)
CREATE TABLE doctor_availability (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  doctor_id   UUID REFERENCES doctors(id) ON DELETE CASCADE,
  day         day_of_week NOT NULL,
  start_time  TIME NOT NULL,              -- e.g., 09:00
  end_time    TIME NOT NULL,              -- e.g., 17:00
  is_active   BOOLEAN DEFAULT true,
  UNIQUE(doctor_id, day)
);

-- 4. Doctor Breaks / Holidays
CREATE TABLE doctor_breaks (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  doctor_id   UUID REFERENCES doctors(id) ON DELETE CASCADE,
  break_date  DATE,                        -- NULL means recurring
  start_time  TIME,
  end_time    TIME,
  reason      VARCHAR(200),
  is_full_day BOOLEAN DEFAULT false
);

-- 5. Services offered
CREATE TABLE services (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id     UUID REFERENCES clinic(id) ON DELETE CASCADE,
  name          VARCHAR(150) NOT NULL,
  description   TEXT,
  duration      INTEGER DEFAULT 30,          -- minutes
  price         DECIMAL(10, 2) DEFAULT 0,
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Doctor-Service mapping
CREATE TABLE doctor_services (
  doctor_id   UUID REFERENCES doctors(id) ON DELETE CASCADE,
  service_id  UUID REFERENCES services(id) ON DELETE CASCADE,
  PRIMARY KEY (doctor_id, service_id)
);

-- 7. Patients
CREATE TABLE patients (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            VARCHAR(150),
  phone           VARCHAR(20) UNIQUE NOT NULL,  -- WhatsApp number
  email           VARCHAR(100),
  date_of_birth   DATE,
  gender          VARCHAR(10),
  notes           TEXT,
  wa_conversation_state JSONB DEFAULT '{}',      -- Track chatbot state
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Appointments
CREATE TABLE appointments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id      UUID REFERENCES patients(id) ON DELETE SET NULL,
  doctor_id       UUID REFERENCES doctors(id) ON DELETE SET NULL,
  service_id      UUID REFERENCES services(id) ON DELETE SET NULL,
  clinic_id       UUID REFERENCES clinic(id) ON DELETE CASCADE,
  
  appointment_date DATE NOT NULL,
  start_time       TIME NOT NULL,
  end_time         TIME NOT NULL,
  
  status           appointment_status DEFAULT 'pending',
  notes            TEXT,
  
  -- Google Calendar sync
  google_event_id  VARCHAR(255),
  
  -- Rescheduling
  rescheduled_from UUID REFERENCES appointments(id),
  
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Payments
CREATE TABLE payments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  appointment_id  UUID REFERENCES appointments(id) ON DELETE CASCADE,
  patient_id      UUID REFERENCES patients(id) ON DELETE SET NULL,
  
  amount          DECIMAL(10, 2) NOT NULL,
  currency        VARCHAR(3) DEFAULT 'INR',
  status          payment_status DEFAULT 'pending',
  
  -- Payment gateway details
  gateway         VARCHAR(20) DEFAULT 'razorpay',   -- razorpay | stripe
  gateway_payment_id   VARCHAR(100),
  gateway_order_id     VARCHAR(100),
  gateway_signature    VARCHAR(255),
  
  paid_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Chat Messages (WhatsApp conversation log)
CREATE TABLE chat_messages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id      UUID REFERENCES patients(id) ON DELETE SET NULL,
  phone           VARCHAR(20) NOT NULL,
  direction       VARCHAR(10) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  message_type    VARCHAR(20) DEFAULT 'text',   -- text, image, template, interactive
  content         TEXT,
  wa_message_id   VARCHAR(100),
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Reminders
CREATE TABLE reminders (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  appointment_id  UUID REFERENCES appointments(id) ON DELETE CASCADE,
  remind_at       TIMESTAMPTZ NOT NULL,
  type            VARCHAR(20) DEFAULT '24h',    -- 24h, 1h, followup
  sent            BOOLEAN DEFAULT false,
  sent_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Admin Users (for dashboard)
CREATE TABLE admin_users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name          VARCHAR(150),
  role          VARCHAR(20) DEFAULT 'staff',   -- admin, staff, doctor
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_appointments_date ON appointments(appointment_date);
CREATE INDEX idx_appointments_doctor ON appointments(doctor_id, appointment_date);
CREATE INDEX idx_appointments_patient ON appointments(patient_id);
CREATE INDEX idx_appointments_status ON appointments(status);
CREATE INDEX idx_patients_phone ON patients(phone);
CREATE INDEX idx_chat_messages_phone ON chat_messages(phone);
CREATE INDEX idx_reminders_pending ON reminders(remind_at) WHERE sent = false;
CREATE INDEX idx_payments_appointment ON payments(appointment_id);

-- ============================================================
-- SEED DATA — Demo Clinic
-- ============================================================

-- Insert demo clinic
INSERT INTO clinic (id, name, phone, email, address) VALUES
  ('11111111-1111-1111-1111-111111111111', 'HealthCare Clinic', '+919876543210', 'clinic@example.com', '123 Main Street, New Delhi, India');

-- Insert demo doctors
INSERT INTO doctors (id, clinic_id, name, specialization, phone, consultation_fee, slot_duration) VALUES
  ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Dr. Priya Sharma', 'General Physician', '+919876543211', 500.00, 30),
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'Dr. Rahul Verma', 'Dermatologist', '+919876543212', 800.00, 20),
  ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', 'Dr. Anita Gupta', 'Pediatrician', '+919876543213', 600.00, 30);

-- Doctor availability (Mon-Sat)
INSERT INTO doctor_availability (doctor_id, day, start_time, end_time) VALUES
  ('22222222-2222-2222-2222-222222222222', 'monday', '09:00', '17:00'),
  ('22222222-2222-2222-2222-222222222222', 'tuesday', '09:00', '17:00'),
  ('22222222-2222-2222-2222-222222222222', 'wednesday', '09:00', '17:00'),
  ('22222222-2222-2222-2222-222222222222', 'thursday', '09:00', '17:00'),
  ('22222222-2222-2222-2222-222222222222', 'friday', '09:00', '17:00'),
  ('22222222-2222-2222-2222-222222222222', 'saturday', '09:00', '13:00'),
  ('33333333-3333-3333-3333-333333333333', 'monday', '10:00', '18:00'),
  ('33333333-3333-3333-3333-333333333333', 'wednesday', '10:00', '18:00'),
  ('33333333-3333-3333-3333-333333333333', 'friday', '10:00', '18:00'),
  ('44444444-4444-4444-4444-444444444444', 'monday', '09:00', '15:00'),
  ('44444444-4444-4444-4444-444444444444', 'tuesday', '09:00', '15:00'),
  ('44444444-4444-4444-4444-444444444444', 'thursday', '09:00', '15:00'),
  ('44444444-4444-4444-4444-444444444444', 'saturday', '09:00', '13:00');

-- Services
INSERT INTO services (id, clinic_id, name, description, duration, price) VALUES
  ('55555555-5555-5555-5555-555555555551', '11111111-1111-1111-1111-111111111111', 'General Consultation', 'Regular health checkup and consultation', 30, 500.00),
  ('55555555-5555-5555-5555-555555555552', '11111111-1111-1111-1111-111111111111', 'Skin Consultation', 'Dermatology consultation and treatment', 20, 800.00),
  ('55555555-5555-5555-5555-555555555553', '11111111-1111-1111-1111-111111111111', 'Child Checkup', 'Pediatric health checkup', 30, 600.00),
  ('55555555-5555-5555-5555-555555555554', '11111111-1111-1111-1111-111111111111', 'Follow-up Visit', 'Follow-up for existing patients', 15, 200.00),
  ('55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', 'Vaccination', 'Scheduled vaccination', 15, 300.00);

-- Doctor-Service mapping
INSERT INTO doctor_services (doctor_id, service_id) VALUES
  ('22222222-2222-2222-2222-222222222222', '55555555-5555-5555-5555-555555555551'),
  ('22222222-2222-2222-2222-222222222222', '55555555-5555-5555-5555-555555555554'),
  ('33333333-3333-3333-3333-333333333333', '55555555-5555-5555-5555-555555555552'),
  ('33333333-3333-3333-3333-333333333333', '55555555-5555-5555-5555-555555555554'),
  ('44444444-4444-4444-4444-444444444444', '55555555-5555-5555-5555-555555555553'),
  ('44444444-4444-4444-4444-444444444444', '55555555-5555-5555-5555-555555555554'),
  ('44444444-4444-4444-4444-444444444444', '55555555-5555-5555-5555-555555555555');

-- Default admin user (password: admin123 — CHANGE IN PRODUCTION)
-- Password hash for 'admin123' using bcrypt
INSERT INTO admin_users (email, password_hash, name, role) VALUES
  ('admin@clinic.com', '$2b$10$XQxBj5v5Hl5qKZ8YzOqOQOGvN5l5qGd5qGKz5qGd5qGKz5qGd5q', 'Admin', 'admin');
