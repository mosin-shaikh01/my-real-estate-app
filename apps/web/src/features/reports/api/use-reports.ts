import { useQuery } from '@tanstack/react-query'
import type { ReportsBundle } from '@app/shared'
import { api } from '@/lib/api'

export function useReports() {
  return useQuery({
    queryKey: ['reports'],
    queryFn: ({ signal }) => api.get<{ data: ReportsBundle }>('/reports', signal),
    select: (r) => r.data,
  })
}
