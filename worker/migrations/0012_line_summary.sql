-- Add notify_on_summary flag to LINE recipients
ALTER TABLE line_recipients ADD COLUMN notify_on_summary INTEGER NOT NULL DEFAULT 1;
