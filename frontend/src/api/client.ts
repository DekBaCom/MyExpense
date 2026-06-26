const BASE = (import.meta.env.VITE_API_URL ?? '') + '/api'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })

  if (res.status === 401) {
    if (window.location.pathname !== '/login') {
      window.location.href = '/login'
    }
    throw new Error('Unauthorized')
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText })) as { error: string }
    throw new Error(err.error)
  }

  return res.json() as Promise<T>
}

export const api = {
  // Auth
  getMe: () => request<import('../types').User>('/auth/me'),
  logout: () => request<{ ok: boolean }>('/auth/logout', { method: 'POST' }),

  // Expenses
  getExpenses: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request<{ data: import('../types').Expense[]; total: number; limit: number; offset: number }>(
      `/expenses${qs ? `?${qs}` : ''}`
    )
  },
  createExpense: (body: import('../types').ExpenseFormData) =>
    request<{ id: number }>('/expenses', { method: 'POST', body: JSON.stringify(body) }),
  updateExpense: (id: number, body: Partial<import('../types').ExpenseFormData>) =>
    request<{ ok: boolean }>(`/expenses/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteExpense: (id: number) =>
    request<{ ok: boolean }>(`/expenses/${id}`, { method: 'DELETE' }),

  // Categories
  getCategories: () => request<import('../types').Category[]>('/categories'),
  getCategoriesFlat: () => request<import('../types').Category[]>('/categories/flat'),

  // Members
  getMembers: () => request<import('../types').Member[]>('/members'),
  createMember: (body: { name: string; email?: string | null; color: string; emoji: string; role?: import('../types').MemberRole }) =>
    request<{ id: number }>('/members', { method: 'POST', body: JSON.stringify(body) }),
  updateMember: (id: number, body: Partial<{ name: string; email: string | null; color: string; emoji: string; role: import('../types').MemberRole }>) =>
    request<{ ok: boolean }>(`/members/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteMember: (id: number) =>
    request<{ ok: boolean }>(`/members/${id}`, { method: 'DELETE' }),

  // LINE recipients (multi)
  getLineRecipients: () =>
    request<import('../types').LineRecipient[]>('/settings/line'),
  createLineRecipient: (body: {
    member_id?: number | null
    label: string
    channel_token: string
    line_user_id: string
    notify_on_add?: boolean
    notify_on_budget_alert?: boolean
    notify_on_recurring?: boolean
  }) => request<{ id: number }>('/settings/line', { method: 'POST', body: JSON.stringify(body) }),
  updateLineRecipient: (id: number, body: Partial<{
    label: string
    member_id: number | null
    channel_token: string
    line_user_id: string
    notify_on_add: boolean
    notify_on_budget_alert: boolean
    notify_on_recurring: boolean
  }>) => request<{ ok: boolean }>(`/settings/line/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteLineRecipient: (id: number) =>
    request<{ ok: boolean }>(`/settings/line/${id}`, { method: 'DELETE' }),
  testLineRecipient: (id: number) =>
    request<{ ok: boolean }>(`/settings/line/${id}/test`, { method: 'POST' }),

  // Budgets
  getBudgets: (month: string) =>
    request<import('../types').Budget[]>(`/budgets/${month}`),
  saveBudgets: (month: string, items: { category_id: number; amount: number }[]) =>
    request<{ ok: boolean; updated: number }>(`/budgets/${month}`, {
      method: 'PUT',
      body: JSON.stringify(items),
    }),

  // Dashboard
  getDashboard: (month: string) =>
    request<import('../types').DashboardData>(`/dashboard?month=${month}`),

  // Receipts (multipart — no JSON wrapper)
  uploadReceipt: async (expenseId: number, file: File): Promise<{ ok: boolean; key: string }> => {
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`${BASE}/receipts/${expenseId}`, {
      method: 'PUT',
      credentials: 'include',
      body: form,
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText })) as { error: string }
      throw new Error(err.error)
    }
    return res.json() as Promise<{ ok: boolean; key: string }>
  },
  getReceiptUrl: (expenseId: number) => `${BASE}/receipts/${expenseId}/image`,
  deleteReceipt: (expenseId: number) =>
    request<{ ok: boolean }>(`/receipts/${expenseId}`, { method: 'DELETE' }),

  // Incomes
  getIncomes: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request<{ data: import('../types').Income[]; total: number; limit: number; offset: number }>(
      `/incomes${qs ? `?${qs}` : ''}`
    )
  },
  createIncome: (body: import('../types').IncomeFormData) =>
    request<{ id: number }>('/incomes', { method: 'POST', body: JSON.stringify(body) }),
  updateIncome: (id: number, body: Partial<import('../types').IncomeFormData>) =>
    request<{ ok: boolean }>(`/incomes/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteIncome: (id: number) =>
    request<{ ok: boolean }>(`/incomes/${id}`, { method: 'DELETE' }),

  // Income categories
  getIncomeCategories: () =>
    request<import('../types').IncomeCategory[]>('/income-categories'),

  // Recurring payments
  getRecurring: () =>
    request<import('../types').RecurringPayment[]>('/recurring'),
  getUpcomingPayments: (month?: string) =>
    request<import('../types').UpcomingPayments>(`/recurring/upcoming${month ? `?month=${month}` : ''}`),
  createRecurring: (body: import('../types').RecurringFormData) =>
    request<{ id: number }>('/recurring', { method: 'POST', body: JSON.stringify(body) }),
  updateRecurring: (id: number, body: Partial<import('../types').RecurringFormData>) =>
    request<{ ok: boolean }>(`/recurring/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteRecurring: (id: number) =>
    request<{ ok: boolean }>(`/recurring/${id}`, { method: 'DELETE' }),
  payRecurring: (id: number, body: { month: string; date?: string; amount?: number; note?: string; create_expense?: boolean }) =>
    request<{ log_id: number; expense_id: number | null }>(`/recurring/${id}/pay`, {
      method: 'POST', body: JSON.stringify(body),
    }),
  unpayRecurring: (id: number, month: string) =>
    request<{ ok: boolean }>(`/recurring/${id}/unpay`, { method: 'POST', body: JSON.stringify({ month }) }),
  checkRecurringNow: () =>
    request<{ users_processed: number; messages_sent: number }>('/recurring/check-now', { method: 'POST' }),
}
