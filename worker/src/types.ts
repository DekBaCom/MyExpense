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
  userEmail: string
  userName: string
}

export type SessionData = {
  userId: number
  email: string
  name: string
  picture: string
}

export type User = {
  id: number
  google_id: string
  email: string
  name: string
  picture: string | null
  created_at: string
}

export type Member = {
  id: number
  user_id: number
  name: string
  color: string
  emoji: string
  is_owner: number
  created_at: string
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

export type DashboardData = {
  month: string
  total_spent: number
  total_budget: number
  by_category: CategorySummary[]
  by_member: MemberSummary[]
  monthly_trend: MonthlyTrend[]
  recent_expenses: Expense[]
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
