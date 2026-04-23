-- Migration 006: Doctor Multi-Clinic Support
-- One doctor → many clinics with per-clinic schedules
-- Merges duplicate doctor rows (same name + phone + tenant) into a single doctor

-- 1. Junction table: doctor ↔ clinic (many-to-many)
CREATE TABLE IF NOT EXISTS doctor_clinics (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID REFERENCES tenants(id) ON DELETE CASCADE,
  doctor_id   UUID REFERENCES doctors(id) ON DELETE CASCADE,
  clinic_label VARCHAR(300) NOT NULL,
  UNIQUE(doctor_id, clinic_label)
);

-- 2. Add clinic_label to doctor_availability for per-clinic schedules
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'doctor_availability' AND column_name = 'clinic_label'
  ) THEN
    ALTER TABLE doctor_availability ADD COLUMN clinic_label VARCHAR(300);
  END IF;
END $$;

-- 3. Drop the old unique constraint (doctor_id, day) so a doctor can have
--    different schedules at different clinics
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'doctor_availability_doctor_id_day_key'
  ) THEN
    ALTER TABLE doctor_availability DROP CONSTRAINT doctor_availability_doctor_id_day_key;
  END IF;
END $$;

-- New unique: one schedule per doctor per clinic per day
-- NULL clinic_label = default/global schedule
CREATE UNIQUE INDEX IF NOT EXISTS doctor_availability_doctor_clinic_day_idx
  ON doctor_availability (doctor_id, day, COALESCE(clinic_label, '__global__'));

-- 4. Migrate existing data: populate doctor_clinics from doctors.clinic column
INSERT INTO doctor_clinics (tenant_id, doctor_id, clinic_label)
SELECT tenant_id, id, clinic FROM doctors
WHERE clinic IS NOT NULL AND clinic != ''
ON CONFLICT DO NOTHING;

-- 5. Merge duplicate doctors (same name + phone + tenant, different clinic)
-- Picks the earliest-created row as keeper, merges others into it
DO $$
DECLARE
  keeper RECORD;
  dup RECORD;
BEGIN
  -- Find keepers: one per (tenant, name, phone) group — the earliest created
  FOR keeper IN
    SELECT DISTINCT ON (tenant_id, LOWER(TRIM(name)), phone)
           id, tenant_id, LOWER(TRIM(name)) as norm_name, phone
    FROM doctors
    WHERE is_active = true AND phone IS NOT NULL AND phone != ''
      AND (tenant_id, LOWER(TRIM(name)), phone) IN (
        SELECT tenant_id, LOWER(TRIM(name)), phone
        FROM doctors WHERE is_active = true AND phone IS NOT NULL AND phone != ''
        GROUP BY tenant_id, LOWER(TRIM(name)), phone
        HAVING COUNT(*) > 1
      )
    ORDER BY tenant_id, LOWER(TRIM(name)), phone, created_at ASC
  LOOP
    -- For each duplicate (not the keeper)
    FOR dup IN
      SELECT id, clinic FROM doctors
      WHERE tenant_id = keeper.tenant_id
        AND LOWER(TRIM(name)) = keeper.norm_name
        AND phone = keeper.phone
        AND id != keeper.id
        AND is_active = true
    LOOP
      -- Move clinic mapping to keeper
      IF dup.clinic IS NOT NULL AND dup.clinic != '' THEN
        INSERT INTO doctor_clinics (tenant_id, doctor_id, clinic_label)
        VALUES (keeper.tenant_id, keeper.id, dup.clinic)
        ON CONFLICT DO NOTHING;
      END IF;

      -- Move availability to keeper (with clinic_label)
      UPDATE doctor_availability
      SET doctor_id = keeper.id, clinic_label = dup.clinic
      WHERE doctor_id = dup.id
        AND NOT EXISTS (
          SELECT 1 FROM doctor_availability da2
          WHERE da2.doctor_id = keeper.id AND da2.day = doctor_availability.day
            AND COALESCE(da2.clinic_label, '') = COALESCE(dup.clinic, '')
        );

      -- Move appointments to keeper
      UPDATE appointments SET doctor_id = keeper.id WHERE doctor_id = dup.id;

      -- Move doctor_services to keeper
      INSERT INTO doctor_services (tenant_id, doctor_id, service_id)
      SELECT tenant_id, keeper.id, service_id FROM doctor_services WHERE doctor_id = dup.id
      ON CONFLICT DO NOTHING;

      -- Move breaks to keeper
      UPDATE doctor_breaks SET doctor_id = keeper.id WHERE doctor_id = dup.id
        AND NOT EXISTS (
          SELECT 1 FROM doctor_breaks db2
          WHERE db2.doctor_id = keeper.id AND db2.break_date = doctor_breaks.break_date
        );

      -- Remove duplicate's leftover data
      DELETE FROM doctor_availability WHERE doctor_id = dup.id;
      DELETE FROM doctor_services WHERE doctor_id = dup.id;
      DELETE FROM doctor_breaks WHERE doctor_id = dup.id;

      -- Soft-delete the duplicate
      UPDATE doctors SET is_active = false, name = name || ' [merged]' WHERE id = dup.id;
    END LOOP;
  END LOOP;
END $$;

-- 6. Keep clinic column for now (backward compat during rollout)
-- It will be ignored by new queries but won't break old code if rollback needed
