import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface AssignableAgent {
  id: string
  fullName: string
}

/**
 * Active agents for assignment dropdowns. Shared by "assign agent to property"
 * and "assign agent to client"; the endpoint is guarded by the union of those
 * permissions server-side.
 *
 * `enabled` lets a caller hold the fetch until a dialog opens, rather than
 * loading the list on every property detail view.
 */
export function useAssignableAgents(enabled = true) {
  return useQuery({
    queryKey: ['agents', 'assignable'],
    queryFn: ({ signal }) => api.get<{ data: AssignableAgent[] }>('/agents/assignable', signal),
    select: (r) => r.data,
    enabled,
    staleTime: 5 * 60_000,
  })
}
