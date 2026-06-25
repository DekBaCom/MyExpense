import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Bindings, Variables, Budget } from '../types'
import { authMiddleware } from '../middleware/auth'

const budgets = new Hono<{ Bindings: Bindings; Variables: Variables }>()
budgets.use('*', authMiddleware)

const budgetSchema = z.object({
  category_id: z.number().int().positive(),
  amount: z.number().nonnegative(),
})

budgets.get('/:month', async (c) => {
  const userId = c.get('userId')
  const month = c.req.param('month') // "2026-06"

  const rows = await c.env.DB.prepare(
    `SELECT b.*, c.name AS category_name, c.icon AS category_icon, c.color AS category_color
     FROM budgets b
     JOIN categories c ON c.id = b.category_id
     WHERE b.user_id = ? AND b.month = ?
     ORDER BY c.sort_order`
  )
    .bind(userId, month)
    .all<Budget & { category_name: string; category_icon: string; category_color: string }>()

  return c.json(rows.results)
})

budgets.put('/:month', zValidator('json', z.array(budgetSchema)), async (c) => {
  const userId = c.get('userId')
  const month = c.req.param('month')
  const items = c.req.valid('json')

  // Upsert each budget entry
  const stmts = items.map(item =>
    c.env.DB.prepare(
      `INSERT INTO budgets (user_id, category_id, month, amount)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id, category_id, month) DO UPDATE SET amount = excluded.amount`
    ).bind(userId, item.category_id, month, item.amount)
  )

  await c.env.DB.batch(stmts)
  return c.json({ ok: true, updated: items.length })
})

budgets.delete('/:month/:categoryId', async (c) => {
  const userId = c.get('userId')
  const month = c.req.param('month')
  const categoryId = parseInt(c.req.param('categoryId'))

  await c.env.DB.prepare(
    'DELETE FROM budgets WHERE user_id = ? AND month = ? AND category_id = ?'
  )
    .bind(userId, month, categoryId)
    .run()

  return c.json({ ok: true })
})

export default budgets
