import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Paginated, SiteVisitCreateInput, SiteVisitDTO, SiteVisitUpdateInput } from '@app/shared'
import { api, qs } from '@/lib/api'

const KEY = ['site-visits'] as const

export function useSiteVisits(filters: { status?: string; page?: number }) {
  return useQuery({
    queryKey: [...KEY, filters],
    queryFn: () =>
      api.get<Paginated<SiteVisitDTO>>(
        `/site-visits${qs({ status: filters.status, page: filters.page ?? 1, pageSize: 25 })}`,
      ),
    placeholderData: (prev) => prev,
  })
}

export function useCreateSiteVisit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: SiteVisitCreateInput) =>
      api.post<{ data: SiteVisitDTO }>('/site-visits', input).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useUpdateSiteVisit(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: SiteVisitUpdateInput) =>
      api.patch<{ data: SiteVisitDTO }>(`/site-visits/${id}`, input).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useDeleteSiteVisit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/site-visits/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}
