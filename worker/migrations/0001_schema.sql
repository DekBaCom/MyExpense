-- Users (from Google OAuth)
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  google_id TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  picture TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Family members in the household
CREATE TABLE IF NOT EXISTS members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  emoji TEXT NOT NULL DEFAULT '👤',
  is_owner INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Expense categories (supports parent/child hierarchy)
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  name_en TEXT,
  icon TEXT NOT NULL DEFAULT '💰',
  color TEXT NOT NULL DEFAULT '#6366f1',
  parent_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- Main expense records
CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  member_id INTEGER REFERENCES members(id) ON DELETE SET NULL,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  amount REAL NOT NULL CHECK(amount > 0),
  date DATE NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'cash' CHECK(payment_method IN ('cash','transfer','credit','qr')),
  note TEXT,
  receipt_key TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Monthly budget per category
CREATE TABLE IF NOT EXISTS budgets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  month TEXT NOT NULL,
  amount REAL NOT NULL CHECK(amount >= 0),
  UNIQUE(user_id, category_id, month)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON expenses(user_id, date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_budgets_user_month ON budgets(user_id, month);
CREATE INDEX IF NOT EXISTS idx_members_user ON members(user_id);
