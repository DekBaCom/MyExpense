import { Hono } from 'hono'
import type { Bindings, Variables, Debt } from '../types'
import { authMiddleware } from '../middleware/auth'
import { sendLineMessage, buildDebtCreatedMessage, buildDebtPaidMessage, buildDebtReminderMessage } from '../lib/line'
import { todayBKK } from '../lib/recurring'

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
const MAX_SIZE = 10 * 1024 * 1024

function fileExt(mime: string) {
  return mime === 'image/jpeg' ? 'jpg' : mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'heic'
}

async function notifyDebt(env: Bindings, userId: number, msg: string) {
  const rows = await env.DB.prepare(
    `SELECT channel_token, line_user_id FROM line_recipients WHERE user_id = ? AND notify_on_debt = 1`
  ).bind(userId).all<{ channel_token: string; line_user_id: string }>()
  for (const r of rows.results) {
    await sendLineMessage(r.channel_token, r.line_user_id, msg)
  }
}

async function createExpenseForDebt(
  env: Bindings,
  userId: number,
  debt: Debt,
  overrides: { amount?: number; date?: string; note?: string; category_id?: number | null }
): Promise<number | null> {
  const categoryId = overrides.category_id ?? debt.category_id
  if (!categoryId) return null
  const row = await env.DB.prepare(
    `INSERT INTO expenses (user_id, member_id, category_id, amount, date, payment_method, note)
     VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`
  ).bind(
    userId,
    debt.member_id,
    categoryId,
    overrides.amount ?? debt.amount,
    overrides.date ?? todayBKK(),
    debt.payment_method ?? 'transfer',
    overrides.note ?? debt.description ?? debt.debtor_name,
  ).first<{ id: number }>()
  return row?.id ?? null
}

const debts = new Hono<{ Bindings: Bindings; Variables: Variables }>()
debts.use('*', authMiddleware)

// GET /api/debts?status=pending|paid|all
debts.get('/', async (c) => {
  const userId = c.get('userId')
  const status = c.req.query('status') ?? 'pending'
  const params: (string | number)[] = [userId]
  let where = 'WHERE d.user_id = ?'
  if (status !== 'all') { where += ' AND d.status = ?'; params.push(status) }

  const rows = await c.env.DB.prepare(
    `SELECT d.*, m.name as member_name, m.emoji as member_emoji
     FROM debts d LEFT JOIN members m ON d.member_id = m.id
     ${where} ORDER BY CASE WHEN d.due_date IS NULL THEN 1 ELSE 0 END, d.due_date ASC, d.created_at DESC`
  ).bind(...params).all<Debt>()

  return c.json({ data: rows.results, total: rows.results.length })
})

// POST /api/debts
debts.post('/', async (c) => {
  const userId = c.get('userId')
  const body = await c.req.json<{
    debtor_name: string; amount: number; due_date?: string | null
    description?: string | null; member_id?: number | null
    category_id?: number | null; payment_method?: string
  }>()

  const row = await c.env.DB.prepare(
    `INSERT INTO debts (user_id, member_id, debtor_name, amount, due_date, description, category_id, payment_method)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`
  ).bind(
    userId, body.member_id ?? null, body.debtor_name, body.amount,
    body.due_date ?? null, body.description ?? null,
    body.category_id ?? null, body.payment_method ?? 'transfer',
  ).first<{ id: number }>()

  if (!row) return c.json({ error: 'Failed to create' }, 500)

  await notifyDebt(c.env, userId, buildDebtCreatedMessage({
    debtorName: body.debtor_name, amount: body.amount,
    dueDate: body.due_date ?? null, description: body.description ?? null,
  }))

  return c.json({ id: row.id })
})

// PUT /api/debts/:id
debts.put('/:id', async (c) => {
  const userId = c.get('userId')
  const id = parseInt(c.req.param('id'))
  const body = await c.req.json<Partial<{
    debtor_name: string; amount: number; due_date: string | null
    description: string | null; member_id: number | null
    category_id: number | null; payment_method: string
  }>>()

  const existing = await c.env.DB.prepare('SELECT * FROM debts WHERE id = ? AND user_id = ?')
    .bind(id, userId).first<Debt>()
  if (!existing) return c.json({ error: 'Not found' }, 404)

  await c.env.DB.prepare(
    `UPDATE debts SET
      debtor_name=?, amount=?, due_date=?, description=?, member_id=?,
      category_id=?, payment_method=?, updated_at=CURRENT_TIMESTAMP
     WHERE id=? AND user_id=?`
  ).bind(
    body.debtor_name ?? existing.debtor_name,
    body.amount ?? existing.amount,
    'due_date' in body ? body.due_date : existing.due_date,
    'description' in body ? body.description : existing.description,
    'member_id' in body ? body.member_id : existing.member_id,
    'category_id' in body ? body.category_id : existing.category_id,
    body.payment_method ?? existing.payment_method,
    id, userId
  ).run()

  return c.json({ ok: true })
})

// DELETE /api/debts/:id
debts.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const id = parseInt(c.req.param('id'))
  const row = await c.env.DB.prepare('SELECT invoice_key, slip_key, expense_id FROM debts WHERE id=? AND user_id=?')
    .bind(id, userId).first<{ invoice_key: string | null; slip_key: string | null; expense_id: number | null }>()
  if (!row) return c.json({ error: 'Not found' }, 404)
  if (row.invoice_key) await c.env.RECEIPTS.delete(row.invoice_key)
  if (row.slip_key) await c.env.RECEIPTS.delete(row.slip_key)
  if (row.expense_id) {
    await c.env.DB.prepare('DELETE FROM expenses WHERE id=? AND user_id=?').bind(row.expense_id, userId).run()
  }
  await c.env.DB.prepare('DELETE FROM debts WHERE id=? AND user_id=?').bind(id, userId).run()
  return c.json({ ok: true })
})

// PUT /api/debts/:id/invoice
debts.put('/:id/invoice', async (c) => {
  const userId = c.get('userId')
  const id = parseInt(c.req.param('id'))
  const existing = await c.env.DB.prepare('SELECT id, invoice_key FROM debts WHERE id=? AND user_id=?')
    .bind(id, userId).first<{ id: number; invoice_key: string | null }>()
  if (!existing) return c.json({ error: 'Not found' }, 404)

  const body = await c.req.parseBody()
  const file = body['file']
  if (!file || !(file instanceof File)) return c.json({ error: 'No file' }, 400)
  if (!ALLOWED_TYPES.has(file.type)) return c.json({ error: 'Invalid file type' }, 415)
  if (file.size > MAX_SIZE) return c.json({ error: 'File too large' }, 413)

  const key = `debts/${userId}/${id}/invoice.${fileExt(file.type)}`
  if (existing.invoice_key && existing.invoice_key !== key) await c.env.RECEIPTS.delete(existing.invoice_key)
  await c.env.RECEIPTS.put(key, file.stream(), { httpMetadata: { contentType: file.type } })
  await c.env.DB.prepare('UPDATE debts SET invoice_key=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(key, id).run()
  return c.json({ ok: true, key })
})

// GET /api/debts/:id/invoice
debts.get('/:id/invoice', async (c) => {
  const userId = c.get('userId')
  const id = parseInt(c.req.param('id'))
  const row = await c.env.DB.prepare('SELECT invoice_key FROM debts WHERE id=? AND user_id=?')
    .bind(id, userId).first<{ invoice_key: string | null }>()
  if (!row?.invoice_key) return c.json({ error: 'No invoice' }, 404)
  const obj = await c.env.RECEIPTS.get(row.invoice_key)
  if (!obj) return c.json({ error: 'File not found' }, 404)
  const headers = new Headers()
  obj.writeHttpMetadata(headers)
  headers.set('Cache-Control', 'private, max-age=3600')
  return new Response(obj.body, { headers })
})

// PUT /api/debts/:id/slip — upload slip AND mark as paid (with expense)
debts.put('/:id/slip', async (c) => {
  const userId = c.get('userId')
  const id = parseInt(c.req.param('id'))
  const existing = await c.env.DB.prepare('SELECT * FROM debts WHERE id=? AND user_id=?')
    .bind(id, userId).first<Debt>()
  if (!existing) return c.json({ error: 'Not found' }, 404)

  const formBody = await c.req.parseBody()
  const file = formBody['file']
  if (!file || !(file instanceof File)) return c.json({ error: 'No file' }, 400)
  if (!ALLOWED_TYPES.has(file.type)) return c.json({ error: 'Invalid file type' }, 415)
  if (file.size > MAX_SIZE) return c.json({ error: 'File too large' }, 413)

  const date = typeof formBody['date'] === 'string' ? formBody['date'] : undefined
  const note = typeof formBody['note'] === 'string' ? formBody['note'] : undefined
  const amount = formBody['amount'] ? Number(formBody['amount']) : undefined
  const category_id = formBody['category_id'] ? Number(formBody['category_id']) : undefined

  const key = `debts/${userId}/${id}/slip.${fileExt(file.type)}`
  if (existing.slip_key && existing.slip_key !== key) await c.env.RECEIPTS.delete(existing.slip_key)
  await c.env.RECEIPTS.put(key, file.stream(), { httpMetadata: { contentType: file.type } })

  const expenseId = await createExpenseForDebt(c.env, userId, existing, { amount, date, note, category_id })

  await c.env.DB.prepare(
    `UPDATE debts SET slip_key=?, status='paid', paid_at=CURRENT_TIMESTAMP, expense_id=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`
  ).bind(key, expenseId, id).run()

  await notifyDebt(c.env, userId, buildDebtPaidMessage({ debtorName: existing.debtor_name, amount: amount ?? existing.amount }))
  return c.json({ ok: true, key, expense_id: expenseId })
})

// GET /api/debts/:id/slip
debts.get('/:id/slip', async (c) => {
  const userId = c.get('userId')
  const id = parseInt(c.req.param('id'))
  const row = await c.env.DB.prepare('SELECT slip_key FROM debts WHERE id=? AND user_id=?')
    .bind(id, userId).first<{ slip_key: string | null }>()
  if (!row?.slip_key) return c.json({ error: 'No slip' }, 404)
  const obj = await c.env.RECEIPTS.get(row.slip_key)
  if (!obj) return c.json({ error: 'File not found' }, 404)
  const headers = new Headers()
  obj.writeHttpMetadata(headers)
  headers.set('Cache-Control', 'private, max-age=3600')
  return new Response(obj.body, { headers })
})

// POST /api/debts/:id/pay — mark paid without slip (with expense)
debts.post('/:id/pay', async (c) => {
  const userId = c.get('userId')
  const id = parseInt(c.req.param('id'))
  const body = await c.req.json<{ date?: string; amount?: number; note?: string; category_id?: number }>().catch(() => ({}))

  const existing = await c.env.DB.prepare('SELECT * FROM debts WHERE id=? AND user_id=?')
    .bind(id, userId).first<Debt>()
  if (!existing) return c.json({ error: 'Not found' }, 404)

  const expenseId = await createExpenseForDebt(c.env, userId, existing, body)

  await c.env.DB.prepare(
    `UPDATE debts SET status='paid', paid_at=CURRENT_TIMESTAMP, expense_id=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`
  ).bind(expenseId, id).run()

  await notifyDebt(c.env, userId, buildDebtPaidMessage({ debtorName: existing.debtor_name, amount: body.amount ?? existing.amount }))
  return c.json({ ok: true, expense_id: expenseId })
})

// POST /api/debts/:id/unpay — revert to pending, delete linked expense
debts.post('/:id/unpay', async (c) => {
  const userId = c.get('userId')
  const id = parseInt(c.req.param('id'))
  const existing = await c.env.DB.prepare('SELECT id, expense_id FROM debts WHERE id=? AND user_id=?')
    .bind(id, userId).first<{ id: number; expense_id: number | null }>()
  if (!existing) return c.json({ error: 'Not found' }, 404)

  if (existing.expense_id) {
    await c.env.DB.prepare('DELETE FROM expenses WHERE id=? AND user_id=?').bind(existing.expense_id, userId).run()
  }

  await c.env.DB.prepare(
    `UPDATE debts SET status='pending', paid_at=NULL, expense_id=NULL, updated_at=CURRENT_TIMESTAMP WHERE id=?`
  ).bind(id).run()
  return c.json({ ok: true })
})

// POST /api/debts/:id/remind
debts.post('/:id/remind', async (c) => {
  const userId = c.get('userId')
  const id = parseInt(c.req.param('id'))
  const debt = await c.env.DB.prepare('SELECT * FROM debts WHERE id=? AND user_id=?')
    .bind(id, userId).first<Debt>()
  if (!debt) return c.json({ error: 'Not found' }, 404)

  const rows = await c.env.DB.prepare(
    `SELECT channel_token, line_user_id FROM line_recipients WHERE user_id = ?`
  ).bind(userId).all<{ channel_token: string; line_user_id: string }>()

  let sent = 0
  for (const r of rows.results) {
    const ok = await sendLineMessage(r.channel_token, r.line_user_id,
      buildDebtReminderMessage({ debtorName: debt.debtor_name, amount: debt.amount, dueDate: debt.due_date, description: debt.description }))
    if (ok) sent++
  }
  return c.json({ ok: true, sent })
})

export default debts
