import { useQuery } from '@tanstack/react-query'
import type { Paginated } from '@app/shared'
import { api, qs } from '@/lib/api'

export interface ActivityEntry {
  id: string
  action: string
  entityType: string
  entityId: string
  summary: string
  createdAt: string
  actor: { id: string; fullName: string } | null
}

export function useActivity(filters: { page?: number; entityType?: string }) {
  return useQuery({
    queryKey: ['activity', filters],
    queryFn: ({ signal }) =>
      api.get<Paginated<ActivityEntry>>(`/activity-logs${qs({ ...filters })}`, signal),
    placeholderData: (prev) => prev,
  })
}
