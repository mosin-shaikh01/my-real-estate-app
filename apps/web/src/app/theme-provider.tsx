import {
  createContext,
  use,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useMe, useUpdateThemePreference } from '@/features/auth/api/use-auth'
import {
  applyTheme,
  clearActiveUser,
  getSystemTheme,
  resolveBootTheme,
  setUserTheme,
  type Theme,
} from '@/lib/theme'

// ============================================================================
// Theme: per-user, database-backed, and always the CURRENT user's.
// ============================================================================
// The DATABASE is the source of truth — it arrives on the ['me'] query, so this
// provider derives the applied theme from there and keeps no second server copy.
//
// The invariant that fixes the cross-user bug: for a logged-in user the applied
// theme is their saved preference and NOTHING else is ever a fallback. When there
// is no authenticated user (login screen, the beat after logout) the fallback is
// the neutral SYSTEM theme — never the previous user's cached value.
//
//   • The theme is applied in a LAYOUT effect, before the browser paints, so the
//     protected app's first frame is already correct (RequireAuth blocks it until
//     /me — and thus preferences — has resolved).
//   • On logout we reset the fallback to system DURING render (before paint) and
//     forget the previous user, so the next login starts clean.
//   • The localStorage cache is keyed by user id, so it can never leak one user's
//     theme onto another.
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
  const isAuthed = userId !== null
  const serverTheme = me.data?.preferences?.theme ?? null

  // What to show when there is no server answer: the boot cache before /me
  // resolves, reset to the neutral system theme the moment a session ends.
  const [fallbackTheme, setFallbackTheme] = useState<Theme>(() => resolveBootTheme())

  // "Adjust state during render" (React's sanctioned pattern, same as AppShell's
  // lastPath): when the session ends, drop the fallback to system so a logged-out
  // browser never shows the previous user's theme. Runs before paint, costs no
  // extra commit, and — because it compares STATE, not a ref — trips no lint.
  const [prevAuthed, setPrevAuthed] = useState(isAuthed)
  if (prevAuthed !== isAuthed) {
    setPrevAuthed(isAuthed)
    if (!isAuthed) setFallbackTheme(getSystemTheme())
  }

  // The current user's DB preference wins; otherwise the neutral fallback.
  const theme: Theme = serverTheme ?? fallbackTheme

  // Apply BEFORE paint — the protected app renders only after /me (RequireAuth),
  // so its first frame lands on the correct theme with no flash.
  useLayoutEffect(() => {
    applyTheme(theme)
  }, [theme])

  // Side-effects only — cache to localStorage, seed a first-time default, and
  // forget the user on logout. Deliberately no setState here (that belongs in the
  // during-render block above and in event handlers).
  const seededForUser = useRef<string | null>(null)
  const wasAuthed = useRef(false)
  useEffect(() => {
    if (isAuthed) {
      wasAuthed.current = true
      if (serverTheme) {
        // Cache under this user's id for an instant, correct boot next time.
        setUserTheme(userId, serverTheme)
      } else if (seededForUser.current !== userId) {
        // First login with no saved preference: adopt the OS default and persist
        // it, so the DB is the source of truth from the next login on.
        seededForUser.current = userId
        const seed = getSystemTheme()
        setUserTheme(userId, seed)
        persistTheme(seed)
      }
    } else if (wasAuthed.current) {
      // Just logged out: forget who was here so neither the boot script nor this
      // provider can resurface their theme for whoever logs in next.
      wasAuthed.current = false
      seededForUser.current = null
      clearActiveUser()
    }
  }, [isAuthed, userId, serverTheme, persistTheme])

  const setTheme = useCallback(
    (next: Theme) => {
      // A brief, opt-out-able cross-fade between palettes.
      const root = document.documentElement
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        root.classList.add('theme-transition')
        window.setTimeout(() => root.classList.remove('theme-transition'), 260)
      }

      setFallbackTheme(next)
      if (userId) {
        setUserTheme(userId, next)
        // Optimistic: patches the ['me'] cache so serverTheme — and the applied
        // theme — flips immediately, then persists to the DB.
        persistTheme(next)
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
