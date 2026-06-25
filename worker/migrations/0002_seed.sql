-- Seed default categories (parent categories)
INSERT OR IGNORE INTO categories (id, name, name_en, icon, color, parent_id, sort_order) VALUES
(1,  'อาหาร',           'Food',          '🍔', '#f59e0b', NULL, 1),
(2,  'ที่พักอาศัย',      'Housing',       '🏠', '#8b5cf6', NULL, 2),
(3,  'สาธารณูปโภค',     'Utilities',     '⚡', '#06b6d4', NULL, 3),
(4,  'การเดินทาง',      'Transport',     '🚗', '#10b981', NULL, 4),
(5,  'สุขภาพ',          'Health',        '🏥', '#ef4444', NULL, 5),
(6,  'การศึกษา',        'Education',     '📚', '#3b82f6', NULL, 6),
(7,  'ช้อปปิ้ง',         'Shopping',      '🛍️', '#ec4899', NULL, 7),
(8,  'บันเทิง',          'Entertainment', '🎮', '#f97316', NULL, 8),
(9,  'อื่นๆ',            'Others',        '💰', '#6b7280', NULL, 9);

-- Sub-categories: อาหาร (1)
INSERT OR IGNORE INTO categories (id, name, name_en, icon, color, parent_id, sort_order) VALUES
(10, 'กับข้าว / วัตถุดิบ',   'Groceries',     '🥬', '#f59e0b', 1, 1),
(11, 'อาหารนอกบ้าน',         'Eating Out',    '🍜', '#f59e0b', 1, 2),
(12, 'เครื่องดื่ม / ของว่าง', 'Drinks/Snacks', '🧋', '#f59e0b', 1, 3);

-- Sub-categories: ที่พักอาศัย (2)
INSERT OR IGNORE INTO categories (id, name, name_en, icon, color, parent_id, sort_order) VALUES
(13, 'ค่าเช่า / ผ่อนบ้าน', 'Rent/Mortgage', '🏠', '#8b5cf6', 2, 1),
(14, 'ค่าซ่อมแซม',         'Repairs',       '🔧', '#8b5cf6', 2, 2),
(15, 'เฟอร์นิเจอร์',        'Furniture',     '🛋️', '#8b5cf6', 2, 3);

-- Sub-categories: สาธารณูปโภค (3)
INSERT OR IGNORE INTO categories (id, name, name_en, icon, color, parent_id, sort_order) VALUES
(16, 'ค่าไฟฟ้า',     'Electricity', '💡', '#06b6d4', 3, 1),
(17, 'ค่าน้ำประปา',  'Water',       '💧', '#06b6d4', 3, 2),
(18, 'อินเทอร์เน็ต', 'Internet',    '📡', '#06b6d4', 3, 3),
(19, 'โทรศัพท์',     'Mobile',      '📱', '#06b6d4', 3, 4);

-- Sub-categories: การเดินทาง (4)
INSERT OR IGNORE INTO categories (id, name, name_en, icon, color, parent_id, sort_order) VALUES
(20, 'น้ำมัน',              'Fuel',        '⛽', '#10b981', 4, 1),
(21, 'รถสาธารณะ / Grab',   'Transit',     '🚌', '#10b981', 4, 2),
(22, 'ค่าจอดรถ / ทางด่วน', 'Parking/Toll','🛣️', '#10b981', 4, 3);

-- Sub-categories: สุขภาพ (5)
INSERT OR IGNORE INTO categories (id, name, name_en, icon, color, parent_id, sort_order) VALUES
(23, 'ค่าหมอ / โรงพยาบาล', 'Doctor/Hospital', '🏥', '#ef4444', 5, 1),
(24, 'ยา / วิตามิน',         'Medicine',        '💊', '#ef4444', 5, 2),
(25, 'ฟิตเนส / กีฬา',        'Fitness',         '🏋️', '#ef4444', 5, 3);

-- Sub-categories: การศึกษา (6)
INSERT OR IGNORE INTO categories (id, name, name_en, icon, color, parent_id, sort_order) VALUES
(26, 'ค่าเทอม / หนังสือ', 'Tuition/Books', '📖', '#3b82f6', 6, 1),
(27, 'กิจกรรมเสริม',      'Activities',    '🎨', '#3b82f6', 6, 2);

-- Sub-categories: ช้อปปิ้ง (7)
INSERT OR IGNORE INTO categories (id, name, name_en, icon, color, parent_id, sort_order) VALUES
(28, 'เสื้อผ้า / รองเท้า',   'Clothing',        '👕', '#ec4899', 7, 1),
(29, 'ของใช้ในบ้าน',          'Household Items', '🧹', '#ec4899', 7, 2);

-- Sub-categories: บันเทิง (8)
INSERT OR IGNORE INTO categories (id, name, name_en, icon, color, parent_id, sort_order) VALUES
(30, 'Streaming / สมัครสมาชิก', 'Streaming',    '📺', '#f97316', 8, 1),
(31, 'ท่องเที่ยว / กิจกรรม',    'Travel',       '✈️', '#f97316', 8, 2);

-- Sub-categories: อื่นๆ (9)
INSERT OR IGNORE INTO categories (id, name, name_en, icon, color, parent_id, sort_order) VALUES
(32, 'บริจาค / ของขวัญ', 'Donation/Gift', '🎁', '#6b7280', 9, 1),
(33, 'ค่าใช้จ่ายฉุกเฉิน',  'Emergency',    '🚨', '#6b7280', 9, 2);
