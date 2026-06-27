CREATE TABLE IF NOT EXISTS debts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  member_id INTEGER REFERENCES members(id),
  debtor_name TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  due_date TEXT,
  description TEXT,
  invoice_key TEXT,
  slip_key TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  paid_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_debts_user_id ON debts(user_id);
CREATE INDEX IF NOT EXISTS idx_debts_user_status ON debts(user_id, status);

ALTER TABLE line_recipients ADD COLUMN notify_on_debt INTEGER NOT NULL DEFAULT 1;
