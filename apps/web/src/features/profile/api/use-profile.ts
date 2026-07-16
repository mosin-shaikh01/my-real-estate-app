import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ProfileResponse, ProfileUpdateInput } from '@app/shared'
import { api } from '@/lib/api'
import { ME_KEY } from '@/features/auth/api/use-auth'

export function useProfile() {
  return useQuery({
    queryKey: ['profile'],
    queryFn: ({ signal }) => api.get<{ data: ProfileResponse }>('/profile', signal),
    select: (r) => r.data,
  })
}

export function useUpdateProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: ProfileUpdateInput) =>
      api.patch<{ data: ProfileResponse }>('/profile', input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['profile'] })
      // The topbar shows the name from ['me'] — refresh it so an edited name
      // updates everywhere at once.
      void qc.invalidateQueries({ queryKey: ME_KEY })
    },
  })
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (input: { currentPassword: string; newPassword: string; confirmPassword: string }) =>
      api.post<void>('/profile/change-password', input),
  })
}
