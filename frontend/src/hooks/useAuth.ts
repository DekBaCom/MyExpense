import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'

export function useAuth() {
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: api.getMe,
    retry: false,
    staleTime: 1000 * 60 * 5,
  })
}
