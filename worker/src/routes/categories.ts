import { Hono } from 'hono'
import type { Bindings, Variables, Category } from '../types'
import { authMiddleware } from '../middleware/auth'

const categories = new Hono<{ Bindings: Bindings; Variables: Variables }>()
categories.use('*', authMiddleware)

categories.get('/', async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT * FROM categories ORDER BY parent_id NULLS FIRST, sort_order ASC`
  ).all<Category>()

  // Build tree: parent categories first, then children grouped
  const parents = rows.results.filter(r => r.parent_id === null)
  const children = rows.results.filter(r => r.parent_id !== null)

  const tree = parents.map(p => ({
    ...p,
    children: children.filter(ch => ch.parent_id === p.id),
  }))

  return c.json(tree)
})

categories.get('/flat', async (c) => {
  const rows = await c.env.DB.prepare(
    'SELECT * FROM categories ORDER BY parent_id NULLS FIRST, sort_order ASC'
  ).all<Category>()
  return c.json(rows.results)
})

export default categories
