export type User = {
  id: number
  email: string
  name: string
  picture: string | null
}

export type Member = {
  id: number
  user_id: number
  name: string
  color: string
  emoji: string
  is_owner: number
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
  total: number
}

export type DashboardData = {
  month: string
  total_spent: number
  total_budget: number
  by_category: CategorySummary[]
  by_member: MemberSummary[]
  monthly_trend: MonthlyTrend[]
  recent_expenses: Expense[]
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

export type LineSettings = {
  channel_token: string | null
  line_user_id: string | null
  notify_on_add: boolean
  notify_on_budget_alert: boolean
  configured: boolean
}
