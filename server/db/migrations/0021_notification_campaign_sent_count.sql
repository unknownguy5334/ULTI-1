ALTER TABLE notification_campaigns ADD COLUMN IF NOT EXISTS sent_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE notification_campaigns ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'NORMAL';
ALTER TABLE notification_campaigns ADD COLUMN IF NOT EXISTS processing_at TIMESTAMP;
ALTER TABLE notification_campaigns ADD COLUMN IF NOT EXISTS failure_reason TEXT;
