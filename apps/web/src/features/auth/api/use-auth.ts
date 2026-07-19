import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  LoginInput,
  MeResponse,
  PermissionKey,
  ResetPasswordInput,
  Theme,
  UserPreferencesDTO,
} from '@app/shared'
import { api, ApiClientError } from '@/lib/api'
import { clearActiveUser } from '@/lib/theme'

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
      // resetQueries(), NOT clear()/removeQueries(). All three drop the cached
      // data — so a new user on this machine never sees a flash of the previous
      // user's clients — but clear()/removeQueries() also *orphan* long-lived
      // observers: the ThemeProvider's useMe would freeze on the old user and
      // keep applying their theme until a full refresh. reset() empties the data
      // AND keeps observers subscribed, so /me re-resolves to the next user and
      // the theme follows them. (Root cause of the cross-user theme bug.)
      void qc.resetQueries()
      // Forget who was here so neither the boot script nor the ThemeProvider can
      // resurface this user's theme for whoever logs in next.
      clearActiveUser()
    },
  })
}

/**
 * Persist the caller's theme to the database — the source of truth for their
 * preference across sessions and devices. Optimistically patches the ['me']
 * cache so the UI flips instantly, rolls back on error, and reconciles with the
 * server on settle. Only ever writes the current user's own preference.
 */
export function useUpdateThemePreference() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (theme: Theme) =>
      api.patch<{ data: UserPreferencesDTO }>('/me/preferences', { theme }),
    onMutate: async (theme) => {
      await qc.cancelQueries({ queryKey: ME_KEY })
      const prev = qc.getQueryData<MeResponse>(ME_KEY)
      if (prev) {
        qc.setQueryData<MeResponse>(ME_KEY, { ...prev, preferences: { ...prev.preferences, theme } })
      }
      return { prev }
    },
    onError: (_err, _theme, ctx) => {
      if (ctx?.prev) qc.setQueryData(ME_KEY, ctx.prev)
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ME_KEY })
    },
  })
}

/**
 * Request a password-reset link. Deliberately not tied to ['me'] — the caller is
 * signed out. The server always resolves 200 (no account enumeration), so a
 * fulfilled mutation means "we've done what we can", not "the email exists".
 */
export function useForgotPassword() {
  return useMutation({
    mutationFn: (email: string) => api.post<{ ok: true }>('/auth/forgot-password', { email }),
  })
}

/** Check whether a reset link is still valid, so the reset page can show state. */
export function useVerifyResetToken(token: string) {
  return useQuery({
    queryKey: ['reset-token', token],
    queryFn: () => api.post<{ valid: boolean }>('/auth/reset-password/verify', { token }),
    enabled: token.length > 0,
    retry: false,
    staleTime: Infinity,
  })
}

/** Complete a reset with a token + new password. On success the user signs in fresh. */
export function useResetPassword() {
  return useMutation({
    mutationFn: (input: ResetPasswordInput) =>
      api.post<{ ok: true }>('/auth/reset-password', input),
  })
}

export function isUnauthenticated(error: unknown): boolean {
  return error instanceof ApiClientError && error.code === 'UNAUTHENTICATED'
}
