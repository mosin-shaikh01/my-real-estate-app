import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { LoginInput, MeResponse, PermissionKey } from '@app/shared'
import { api, ApiClientError } from '@/lib/api'

// ============================================================================
// Auth is SERVER STATE. It lives in TanStack Query, not a store.
// ============================================================================
// This is the single most important line in the frontend architecture, and the
// reason Zustand isn't installed. Copy `permissions` into a store and it goes
// stale the moment an admin changes a role — the user keeps seeing buttons the
// server will refuse. Here, invalidating ['me'] is the whole sync mechanism.
// ============================================================================

export const ME_KEY = ['me'] as const

export function useMe() {
  return useQuery({
    queryKey: ME_KEY,
    queryFn: () => api.get<MeResponse>('/auth/me'),
    // Not signed in is an ANSWER, not a failure. Without this the query retries
    // and the login screen flickers behind a spinner.
    retry: false,
    staleTime: 60_000,
  })
}

export interface Permissions {
  has: (key: PermissionKey) => boolean
  hasAny: (keys: readonly PermissionKey[]) => boolean
  hasAll: (keys: readonly PermissionKey[]) => boolean
  isLoading: boolean
}

/**
 * Reads the same ['me'] query as everything else — one source of truth that
 * auto-invalidates.
 *
 * REMEMBER: this is UX. It hides a button the user cannot use. The server's
 * requirePermission + serializer are what actually enforce anything.
 */
export function usePermissions(): Permissions {
  const { data, isLoading } = useMe()
  const set = new Set(data?.permissions ?? [])
  return {
    has: (key) => set.has(key),
    hasAny: (keys) => keys.some((k) => set.has(k)),
    hasAll: (keys) => keys.every((k) => set.has(k)),
    isLoading,
  }
}

export function useLogin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: LoginInput) => api.post<void>('/auth/login', input),
    onSuccess: () => {
      // Refetch identity rather than assume it — the server decides what this
      // user may do, and it may differ from what the last session could.
      void qc.invalidateQueries({ queryKey: ME_KEY })
    },
  })
}

export function useLogout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.post<void>('/auth/logout'),
    onSuccess: () => {
      // clear(), not invalidate(): another user may sign in on this machine and
      // must never see a flash of the previous user's cached clients.
      qc.clear()
    },
  })
}

export function isUnauthenticated(error: unknown): boolean {
  return error instanceof ApiClientError && error.code === 'UNAUTHENTICATED'
}
