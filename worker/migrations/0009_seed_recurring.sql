-- Seed recurring payments from the existing imported data
-- All for user_id = 1 (the household owner)

INSERT INTO recurring_payments (user_id, category_id, name, amount, due_day, payment_method, notify_days_before, is_active) VALUES
(1, 13, 'ค่าผ่อนคอนโด',           11000,    30, 'transfer', 3, 1),
(1, 13, 'ค่าผ่อนบ้าน (พิมลกาญจน์)', 11820,    30, 'transfer', 3, 1),
(1, 34, 'ค่าผ่อนรถยนต์ Yaris',     9059,     30, 'transfer', 3, 1),
(1, 34, 'ค่าผ่อนรถลูมิน',          6969,     29, 'transfer', 3, 1),
(1, 34, 'ค่าผ่อนมอเตอร์ไซต์',      5197,     30, 'transfer', 3, 1),
(1, 39, 'ผ่อนประกัน Yaris',        2500,     11, 'transfer', 5, 1),
(1, 37, 'ให้แม่',                  4000,     30, 'transfer', 1, 1),
(1, 37, 'รายเดือนภรรยา',           10000,    30, 'transfer', 1, 1),
(1, 16, 'ค่าไฟบ้าน (นนทบุรี)',     2500,     5,  'transfer', 3, 1),
(1, 16, 'ค่าไฟบ้านแม่',            300,      5,  'transfer', 3, 1),
(1, 18, '3BB Internet',            374.5,    12, 'transfer', 3, 1),
(1, 19, 'ค่าโทรศัพท์ลี',           320,      28, 'transfer', 2, 1),
(1, 19, 'ค่าโทรศัพท์แม่',          280,      28, 'transfer', 2, 1),
(1, 22, 'Easypass (ทางด่วน)',     2500,     3,  'transfer', 0, 1);
