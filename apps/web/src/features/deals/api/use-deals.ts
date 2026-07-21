import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { DealCreateInput, DealDTO, Paginated } from '@app/shared'
import { api, qs } from '@/lib/api'

const KEY = ['deals'] as const

export function useDeals(params: { page?: number; dealType?: string; agentId?: string } = {}) {
  return useQuery({
    queryKey: [...KEY, 'list', params.page ?? 1, params.dealType ?? '', params.agentId ?? ''],
    queryFn: () =>
      api.get<Paginated<DealDTO>>(
        `/deals${qs({ page: params.page ?? 1, pageSize: 25, dealType: params.dealType, agentId: params.agentId })}`,
      ),
    placeholderData: (prev) => prev,
  })
}

export function useCreateDeal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: DealCreateInput) => api.post<{ data: DealDTO }>('/deals', input).then((r) => r.data),
    onSuccess: () => {
      // A new deal changes the deals list AND every report figure.
      void qc.invalidateQueries({ queryKey: KEY })
      void qc.invalidateQueries({ queryKey: ['reports'] })
    },
  })
}
