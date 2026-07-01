import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Bindings, Variables, RecurringPayment, UpcomingPaymentItem, UpcomingPayments } from '../types'
import { authMiddleware } from '../middleware/auth'
import { computeDueDate, currentMonthBKK, daysUntil, todayBKK } from '../lib/recurring'
import { sendLineMessage, buildBillPaidMessage } from '../lib/line'

const recurring = new Hono<{ Bindings: Bindings; Variables: Variables }>()
recurring.use('*', authMiddleware)

const recurringSchema = z.object({
  name: z.string().min(1).max(100),
  amount: z.number().positive(),
  category_id: z.number().int().positive(),
  due_day: z.number().int().min(1).max(31),
  member_id: z.number().int().positive().nullable().optional(),
  payment_method: z.enum(['cash', 'transfer', 'credit', 'qr']).default('transfer'),
  notify_days_before: z.number().int().min(0).max(30).default(3),
  is_active: z.boolean().default(true),
})

recurring.get('/', async (c) => {
  const userId = c.get('userId')
  const rows = await c.env.DB.prepare(
    `SELECT r.*,
            c.name AS category_name, c.icon AS category_icon, c.color AS category_color,
            m.name AS member_name, m.emoji AS member_emoji
     FROM recurring_payments r
     JOIN categories c ON c.id = r.category_id
     LEFT JOIN members m ON m.id = r.member_id
     WHERE r.user_id = ?
     ORDER BY r.is_active DESC, r.due_day ASC`
  )
    .bind(userId)
    .all<RecurringPayment>()
  return c.json(rows.results)
})

recurring.post('/', zValidator('json', recurringSchema), async (c) => {
  const userId = c.get('userId')
  const body = c.req.valid('json')

  const result = await c.env.DB.prepare(
    `INSERT INTO recurring_payments
       (user_id, member_id, category_id, name, amount, due_day, payment_method, notify_days_before, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     RETURNING id`
  )
    .bind(
      userId,
      body.member_id ?? null,
      body.category_id,
      body.name,
      body.amount,
      body.due_day,
      body.payment_method,
      body.notify_days_before,
      body.is_active ? 1 : 0
    )
    .first<{ id: number }>()

  return c.json({ id: result?.id }, 201)
})

recurring.put('/:id', zValidator('json', recurringSchema.partial()), async (c) => {
  const userId = c.get('userId')
  const id = parseInt(c.req.param('id'))
  const body = c.req.valid('json')

  const existing = await c.env.DB.prepare(
    'SELECT id FROM recurring_payments WHERE id = ? AND user_id = ?'
  )
    .bind(id, userId)
    .first()
  if (!existing) return c.json({ error: 'Not found' }, 404)

  const fields: string[] = []
  const vals: (string | number | null)[] = []
  if (body.name !== undefined) { fields.push('name = ?'); vals.push(body.name) }
  if (body.amount !== undefined) { fields.push('amount = ?'); vals.push(body.amount) }
  if (body.category_id !== undefined) { fields.push('category_id = ?'); vals.push(body.category_id) }
  if (body.due_day !== undefined) { fields.push('due_day = ?'); vals.push(body.due_day) }
  if (body.member_id !== undefined) { fields.push('member_id = ?'); vals.push(body.member_id ?? null) }
  if (body.payment_method !== undefined) { fields.push('payment_method = ?'); vals.push(body.payment_method) }
  if (body.notify_days_before !== undefined) { fields.push('notify_days_before = ?'); vals.push(body.notify_days_before) }
  if (body.is_active !== undefined) { fields.push('is_active = ?'); vals.push(body.is_active ? 1 : 0) }

  if (fields.length === 0) return c.json({ error: 'No fields to update' }, 400)
  fields.push('updated_at = CURRENT_TIMESTAMP')

  await c.env.DB.prepare(
    `UPDATE recurring_payments SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`
  )
    .bind(...vals, id, userId)
    .run()

  return c.json({ ok: true })
})

recurring.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const id = parseInt(c.req.param('id'))

  const result = await c.env.DB.prepare(
    'DELETE FROM recurring_payments WHERE id = ? AND user_id = ?'
  )
    .bind(id, userId)
    .run()

  if (result.meta.changes === 0) return c.json({ error: 'Not found' }, 404)
  return c.json({ ok: true })
})

// Upcoming payments for a given month
recurring.get('/upcoming', async (c) => {
  const userId = c.get('userId')
  const month = c.req.query('month') ?? currentMonthBKK()

  const rows = await c.env.DB.prepare(
    `SELECT r.*,
            c.name AS category_name, c.icon AS category_icon, c.color AS category_color,
            m.name AS member_name, m.emoji AS member_emoji,
            l.id AS log_id, l.status AS log_status, l.paid_at, l.expense_id
     FROM recurring_payments r
     JOIN categories c ON c.id = r.category_id
     LEFT JOIN members m ON m.id = r.member_id
     LEFT JOIN recurring_payment_logs l
       ON l.recurring_id = r.id AND l.month = ?
     WHERE r.user_id = ? AND r.is_active = 1
     ORDER BY r.due_day ASC`
  )
    .bind(month, userId)
    .all<RecurringPayment & {
      log_id: number | null
      log_status: 'pending' | 'paid' | 'skipped' | null
      paid_at: string | null
      expense_id: number | null
    }>()

  const today = todayBKK()
  const items: UpcomingPaymentItem[] = rows.results.map(r => {
    const dueDate = computeDueDate(month, r.due_day)
    let status: UpcomingPaymentItem['status'] = r.log_status ?? 'pending'
    if (status === 'pending' && dueDate < today) status = 'overdue'
    return {
      ...r,
      due_date: dueDate,
      log_id: r.log_id,
      status,
      paid_at: r.paid_at,
      expense_id: r.expense_id,
    }
  })

  let total_due = 0, total_paid = 0, total_pending = 0
  let paid_count = 0, pending_count = 0, overdue_count = 0
  for (const it of items) {
    total_due += it.amount
    if (it.status === 'paid') { total_paid += it.amount; paid_count++ }
    else if (it.status === 'overdue') { total_pending += it.amount; overdue_count++ }
    else if (it.status === 'pending') { total_pending += it.amount; pending_count++ }
  }

  const result: UpcomingPayments = {
    month,
    total_due,
    total_paid,
    total_pending,
    paid_count,
    pending_count,
    overdue_count,
    items,
  }
  return c.json(result)
})

// Mark recurring payment as paid (creates expense + log)
const paySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  amount: z.number().positive().optional(),
  note: z.string().max(500).optional(),
  create_expense: z.boolean().default(true),
})

recurring.post('/:id/pay', zValidator('json', paySchema), async (c) => {
  const userId = c.get('userId')
  const id = parseInt(c.req.param('id'))
  const { month, date, amount, note, create_expense } = c.req.valid('json')

  const r = await c.env.DB.prepare(
    'SELECT * FROM recurring_payments WHERE id = ? AND user_id = ?'
  )
    .bind(id, userId)
    .first<RecurringPayment>()
  if (!r) return c.json({ error: 'Recurring payment not found' }, 404)

  const paidDate = date ?? todayBKK()
  const finalAmount = amount ?? r.amount
  const expenseNote = note ?? `${r.name} (รายเดือน ${month})`

  let expenseId: number | null = null
  if (create_expense) {
    const exp = await c.env.DB.prepare(
      `INSERT INTO expenses (user_id, member_id, category_id, amount, date, payment_method, note)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       RETURNING id`
    )
      .bind(userId, r.member_id, r.category_id, finalAmount, paidDate, r.payment_method, expenseNote)
      .first<{ id: number }>()
    expenseId = exp?.id ?? null
  }

  const log = await c.env.DB.prepare(
    `INSERT INTO recurring_payment_logs (recurring_id, month, status, expense_id, paid_at)
     VALUES (?, ?, 'paid', ?, CURRENT_TIMESTAMP)
     ON CONFLICT(recurring_id, month) DO UPDATE SET
       status = 'paid',
       expense_id = excluded.expense_id,
       paid_at = CURRENT_TIMESTAMP
     RETURNING id`
  )
    .bind(id, month, expenseId)
    .first<{ id: number }>()

  // Clear dashboard KV cache so next refetch returns fresh data with the new expense
  const expenseMonth = paidDate.slice(0, 7)
  const cacheDeletes: Promise<void>[] = [c.env.SESSIONS.delete(`dashboard:${userId}:${month}`)]
  if (expenseMonth !== month) cacheDeletes.push(c.env.SESSIONS.delete(`dashboard:${userId}:${expenseMonth}`))
  await Promise.all(cacheDeletes)

  c.executionCtx.waitUntil(
    (async () => {
      const [recipients, catRow] = await Promise.all([
        c.env.DB.prepare(
          `SELECT channel_token, line_user_id FROM line_recipients WHERE user_id = ? AND notify_on_recurring = 1`
        ).bind(userId).all<{ channel_token: string; line_user_id: string }>(),
        c.env.DB.prepare('SELECT name, icon FROM categories WHERE id = ?')
          .bind(r.category_id).first<{ name: string; icon: string }>(),
      ])
      if (recipients.results.length === 0) return
      const msg = buildBillPaidMessage({
        name: r.name,
        amount: finalAmount,
        date: paidDate,
        icon: catRow?.icon ?? '💰',
        category: catRow?.name ?? '',
        month,
      })
      await Promise.all(recipients.results.map(rec => sendLineMessage(rec.channel_token, rec.line_user_id, msg)))
    })()
  )

  return c.json({ log_id: log?.id, expense_id: expenseId })
})

// Unmark / revert payment (deletes expense and resets log)
recurring.post('/:id/unpay', zValidator('json', z.object({ month: z.string() })), async (c) => {
  const userId = c.get('userId')
  const id = parseInt(c.req.param('id'))
  const { month } = c.req.valid('json')

  const log = await c.env.DB.prepare(
    `SELECT l.id, l.expense_id FROM recurring_payment_logs l
     JOIN recurring_payments r ON r.id = l.recurring_id
     WHERE l.recurring_id = ? AND l.month = ? AND r.user_id = ?`
  )
    .bind(id, month, userId)
    .first<{ id: number; expense_id: number | null }>()

  if (!log) return c.json({ error: 'Log not found' }, 404)

  if (log.expense_id) {
    await c.env.DB.prepare('DELETE FROM expenses WHERE id = ? AND user_id = ?')
      .bind(log.expense_id, userId)
      .run()
  }
  await c.env.DB.prepare('DELETE FROM recurring_payment_logs WHERE id = ?')
    .bind(log.id)
    .run()

  await c.env.SESSIONS.delete(`dashboard:${userId}:${month}`)

  return c.json({ ok: true })
})

// Manual trigger for testing (owner only)
recurring.post('/check-now', async (c) => {
  const result = await runDailyRecurringCheck(c.env)
  return c.json(result)
})

export default recurring

// ────────────────────────────────────────────────────────────────────────
// Cron job: check pending recurring payments and send LINE reminders
// ────────────────────────────────────────────────────────────────────────
export async function runDailyRecurringCheck(env: Bindings): Promise<{ users_processed: number; messages_sent: number }> {
  const { sendLineMessage, buildRecurringReminderMessage } = await import('../lib/line')

  const month = currentMonthBKK()
  const today = todayBKK()

  // Group reminders by user, by daysUntil bucket: upcoming / due-today / overdue
  type Bucket = { items: { name: string; amount: number; due_date: string; icon: string; recurring_id: number; log_id: number | null }[]; daysUntil: number }
  type UserBuckets = { upcoming: Bucket; dueToday: Bucket; overdue: Bucket }
  const userBuckets = new Map<number, UserBuckets>()

  const rows = await env.DB.prepare(
    `SELECT r.id, r.user_id, r.name, r.amount, r.due_day, r.notify_days_before,
            c.icon AS category_icon,
            l.id AS log_id, l.status AS log_status, l.reminder_sent_at, l.overdue_alert_at
     FROM recurring_payments r
     JOIN categories c ON c.id = r.category_id
     LEFT JOIN recurring_payment_logs l
       ON l.recurring_id = r.id AND l.month = ?
     WHERE r.is_active = 1`
  )
    .bind(month)
    .all<{
      id: number; user_id: number; name: string; amount: number; due_day: number; notify_days_before: number
      category_icon: string
      log_id: number | null
      log_status: string | null
      reminder_sent_at: string | null
      overdue_alert_at: string | null
    }>()

  for (const r of rows.results) {
    if (r.log_status === 'paid' || r.log_status === 'skipped') continue

    const dueDate = computeDueDate(month, r.due_day)
    const days = daysUntil(dueDate)

    let bucketKey: keyof UserBuckets | null = null
    if (days < 0) {
      // Overdue: send daily until paid (but only once per day)
      const lastAlert = r.overdue_alert_at?.slice(0, 10)
      if (lastAlert !== today) bucketKey = 'overdue'
    } else if (days === 0) {
      const lastReminder = r.reminder_sent_at?.slice(0, 10)
      if (lastReminder !== today) bucketKey = 'dueToday'
    } else if (days <= r.notify_days_before) {
      // Send only once for upcoming (track via reminder_sent_at)
      if (!r.reminder_sent_at) bucketKey = 'upcoming'
    }

    if (!bucketKey) continue

    let ub = userBuckets.get(r.user_id)
    if (!ub) {
      ub = {
        upcoming: { items: [], daysUntil: 0 },
        dueToday: { items: [], daysUntil: 0 },
        overdue: { items: [], daysUntil: 0 },
      }
      userBuckets.set(r.user_id, ub)
    }
    const bucket = ub[bucketKey]
    bucket.daysUntil = days
    bucket.items.push({
      name: r.name,
      amount: r.amount,
      due_date: dueDate,
      icon: r.category_icon,
      recurring_id: r.id,
      log_id: r.log_id,
    })
  }

  let messagesSent = 0
  let usersProcessed = 0

  for (const [userId, buckets] of userBuckets) {
    // Get all LINE recipients for this household who want recurring reminders
    const recipients = await env.DB.prepare(
      `SELECT channel_token, line_user_id FROM line_recipients
       WHERE user_id = ? AND notify_on_recurring = 1`
    )
      .bind(userId)
      .all<{ channel_token: string; line_user_id: string }>()

    if (recipients.results.length === 0) continue
    usersProcessed++

    for (const [key, bucket] of Object.entries(buckets) as [keyof UserBuckets, Bucket][]) {
      if (bucket.items.length === 0) continue

      const msg = buildRecurringReminderMessage({ items: bucket.items, daysUntil: bucket.daysUntil })
      const results = await Promise.all(
        recipients.results.map(r => sendLineMessage(r.channel_token, r.line_user_id, msg))
      )
      const anyOk = results.some(ok => ok)
      if (!anyOk) continue
      messagesSent += results.filter(ok => ok).length

      const isOverdue = key === 'overdue'
      const stmts = bucket.items.map(item =>
        env.DB.prepare(
          item.log_id
            ? `UPDATE recurring_payment_logs
               SET ${isOverdue ? 'overdue_alert_at' : 'reminder_sent_at'} = CURRENT_TIMESTAMP
               WHERE id = ?`
            : `INSERT INTO recurring_payment_logs (recurring_id, month, status, ${isOverdue ? 'overdue_alert_at' : 'reminder_sent_at'})
               VALUES (?, ?, 'pending', CURRENT_TIMESTAMP)`
        ).bind(...(item.log_id ? [item.log_id] : [item.recurring_id, month]))
      )
      await env.DB.batch(stmts)
    }
  }

  return { users_processed: usersProcessed, messages_sent: messagesSent }
}
