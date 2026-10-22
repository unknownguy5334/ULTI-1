ALTER TABLE app_config ADD COLUMN IF NOT EXISTS support_email TEXT;
ALTER TABLE app_config ADD COLUMN IF NOT EXISTS support_phone TEXT;
ALTER TABLE app_config ADD COLUMN IF NOT EXISTS business_location TEXT;
ALTER TABLE app_config ADD COLUMN IF NOT EXISTS maintenance_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE app_config ADD COLUMN IF NOT EXISTS maintenance_message TEXT;
ALTER TABLE app_config ADD COLUMN IF NOT EXISTS maintenance_starts_at TIMESTAMPTZ;
ALTER TABLE app_config ADD COLUMN IF NOT EXISTS maintenance_ends_at TIMESTAMPTZ;
ALTER TABLE app_config ADD COLUMN IF NOT EXISTS registration_windows JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE app_config ADD COLUMN IF NOT EXISTS access_policy JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE app_config ADD COLUMN IF NOT EXISTS feature_flags JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE students ADD COLUMN IF NOT EXISTS account_status TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE students ADD COLUMN IF NOT EXISTS suspension_reason TEXT;

CREATE TABLE IF NOT EXISTS product_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id TEXT NOT NULL,
  old_amount INTEGER,
  new_amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EGP',
  admin_id TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS product_price_history_product_time_idx
  ON product_price_history (product_id, created_at DESC);

CREATE TABLE IF NOT EXISTS academic_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year TEXT NOT NULL,
  term TEXT NOT NULL CHECK (term IN ('FALL','SPRING','SUMMER')),
  start_date DATE,
  end_date DATE,
  registration_start DATE,
  registration_end DATE,
  access_expiry DATE,
  enabled INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (academic_year, term)
);

CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id TEXT REFERENCES students(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'NORMAL',
  status TEXT NOT NULL DEFAULT 'OPEN',
  assigned_admin_id TEXT,
  internal_notes TEXT,
  resolution TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS support_tickets_status_time_idx
  ON support_tickets (status, created_at DESC);
CREATE INDEX IF NOT EXISTS support_tickets_student_time_idx
  ON support_tickets (student_id, created_at DESC);
