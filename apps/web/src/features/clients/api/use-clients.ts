import { useQuery } from '@tanstack/react-query'
import type { Paginated } from '@app/shared'
import { api, qs } from '@/lib/api'

/**
 * Mirrors the server's ClientDTO.
 *
 * Every restricted field is OPTIONAL, and that is the contract:
 *   absent  -> redacted (the actor may not see it)
 *   null    -> empty    (nothing recorded)
 * The UI must render those differently — a lock versus an em dash. Typing them
 * as `string | null` would erase the distinction the serializer works to keep.
 */
export interface ClientDTO {
  id: string
  code: string
  fullName: string
  buyerType: string | null
  city: string | null
  importantLead: boolean
  priority: string
  followUpStatus: string
  source: string | null
  lastContactAt: string | null
  nextFollowUp: string | null
  createdAt: string
  archivedAt: string | null
  archivedBy: { id: string; fullName: string } | null
  assignedAgent: { id: string; fullName: string } | null
  assignedPropertyCount: number

  email?: string | null
  phone?: string
  whatsapp?: string | null
  notes?: string | null
  requirement?: {
    id: string
    propertyType: string | null
    listingType: string | null
    bedrooms: number | null
    city: string | null
    locality: string | null
    areaMin: string | null
    areaMax: string | null
    budgetMin?: string | null
    budgetMax?: string | null
  }
  _redacted: string[]
}

export interface ClientFilters {
  page?: number
  q?: string
  followUpStatus?: string
  importantLead?: string
  sort?: string
  /** 'only' shows archived-only; 'all' shows both; unset = active only. */
  archived?: string
}

export function useClients(filters: ClientFilters) {
  return useQuery({
    // Key mirrors the filters, so changing a filter refetches and the URL stays
    // the source of truth for what's on screen.
    queryKey: ['clients', filters],
    queryFn: ({ signal }) =>
      api.get<Paginated<ClientDTO>>(
        `/clients${qs({
          page: filters.page ?? 1,
          q: filters.q,
          followUpStatus: filters.followUpStatus,
          importantLead: filters.importantLead,
          archived: filters.archived,
          sort: filters.sort,
        })}`,
        signal,
      ),
    placeholderData: (prev) => prev,
  })
}
