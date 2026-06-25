import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: api.getCategories,
    staleTime: 1000 * 60 * 60, // 1 hour
  })
}

export function useCategoriesFlat() {
  return useQuery({
    queryKey: ['categories', 'flat'],
    queryFn: api.getCategoriesFlat,
    staleTime: 1000 * 60 * 60,
  })
}
