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
