// Theme primitives, framework-free so the same logic runs in the no-FOUC boot
// script (see index.html) and the React provider. Keep the storage key and the
// resolution order identical in both places or the first paint flickers.

export type Theme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'estate-theme'

const DARK_QUERY = '(prefers-color-scheme: dark)'

export function getSystemTheme(): Theme {
  return typeof window !== 'undefined' && window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light'
}

/** The cached theme for this device, or null if none. This is a CACHE for
 *  instant first paint — the database (via /me) is the source of truth. */
export function getStoredTheme(): Theme | null {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY)
    return v === 'light' || v === 'dark' ? v : null
  } catch {
    // Private mode / storage disabled — fall back to system.
    return null
  }
}

/** Update the device cache so the next cold boot paints without a flash. */
export function setStoredTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // Non-fatal: the theme still applies for this session, and the DB still
    // holds the source of truth for the next login.
  }
}

/** Stored preference wins; otherwise the OS setting. */
export function resolveInitialTheme(): Theme {
  return getStoredTheme() ?? getSystemTheme()
}

/** The single place the DOM learns the theme: a class the token layer keys off,
 *  plus color-scheme so native controls, scrollbars and form widgets match. */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement
  root.classList.toggle('dark', theme === 'dark')
  root.style.colorScheme = theme
}
