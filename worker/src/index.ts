import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import type { Bindings, Variables } from './types'
import auth from './routes/auth'
import expenses from './routes/expenses'
import categories from './routes/categories'
import members from './routes/members'
import budgets from './routes/budgets'
import dashboard from './routes/dashboard'
import receipts from './routes/receipts'
import settings from './routes/settings'
import incomes from './routes/incomes'
import incomeCategories from './routes/income-categories'
import recurring, { runDailyRecurringCheck } from './routes/recurring'

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

app.use('*', logger())

app.use(
  '/api/*',
  cors({
    origin: (origin, c) => {
      const allowed = c.env.FRONTEND_URL
      return origin === allowed ? origin : allowed
    },
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Accept'],
  })
)

app.route('/api/auth', auth)
app.route('/api/expenses', expenses)
app.route('/api/categories', categories)
app.route('/api/members', members)
app.route('/api/budgets', budgets)
app.route('/api/dashboard', dashboard)
app.route('/api/receipts', receipts)
app.route('/api/settings', settings)
app.route('/api/incomes', incomes)
app.route('/api/income-categories', incomeCategories)
app.route('/api/recurring', recurring)

app.get('/api/health', (c) => c.json({ status: 'ok', ts: new Date().toISOString() }))

app.notFound((c) => c.json({ error: 'Not found' }, 404))
app.onError((err, c) => {
  console.error(err)
  return c.json({ error: 'Internal server error' }, 500)
})

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, env: Bindings, ctx: ExecutionContext): Promise<void> {
    // Daily cron: check recurring payments and send LINE reminders
    ctx.waitUntil(
      runDailyRecurringCheck(env)
        .then(r => console.log('recurring check:', r))
        .catch(err => console.error('recurring check error:', err))
    )
  },
}
