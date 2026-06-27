const LINE_PUSH_URL = 'https://api.line.me/v2/bot/message/push'

export type LineSettings = {
  channel_token: string | null
  line_user_id: string | null
  notify_on_add: number
  notify_on_budget_alert: number
}

export async function sendLineMessage(token: string, userId: string, text: string): Promise<boolean> {
  try {
    const res = await fetch(LINE_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        to: userId,
        messages: [{ type: 'text', text }],
      }),
    })
    return res.ok
  } catch {
    return false
  }
}

export function buildExpenseMessage(opts: {
  icon: string
  categoryName: string
  amount: number
  date: string
  memberName?: string | null
  paymentMethod: string
  note?: string | null
  totalSpentThisMonth: number
}): string {
  const paymentLabel: Record<string, string> = {
    cash: '💵 เงินสด',
    transfer: '🏦 โอนเงิน',
    credit: '💳 บัตรเครดิต',
    qr: '📱 QR Code',
  }

  const lines = [
    '💸 บันทึกรายจ่ายใหม่',
    `━━━━━━━━━━━━━━━`,
    `${opts.icon} ${opts.categoryName}`,
    `💰 ฿${opts.amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`,
    `📅 ${formatDateTH(opts.date)}`,
    `${paymentLabel[opts.paymentMethod] ?? opts.paymentMethod}`,
  ]

  if (opts.memberName) lines.push(`👤 ${opts.memberName}`)
  if (opts.note) lines.push(`📝 ${opts.note}`)

  lines.push(
    `━━━━━━━━━━━━━━━`,
    `📊 ยอดรวมเดือนนี้: ฿${opts.totalSpentThisMonth.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`
  )

  return lines.join('\n')
}

export function buildRecurringReminderMessage(opts: {
  items: { name: string; amount: number; due_date: string; icon: string }[]
  daysUntil: number  // 0 = due today, positive = upcoming, negative = overdue
}): string {
  const total = opts.items.reduce((s, i) => s + i.amount, 0)
  const header = opts.daysUntil > 0
    ? `🔔 บิลที่ต้องชำระใน ${opts.daysUntil} วัน`
    : opts.daysUntil === 0
      ? '⏰ บิลที่ครบกำหนดวันนี้'
      : `🚨 บิลค้างชำระ ${Math.abs(opts.daysUntil)} วันแล้ว`

  const lines = [header, '━━━━━━━━━━━━━━━']
  for (const item of opts.items) {
    lines.push(`${item.icon} ${item.name}`)
    lines.push(`   ฿${item.amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })} • ${formatDateTH(item.due_date)}`)
  }
  lines.push('━━━━━━━━━━━━━━━')
  lines.push(`💰 รวม ฿${total.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`)
  return lines.join('\n')
}

export function buildBudgetAlertMessage(opts: {
  icon: string
  categoryName: string
  spent: number
  budget: number
}): string {
  const pct = Math.round((opts.spent / opts.budget) * 100)
  const isOver = opts.spent > opts.budget

  return [
    isOver ? '🚨 เกินงบประมาณ!' : '⚠️ ใกล้ถึงงบประมาณ',
    `━━━━━━━━━━━━━━━`,
    `${opts.icon} หมวด "${opts.categoryName}"`,
    `ใช้ไปแล้ว ${pct}%`,
    `฿${opts.spent.toLocaleString('th-TH', { minimumFractionDigits: 2 })} / ฿${opts.budget.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`,
    isOver
      ? `เกินงบ ฿${(opts.spent - opts.budget).toLocaleString('th-TH', { minimumFractionDigits: 2 })}`
      : `เหลืออีก ฿${(opts.budget - opts.spent).toLocaleString('th-TH', { minimumFractionDigits: 2 })}`,
  ].join('\n')
}

export function buildDailySummaryMessage(opts: {
  month: string
  today: string
  todayTotal: number
  totalSpent: number
  totalBudget: number
  categories: { name: string; icon: string; spent: number }[]
  upcomingBills: { name: string; amount: number; due_date: string; icon: string }[]
}): string {
  const budgetPct = opts.totalBudget > 0 ? Math.round((opts.totalSpent / opts.totalBudget) * 100) : null
  const remaining = opts.totalBudget > 0 ? opts.totalBudget - opts.totalSpent : null

  const lines = [
    `📊 สรุปรายวัน — ${formatDateTH(opts.today)}`,
    '━━━━━━━━━━━━━━━',
  ]

  if (opts.todayTotal > 0) {
    lines.push(`💸 วันนี้ใช้ไป ฿${opts.todayTotal.toLocaleString('th-TH', { minimumFractionDigits: 0 })}`)
  } else {
    lines.push('💸 วันนี้ยังไม่มีรายจ่าย')
  }

  if (opts.totalBudget > 0) {
    const bar = budgetBar(budgetPct!)
    lines.push(`📅 เดือนนี้ ฿${fmt(opts.totalSpent)} / ฿${fmt(opts.totalBudget)} ${bar} ${budgetPct}%`)
    if (remaining! < 0) {
      lines.push(`⚠️ เกินงบ ฿${fmt(Math.abs(remaining!))}`)
    } else {
      lines.push(`✅ เหลือ ฿${fmt(remaining!)}`)
    }
  } else {
    lines.push(`📅 เดือนนี้รวม ฿${fmt(opts.totalSpent)}`)
  }

  if (opts.categories.length > 0) {
    lines.push('', '🏷️ หมวดที่ใช้มากสุด')
    for (const cat of opts.categories.slice(0, 3)) {
      const pct = opts.totalSpent > 0 ? Math.round((cat.spent / opts.totalSpent) * 100) : 0
      lines.push(`${cat.icon} ${cat.name} ฿${fmt(cat.spent)} (${pct}%)`)
    }
  }

  if (opts.upcomingBills.length > 0) {
    lines.push('', '🔔 บิลที่ต้องจ่ายเร็วๆนี้')
    for (const bill of opts.upcomingBills.slice(0, 3)) {
      lines.push(`${bill.icon} ${bill.name} ฿${fmt(bill.amount)} • ${formatDateTH(bill.due_date)}`)
    }
  }

  return lines.join('\n')
}

export function buildMonthlySummaryMessage(opts: {
  month: string
  totalSpent: number
  totalIncome: number
  totalBudget: number
  categories: { name: string; icon: string; spent: number }[]
  pendingDebtCount: number
  pendingDebtTotal: number
}): string {
  const net = opts.totalIncome - opts.totalSpent
  const budgetPct = opts.totalBudget > 0 ? Math.round((opts.totalSpent / opts.totalBudget) * 100) : null

  const [y, m] = opts.month.split('-').map(Number)
  const months = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']
  const monthLabel = `${months[m - 1]} ${y + 543}`

  const lines = [
    `📋 สรุปประจำเดือน ${monthLabel}`,
    '━━━━━━━━━━━━━━━',
    `📥 รายรับ +฿${fmt(opts.totalIncome)}`,
    `📤 รายจ่าย −฿${fmt(opts.totalSpent)}`,
    `${net >= 0 ? '💚' : '🔴'} คงเหลือ ${net >= 0 ? '' : '−'}฿${fmt(Math.abs(net))}`,
  ]

  if (opts.totalBudget > 0) {
    const bar = budgetBar(budgetPct!)
    lines.push(`📊 งบประมาณ ${bar} ${budgetPct}% (฿${fmt(opts.totalSpent)} / ฿${fmt(opts.totalBudget)})`)
  }

  if (opts.categories.length > 0) {
    lines.push('', '🏷️ รายจ่ายแต่ละหมวด')
    for (const cat of opts.categories) {
      const pct = opts.totalSpent > 0 ? Math.round((cat.spent / opts.totalSpent) * 100) : 0
      lines.push(`${cat.icon} ${cat.name} ฿${fmt(cat.spent)} (${pct}%)`)
    }
  }

  if (opts.pendingDebtCount > 0) {
    lines.push('', `💳 หนี้คงค้าง ${opts.pendingDebtCount} รายการ รวม ฿${fmt(opts.pendingDebtTotal)}`)
  }

  return lines.join('\n')
}

function fmt(n: number): string {
  return n.toLocaleString('th-TH', { minimumFractionDigits: 0 })
}

function budgetBar(pct: number): string {
  const filled = Math.round(Math.min(pct, 100) / 10)
  return '█'.repeat(filled) + '░'.repeat(10 - filled)
}

function formatDateTH(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const months = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + 543}`
}

export function buildDebtCreatedMessage(opts: {
  debtorName: string
  amount: number
  dueDate: string | null
  description: string | null
}): string {
  const lines = [
    '🧾 รายการทวงหนี้ใหม่',
    `━━━━━━━━━━━━━━━`,
    `👤 ${opts.debtorName}`,
    `💰 ฿${opts.amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`,
  ]
  if (opts.dueDate) lines.push(`📅 ครบกำหนด ${formatDateTH(opts.dueDate)}`)
  if (opts.description) lines.push(`📝 ${opts.description}`)
  return lines.join('\n')
}

export function buildDebtPaidMessage(opts: {
  debtorName: string
  amount: number
}): string {
  return [
    '✅ รับชำระหนี้แล้ว',
    `━━━━━━━━━━━━━━━`,
    `👤 ${opts.debtorName}`,
    `💰 ฿${opts.amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`,
  ].join('\n')
}

export function buildDebtReminderMessage(opts: {
  debtorName: string
  amount: number
  dueDate: string | null
  description: string | null
}): string {
  const lines = [
    '🔔 แจ้งเตือนการชำระหนี้',
    `━━━━━━━━━━━━━━━`,
    `👤 ${opts.debtorName}`,
    `💰 ฿${opts.amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`,
  ]
  if (opts.dueDate) lines.push(`📅 ครบกำหนด ${formatDateTH(opts.dueDate)}`)
  if (opts.description) lines.push(`📝 ${opts.description}`)
  lines.push('━━━━━━━━━━━━━━━', 'กรุณาชำระตามกำหนดด้วยนะครับ/ค่ะ')
  return lines.join('\n')
}
