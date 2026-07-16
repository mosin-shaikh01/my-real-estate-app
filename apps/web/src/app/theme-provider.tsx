import { createContext, use, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  applyTheme,
  getStoredTheme,
  resolveInitialTheme,
  THEME_STORAGE_KEY,
  type Theme,
} from '@/lib/theme'

// Centralized theme so any component can read or flip it without re-deriving the
// storage/system logic. Server state stays in Query; this is a UI preference,
// which per the state-ownership rules lives in localStorage — the one place a
// small piece of cross-cutting UI state is allowed.

interface ThemeContextValue {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Lazy init matches the boot script, so state and the DOM class already agree
  // on the first render — no flash, no correcting effect.
  const [theme, setThemeState] = useState<Theme>(() => resolveInitialTheme())
  // Whether the user has made an explicit choice. Until they do, we follow the
  // OS setting live; once they pick, we stop tracking it.
  const explicit = useRef(getStoredTheme() !== null)

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  // Follow the system preference only while the user hasn't chosen one.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (e: MediaQueryListEvent) => {
      if (!explicit.current) setThemeState(e.matches ? 'dark' : 'light')
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const setTheme = useCallback((next: Theme) => {
    explicit.current = true
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      // Non-fatal: the theme still applies for this session.
    }

    // A brief, opt-out-able cross-fade between palettes. The class enables color
    // transitions on everything for one beat, then is removed so it never drags
    // on ordinary hover/press interactions.
    const root = document.documentElement
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      root.classList.add('theme-transition')
      window.setTimeout(() => root.classList.remove('theme-transition'), 260)
    }

    setThemeState(next)
  }, [])

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
