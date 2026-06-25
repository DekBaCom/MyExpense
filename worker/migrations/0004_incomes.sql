-- Income categories
CREATE TABLE IF NOT EXISTS income_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  name_en TEXT,
  icon TEXT NOT NULL DEFAULT '💵',
  color TEXT NOT NULL DEFAULT '#10b981',
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- Income records
CREATE TABLE IF NOT EXISTS incomes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  member_id INTEGER REFERENCES members(id) ON DELETE SET NULL,
  category_id INTEGER NOT NULL REFERENCES income_categories(id),
  amount REAL NOT NULL CHECK(amount > 0),
  date DATE NOT NULL,
  note TEXT,
  receipt_key TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_incomes_user_date ON incomes(user_id, date);
CREATE INDEX IF NOT EXISTS idx_incomes_category  ON incomes(category_id);

-- Seed income categories
INSERT OR IGNORE INTO income_categories (id, name, name_en, icon, color, sort_order) VALUES
(1, 'เงินเดือน',          'Salary',      '💼', '#10b981', 1),
(2, 'งานพิเศษ / ฟรีแลนซ์','Freelance',   '🤝', '#06b6d4', 2),
(3, 'โบนัส / OT',          'Bonus',       '🎉', '#f59e0b', 3),
(4, 'ลงทุน / ดอกเบี้ย',    'Investment',  '📈', '#8b5cf6', 4),
(5, 'ขายของ',              'Sales',       '🛒', '#f97316', 5),
(6, 'ของขวัญ / รับโอน',    'Gift',        '🎁', '#ec4899', 6),
(7, 'อื่นๆ',                'Others',      '💸', '#6b7280', 7);
