export type Bindings = {
  DB: D1Database
  SESSIONS: KVNamespace
  RECEIPTS: R2Bucket
  GOOGLE_CLIENT_ID: string
  GOOGLE_CLIENT_SECRET: string
  SESSION_SECRET: string
  FRONTEND_URL: string
}

export type Variables = {
  userId: number
  memberId: number | null
  userEmail: string
  userName: string
  userPicture: string
  isOwner: boolean
  role: MemberRole
}

export type SessionData = {
  userId: number          // household owner's user_id (used for all data queries)
  memberId: number | null // the member who actually logged in (for tracking)
  email: string
  name: string
  picture: string
  isOwner: boolean        // kept for backward compat; derived from role === 'owner'
  role: MemberRole
}

export type User = {
  id: number
  google_id: string
  email: string
  name: string
  picture: string | null
  created_at: string
}

export type MemberRole = 'owner' | 'admin' | 'member'

export type Member = {
  id: number
  user_id: number
  name: string
  email: string | null
  color: string
  emoji: string
  is_owner: number
  role: MemberRole
  created_at: string
}

export type LineRecipient = {
  id: number
  user_id: number
  member_id: number | null
  label: string
  channel_token: string
  line_user_id: string
  notify_on_add: number
  notify_on_budget_alert: number
  notify_on_recurring: number
  created_at: string
  updated_at: string
}

export type Category = {
  id: number
  name: string
  name_en: string | null
  icon: string
  color: string
  parent_id: number | null
  sort_order: number
}

export type Expense = {
  id: number
  user_id: number
  member_id: number | null
  category_id: number
  amount: number
  date: string
  payment_method: 'cash' | 'transfer' | 'credit' | 'qr'
  note: string | null
  receipt_key: string | null
  created_at: string
  updated_at: string
  // Joined fields
  category_name?: string
  category_icon?: string
  category_color?: string
  member_name?: string
  member_emoji?: string
  member_color?: string
}

export type LineSettings = {
  channel_token: string | null
  line_user_id: string | null
  notify_on_add: number
  notify_on_budget_alert: number
}

export type Budget = {
  id: number
  user_id: number
  category_id: number
  month: string
  amount: number
}

export type IncomeCategory = {
  id: number
  name: string
  name_en: string | null
  icon: string
  color: string
  sort_order: number
}

export type Income = {
  id: number
  user_id: number
  member_id: number | null
  category_id: number
  amount: number
  date: string
  note: string | null
  receipt_key: string | null
  created_at: string
  updated_at: string
  // Joined fields
  category_name?: string
  category_icon?: string
  category_color?: string
  member_name?: string
  member_emoji?: string
  member_color?: string
}

export type IncomeSummary = {
  category_id: number
  category_name: string
  category_icon: string
  category_color: string
  received: number
}

export type RecurringPayment = {
  id: number
  user_id: number
  member_id: number | null
  category_id: number
  name: string
  amount: number
  due_day: number
  payment_method: 'cash' | 'transfer' | 'credit' | 'qr'
  notify_days_before: number
  is_active: number
  created_at: string
  updated_at: string
  // Joined
  category_name?: string
  category_icon?: string
  category_color?: string
  member_name?: string
  member_emoji?: string
}

export type RecurringPaymentLog = {
  id: number
  recurring_id: number
  month: string
  status: 'pending' | 'paid' | 'skipped'
  expense_id: number | null
  paid_at: string | null
  reminder_sent_at: string | null
  overdue_alert_at: string | null
}

export type UpcomingPaymentItem = RecurringPayment & {
  due_date: string                                   // computed YYYY-MM-DD
  log_id: number | null
  status: 'pending' | 'paid' | 'skipped' | 'overdue'
  paid_at: string | null
  expense_id: number | null
}

export type UpcomingPayments = {
  month: string
  total_due: number
  total_paid: number
  total_pending: number
  paid_count: number
  pending_count: number
  overdue_count: number
  items: UpcomingPaymentItem[]
}

export type DashboardData = {
  month: string
  total_spent: number
  total_income: number
  prev_month_income: number
  net_balance: number      // = prev_month_income - total_spent
  total_budget: number
  by_category: CategorySummary[]
  by_income_category: IncomeSummary[]
  by_member: MemberSummary[]
  monthly_trend: MonthlyTrend[]
  recent_expenses: Expense[]
  recent_incomes: Income[]
}

export type CategorySummary = {
  category_id: number
  category_name: string
  category_icon: string
  category_color: string
  spent: number
  budget: number
  percentage: number
}

export type MemberSummary = {
  member_id: number | null
  member_name: string
  member_emoji: string
  member_color: string
  spent: number
}

export type MonthlyTrend = {
  month: string
  expense: number
  income: number
}

export type Debt = {
  id: number
  user_id: number
  member_id: number | null
  debtor_name: string
  amount: number
  due_date: string | null
  description: string | null
  invoice_key: string | null
  slip_key: string | null
  status: 'pending' | 'paid'
  paid_at: string | null
  created_at: string
  updated_at: string
  member_name?: string | null
  member_emoji?: string | null
}
