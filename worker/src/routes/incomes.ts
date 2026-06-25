import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Bindings, Variables, Income } from '../types'
import { authMiddleware } from '../middleware/auth'

const incomes = new Hono<{ Bindings: Bindings; Variables: Variables }>()
incomes.use('*', authMiddleware)

const incomeSchema = z.object({
  amount: z.number().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  category_id: z.number().int().positive(),
  member_id: z.number().int().positive().nullable().optional(),
  note: z.string().max(500).nullable().optional(),
})

incomes.get('/', async (c) => {
  const userId = c.get('userId')
  const month = c.req.query('month')
  const category = c.req.query('category')
  const member = c.req.query('member')
  const limit = Math.min(parseInt(c.req.query('limit') ?? '50'), 200)
  const offset = parseInt(c.req.query('offset') ?? '0')

  let where = 'i.user_id = ?'
  const params: (string | number)[] = [userId]

  if (month) {
    where += ` AND strftime('%Y-%m', i.date) = ?`
    params.push(month)
  }
  if (category) {
    where += ' AND i.category_id = ?'
    params.push(parseInt(category))
  }
  if (member) {
    where += ' AND i.member_id = ?'
    params.push(parseInt(member))
  }

  const sql = `
    SELECT
      i.*,
      c.name  AS category_name,
      c.icon  AS category_icon,
      c.color AS category_color,
      m.name  AS member_name,
      m.emoji AS member_emoji,
      m.color AS member_color
    FROM incomes i
    JOIN income_categories c ON c.id = i.category_id
    LEFT JOIN members m ON m.id = i.member_id
    WHERE ${where}
    ORDER BY i.date DESC, i.created_at DESC
    LIMIT ? OFFSET ?
  `

  const countSql = `SELECT COUNT(*) as total FROM incomes i WHERE ${where}`

  const [rows, countRow] = await Promise.all([
    c.env.DB.prepare(sql).bind(...params, limit, offset).all<Income>(),
    c.env.DB.prepare(countSql).bind(...params).first<{ total: number }>(),
  ])

  return c.json({
    data: rows.results,
    total: countRow?.total ?? 0,
    limit,
    offset,
  })
})

incomes.post('/', zValidator('json', incomeSchema), async (c) => {
  const userId = c.get('userId')
  const body = c.req.valid('json')

  const result = await c.env.DB.prepare(
    `INSERT INTO incomes (user_id, member_id, category_id, amount, date, note)
     VALUES (?, ?, ?, ?, ?, ?)
     RETURNING id`
  )
    .bind(
      userId,
      body.member_id ?? null,
      body.category_id,
      body.amount,
      body.date,
      body.note ?? null
    )
    .first<{ id: number }>()

  return c.json({ id: result?.id }, 201)
})

incomes.get('/:id', async (c) => {
  const userId = c.get('userId')
  const id = parseInt(c.req.param('id'))

  const income = await c.env.DB.prepare(
    `SELECT i.*, c.name AS category_name, c.icon AS category_icon, c.color AS category_color,
            m.name AS member_name, m.emoji AS member_emoji, m.color AS member_color
     FROM incomes i
     JOIN income_categories c ON c.id = i.category_id
     LEFT JOIN members m ON m.id = i.member_id
     WHERE i.id = ? AND i.user_id = ?`
  )
    .bind(id, userId)
    .first<Income>()

  if (!income) return c.json({ error: 'Not found' }, 404)
  return c.json(income)
})

incomes.put('/:id', zValidator('json', incomeSchema.partial()), async (c) => {
  const userId = c.get('userId')
  const id = parseInt(c.req.param('id'))
  const body = c.req.valid('json')

  const existing = await c.env.DB.prepare(
    'SELECT id FROM incomes WHERE id = ? AND user_id = ?'
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
  if (body.note !== undefined) { fields.push('note = ?'); vals.push(body.note ?? null) }

  if (fields.length === 0) return c.json({ error: 'No fields to update' }, 400)
  fields.push('updated_at = CURRENT_TIMESTAMP')

  await c.env.DB.prepare(
    `UPDATE incomes SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`
  )
    .bind(...vals, id, userId)
    .run()

  return c.json({ ok: true })
})

incomes.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const id = parseInt(c.req.param('id'))

  const result = await c.env.DB.prepare(
    'DELETE FROM incomes WHERE id = ? AND user_id = ?'
  )
    .bind(id, userId)
    .run()

  if (result.meta.changes === 0) return c.json({ error: 'Not found' }, 404)
  return c.json({ ok: true })
})

export default incomes
