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
