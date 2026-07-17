import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { BrandingAsset, SettingsDTO, SettingsUpdateInput } from '@app/shared'
import { api } from '@/lib/api'

// CRM settings are SERVER STATE (TanStack Query), read publicly so the whole app
// — including the login screen and the favicon — can brand itself. The admin
// Settings page mutates the same query, so every surface updates at once.

export const SETTINGS_KEY = ['settings'] as const

export function useSettings() {
  return useQuery({
    queryKey: SETTINGS_KEY,
    queryFn: () => api.get<{ data: SettingsDTO }>('/settings').then((r) => r.data),
    // Branding rarely changes; keep it warm and let mutations refresh it.
    staleTime: 5 * 60_000,
  })
}

export function useUpdateSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: SettingsUpdateInput) =>
      api.patch<{ data: SettingsDTO }>('/settings', input).then((r) => r.data),
    onSuccess: (dto) => qc.setQueryData(SETTINGS_KEY, dto),
  })
}

/** Upload a logo or favicon. FormData, so it bypasses the JSON api client. */
export function useUploadBrandingAsset(asset: BrandingAsset) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (file: File) => {
      const body = new FormData()
      body.append('file', file)
      const res = await fetch(`/api/settings/${asset}`, {
        method: 'POST',
        credentials: 'include',
        body,
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error?.message ?? 'Upload failed')
      return json.data as SettingsDTO
    },
    onSuccess: (dto) => qc.setQueryData(SETTINGS_KEY, dto),
  })
}

export function useDeleteBrandingAsset(asset: BrandingAsset) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.delete<{ data: SettingsDTO }>(`/settings/${asset}`).then((r) => r.data),
    onSuccess: (dto) => qc.setQueryData(SETTINGS_KEY, dto),
  })
}
