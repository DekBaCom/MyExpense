import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Bindings, Variables } from '../types'
import { authMiddleware } from '../middleware/auth'
import { sendLineMessage } from '../lib/line'

const settings = new Hono<{ Bindings: Bindings; Variables: Variables }>()
settings.use('*', authMiddleware)

const lineSchema = z.object({
  channel_token: z.string().min(1).nullable(),
  line_user_id: z.string().min(1).nullable(),
  notify_on_add: z.boolean().default(true),
  notify_on_budget_alert: z.boolean().default(true),
})

settings.get('/line', async (c) => {
  const userId = c.get('userId')
  const row = await c.env.DB.prepare(
    'SELECT channel_token, line_user_id, notify_on_add, notify_on_budget_alert FROM line_settings WHERE user_id = ?'
  )
    .bind(userId)
    .first<{
      channel_token: string | null
      line_user_id: string | null
      notify_on_add: number
      notify_on_budget_alert: number
    }>()

  // Mask token for display (show last 8 chars only)
  return c.json({
    channel_token: row?.channel_token ? maskToken(row.channel_token) : null,
    line_user_id: row?.line_user_id ?? null,
    notify_on_add: (row?.notify_on_add ?? 1) === 1,
    notify_on_budget_alert: (row?.notify_on_budget_alert ?? 1) === 1,
    configured: !!(row?.channel_token && row?.line_user_id),
  })
})

settings.put('/line', zValidator('json', lineSchema), async (c) => {
  const userId = c.get('userId')
  const body = c.req.valid('json')

  // If token starts with "***" it's a masked value — keep existing
  let token = body.channel_token
  if (token?.startsWith('***')) {
    const existing = await c.env.DB.prepare(
      'SELECT channel_token FROM line_settings WHERE user_id = ?'
    )
      .bind(userId)
      .first<{ channel_token: string | null }>()
    token = existing?.channel_token ?? null
  }

  await c.env.DB.prepare(
    `INSERT INTO line_settings (user_id, channel_token, line_user_id, notify_on_add, notify_on_budget_alert)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       channel_token = excluded.channel_token,
       line_user_id = excluded.line_user_id,
       notify_on_add = excluded.notify_on_add,
       notify_on_budget_alert = excluded.notify_on_budget_alert,
       updated_at = CURRENT_TIMESTAMP`
  )
    .bind(userId, token, body.line_user_id, body.notify_on_add ? 1 : 0, body.notify_on_budget_alert ? 1 : 0)
    .run()

  return c.json({ ok: true })
})

// Test notification
settings.post('/line/test', async (c) => {
  const userId = c.get('userId')
  const row = await c.env.DB.prepare(
    'SELECT channel_token, line_user_id FROM line_settings WHERE user_id = ?'
  )
    .bind(userId)
    .first<{ channel_token: string | null; line_user_id: string | null }>()

  if (!row?.channel_token || !row?.line_user_id) {
    return c.json({ error: 'LINE ยังไม่ได้ตั้งค่า' }, 400)
  }

  const ok = await sendLineMessage(
    row.channel_token,
    row.line_user_id,
    '✅ MyExpense เชื่อมต่อ LINE สำเร็จ!\nคุณจะได้รับแจ้งเตือนค่าใช้จ่ายที่นี่'
  )

  if (!ok) return c.json({ error: 'ส่งข้อความไม่สำเร็จ ตรวจสอบ Token และ User ID อีกครั้ง' }, 400)
  return c.json({ ok: true })
})

function maskToken(token: string): string {
  if (token.length <= 8) return '***'
  return `***${token.slice(-8)}`
}

export default settings
