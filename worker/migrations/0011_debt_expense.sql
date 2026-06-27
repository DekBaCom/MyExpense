ALTER TABLE debts ADD COLUMN category_id INTEGER REFERENCES categories(id);
ALTER TABLE debts ADD COLUMN payment_method TEXT NOT NULL DEFAULT 'transfer';
ALTER TABLE debts ADD COLUMN expense_id INTEGER REFERENCES expenses(id);
