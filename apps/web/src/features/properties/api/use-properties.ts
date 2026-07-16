import { useQuery } from '@tanstack/react-query'
import type { Paginated } from '@app/shared'
import { api, qs } from '@/lib/api'

/**
 * Mirrors the server's PropertyDTO.
 *
 * Restricted fields are OPTIONAL, and that is the contract:
 *   absent -> redacted   null -> empty
 * Typing them `string | null` would erase the distinction the serializer works
 * to preserve, and the UI would render a lock as an em dash.
 */
export interface PropertyDTO {
  id: string
  code: string
  title: string
  description: string
  propertyType: string
  listingType: string
  status: string
  constructionStatus: string
  visibility: string
  featured: boolean
  negotiable: boolean
  areaSqft: string | null
  bedrooms: number | null
  bathrooms: number | null
  parking: number
  furnished: string
  facing: string | null
  floor: number | null
  totalFloor: number | null
  builtYear: number | null
  address: string
  locality: string | null
  city: string
  state: string
  country: string
  pincode: string
  latitude: string | null
  longitude: string | null
  videoUrl: string | null
  createdAt: string
  archivedAt: string | null
  assignedAgent: { id: string; fullName: string } | null
  amenities: Array<{ id: string; name: string; slug: string; category: string | null }>
  coverMediaId: string | null
  assignedClientCount: number

  salePrice?: string | null
  rentPricePerMonth?: string | null
  securityDeposit?: string | null
  maintenanceCharges?: string | null
  internalNotes?: string | null

  _redacted: string[]
}

export interface PropertyFilters {
  page?: number
  q?: string
  status?: string
  propertyType?: string
  listingType?: string
  bedrooms?: string
  city?: string
  minPrice?: string
  maxPrice?: string
  sort?: string
}

export function useProperties(filters: PropertyFilters) {
  return useQuery({
    queryKey: ['properties', filters],
    queryFn: ({ signal }) =>
      api.get<Paginated<PropertyDTO>>(`/properties${qs({ ...filters })}`, signal),
    // Keeps the previous page on screen while the next loads, instead of
    // flashing an empty table on every filter keystroke.
    placeholderData: (prev) => prev,
  })
}

export function useProperty(id: string | undefined) {
  return useQuery({
    queryKey: ['properties', id],
    queryFn: ({ signal }) => api.get<{ data: PropertyDTO }>(`/properties/${id}`, signal),
    enabled: Boolean(id),
    select: (r) => r.data,
  })
}

export function usePropertyCities() {
  return useQuery({
    queryKey: ['properties', 'cities'],
    queryFn: ({ signal }) => api.get<{ data: string[] }>('/properties/cities', signal),
    select: (r) => r.data,
    staleTime: 5 * 60_000,
  })
}
