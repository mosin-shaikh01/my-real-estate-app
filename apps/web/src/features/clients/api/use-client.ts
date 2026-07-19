import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  ClientCreateInput,
  ClientUpdateInput,
  InteractionCreateInput,
  RequirementInput,
} from '@app/shared'
import { api } from '@/lib/api'
import type { ClientDTO } from './use-clients'

export interface ClientDetailDTO extends ClientDTO {
  interactions: Array<{
    id: string
    type: string
    body: string | null
    occurredAt: string
    scheduledAt: string | null
    outcome: string | null
    authorName: string | null
  }>
  assignedProperties: Array<{
    id: string
    propertyId: string
    code: string
    title: string
    status: string
    assignmentStatus: string
  }>
}

export function useClient(id: string | undefined) {
  return useQuery({
    queryKey: ['clients', id],
    queryFn: ({ signal }) => api.get<{ data: ClientDetailDTO }>(`/clients/${id}`, signal),
    enabled: Boolean(id),
    select: (r) => r.data,
  })
}

export function useCreateClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: ClientCreateInput) =>
      api.post<{ data: { id: string; code: string } }>('/clients', input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['clients'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useUpdateClient(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: ClientUpdateInput) => api.patch(`/clients/${id}`, input),
    onSuccess: () => {
      // The edited row shows in the list, the detail page, and the dashboard
      // counts (importantLead feeds a tile) — invalidate all three.
      void qc.invalidateQueries({ queryKey: ['clients'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

/**
 * Upsert the active requirement. The server deactivates the old one and creates
 * a new active row, preserving history — so this is a POST, not a PATCH, and
 * every call is a new version. The edit form only calls it when a requirement
 * field actually changed, so re-saving unrelated contact edits leaves no noise.
 */
export function useUpsertRequirement(clientId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: RequirementInput) => api.post(`/clients/${clientId}/requirements`, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['clients', clientId] })
      void qc.invalidateQueries({ queryKey: ['clients'] })
    },
  })
}

/** Soft-remove a shared property from a client. */
export function useRemoveAssignment(clientId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (propertyId: string) => api.delete(`/clients/${clientId}/properties/${propertyId}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['clients', clientId] })
      void qc.invalidateQueries({ queryKey: ['properties'] })
    },
  })
}

export function useAddInteraction(clientId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: InteractionCreateInput) =>
      api.post(`/clients/${clientId}/interactions`, input),
    onSuccess: () => {
      // The interaction moved lastContactAt and possibly followUpStatus, so the
      // list is stale too — invalidate broadly rather than patch by hand.
      void qc.invalidateQueries({ queryKey: ['clients'] })
    },
  })
}

export function useBulkAssign(clientId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (propertyIds: string[]) =>
      api.post<{ data: { assigned: number } }>(`/clients/${clientId}/properties`, { propertyIds }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['clients', clientId] })
      void qc.invalidateQueries({ queryKey: ['properties'] })
    },
  })
}
