import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

// Document upload/delete for a property. Uploads go through the same authorized
// media endpoint as images, tagged with a documentType; deletes hit the shared
// media route. Both refresh the property detail query so the list updates live.

export function useUploadDocument(propertyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ file, documentType }: { file: File; documentType: string }) => {
      const body = new FormData()
      body.append('files', file)
      body.append('documentType', documentType)
      const res = await fetch(`/api/properties/${propertyId}/media`, {
        method: 'POST',
        credentials: 'include',
        body,
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error?.message ?? 'Upload failed')
      return json.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['properties', propertyId] }),
  })
}

export function useDeleteMedia(propertyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (mediaId: string) => api.delete<void>(`/media/${mediaId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['properties', propertyId] }),
  })
}
