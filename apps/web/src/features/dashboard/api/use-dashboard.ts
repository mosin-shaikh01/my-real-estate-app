import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface DashboardSummary {
  activeProperties: number
  totalProperties: number
  soldProperties: number
  rentedProperties: number
  totalClients: number
  /** null = the actor may not see agent headcount. Not zero. */
  totalAgents: number | null
  followUpsDue: number
  /** null = gated. String, because it is money. */
  commissionEarned: string | null
  recentActivity: Array<{
    id: string
    action: string
    summary: string
    createdAt: string
    actorName: string | null
  }>
}

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: ({ signal }) => api.get<{ data: DashboardSummary }>('/dashboard', signal),
    select: (r) => r.data,
  })
}
