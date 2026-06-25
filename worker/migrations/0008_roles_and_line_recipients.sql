-- Member roles: owner > admin > member
ALTER TABLE members ADD COLUMN role TEXT NOT NULL DEFAULT 'member'
  CHECK(role IN ('owner','admin','member'));

-- Migrate existing is_owner=1 to role='owner', the rest become 'admin' (granted by owner)
UPDATE members SET role = 'owner' WHERE is_owner = 1;
UPDATE members SET role = 'admin' WHERE is_owner = 0;

-- LINE recipients (replaces line_settings — supports multiple per household)
CREATE TABLE IF NOT EXISTS line_recipients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  member_id INTEGER REFERENCES members(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  channel_token TEXT NOT NULL,
  line_user_id TEXT NOT NULL,
  notify_on_add INTEGER NOT NULL DEFAULT 1,
  notify_on_budget_alert INTEGER NOT NULL DEFAULT 1,
  notify_on_recurring INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, member_id)
);

-- Migrate existing line_settings to line_recipients (associate with the household owner)
INSERT INTO line_recipients (user_id, member_id, label, channel_token, line_user_id, notify_on_add, notify_on_budget_alert, notify_on_recurring)
SELECT
  l.user_id,
  (SELECT id FROM members WHERE user_id = l.user_id AND is_owner = 1 LIMIT 1),
  'เจ้าของบัญชี',
  l.channel_token,
  l.line_user_id,
  l.notify_on_add,
  l.notify_on_budget_alert,
  1
FROM line_settings l
WHERE l.channel_token IS NOT NULL AND l.line_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_line_recipients_user ON line_recipients(user_id);
