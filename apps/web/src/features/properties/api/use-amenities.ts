import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface Amenity {
  id: string
  name: string
  slug: string
  category: string | null
}

/** The amenity catalog for the property form's picker. Reference data — cached
 *  hard, and only fetched when the caller (a create/edit form) needs it. */
export function useAmenities(enabled = true) {
  return useQuery({
    queryKey: ['amenities'],
    queryFn: ({ signal }) => api.get<{ data: Amenity[] }>('/amenities', signal),
    select: (r) => r.data,
    enabled,
    staleTime: 10 * 60_000,
  })
}
