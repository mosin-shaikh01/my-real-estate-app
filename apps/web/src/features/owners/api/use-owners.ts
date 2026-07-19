import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  OwnerCreateInput,
  OwnerDTO,
  OwnerDuplicate,
  OwnerListItem,
  OwnerOption,
  OwnerUpdateInput,
  Paginated,
} from '@app/shared'
import { api, qs } from '@/lib/api'

// Property Owner master — admin server state (TanStack Query). Duplicate detection
// is a live warning, keyed on the normalised mobile, never a hard block.

const OWNERS_KEY = ['owners'] as const

export function useOwners(params: { q?: string; page?: number }) {
  return useQuery({
    queryKey: [...OWNERS_KEY, 'list', params.q ?? '', params.page ?? 1],
    queryFn: () =>
      api.get<Paginated<OwnerListItem>>(`/owners${qs({ q: params.q, page: params.page ?? 1, pageSize: 25 })}`),
    placeholderData: (prev) => prev,
  })
}

export function useOwner(id: string | undefined) {
  return useQuery({
    queryKey: [...OWNERS_KEY, 'detail', id ?? ''],
    queryFn: () => api.get<{ data: OwnerDTO }>(`/owners/${id}`).then((r) => r.data),
    enabled: Boolean(id),
  })
}

export function useOwnerOptions() {
  return useQuery({
    queryKey: [...OWNERS_KEY, 'options'],
    queryFn: () => api.get<{ data: OwnerOption[] }>('/owners/options').then((r) => r.data),
    staleTime: 60_000,
  })
}

export function useCreateOwner() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: OwnerCreateInput) => api.post<{ data: OwnerDTO }>('/owners', input).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: OWNERS_KEY }),
  })
}

export function useUpdateOwner(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: OwnerUpdateInput) =>
      api.patch<{ data: OwnerDTO }>(`/owners/${id}`, input).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: OWNERS_KEY }),
  })
}

export function useDeleteOwner() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/owners/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: OWNERS_KEY }),
  })
}

/** Live duplicate check by mobile — enabled once enough digits are entered. */
export function useOwnerDuplicate(mobile: string, excludeId?: string) {
  const digits = mobile.replace(/\D/g, '')
  return useQuery({
    queryKey: [...OWNERS_KEY, 'dup', digits, excludeId ?? ''],
    queryFn: () =>
      api
        .get<{ data: { duplicate: OwnerDuplicate | null } }>(`/owners/duplicate${qs({ mobile, excludeId })}`)
        .then((r) => r.data.duplicate),
    enabled: digits.length >= 6,
    staleTime: 10_000,
  })
}
