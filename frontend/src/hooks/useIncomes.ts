import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import type { IncomeFormData } from '../types'

export function useIncomes(params: Record<string, string> = {}) {
  return useQuery({
    queryKey: ['incomes', params],
    queryFn: () => api.getIncomes(params),
    staleTime: 1000 * 30,
  })
}

export function useIncomeCategories() {
  return useQuery({
    queryKey: ['income-categories'],
    queryFn: api.getIncomeCategories,
    staleTime: 1000 * 60 * 60,
  })
}

export function useCreateIncome() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: IncomeFormData) => api.createIncome(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['incomes'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useUpdateIncome() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<IncomeFormData> }) =>
      api.updateIncome(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['incomes'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useDeleteIncome() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.deleteIncome(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['incomes'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}
