export type User = {
  email: string
  name: string
  picture: string | null
  member_id: number | null
  member_name: string
  member_emoji: string
  member_color: string
  is_owner: boolean
  role: MemberRole
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
}

export type LineRecipient = {
  id: number
  user_id: number
  member_id: number | null
  label: string
  channel_token: string
  line_user_id: string
  notify_on_add: boolean
  notify_on_budget_alert: boolean
  notify_on_recurring: boolean
  member_name?: string | null
  member_emoji?: string | null
}

export type Category = {
  id: number
  name: string
  name_en: string | null
  icon: string
  color: string
  parent_id: number | null
  sort_order: number
  children?: Category[]
}

export type PaymentMethod = 'cash' | 'transfer' | 'credit' | 'qr'

export type Expense = {
  id: number
  user_id: number
  member_id: number | null
  category_id: number
  amount: number
  date: string
  payment_method: PaymentMethod
  note: string | null
  receipt_key: string | null
  created_at: string
  updated_at: string
  category_name?: string
  category_icon?: string
  category_color?: string
  member_name?: string
  member_emoji?: string
  member_color?: string
}

export type Budget = {
  id: number
  category_id: number
  month: string
  amount: number
  category_name?: string
  category_icon?: string
  category_color?: string
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
  category_name?: string
  category_icon?: string
  category_color?: string
  member_name?: string
  member_emoji?: string
  member_color?: string
}

export type IncomeFormData = {
  amount: number
  date: string
  category_id: number
  member_id: number | null
  note: string
}

export type IncomeSummary = {
  category_id: number
  category_name: string
  category_icon: string
  category_color: string
  received: number
}

export type DashboardData = {
  month: string
  total_spent: number
  total_income: number
  prev_month_income: number
  net_balance: number
  total_budget: number
  by_category: CategorySummary[]
  by_income_category: IncomeSummary[]
  by_member: MemberSummary[]
  monthly_trend: MonthlyTrend[]
  recent_expenses: Expense[]
  recent_incomes: Income[]
}

export type ExpenseFormData = {
  amount: number
  date: string
  category_id: number
  member_id: number | null
  payment_method: PaymentMethod
  note: string
}

export const PAYMENT_METHODS: { value: PaymentMethod; label: string; icon: string }[] = [
  { value: 'cash',     label: 'เงินสด',      icon: '💵' },
  { value: 'transfer', label: 'โอนเงิน',     icon: '🏦' },
  { value: 'credit',   label: 'บัตรเครดิต', icon: '💳' },
  { value: 'qr',       label: 'QR Code',    icon: '📱' },
]

export type RecurringPayment = {
  id: number
  user_id: number
  member_id: number | null
  category_id: number
  name: string
  amount: number
  due_day: number
  payment_method: PaymentMethod
  notify_days_before: number
  is_active: number
  created_at: string
  updated_at: string
  category_name?: string
  category_icon?: string
  category_color?: string
  member_name?: string
  member_emoji?: string
}

export type RecurringFormData = {
  name: string
  amount: number
  category_id: number
  due_day: number
  member_id: number | null
  payment_method: PaymentMethod
  notify_days_before: number
  is_active: boolean
}

export type UpcomingPaymentItem = RecurringPayment & {
  due_date: string
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

export type DebtFormData = {
  debtor_name: string
  amount: number
  due_date: string
  description: string
  member_id: number | null
}
