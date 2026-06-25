import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { format } from 'date-fns'

export function useDashboard(month?: string) {
  const currentMonth = month ?? format(new Date(), 'yyyy-MM')
  return useQuery({
    queryKey: ['dashboard', currentMonth],
    queryFn: () => api.getDashboard(currentMonth),
    staleTime: 1000 * 60 * 5,
  })
}
