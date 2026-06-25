import { Hono } from 'hono'
import type { Bindings, Variables, IncomeCategory } from '../types'
import { authMiddleware } from '../middleware/auth'

const incomeCategories = new Hono<{ Bindings: Bindings; Variables: Variables }>()
incomeCategories.use('*', authMiddleware)

incomeCategories.get('/', async (c) => {
  const rows = await c.env.DB.prepare(
    'SELECT * FROM income_categories ORDER BY sort_order ASC'
  ).all<IncomeCategory>()
  return c.json(rows.results)
})

export default incomeCategories
