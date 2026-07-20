import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { PropertyCreateInput, PropertyStatus, PropertyUpdateInput } from '@app/shared'
import { api } from '@/lib/api'

// Invalidate broadly rather than patch the cache by hand. A status change moves
// a row between filters, changes dashboard counts, and adds an activity row —
// hand-reconciling all of that is how caches start lying.
function useInvalidateProperties() {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: ['properties'] })
    void qc.invalidateQueries({ queryKey: ['dashboard'] })
  }
}

export function useCreateProperty() {
  const invalidate = useInvalidateProperties()
  return useMutation({
    mutationFn: (input: PropertyCreateInput) =>
      api.post<{ data: { id: string; code: string } }>('/properties', input),
    onSuccess: invalidate,
  })
}

export function useUpdateProperty(id: string) {
  const invalidate = useInvalidateProperties()
  return useMutation({
    // `changed` is false when the submit was a genuine no-op — the UI shows
    // "No changes detected" rather than a false "updated".
    mutationFn: (input: PropertyUpdateInput) =>
      api.patch<{ data: { id: string; code: string; changed: boolean } }>(`/properties/${id}`, input),
    onSuccess: invalidate,
  })
}

export function useSetPropertyStatus(id: string) {
  const invalidate = useInvalidateProperties()
  return useMutation({
    mutationFn: (status: PropertyStatus) => api.post(`/properties/${id}/status`, { status }),
    onSuccess: invalidate,
  })
}

export function useArchiveProperty(id: string) {
  const invalidate = useInvalidateProperties()
  return useMutation({
    // archived=true archives, archived=false restores — one endpoint, mirrored
    // by the server's archiveProperty(archived) signature.
    mutationFn: (archived: boolean) => api.post(`/properties/${id}/archive`, { archived }),
    onSuccess: invalidate,
  })
}

/**
 * Permanent-delete (admin, property.delete). SOFT at the database level — the
 * server sets deletedAt, which scopeForProperty filters from every read, so the
 * row vanishes from all listings while its data and activity history are
 * preserved. Not reversible from the UI.
 */
export function useDeleteProperty(id: string) {
  const invalidate = useInvalidateProperties()
  return useMutation({
    mutationFn: () => api.delete(`/properties/${id}`),
    onSuccess: invalidate,
  })
}

export function useAssignPropertyAgent(id: string) {
  const invalidate = useInvalidateProperties()
  return useMutation({
    // null clears the assignment. Reassigning changes who can SEE the property,
    // so invalidate broadly — the current agent's scoped list may shift.
    mutationFn: (agentId: string | null) => api.post(`/properties/${id}/assign-agent`, { agentId }),
    onSuccess: invalidate,
  })
}

export function useUploadMedia(propertyId: string) {
  const qc = useQueryClient()
  return useMutation({
    // FormData, not JSON — the api client sends JSON, so this uses fetch
    // directly. credentials: 'include' carries the auth cookie; no
    // Content-Type header, so the browser sets the multipart boundary.
    mutationFn: async (files: FileList) => {
      const body = new FormData()
      for (const file of Array.from(files)) body.append('files', file)
      const res = await fetch(`/api/properties/${propertyId}/media`, {
        method: 'POST',
        credentials: 'include',
        body,
      })
      if (!res.ok) {
        const j = await res.json().catch(() => null)
        throw new Error(j?.error?.message ?? 'Upload failed')
      }
      return res.json()
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['properties', propertyId] }),
  })
}

export function useDeleteMedia(propertyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (mediaId: string) => api.delete(`/media/${mediaId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['properties', propertyId] }),
  })
}

export function useSetCover(propertyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (mediaId: string) => api.post(`/media/${mediaId}/cover`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['properties', propertyId] }),
  })
}
