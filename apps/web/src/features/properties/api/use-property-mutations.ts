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
    mutationFn: (input: PropertyUpdateInput) =>
      api.patch<{ data: { id: string; code: string } }>(`/properties/${id}`, input),
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
    mutationFn: (archived: boolean) => api.post(`/properties/${id}/archive`, { archived }),
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
