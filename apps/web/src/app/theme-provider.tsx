import { createContext, use, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useMe, useUpdateThemePreference } from '@/features/auth/api/use-auth'
import { applyTheme, resolveInitialTheme, setStoredTheme, type Theme } from '@/lib/theme'

// ============================================================================
// Theme: per-user, database-backed.
// ============================================================================
// The DATABASE is the source of truth — a user's choice follows them across
// sessions and devices. It arrives on the ['me'] query, so this provider derives
// the applied theme from there and never keeps a second server copy (the
// state-ownership rule: server data stays in Query).
//
// localStorage is a CACHE, nothing more: the boot script in index.html reads it
// to paint the right palette before /me resolves, avoiding a flash. Once /me
// lands, the server value wins and the cache is realigned to it.
//
// First login with no saved preference: the OS `prefers-color-scheme` (resolved
// into the cache pre-paint) is applied, then persisted to the DB as the user's
// default — so from the next login on, the DB decides.
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

  // Instant theme for first paint and the unauthenticated login screen. Seeded
  // from the same cache/OS logic the boot script used, so they already agree.
  const [cachedTheme, setCachedTheme] = useState<Theme>(() => resolveInitialTheme())

  // The DB wins whenever we have it; otherwise the cache carries us.
  const theme: Theme = serverTheme ?? cachedTheme

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  // Reconcile the local cache with the server, and seed a default the first time
  // we meet an authenticated user who has never chosen one. Keyed on userId so
  // it runs once per login, and resets when they sign out.
  const seededForUser = useRef<string | null>(null)
  useEffect(() => {
    if (!isAuthed) {
      seededForUser.current = null
      return
    }
    if (serverTheme) {
      // Keep the cache aligned so the next cold boot paints correctly — e.g. the
      // user flipped the theme on another device.
      setStoredTheme(serverTheme)
      return
    }
    // Authenticated, but no saved preference: persist the resolved default (their
    // OS setting) once, making the DB the source of truth from here on.
    if (seededForUser.current !== userId) {
      seededForUser.current = userId
      persistTheme(cachedTheme)
    }
  }, [isAuthed, userId, serverTheme, cachedTheme, persistTheme])

  const setTheme = useCallback(
    (next: Theme) => {
      setStoredTheme(next)

      // A brief, opt-out-able cross-fade between palettes. The class enables
      // color transitions for one beat, then is removed so it never drags on
      // ordinary hover/press.
      const root = document.documentElement
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        root.classList.add('theme-transition')
        window.setTimeout(() => root.classList.remove('theme-transition'), 260)
      }

      setCachedTheme(next)
      // Authenticated → persist to the DB (optimistic, so the applied theme —
      // which prefers the server value — flips immediately).
      if (isAuthed) persistTheme(next)
    },
    [isAuthed, persistTheme],
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
