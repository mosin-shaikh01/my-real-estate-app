import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Paginated, SiteVisitCreateInput, SiteVisitDTO, SiteVisitUpdateInput } from '@app/shared'
import { api, qs } from '@/lib/api'

const KEY = ['site-visits'] as const

// A visit's schedule/status feeds the dashboard's Today's/Upcoming-visits tiles,
// so every visit mutation must refresh both — otherwise those tiles show a stale
// count until the query happens to refetch.
function invalidate(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: KEY })
  void qc.invalidateQueries({ queryKey: ['dashboard'] })
}

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
    onSuccess: () => invalidate(qc),
  })
}

export function useUpdateSiteVisit(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: SiteVisitUpdateInput) =>
      api.patch<{ data: SiteVisitDTO }>(`/site-visits/${id}`, input).then((r) => r.data),
    onSuccess: () => invalidate(qc),
  })
}

export function useDeleteSiteVisit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/site-visits/${id}`),
    onSuccess: () => invalidate(qc),
  })
}
