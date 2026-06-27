import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import type { DebtFormData } from '../types'

export function useDebts(status: 'pending' | 'paid' | 'all' = 'pending') {
  return useQuery({
    queryKey: ['debts', status],
    queryFn: () => api.getDebts({ status }),
    staleTime: 1000 * 30,
  })
}

export function useCreateDebt() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: DebtFormData) => api.createDebt(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['debts'] }),
  })
}

export function useUpdateDebt() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<DebtFormData> }) => api.updateDebt(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['debts'] }),
  })
}

export function useDeleteDebt() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.deleteDebt(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['debts'] }),
  })
}

export function usePayDebt() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.payDebt(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['debts'] }),
  })
}

export function useUnpayDebt() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.unpayDebt(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['debts'] })
      await qc.invalidateQueries({ queryKey: ['expenses'] })
      await qc.refetchQueries({ queryKey: ['dashboard'], type: 'all' })
    },
  })
}

export function useRemindDebt() {
  return useMutation({
    mutationFn: (id: number) => api.remindDebt(id),
  })
}
