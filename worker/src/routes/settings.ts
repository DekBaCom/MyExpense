import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Bindings, Variables, LineRecipient } from '../types'
import { authMiddleware } from '../middleware/auth'
import { sendLineMessage } from '../lib/line'

const settings = new Hono<{ Bindings: Bindings; Variables: Variables }>()
settings.use('*', authMiddleware)

const recipientSchema = z.object({
  member_id: z.number().int().positive().nullable().optional(),
  label: z.string().min(1).max(50),
  channel_token: z.string().min(1),
  line_user_id: z.string().min(1),
  notify_on_add: z.boolean().default(true),
  notify_on_budget_alert: z.boolean().default(true),
  notify_on_recurring: z.boolean().default(true),
  notify_on_summary: z.boolean().default(true),
})

function maskToken(token: string): string {
  if (token.length <= 8) return '***'
  return `***${token.slice(-8)}`
}

// List all LINE recipients in the household
settings.get('/line', async (c) => {
  const userId = c.get('userId')
  const rows = await c.env.DB.prepare(
    `SELECT r.*, m.name AS member_name, m.emoji AS member_emoji
     FROM line_recipients r
     LEFT JOIN members m ON m.id = r.member_id
     WHERE r.user_id = ?
     ORDER BY r.created_at ASC`
  )
    .bind(userId)
    .all<LineRecipient & { member_name: string | null; member_emoji: string | null }>()

  // Mask tokens before returning
  return c.json(rows.results.map(r => ({
    ...r,
    channel_token: maskToken(r.channel_token),
    notify_on_add: r.notify_on_add === 1,
    notify_on_budget_alert: r.notify_on_budget_alert === 1,
    notify_on_recurring: r.notify_on_recurring === 1,
    notify_on_summary: r.notify_on_summary === 1,
  })))
})

// Create new recipient
settings.post('/line', zValidator('json', recipientSchema), async (c) => {
  const userId = c.get('userId')
  const body = c.req.valid('json')

  const result = await c.env.DB.prepare(
    `INSERT INTO line_recipients
       (user_id, member_id, label, channel_token, line_user_id, notify_on_add, notify_on_budget_alert, notify_on_recurring, notify_on_summary)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, member_id) DO UPDATE SET
       label = excluded.label,
       channel_token = excluded.channel_token,
       line_user_id = excluded.line_user_id,
       notify_on_add = excluded.notify_on_add,
       notify_on_budget_alert = excluded.notify_on_budget_alert,
       notify_on_recurring = excluded.notify_on_recurring,
       notify_on_summary = excluded.notify_on_summary,
       updated_at = CURRENT_TIMESTAMP
     RETURNING id`
  )
    .bind(
      userId,
      body.member_id ?? null,
      body.label,
      body.channel_token,
      body.line_user_id,
      body.notify_on_add ? 1 : 0,
      body.notify_on_budget_alert ? 1 : 0,
      body.notify_on_recurring ? 1 : 0,
      body.notify_on_summary ? 1 : 0
    )
    .first<{ id: number }>()

  return c.json({ id: result?.id })
})

// Update recipient (partial)
settings.put('/line/:id', zValidator('json', recipientSchema.partial()), async (c) => {
  const userId = c.get('userId')
  const id = parseInt(c.req.param('id'))
  const body = c.req.valid('json')

  const existing = await c.env.DB.prepare(
    'SELECT id FROM line_recipients WHERE id = ? AND user_id = ?'
  )
    .bind(id, userId)
    .first()
  if (!existing) return c.json({ error: 'Not found' }, 404)

  const fields: string[] = []
  const vals: (string | number | null)[] = []
  if (body.label !== undefined) { fields.push('label = ?'); vals.push(body.label) }
  if (body.member_id !== undefined) { fields.push('member_id = ?'); vals.push(body.member_id ?? null) }
  // Only update token if it doesn't look like a mask
  if (body.channel_token && !body.channel_token.startsWith('***')) {
    fields.push('channel_token = ?'); vals.push(body.channel_token)
  }
  if (body.line_user_id !== undefined) { fields.push('line_user_id = ?'); vals.push(body.line_user_id) }
  if (body.notify_on_add !== undefined) { fields.push('notify_on_add = ?'); vals.push(body.notify_on_add ? 1 : 0) }
  if (body.notify_on_budget_alert !== undefined) { fields.push('notify_on_budget_alert = ?'); vals.push(body.notify_on_budget_alert ? 1 : 0) }
  if (body.notify_on_recurring !== undefined) { fields.push('notify_on_recurring = ?'); vals.push(body.notify_on_recurring ? 1 : 0) }
  if (body.notify_on_summary !== undefined) { fields.push('notify_on_summary = ?'); vals.push(body.notify_on_summary ? 1 : 0) }

  if (fields.length === 0) return c.json({ error: 'No fields to update' }, 400)
  fields.push('updated_at = CURRENT_TIMESTAMP')

  await c.env.DB.prepare(
    `UPDATE line_recipients SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`
  )
    .bind(...vals, id, userId)
    .run()

  return c.json({ ok: true })
})

// Delete recipient
settings.delete('/line/:id', async (c) => {
  const userId = c.get('userId')
  const id = parseInt(c.req.param('id'))

  const result = await c.env.DB.prepare(
    'DELETE FROM line_recipients WHERE id = ? AND user_id = ?'
  )
    .bind(id, userId)
    .run()

  if (result.meta.changes === 0) return c.json({ error: 'Not found' }, 404)
  return c.json({ ok: true })
})

// Test send to a specific recipient
settings.post('/line/:id/test', async (c) => {
  const userId = c.get('userId')
  const id = parseInt(c.req.param('id'))

  const row = await c.env.DB.prepare(
    'SELECT channel_token, line_user_id, label FROM line_recipients WHERE id = ? AND user_id = ?'
  )
    .bind(id, userId)
    .first<{ channel_token: string; line_user_id: string; label: string }>()

  if (!row) return c.json({ error: 'Not found' }, 404)

  const ok = await sendLineMessage(
    row.channel_token,
    row.line_user_id,
    `✅ MyExpense เชื่อมต่อ LINE สำเร็จ!\n\nสวัสดี ${row.label}\nคุณจะได้รับแจ้งเตือนค่าใช้จ่ายและบิลรายเดือนที่นี่`
  )

  if (!ok) return c.json({ error: 'ส่งข้อความไม่สำเร็จ ตรวจสอบ Token และ User ID อีกครั้ง' }, 400)
  return c.json({ ok: true })
})

export default settings
