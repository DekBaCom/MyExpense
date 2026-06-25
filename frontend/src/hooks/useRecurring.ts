import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { format } from 'date-fns'
import type { RecurringFormData } from '../types'

export function useRecurring() {
  return useQuery({
    queryKey: ['recurring'],
    queryFn: api.getRecurring,
    staleTime: 1000 * 60,
  })
}

export function useUpcomingPayments(month?: string) {
  const m = month ?? format(new Date(), 'yyyy-MM')
  return useQuery({
    queryKey: ['recurring', 'upcoming', m],
    queryFn: () => api.getUpcomingPayments(m),
    staleTime: 1000 * 30,
  })
}

export function useCreateRecurring() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: RecurringFormData) => api.createRecurring(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recurring'] })
    },
  })
}

export function useUpdateRecurring() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<RecurringFormData> }) =>
      api.updateRecurring(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recurring'] })
    },
  })
}

export function useDeleteRecurring() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.deleteRecurring(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recurring'] })
    },
  })
}

export function usePayRecurring() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: number; month: string; date?: string; amount?: number; note?: string }) =>
      api.payRecurring(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recurring'] })
      qc.invalidateQueries({ queryKey: ['expenses'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useUnpayRecurring() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, month }: { id: number; month: string }) => api.unpayRecurring(id, month),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recurring'] })
      qc.invalidateQueries({ queryKey: ['expenses'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}
