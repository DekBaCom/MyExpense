-- Recurring monthly payments (mortgage, utilities, subscriptions, etc.)
CREATE TABLE IF NOT EXISTS recurring_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  member_id INTEGER REFERENCES members(id) ON DELETE SET NULL,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  name TEXT NOT NULL,
  amount REAL NOT NULL CHECK(amount > 0),
  due_day INTEGER NOT NULL CHECK(due_day BETWEEN 1 AND 31),
  payment_method TEXT NOT NULL DEFAULT 'transfer'
    CHECK(payment_method IN ('cash','transfer','credit','qr')),
  notify_days_before INTEGER NOT NULL DEFAULT 3 CHECK(notify_days_before BETWEEN 0 AND 30),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tracks pay status per month per recurring payment
CREATE TABLE IF NOT EXISTS recurring_payment_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recurring_id INTEGER NOT NULL REFERENCES recurring_payments(id) ON DELETE CASCADE,
  month TEXT NOT NULL,                              -- "2026-06"
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending','paid','skipped')),
  expense_id INTEGER REFERENCES expenses(id) ON DELETE SET NULL,
  paid_at DATETIME,
  reminder_sent_at DATETIME,                        -- last reminder for upcoming/due
  overdue_alert_at DATETIME,                        -- last overdue alert
  UNIQUE(recurring_id, month)
);

CREATE INDEX IF NOT EXISTS idx_recurring_user_active ON recurring_payments(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_recurring_logs_month ON recurring_payment_logs(month, status);
