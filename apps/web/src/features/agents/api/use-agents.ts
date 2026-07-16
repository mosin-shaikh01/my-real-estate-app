import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  AgentCreateInput,
  AgentPermissionsInput,
  AgentPermissionsResponse,
  AgentUpdateInput,
  UserStatus,
} from '@app/shared'
import { api } from '@/lib/api'

export interface AgentDTO {
  id: string
  code: string | null
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

export function useUpdateAgent(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: AgentUpdateInput) => api.patch<{ data: { id: string } }>(`/agents/${id}`, input),
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

export function useAgentPermissions(id: string | undefined) {
  return useQuery({
    queryKey: ['agents', id, 'permissions'],
    queryFn: ({ signal }) => api.get<{ data: AgentPermissionsResponse }>(`/agents/${id}/permissions`, signal),
    enabled: Boolean(id),
    select: (r) => r.data,
  })
}

export function useSetAgentPermissions(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: AgentPermissionsInput) =>
      api.put<{ data: AgentPermissionsResponse }>(`/agents/${id}/permissions`, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['agents', id, 'permissions'] })
      void qc.invalidateQueries({ queryKey: ['agents'] })
    },
  })
}
