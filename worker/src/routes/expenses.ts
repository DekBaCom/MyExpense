import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Bindings, Variables, Expense, LineRecipient } from '../types'
import { authMiddleware } from '../middleware/auth'
import { sendLineMessage, buildExpenseMessage, buildBudgetAlertMessage } from '../lib/line'

const expenses = new Hono<{ Bindings: Bindings; Variables: Variables }>()
expenses.use('*', authMiddleware)

const expenseSchema = z.object({
  amount: z.number().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  category_id: z.number().int().positive(),
  member_id: z.number().int().positive().nullable().optional(),
  payment_method: z.enum(['cash', 'transfer', 'credit', 'qr']).default('cash'),
  note: z.string().max(500).nullable().optional(),
})

expenses.get('/', async (c) => {
  const userId = c.get('userId')
  const month = c.req.query('month') // e.g. "2026-06"
  const category = c.req.query('category')
  const member = c.req.query('member')
  const limit = Math.min(parseInt(c.req.query('limit') ?? '50'), 200)
  const offset = parseInt(c.req.query('offset') ?? '0')

  let where = 'e.user_id = ?'
  const params: (string | number)[] = [userId]

  if (month) {
    where += ` AND strftime('%Y-%m', e.date) = ?`
    params.push(month)
  }
  if (category) {
    where += ' AND e.category_id = ?'
    params.push(parseInt(category))
  }
  if (member) {
    where += ' AND e.member_id = ?'
    params.push(parseInt(member))
  }

  const sql = `
    SELECT
      e.*,
      c.name  AS category_name,
      c.icon  AS category_icon,
      c.color AS category_color,
      m.name  AS member_name,
      m.emoji AS member_emoji,
      m.color AS member_color
    FROM expenses e
    JOIN categories c ON c.id = e.category_id
    LEFT JOIN members m ON m.id = e.member_id
    WHERE ${where}
    ORDER BY e.date DESC, e.created_at DESC
    LIMIT ? OFFSET ?
  `

  const countSql = `SELECT COUNT(*) as total FROM expenses e WHERE ${where}`

  const [rows, countRow] = await Promise.all([
    c.env.DB.prepare(sql).bind(...params, limit, offset).all<Expense>(),
    c.env.DB.prepare(countSql).bind(...params).first<{ total: number }>(),
  ])

  return c.json({
    data: rows.results,
    total: countRow?.total ?? 0,
    limit,
    offset,
  })
})

expenses.post('/', zValidator('json', expenseSchema), async (c) => {
  const userId = c.get('userId')
  const body = c.req.valid('json')

  const result = await c.env.DB.prepare(
    `INSERT INTO expenses (user_id, member_id, category_id, amount, date, payment_method, note)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     RETURNING id`
  )
    .bind(
      userId,
      body.member_id ?? null,
      body.category_id,
      body.amount,
      body.date,
      body.payment_method,
      body.note ?? null
    )
    .first<{ id: number }>()

  const expenseId = result?.id

  // Fire LINE notifications async (non-blocking)
  c.executionCtx.waitUntil(
    sendLineNotifications(c.env, userId, expenseId ?? 0, body)
  )

  return c.json({ id: expenseId }, 201)
})

expenses.get('/:id', async (c) => {
  const userId = c.get('userId')
  const id = parseInt(c.req.param('id'))

  const expense = await c.env.DB.prepare(
    `SELECT e.*, c.name AS category_name, c.icon AS category_icon, c.color AS category_color,
            m.name AS member_name, m.emoji AS member_emoji, m.color AS member_color
     FROM expenses e
     JOIN categories c ON c.id = e.category_id
     LEFT JOIN members m ON m.id = e.member_id
     WHERE e.id = ? AND e.user_id = ?`
  )
    .bind(id, userId)
    .first<Expense>()

  if (!expense) return c.json({ error: 'Not found' }, 404)
  return c.json(expense)
})

expenses.put('/:id', zValidator('json', expenseSchema.partial()), async (c) => {
  const userId = c.get('userId')
  const id = parseInt(c.req.param('id'))
  const body = c.req.valid('json')

  const existing = await c.env.DB.prepare(
    'SELECT id FROM expenses WHERE id = ? AND user_id = ?'
  )
    .bind(id, userId)
    .first()
  if (!existing) return c.json({ error: 'Not found' }, 404)

  const fields: string[] = []
  const vals: (string | number | null)[] = []

  if (body.amount !== undefined) { fields.push('amount = ?'); vals.push(body.amount) }
  if (body.date !== undefined) { fields.push('date = ?'); vals.push(body.date) }
  if (body.category_id !== undefined) { fields.push('category_id = ?'); vals.push(body.category_id) }
  if (body.member_id !== undefined) { fields.push('member_id = ?'); vals.push(body.member_id ?? null) }
  if (body.payment_method !== undefined) { fields.push('payment_method = ?'); vals.push(body.payment_method) }
  if (body.note !== undefined) { fields.push('note = ?'); vals.push(body.note ?? null) }

  if (fields.length === 0) return c.json({ error: 'No fields to update' }, 400)
  fields.push('updated_at = CURRENT_TIMESTAMP')

  await c.env.DB.prepare(
    `UPDATE expenses SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`
  )
    .bind(...vals, id, userId)
    .run()

  return c.json({ ok: true })
})

expenses.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const id = parseInt(c.req.param('id'))

  const result = await c.env.DB.prepare(
    'DELETE FROM expenses WHERE id = ? AND user_id = ?'
  )
    .bind(id, userId)
    .run()

  if (result.meta.changes === 0) return c.json({ error: 'Not found' }, 404)
  return c.json({ ok: true })
})

async function sendLineNotifications(
  env: Bindings,
  userId: number,
  expenseId: number,
  body: { amount: number; date: string; category_id: number; member_id?: number | null; payment_method: string; note?: string | null }
): Promise<void> {
  // Fetch ALL recipients in the household
  const recipients = await env.DB.prepare(
    `SELECT channel_token, line_user_id, notify_on_add, notify_on_budget_alert
     FROM line_recipients WHERE user_id = ?`
  )
    .bind(userId)
    .all<LineRecipient>()

  if (recipients.results.length === 0) return

  const month = body.date.slice(0, 7)
  const wantsAdd = recipients.results.filter(r => r.notify_on_add === 1)
  const wantsBudget = recipients.results.filter(r => r.notify_on_budget_alert === 1)

  if (wantsAdd.length > 0) {
    // Get category + member + monthly total for message
    const [catRow, memberRow, totalRow] = await Promise.all([
      env.DB.prepare('SELECT name, icon FROM categories WHERE id = ?')
        .bind(body.category_id)
        .first<{ name: string; icon: string }>(),
      body.member_id
        ? env.DB.prepare('SELECT name FROM members WHERE id = ?')
            .bind(body.member_id)
            .first<{ name: string }>()
        : Promise.resolve(null),
      env.DB.prepare(
        `SELECT COALESCE(SUM(amount), 0) AS total FROM expenses WHERE user_id = ? AND strftime('%Y-%m', date) = ?`
      )
        .bind(userId, month)
        .first<{ total: number }>(),
    ])

    const msg = buildExpenseMessage({
      icon: catRow?.icon ?? '💰',
      categoryName: catRow?.name ?? 'อื่นๆ',
      amount: body.amount,
      date: body.date,
      memberName: memberRow?.name,
      paymentMethod: body.payment_method,
      note: body.note,
      totalSpentThisMonth: totalRow?.total ?? body.amount,
    })

    await Promise.all(
      wantsAdd.map(r => sendLineMessage(r.channel_token, r.line_user_id, msg))
    )
  }

  if (wantsBudget.length > 0) {
    // Check if category budget is exceeded
    const alertRow = await env.DB.prepare(
      `SELECT
         COALESCE(SUM(e.amount), 0) AS spent,
         b.amount AS budget,
         c.name AS category_name,
         c.icon AS category_icon
       FROM expenses e
       JOIN categories c ON c.id = e.category_id
       LEFT JOIN budgets b
         ON b.category_id = COALESCE(c.parent_id, c.id)
         AND b.user_id = e.user_id AND b.month = ?
       WHERE e.user_id = ? AND strftime('%Y-%m', e.date) = ?
         AND (c.id = ? OR c.parent_id = ?)
       GROUP BY COALESCE(c.parent_id, c.id)`
    )
      .bind(month, userId, month, body.category_id, body.category_id)
      .first<{ spent: number; budget: number | null; category_name: string; category_icon: string }>()

    if (alertRow?.budget && alertRow.budget > 0) {
      const pct = (alertRow.spent / alertRow.budget) * 100
      // Alert at 100% (first time exceeded) or at 80%
      if (pct >= 100) {
        const alertMsg = buildBudgetAlertMessage({
          icon: alertRow.category_icon,
          categoryName: alertRow.category_name,
          spent: alertRow.spent,
          budget: alertRow.budget,
        })
        await Promise.all(
          wantsBudget.map(r => sendLineMessage(r.channel_token, r.line_user_id, alertMsg))
        )
      }
    }
  }
}

export default expenses
