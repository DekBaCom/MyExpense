import { Hono } from 'hono'
import type { Bindings, Variables, DashboardData, CategorySummary, MemberSummary, MonthlyTrend, Expense, Income, IncomeSummary } from '../types'
import { authMiddleware } from '../middleware/auth'

const dashboard = new Hono<{ Bindings: Bindings; Variables: Variables }>()
dashboard.use('*', authMiddleware)

function previousMonth(month: string): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 2, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

dashboard.get('/', async (c) => {
  const userId = c.get('userId')
  const month = c.req.query('month') ?? new Date().toISOString().slice(0, 7)
  const prevMonth = previousMonth(month)

  const cacheKey = `dashboard:v2:${userId}:${month}`
  const cached = await c.env.SESSIONS.get(cacheKey)
  if (cached) {
    return c.json(JSON.parse(cached))
  }

  const [
    totalSpentRow,
    totalIncomeRow,
    prevIncomeRow,
    byCategory,
    byIncomeCategory,
    byMember,
    expenseTrend,
    incomeTrend,
    recentExpenses,
    recentIncomes,
    totalBudgetRow,
  ] = await Promise.all([
    c.env.DB.prepare(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM expenses
       WHERE user_id = ? AND strftime('%Y-%m', date) = ?`
    )
      .bind(userId, month)
      .first<{ total: number }>(),

    c.env.DB.prepare(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM incomes
       WHERE user_id = ? AND strftime('%Y-%m', date) = ?`
    )
      .bind(userId, month)
      .first<{ total: number }>(),

    // Previous month income (used as available funds for this month)
    c.env.DB.prepare(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM incomes
       WHERE user_id = ? AND strftime('%Y-%m', date) = ?`
    )
      .bind(userId, prevMonth)
      .first<{ total: number }>(),

    // Spending by category (parent categories only)
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

    // Income by category
    c.env.DB.prepare(
      `SELECT
         c.id    AS category_id,
         c.name  AS category_name,
         c.icon  AS category_icon,
         c.color AS category_color,
         SUM(i.amount) AS received
       FROM incomes i
       JOIN income_categories c ON c.id = i.category_id
       WHERE i.user_id = ? AND strftime('%Y-%m', i.date) = ?
       GROUP BY c.id
       ORDER BY received DESC`
    )
      .bind(userId, month)
      .all<IncomeSummary>(),

    // Spending by member
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

    // Expense trend (last 6 months)
    c.env.DB.prepare(
      `SELECT strftime('%Y-%m', date) AS month, SUM(amount) AS total
       FROM expenses
       WHERE user_id = ?
         AND date >= date('now', '-6 months', 'start of month')
       GROUP BY strftime('%Y-%m', date)
       ORDER BY month ASC`
    )
      .bind(userId)
      .all<{ month: string; total: number }>(),

    // Income trend (last 6 months)
    c.env.DB.prepare(
      `SELECT strftime('%Y-%m', date) AS month, SUM(amount) AS total
       FROM incomes
       WHERE user_id = ?
         AND date >= date('now', '-6 months', 'start of month')
       GROUP BY strftime('%Y-%m', date)
       ORDER BY month ASC`
    )
      .bind(userId)
      .all<{ month: string; total: number }>(),

    // Recent expenses
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

    // Recent incomes
    c.env.DB.prepare(
      `SELECT i.*, c.name AS category_name, c.icon AS category_icon, c.color AS category_color,
              m.name AS member_name, m.emoji AS member_emoji, m.color AS member_color
       FROM incomes i
       JOIN income_categories c ON c.id = i.category_id
       LEFT JOIN members m ON m.id = i.member_id
       WHERE i.user_id = ?
       ORDER BY i.date DESC, i.created_at DESC
       LIMIT 10`
    )
      .bind(userId)
      .all<Income>(),

    c.env.DB.prepare(
      `SELECT COALESCE(SUM(amount), 0) AS total_budget
       FROM budgets WHERE user_id = ? AND month = ?`
    )
      .bind(userId, month)
      .first<{ total_budget: number }>(),
  ])

  // Build combined trend (income + expense per month)
  const trendMap = new Map<string, MonthlyTrend>()
  for (const row of expenseTrend.results) {
    trendMap.set(row.month, { month: row.month, expense: row.total, income: 0 })
  }
  for (const row of incomeTrend.results) {
    const existing = trendMap.get(row.month)
    if (existing) existing.income = row.total
    else trendMap.set(row.month, { month: row.month, expense: 0, income: row.total })
  }
  const monthlyTrend = Array.from(trendMap.values()).sort((a, b) => a.month.localeCompare(b.month))

  const categoriesWithPct: CategorySummary[] = byCategory.results.map(r => ({
    ...r,
    percentage: r.budget > 0 ? Math.round((r.spent / r.budget) * 100) : 0,
  }))

  const totalSpent = totalSpentRow?.total ?? 0
  const totalIncome = totalIncomeRow?.total ?? 0
  const prevIncome = prevIncomeRow?.total ?? 0

  const data: DashboardData = {
    month,
    total_spent: totalSpent,
    total_income: totalIncome,
    prev_month_income: prevIncome,
    // Net balance pattern: previous month income pays for this month's bills
    net_balance: totalIncome - totalSpent,
    total_budget: totalBudgetRow?.total_budget ?? 0,
    by_category: categoriesWithPct,
    by_income_category: byIncomeCategory.results,
    by_member: byMember.results,
    monthly_trend: monthlyTrend,
    recent_expenses: recentExpenses.results,
    recent_incomes: recentIncomes.results,
  }

  await c.env.SESSIONS.put(cacheKey, JSON.stringify(data), { expirationTtl: 300 })
  return c.json(data)
})

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
