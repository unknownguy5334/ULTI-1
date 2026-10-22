ALTER TABLE students ADD CONSTRAINT students_admin_role_check CHECK (admin_role IN ('NONE','OWNER','ADMIN','FINANCE','SUPPORT'));
ALTER TABLE entitlements ADD COLUMN IF NOT EXISTS grant_type TEXT NOT NULL DEFAULT 'PAID';
CREATE INDEX IF NOT EXISTS entitlements_student_grant_type_idx ON entitlements(student_id, grant_type, status);
ALTER TABLE payment_submissions ADD COLUMN IF NOT EXISTS refund_amount INTEGER NOT NULL DEFAULT 0;
ALTER TABLE payment_submissions ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;
ALTER TABLE payment_submissions ADD COLUMN IF NOT EXISTS refunded_by TEXT;
ALTER TABLE payment_submissions ADD COLUMN IF NOT EXISTS refund_reason TEXT;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_adjustment_type') THEN
    CREATE TYPE payment_adjustment_type AS ENUM ('CORRECTION','REFUND','REVERSAL');
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS payment_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES payment_submissions(id) ON DELETE CASCADE,
  admin_id TEXT NOT NULL,
  type payment_adjustment_type NOT NULL,
  amount INTEGER NOT NULL,
  previous_amount INTEGER,
  new_amount INTEGER,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS payment_adjustments_submission_time_idx ON payment_adjustments(submission_id, created_at DESC);
CREATE INDEX IF NOT EXISTS payment_adjustments_admin_time_idx ON payment_adjustments(admin_id, created_at DESC);
CREATE TABLE IF NOT EXISTS support_ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL,
  author_type TEXT NOT NULL DEFAULT 'ADMIN',
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS support_ticket_messages_ticket_time_idx ON support_ticket_messages(ticket_id, created_at ASC);

ALTER TABLE students DROP CONSTRAINT IF EXISTS students_role_check;
ALTER TABLE students ADD CONSTRAINT students_role_check CHECK (role IN ('STUDENT','ADMIN','OWNER'));
