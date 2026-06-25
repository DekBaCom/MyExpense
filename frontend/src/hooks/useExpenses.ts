import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import type { ExpenseFormData } from '../types'

export function useExpenses(params: Record<string, string> = {}) {
  return useQuery({
    queryKey: ['expenses', params],
    queryFn: () => api.getExpenses(params),
    staleTime: 1000 * 30,
  })
}

export function useCreateExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: ExpenseFormData) => api.createExpense(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useUpdateExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<ExpenseFormData> }) =>
      api.updateExpense(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useDeleteExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.deleteExpense(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useMembers() {
  return useQuery({
    queryKey: ['members'],
    queryFn: api.getMembers,
    staleTime: 1000 * 60 * 10,
  })
}
