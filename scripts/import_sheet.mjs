// Import expenses from Google Sheets CSV into D1
// Usage: node scripts/import_sheet.mjs > worker/migrations/0006_import_sheet.sql
//
// Then run:  cd worker && npx wrangler d1 execute myexpense-db --remote --file=migrations/0006_import_sheet.sql

import { readFileSync } from 'node:fs'

const USER_ID = 1
const CSV_PATH = 'sheet_data.csv'

// New sub-categories to add (parent_id references existing parents)
const NEW_CATEGORIES = [
  // parent 4 = การเดินทาง
  { id: 34, name: 'ค่าผ่อนรถ',       icon: '🚙', color: '#10b981', parent_id: 4, sort_order: 4 },
  { id: 35, name: 'ค่าซ่อมรถ',       icon: '🔧', color: '#10b981', parent_id: 4, sort_order: 5 },
  // parent 9 = อื่นๆ
  { id: 36, name: 'บัตรเครดิต',      icon: '💳', color: '#6b7280', parent_id: 9, sort_order: 3 },
  { id: 37, name: 'เงินให้ครอบครัว', icon: '👨‍👩‍👧', color: '#6b7280', parent_id: 9, sort_order: 4 },
  { id: 38, name: 'สัตว์เลี้ยง',     icon: '🐱', color: '#6b7280', parent_id: 9, sort_order: 5 },
  { id: 39, name: 'ประกัน',          icon: '🛡️', color: '#6b7280', parent_id: 9, sort_order: 6 },
  { id: 40, name: 'สินเชื่อ',        icon: '🏦', color: '#6b7280', parent_id: 9, sort_order: 7 },
]

// Map sheet category text → category_id in D1
const CATEGORY_MAP = {
  'รายจ่ายเรื่องรถ':      35, // ค่าซ่อมรถ
  'ค่าใช้จ่ายอื่นๆ':       9,  // อื่นๆ (parent)
  'ค่ารถยนต์ Yaris':       34, // ค่าผ่อนรถ
  'ให้แม่':                37, // เงินให้ครอบครัว
  'รายเดือนภรรยา':        37, // เงินให้ครอบครัว
  'Home Pro Credit card':  36, // บัตรเครดิต
  'ค่าผ่อนคอนโด':         13, // ค่าเช่า / ผ่อนบ้าน
  'ค่าไฟบ้านที่นนทบุรี':  16, // ค่าไฟฟ้า
  'ค่าไฟบ้านแม่':         16, // ค่าไฟฟ้า
  'TTB Credit Card':       36, // บัตรเครดิต
  'เฟิร์สช้อยส์':          40, // สินเชื่อ
  'KBank Credit Card':     36, // บัตรเครดิต
  'ค่าโทรศัพท์ลี':        19, // โทรศัพท์
  'ค่าโทรศัพท์แม่':       19, // โทรศัพท์
  'ค่าผ่อนมอเตอร์ไซต์':   34, // ค่าผ่อนรถ
  'ผ่อนประกัน':           39, // ประกัน
  'ค่าผ่อนบ้าน':           13, // ค่าเช่า / ผ่อนบ้าน
  'Easypass':              22, // ค่าจอดรถ / ทางด่วน
  'Easypass ':             22,
  'ค่ารักษาแมว':           38, // สัตว์เลี้ยง
  '3BB Internet':          18, // อินเทอร์เน็ต
  'ค่าใช้จ่ายแมว':         38, // สัตว์เลี้ยง
  'ค่าผ่อนรถลูมิน':        34, // ค่าผ่อนรถ
}

// Minimal CSV parser supporting quoted fields with embedded newlines
function parseCSV(text) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++ }
      else if (ch === '"') inQuotes = false
      else field += ch
    } else {
      if (ch === '"') inQuotes = true
      else if (ch === ',') { row.push(field); field = '' }
      else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = '' }
      else if (ch === '\r') { /* skip */ }
      else field += ch
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row) }
  return rows
}

function sqlEscape(s) {
  if (s === null || s === undefined) return 'NULL'
  return `'${String(s).replace(/'/g, "''")}'`
}

const csv = readFileSync(CSV_PATH, 'utf-8')
const rows = parseCSV(csv)
const header = rows[0]
const idx = {
  date: header.indexOf('Date'),
  category: header.indexOf('Category'),
  description: header.indexOf('Description'),
  amount: header.indexOf('Amount'),
  paidDate: header.indexOf('PaidDate'),
  imageUrl: header.indexOf('ImageUrl'),
  slipUrl: header.indexOf('SlipUrl'),
}

const out = []

// Insert new categories
for (const c of NEW_CATEGORIES) {
  out.push(
    `INSERT OR IGNORE INTO categories (id, name, icon, color, parent_id, sort_order) VALUES ` +
    `(${c.id}, ${sqlEscape(c.name)}, ${sqlEscape(c.icon)}, ${sqlEscape(c.color)}, ${c.parent_id}, ${c.sort_order});`
  )
}
// Insert expenses
const unmapped = new Set()
let imported = 0
for (let i = 1; i < rows.length; i++) {
  const r = rows[i]
  if (!r || r.length === 0 || !r[idx.date]) continue

  const dateStr = r[idx.date].trim()
  const category = r[idx.category].trim()
  const description = r[idx.description].trim().replace(/\n+/g, ' ').replace(/\s+/g, ' ')
  const amount = parseFloat(r[idx.amount])

  if (!amount || amount <= 0) continue

  const categoryId = CATEGORY_MAP[category]
  if (!categoryId) {
    unmapped.add(category)
    continue
  }

  // Build note: original category name + description + drive links
  const noteParts = []
  if (description) noteParts.push(description)
  const driveLinks = []
  if (r[idx.imageUrl]?.trim()) driveLinks.push(`📄 ${r[idx.imageUrl].trim()}`)
  if (r[idx.slipUrl]?.trim()) driveLinks.push(`📎 ${r[idx.slipUrl].trim()}`)
  if (driveLinks.length) noteParts.push(driveLinks.join(' '))
  noteParts.push(`[จาก: ${category}]`)
  const note = noteParts.join(' | ').slice(0, 500)

  out.push(
    `INSERT INTO expenses (user_id, category_id, amount, date, payment_method, note) VALUES ` +
    `(${USER_ID}, ${categoryId}, ${amount}, ${sqlEscape(dateStr)}, 'transfer', ${sqlEscape(note)});`
  )
  imported++
}

process.stdout.write(out.join('\n') + '\n')
process.stderr.write(`Imported: ${imported}\nUnmapped: ${unmapped.size}\n`)
