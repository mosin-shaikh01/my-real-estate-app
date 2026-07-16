import { useQuery } from '@tanstack/react-query'
import type { SearchResult } from '@app/shared'
import { api, qs } from '@/lib/api'

export function useSearch(q: string) {
  return useQuery({
    queryKey: ['search', q],
    queryFn: ({ signal }) => api.get<{ data: SearchResult }>(`/search${qs({ q })}`, signal),
    select: (r) => r.data,
    // The schema requires >= 2 chars; don't fire on a single keystroke.
    enabled: q.trim().length >= 2,
    staleTime: 10_000,
  })
}
