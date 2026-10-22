ALTER TABLE students ADD COLUMN IF NOT EXISTS free_runs_remaining INTEGER NOT NULL DEFAULT 1;
ALTER TABLE students ADD COLUMN IF NOT EXISTS admin_role TEXT NOT NULL DEFAULT 'NONE';
ALTER TABLE products ADD COLUMN IF NOT EXISTS duration_days INTEGER;
ALTER TABLE products ADD COLUMN IF NOT EXISTS access_scope TEXT NOT NULL DEFAULT 'REGISTRATION';
ALTER TABLE products ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS short_description TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS marketing_label TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS best_value INTEGER NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS availability_start TIMESTAMPTZ;
ALTER TABLE products ADD COLUMN IF NOT EXISTS availability_end TIMESTAMPTZ;
ALTER TABLE entitlements ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE entitlements ADD COLUMN IF NOT EXISTS granted_by TEXT;
ALTER TABLE entitlements ADD COLUMN IF NOT EXISTS grant_reason TEXT;
CREATE TABLE IF NOT EXISTS notification_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'INFO',
  target_scope TEXT NOT NULL DEFAULT 'ALL',
  target_student_id TEXT REFERENCES students(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  scheduled_at TIMESTAMPTZ,
  created_by TEXT NOT NULL,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS notification_campaigns_status_scheduled_idx ON notification_campaigns(status, scheduled_at);
UPDATE students SET free_runs_remaining = CASE WHEN free_run_status = 'used' THEN 0 ELSE GREATEST(1, free_runs_remaining) END;
UPDATE entitlements SET expires_at = NULL WHERE expires_at IS NULL;
