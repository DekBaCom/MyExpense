import { Hono } from 'hono'
import type { Bindings, Variables } from '../types'
import { authMiddleware } from '../middleware/auth'
import { sendLineMessage, buildDailySummaryMessage, buildMonthlySummaryMessage } from '../lib/line'
import { currentMonthBKK, todayBKK, computeDueDate, daysUntil } from '../lib/recurring'

const summary = new Hono<{ Bindings: Bindings; Variables: Variables }>()
summary.use('*', authMiddleware)

// Manual trigger: send current-month summary to all recipients with notify_on_summary = 1
summary.post('/send', async (c) => {
  const userId = c.get('userId')
  const month = c.req.query('month') ?? currentMonthBKK()
  const sent = await sendSummaryToUser(c.env, userId, month, 'manual')
  return c.json({ ok: true, sent })
})

export default summary

// ─────────────────────────────────────────────────────
// Cron: daily summary (every night 21:00 BKK)
// ─────────────────────────────────────────────────────
export async function runDailySummary(env: Bindings): Promise<{ users_processed: number; messages_sent: number }> {
  const userRows = await env.DB.prepare(
    `SELECT DISTINCT user_id FROM line_recipients WHERE notify_on_summary = 1`
  ).all<{ user_id: number }>()

  let usersProcessed = 0
  let messagesSent = 0
  for (const { user_id } of userRows.results) {
    const sent = await sendSummaryToUser(env, user_id, currentMonthBKK(), 'daily')
    if (sent > 0) { usersProcessed++; messagesSent += sent }
  }
  return { users_processed: usersProcessed, messages_sent: messagesSent }
}

// ─────────────────────────────────────────────────────
// Cron: monthly summary (1st of month 08:00 BKK)
// ─────────────────────────────────────────────────────
export async function runMonthlySummary(env: Bindings): Promise<{ users_processed: number; messages_sent: number }> {
  // Report on previous month
  const today = todayBKK()
  const d = new Date(today + 'T00:00:00')
  d.setMonth(d.getMonth() - 1)
  const prevMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

  const userRows = await env.DB.prepare(
    `SELECT DISTINCT user_id FROM line_recipients WHERE notify_on_summary = 1`
  ).all<{ user_id: number }>()

  let usersProcessed = 0
  let messagesSent = 0
  for (const { user_id } of userRows.results) {
    const sent = await sendSummaryToUser(env, user_id, prevMonth, 'monthly')
    if (sent > 0) { usersProcessed++; messagesSent += sent }
  }
  return { users_processed: usersProcessed, messages_sent: messagesSent }
}

// ─────────────────────────────────────────────────────
// Shared: build and push summary for one user
// ─────────────────────────────────────────────────────
async function sendSummaryToUser(
  env: Bindings,
  userId: number,
  month: string,
  mode: 'daily' | 'monthly' | 'manual'
): Promise<number> {
  const recipients = await env.DB.prepare(
    `SELECT channel_token, line_user_id FROM line_recipients
     WHERE user_id = ? AND notify_on_summary = 1`
  ).bind(userId).all<{ channel_token: string; line_user_id: string }>()

  if (recipients.results.length === 0) return 0

  const msg = mode === 'monthly'
    ? await buildMonthlyMsg(env, userId, month)
    : await buildDailyMsg(env, userId, month)

  const results = await Promise.all(
    recipients.results.map(r => sendLineMessage(r.channel_token, r.line_user_id, msg))
  )
  return results.filter(Boolean).length
}

async function buildDailyMsg(env: Bindings, userId: number, month: string): Promise<string> {
  const today = todayBKK()

  const [todayRow, monthRow, catRows, recurringRows] = await Promise.all([
    env.DB.prepare(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM expenses WHERE user_id = ? AND date = ?`
    ).bind(userId, today).first<{ total: number }>(),

    env.DB.prepare(
      `SELECT
         COALESCE(SUM(e.amount), 0) AS total_spent,
         COALESCE((SELECT SUM(b.amount) FROM budgets b WHERE b.user_id = ? AND b.month = ?), 0) AS total_budget
       FROM expenses e WHERE e.user_id = ? AND strftime('%Y-%m', e.date) = ?`
    ).bind(userId, month, userId, month).first<{ total_spent: number; total_budget: number }>(),

    env.DB.prepare(
      `SELECT COALESCE(c.parent_id, c.id) AS cat_id,
              COALESCE(p.name, c.name) AS name,
              COALESCE(p.icon, c.icon) AS icon,
              SUM(e.amount) AS spent
       FROM expenses e
       JOIN categories c ON c.id = e.category_id
       LEFT JOIN categories p ON p.id = c.parent_id
       WHERE e.user_id = ? AND strftime('%Y-%m', e.date) = ?
       GROUP BY COALESCE(c.parent_id, c.id)
       ORDER BY spent DESC LIMIT 5`
    ).bind(userId, month).all<{ cat_id: number; name: string; icon: string; spent: number }>(),

    env.DB.prepare(
      `SELECT r.name, r.amount, r.due_day, c.icon, l.status
       FROM recurring_payments r
       JOIN categories c ON c.id = r.category_id
       LEFT JOIN recurring_payment_logs l ON l.recurring_id = r.id AND l.month = ?
       WHERE r.user_id = ? AND r.is_active = 1`
    ).bind(month, userId).all<{ name: string; amount: number; due_day: number; icon: string; status: string | null }>(),
  ])

  // Filter upcoming bills (0–7 days, unpaid)
  const upcomingBills = recurringRows.results
    .filter(r => r.status !== 'paid' && r.status !== 'skipped')
    .map(r => ({ ...r, due_date: computeDueDate(month, r.due_day) }))
    .filter(r => { const d = daysUntil(r.due_date); return d >= 0 && d <= 7 })
    .sort((a, b) => a.due_date.localeCompare(b.due_date))

  return buildDailySummaryMessage({
    month,
    today,
    todayTotal: todayRow?.total ?? 0,
    totalSpent: monthRow?.total_spent ?? 0,
    totalBudget: monthRow?.total_budget ?? 0,
    categories: catRows.results,
    upcomingBills,
  })
}

async function buildMonthlyMsg(env: Bindings, userId: number, month: string): Promise<string> {
  const [spentRow, incomeRow, budgetRow, catRows, debtRow] = await Promise.all([
    env.DB.prepare(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM expenses WHERE user_id = ? AND strftime('%Y-%m', date) = ?`
    ).bind(userId, month).first<{ total: number }>(),

    env.DB.prepare(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM incomes WHERE user_id = ? AND strftime('%Y-%m', date) = ?`
    ).bind(userId, month).first<{ total: number }>(),

    env.DB.prepare(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM budgets WHERE user_id = ? AND month = ?`
    ).bind(userId, month).first<{ total: number }>(),

    env.DB.prepare(
      `SELECT COALESCE(c.parent_id, c.id) AS cat_id,
              COALESCE(p.name, c.name) AS name,
              COALESCE(p.icon, c.icon) AS icon,
              SUM(e.amount) AS spent
       FROM expenses e
       JOIN categories c ON c.id = e.category_id
       LEFT JOIN categories p ON p.id = c.parent_id
       WHERE e.user_id = ? AND strftime('%Y-%m', e.date) = ?
       GROUP BY COALESCE(c.parent_id, c.id)
       ORDER BY spent DESC`
    ).bind(userId, month).all<{ cat_id: number; name: string; icon: string; spent: number }>(),

    env.DB.prepare(
      `SELECT COUNT(*) AS cnt, COALESCE(SUM(amount), 0) AS total
       FROM debts WHERE user_id = ? AND status = 'pending'`
    ).bind(userId).first<{ cnt: number; total: number }>(),
  ])

  return buildMonthlySummaryMessage({
    month,
    totalSpent: spentRow?.total ?? 0,
    totalIncome: incomeRow?.total ?? 0,
    totalBudget: budgetRow?.total ?? 0,
    categories: catRows.results,
    pendingDebtCount: debtRow?.cnt ?? 0,
    pendingDebtTotal: debtRow?.total ?? 0,
  })
}
