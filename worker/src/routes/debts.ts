import { Hono } from 'hono'
import type { Bindings, Variables, Debt } from '../types'
import { authMiddleware } from '../middleware/auth'
import { sendLineMessage, buildDebtCreatedMessage, buildDebtPaidMessage, buildDebtReminderMessage } from '../lib/line'

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
  }>()

  const row = await c.env.DB.prepare(
    `INSERT INTO debts (user_id, member_id, debtor_name, amount, due_date, description)
     VALUES (?, ?, ?, ?, ?, ?) RETURNING id`
  ).bind(userId, body.member_id ?? null, body.debtor_name, body.amount,
    body.due_date ?? null, body.description ?? null).first<{ id: number }>()

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
  const body = await c.req.json<Partial<{ debtor_name: string; amount: number; due_date: string | null; description: string | null; member_id: number | null }>>()

  const existing = await c.env.DB.prepare('SELECT * FROM debts WHERE id = ? AND user_id = ?')
    .bind(id, userId).first<Debt>()
  if (!existing) return c.json({ error: 'Not found' }, 404)

  await c.env.DB.prepare(
    `UPDATE debts SET debtor_name=?, amount=?, due_date=?, description=?, member_id=?, updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?`
  ).bind(
    body.debtor_name ?? existing.debtor_name,
    body.amount ?? existing.amount,
    'due_date' in body ? body.due_date : existing.due_date,
    'description' in body ? body.description : existing.description,
    'member_id' in body ? body.member_id : existing.member_id,
    id, userId
  ).run()

  return c.json({ ok: true })
})

// DELETE /api/debts/:id
debts.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const id = parseInt(c.req.param('id'))
  const row = await c.env.DB.prepare('SELECT invoice_key, slip_key FROM debts WHERE id=? AND user_id=?')
    .bind(id, userId).first<{ invoice_key: string | null; slip_key: string | null }>()
  if (!row) return c.json({ error: 'Not found' }, 404)
  if (row.invoice_key) await c.env.RECEIPTS.delete(row.invoice_key)
  if (row.slip_key) await c.env.RECEIPTS.delete(row.slip_key)
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

// PUT /api/debts/:id/slip  — upload slip AND mark as paid
debts.put('/:id/slip', async (c) => {
  const userId = c.get('userId')
  const id = parseInt(c.req.param('id'))
  const existing = await c.env.DB.prepare('SELECT id, slip_key, debtor_name, amount FROM debts WHERE id=? AND user_id=?')
    .bind(id, userId).first<{ id: number; slip_key: string | null; debtor_name: string; amount: number }>()
  if (!existing) return c.json({ error: 'Not found' }, 404)

  const body = await c.req.parseBody()
  const file = body['file']
  if (!file || !(file instanceof File)) return c.json({ error: 'No file' }, 400)
  if (!ALLOWED_TYPES.has(file.type)) return c.json({ error: 'Invalid file type' }, 415)
  if (file.size > MAX_SIZE) return c.json({ error: 'File too large' }, 413)

  const key = `debts/${userId}/${id}/slip.${fileExt(file.type)}`
  if (existing.slip_key && existing.slip_key !== key) await c.env.RECEIPTS.delete(existing.slip_key)
  await c.env.RECEIPTS.put(key, file.stream(), { httpMetadata: { contentType: file.type } })
  await c.env.DB.prepare(
    `UPDATE debts SET slip_key=?, status='paid', paid_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=?`
  ).bind(key, id).run()

  await notifyDebt(c.env, userId, buildDebtPaidMessage({ debtorName: existing.debtor_name, amount: existing.amount }))
  return c.json({ ok: true, key })
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

// POST /api/debts/:id/pay — mark paid without slip
debts.post('/:id/pay', async (c) => {
  const userId = c.get('userId')
  const id = parseInt(c.req.param('id'))
  const existing = await c.env.DB.prepare('SELECT id, debtor_name, amount FROM debts WHERE id=? AND user_id=?')
    .bind(id, userId).first<{ id: number; debtor_name: string; amount: number }>()
  if (!existing) return c.json({ error: 'Not found' }, 404)
  await c.env.DB.prepare(
    `UPDATE debts SET status='paid', paid_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=?`
  ).bind(id).run()
  await notifyDebt(c.env, userId, buildDebtPaidMessage({ debtorName: existing.debtor_name, amount: existing.amount }))
  return c.json({ ok: true })
})

// POST /api/debts/:id/unpay — revert to pending
debts.post('/:id/unpay', async (c) => {
  const userId = c.get('userId')
  const id = parseInt(c.req.param('id'))
  const existing = await c.env.DB.prepare('SELECT id FROM debts WHERE id=? AND user_id=?')
    .bind(id, userId).first<{ id: number }>()
  if (!existing) return c.json({ error: 'Not found' }, 404)
  await c.env.DB.prepare(
    `UPDATE debts SET status='pending', paid_at=NULL, updated_at=CURRENT_TIMESTAMP WHERE id=?`
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
