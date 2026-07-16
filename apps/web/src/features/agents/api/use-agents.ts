import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AgentCreateInput, UserStatus } from '@app/shared'
import { api } from '@/lib/api'

export interface AgentDTO {
  id: string
  fullName: string
  email: string
  phone: string | null
  status: string
  createdAt: string
  address: string | null
  experienceYears: number | null
  specialization: string | null
  assignedClientCount: number
  assignedPropertyCount: number
  commissionRate?: string | null
  _redacted: string[]
}

export function useAgents() {
  return useQuery({
    queryKey: ['agents'],
    queryFn: ({ signal }) => api.get<{ data: AgentDTO[] }>('/agents', signal),
    select: (r) => r.data,
  })
}

export function useCreateAgent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: AgentCreateInput) => api.post<{ data: { id: string } }>('/agents', input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['agents'] }),
  })
}

export function useSetAgentStatus(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (status: UserStatus) => api.post(`/agents/${id}/status`, { status }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['agents'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}
