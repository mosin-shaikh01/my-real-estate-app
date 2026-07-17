import { createContext, use, useCallback, useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'
import { useMe, useUpdateThemePreference } from '@/features/auth/api/use-auth'
import {
  applyTheme,
  getSystemTheme,
  resolveBootTheme,
  setUserTheme,
  type Theme,
} from '@/lib/theme'

// ============================================================================
// Theme: per-user, database-backed, and always the CURRENT user's.
// ============================================================================
// The DATABASE is the source of truth (UserPreference.theme, on the ['me']
// query). The applied theme is derived PURELY from it — no second copy of server
// state, and no local mirror that could drift out of sync:
//
//   • Authenticated → the user's saved preference (or the OS default while a
//     brand-new user's default is being seeded).
//   • Not authenticated (login screen, the beat after logout) → resolveBootTheme,
//     which returns the active user's cached theme ONLY while a session pointer
//     exists (a logged-in reload) and the neutral OS theme otherwise. That
//     pointer is cleared on logout, so a logged-out browser never resurfaces the
//     previous user's theme.
//
// Applied in a LAYOUT effect (before paint); RequireAuth blocks the protected app
// until /me resolves, so the dashboard's first frame is already correct.
// ============================================================================

interface ThemeContextValue {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const me = useMe()
  const { mutate: persistTheme } = useUpdateThemePreference()
  const userId = me.data?.user.id ?? null
  const serverTheme = me.data?.preferences?.theme ?? null

  // Pure derivation. resolveBootTheme reads the per-user cache + the session
  // pointer fresh each render, so it reflects logout (pointer cleared → system)
  // with no local state to keep in sync.
  const theme: Theme = serverTheme ?? resolveBootTheme()

  useLayoutEffect(() => {
    applyTheme(theme)
  }, [theme])

  // Side-effects only: cache the current user's theme, and seed a first-time
  // default. No setState here.
  const seededForUser = useRef<string | null>(null)
  useEffect(() => {
    if (!userId) return
    if (serverTheme) {
      setUserTheme(userId, serverTheme)
    } else if (seededForUser.current !== userId) {
      seededForUser.current = userId
      const seed = getSystemTheme()
      setUserTheme(userId, seed)
      persistTheme(seed)
    }
  }, [userId, serverTheme, persistTheme])

  const setTheme = useCallback(
    (next: Theme) => {
      const root = document.documentElement
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        root.classList.add('theme-transition')
        window.setTimeout(() => root.classList.remove('theme-transition'), 260)
      }
      if (userId) {
        setUserTheme(userId, next)
        // Optimistic: patches the ['me'] cache so serverTheme — and the applied
        // theme — flips immediately, then persists to the DB.
        persistTheme(next)
      } else {
        applyTheme(next)
      }
    },
    [userId, persistTheme],
  )

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }, [theme, setTheme])

  return <ThemeContext value={{ theme, setTheme, toggleTheme }}>{children}</ThemeContext>
}

export function useTheme(): ThemeContextValue {
  const ctx = use(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider')
  return ctx
}
