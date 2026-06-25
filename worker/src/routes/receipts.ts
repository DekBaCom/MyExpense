import { Hono } from 'hono'
import type { Bindings, Variables } from '../types'
import { authMiddleware } from '../middleware/auth'

const receipts = new Hono<{ Bindings: Bindings; Variables: Variables }>()
receipts.use('*', authMiddleware)

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
const MAX_SIZE = 10 * 1024 * 1024 // 10 MB

function r2Key(userId: number, expenseId: number, ext: string) {
  return `receipts/${userId}/${expenseId}.${ext}`
}

// Upload receipt for an expense
receipts.put('/:id', async (c) => {
  const userId = c.get('userId')
  const expenseId = parseInt(c.req.param('id'))

  const expense = await c.env.DB.prepare(
    'SELECT id FROM expenses WHERE id = ? AND user_id = ?'
  )
    .bind(expenseId, userId)
    .first<{ id: number }>()
  if (!expense) return c.json({ error: 'Expense not found' }, 404)

  const body = await c.req.parseBody()
  const file = body['file']

  if (!file || !(file instanceof File)) {
    return c.json({ error: 'No file provided' }, 400)
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return c.json({ error: 'File type not allowed. Use JPEG, PNG, or WebP.' }, 415)
  }
  if (file.size > MAX_SIZE) {
    return c.json({ error: 'File too large. Max 10 MB.' }, 413)
  }

  const ext = file.type === 'image/jpeg' ? 'jpg'
    : file.type === 'image/png' ? 'png'
    : file.type === 'image/webp' ? 'webp'
    : 'heic'

  const key = r2Key(userId, expenseId, ext)

  // Delete old receipt if exists (different extension)
  const existing = await c.env.DB.prepare(
    'SELECT receipt_key FROM expenses WHERE id = ?'
  )
    .bind(expenseId)
    .first<{ receipt_key: string | null }>()

  if (existing?.receipt_key && existing.receipt_key !== key) {
    await c.env.RECEIPTS.delete(existing.receipt_key)
  }

  await c.env.RECEIPTS.put(key, file.stream(), {
    httpMetadata: { contentType: file.type },
    customMetadata: { userId: String(userId), expenseId: String(expenseId) },
  })

  await c.env.DB.prepare(
    'UPDATE expenses SET receipt_key = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  )
    .bind(key, expenseId)
    .run()

  return c.json({ ok: true, key })
})

// Serve receipt image (streamed from R2)
receipts.get('/:id/image', async (c) => {
  const userId = c.get('userId')
  const expenseId = parseInt(c.req.param('id'))

  const row = await c.env.DB.prepare(
    'SELECT receipt_key FROM expenses WHERE id = ? AND user_id = ?'
  )
    .bind(expenseId, userId)
    .first<{ receipt_key: string | null }>()

  if (!row?.receipt_key) return c.json({ error: 'No receipt' }, 404)

  const object = await c.env.RECEIPTS.get(row.receipt_key)
  if (!object) return c.json({ error: 'File not found in storage' }, 404)

  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set('Cache-Control', 'private, max-age=3600')
  headers.set('ETag', object.httpEtag)

  return new Response(object.body, { headers })
})

// Delete receipt
receipts.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const expenseId = parseInt(c.req.param('id'))

  const row = await c.env.DB.prepare(
    'SELECT receipt_key FROM expenses WHERE id = ? AND user_id = ?'
  )
    .bind(expenseId, userId)
    .first<{ receipt_key: string | null }>()

  if (!row) return c.json({ error: 'Not found' }, 404)

  if (row.receipt_key) {
    await c.env.RECEIPTS.delete(row.receipt_key)
  }

  await c.env.DB.prepare(
    'UPDATE expenses SET receipt_key = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  )
    .bind(expenseId)
    .run()

  return c.json({ ok: true })
})

export default receipts
