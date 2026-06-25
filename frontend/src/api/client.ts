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
  getMe: () => request<{ id: number; email: string; name: string; picture: string }>('/auth/me'),
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
  createMember: (body: { name: string; color: string; emoji: string }) =>
    request<{ id: number }>('/members', { method: 'POST', body: JSON.stringify(body) }),
  updateMember: (id: number, body: Partial<{ name: string; color: string; emoji: string }>) =>
    request<{ ok: boolean }>(`/members/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteMember: (id: number) =>
    request<{ ok: boolean }>(`/members/${id}`, { method: 'DELETE' }),

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
  getReceiptUrl: (expenseId: number) => `/api/receipts/${expenseId}/image`,
  deleteReceipt: (expenseId: number) =>
    request<{ ok: boolean }>(`/receipts/${expenseId}`, { method: 'DELETE' }),

  // LINE Settings
  getLineSettings: () =>
    request<import('../types').LineSettings>('/settings/line'),
  saveLineSettings: (body: {
    channel_token: string | null
    line_user_id: string | null
    notify_on_add: boolean
    notify_on_budget_alert: boolean
  }) =>
    request<{ ok: boolean }>('/settings/line', { method: 'PUT', body: JSON.stringify(body) }),
  testLineNotification: () =>
    request<{ ok: boolean }>('/settings/line/test', { method: 'POST' }),
}
