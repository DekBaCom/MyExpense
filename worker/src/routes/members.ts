import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Bindings, Variables, Member } from '../types'
import { authMiddleware } from '../middleware/auth'

const members = new Hono<{ Bindings: Bindings; Variables: Variables }>()
members.use('*', authMiddleware)

const memberSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#6366f1'),
  emoji: z.string().max(4).default('👤'),
})

members.get('/', async (c) => {
  const userId = c.get('userId')
  const rows = await c.env.DB.prepare(
    'SELECT * FROM members WHERE user_id = ? ORDER BY is_owner DESC, created_at ASC'
  )
    .bind(userId)
    .all<Member>()
  return c.json(rows.results)
})

members.post('/', zValidator('json', memberSchema), async (c) => {
  const userId = c.get('userId')
  const { name, color, emoji } = c.req.valid('json')

  const result = await c.env.DB.prepare(
    `INSERT INTO members (user_id, name, color, emoji) VALUES (?, ?, ?, ?) RETURNING id`
  )
    .bind(userId, name, color, emoji)
    .first<{ id: number }>()

  return c.json({ id: result?.id }, 201)
})

members.put('/:id', zValidator('json', memberSchema.partial()), async (c) => {
  const userId = c.get('userId')
  const id = parseInt(c.req.param('id'))
  const body = c.req.valid('json')

  const existing = await c.env.DB.prepare(
    'SELECT id FROM members WHERE id = ? AND user_id = ?'
  )
    .bind(id, userId)
    .first()
  if (!existing) return c.json({ error: 'Not found' }, 404)

  const fields: string[] = []
  const vals: (string | number)[] = []
  if (body.name !== undefined) { fields.push('name = ?'); vals.push(body.name) }
  if (body.color !== undefined) { fields.push('color = ?'); vals.push(body.color) }
  if (body.emoji !== undefined) { fields.push('emoji = ?'); vals.push(body.emoji) }

  if (fields.length === 0) return c.json({ error: 'No fields to update' }, 400)

  await c.env.DB.prepare(
    `UPDATE members SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`
  )
    .bind(...vals, id, userId)
    .run()

  return c.json({ ok: true })
})

members.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const id = parseInt(c.req.param('id'))

  const member = await c.env.DB.prepare(
    'SELECT is_owner FROM members WHERE id = ? AND user_id = ?'
  )
    .bind(id, userId)
    .first<{ is_owner: number }>()

  if (!member) return c.json({ error: 'Not found' }, 404)
  if (member.is_owner === 1) return c.json({ error: 'Cannot delete owner' }, 400)

  await c.env.DB.prepare('DELETE FROM members WHERE id = ? AND user_id = ?')
    .bind(id, userId)
    .run()

  return c.json({ ok: true })
})

export default members
