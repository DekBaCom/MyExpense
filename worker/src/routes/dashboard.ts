import { Hono } from 'hono'
import type { Bindings, Variables, DashboardData, CategorySummary, MemberSummary, MonthlyTrend, Expense } from '../types'
import { authMiddleware } from '../middleware/auth'

const dashboard = new Hono<{ Bindings: Bindings; Variables: Variables }>()
dashboard.use('*', authMiddleware)

dashboard.get('/', async (c) => {
  const userId = c.get('userId')
  const month = c.req.query('month') ?? new Date().toISOString().slice(0, 7) // "2026-06"

  const cacheKey = `dashboard:${userId}:${month}`
  const cached = await c.env.SESSIONS.get(cacheKey)
  if (cached) {
    return c.json(JSON.parse(cached))
  }

  const [totalRow, byCategory, byMember, trend, recent] = await Promise.all([
    // Total spent this month
    c.env.DB.prepare(
      `SELECT COALESCE(SUM(amount), 0) AS total_spent FROM expenses
       WHERE user_id = ? AND strftime('%Y-%m', date) = ?`
    )
      .bind(userId, month)
      .first<{ total_spent: number }>(),

    // Spending by category (parent categories only, sum children)
    c.env.DB.prepare(
      `SELECT
         COALESCE(c.parent_id, c.id)            AS category_id,
         COALESCE(p.name,  c.name)               AS category_name,
         COALESCE(p.icon,  c.icon)               AS category_icon,
         COALESCE(p.color, c.color)              AS category_color,
         COALESCE(SUM(e.amount), 0)              AS spent,
         COALESCE(b.amount, 0)                   AS budget
       FROM expenses e
       JOIN categories c ON c.id = e.category_id
       LEFT JOIN categories p ON p.id = c.parent_id
       LEFT JOIN budgets b
         ON b.category_id = COALESCE(c.parent_id, c.id)
         AND b.user_id = e.user_id AND b.month = ?
       WHERE e.user_id = ? AND strftime('%Y-%m', e.date) = ?
       GROUP BY COALESCE(c.parent_id, c.id)
       ORDER BY spent DESC`
    )
      .bind(month, userId, month)
      .all<CategorySummary>(),

    // Spending by family member
    c.env.DB.prepare(
      `SELECT
         e.member_id,
         COALESCE(m.name,  'ไม่ระบุ') AS member_name,
         COALESCE(m.emoji, '❓')       AS member_emoji,
         COALESCE(m.color, '#9ca3af')  AS member_color,
         SUM(e.amount)                 AS spent
       FROM expenses e
       LEFT JOIN members m ON m.id = e.member_id
       WHERE e.user_id = ? AND strftime('%Y-%m', e.date) = ?
       GROUP BY e.member_id
       ORDER BY spent DESC`
    )
      .bind(userId, month)
      .all<MemberSummary>(),

    // Monthly trend (last 6 months)
    c.env.DB.prepare(
      `SELECT strftime('%Y-%m', date) AS month, SUM(amount) AS total
       FROM expenses
       WHERE user_id = ?
         AND date >= date('now', '-6 months', 'start of month')
       GROUP BY strftime('%Y-%m', date)
       ORDER BY month ASC`
    )
      .bind(userId)
      .all<MonthlyTrend>(),

    // Recent 10 expenses
    c.env.DB.prepare(
      `SELECT e.*, c.name AS category_name, c.icon AS category_icon, c.color AS category_color,
              m.name AS member_name, m.emoji AS member_emoji, m.color AS member_color
       FROM expenses e
       JOIN categories c ON c.id = e.category_id
       LEFT JOIN members m ON m.id = e.member_id
       WHERE e.user_id = ?
       ORDER BY e.date DESC, e.created_at DESC
       LIMIT 10`
    )
      .bind(userId)
      .all<Expense>(),
  ])

  // Calculate total budget
  const totalBudgetRow = await c.env.DB.prepare(
    `SELECT COALESCE(SUM(amount), 0) AS total_budget
     FROM budgets WHERE user_id = ? AND month = ?`
  )
    .bind(userId, month)
    .first<{ total_budget: number }>()

  // Attach percentage to category summaries
  const categoriesWithPct: CategorySummary[] = byCategory.results.map(r => ({
    ...r,
    percentage: r.budget > 0 ? Math.round((r.spent / r.budget) * 100) : 0,
  }))

  const data: DashboardData = {
    month,
    total_spent: totalRow?.total_spent ?? 0,
    total_budget: totalBudgetRow?.total_budget ?? 0,
    by_category: categoriesWithPct,
    by_member: byMember.results,
    monthly_trend: trend.results,
    recent_expenses: recent.results,
  }

  // Cache for 5 minutes
  await c.env.SESSIONS.put(cacheKey, JSON.stringify(data), { expirationTtl: 300 })

  return c.json(data)
})

// Monthly report with category breakdown
dashboard.get('/report', async (c) => {
  const userId = c.get('userId')
  const year = c.req.query('year') ?? new Date().getFullYear().toString()

  const rows = await c.env.DB.prepare(
    `SELECT
       strftime('%Y-%m', e.date) AS month,
       COALESCE(p.name, c.name)   AS category_name,
       COALESCE(p.icon, c.icon)   AS category_icon,
       COALESCE(p.color, c.color) AS category_color,
       SUM(e.amount)              AS total
     FROM expenses e
     JOIN categories c ON c.id = e.category_id
     LEFT JOIN categories p ON p.id = c.parent_id
     WHERE e.user_id = ? AND strftime('%Y', e.date) = ?
     GROUP BY strftime('%Y-%m', e.date), COALESCE(c.parent_id, c.id)
     ORDER BY month ASC, total DESC`
  )
    .bind(userId, year)
    .all()

  return c.json(rows.results)
})

export default dashboard
