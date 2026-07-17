// Theme primitives, framework-free so the same logic runs in the no-FOUC boot
// script (see index.html) and the React provider. Keep the keys and resolution
// order identical in both places or the first paint flickers.
//
// The DATABASE is the source of truth (UserPreference.theme, carried on /me).
// localStorage is ONLY a per-user cache so the boot script can paint the right
// palette before /me resolves. It is deliberately NOT a single global value:
// that is exactly what leaks the previous user's theme onto the next user. The
// cache is keyed by user id, and the "who was last here" pointer is cleared on
// logout so a logged-out browser never resolves anyone's theme.

export type Theme = 'light' | 'dark'

/** Per-user cache: { [userId]: 'light' | 'dark' }. Never a single global value. */
export const THEME_MAP_KEY = 'estate-theme'
/** The user id whose session is active on this device. Cleared on logout. */
export const THEME_LAST_USER_KEY = 'estate-last-user'

const DARK_QUERY = '(prefers-color-scheme: dark)'

function isTheme(v: unknown): v is Theme {
  return v === 'light' || v === 'dark'
}

export function getSystemTheme(): Theme {
  return typeof window !== 'undefined' && window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light'
}

function readMap(): Record<string, Theme> {
  try {
    const raw = localStorage.getItem(THEME_MAP_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, Theme>) : {}
  } catch {
    return {}
  }
}

/** A specific user's cached theme, or null if we've never cached one. */
export function getUserTheme(userId: string): Theme | null {
  const v = readMap()[userId]
  return isTheme(v) ? v : null
}

/** Cache a user's theme and mark them as the active user on this device. */
export function setUserTheme(userId: string, theme: Theme): void {
  try {
    const map = readMap()
    map[userId] = theme
    localStorage.setItem(THEME_MAP_KEY, JSON.stringify(map))
    localStorage.setItem(THEME_LAST_USER_KEY, userId)
  } catch {
    // Non-fatal: the theme still applies this session; the DB remains the truth.
  }
}

/** Forget who was here. Called on logout so the boot script falls back to the
 *  system theme rather than resolving the previous user's cached choice. */
export function clearActiveUser(): void {
  try {
    localStorage.removeItem(THEME_LAST_USER_KEY)
  } catch {
    // ignore
  }
}

/** The theme the boot script should paint: the active user's cached choice if a
 *  session is active on this device, otherwise the OS preference. */
export function resolveBootTheme(): Theme {
  try {
    const lastUser = localStorage.getItem(THEME_LAST_USER_KEY)
    if (lastUser) {
      const cached = getUserTheme(lastUser)
      if (cached) return cached
    }
  } catch {
    // fall through to system
  }
  return getSystemTheme()
}

/** The single place the DOM learns the theme: a class the token layer keys off,
 *  plus color-scheme so native controls, scrollbars and form widgets match. */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement
  root.classList.toggle('dark', theme === 'dark')
  root.style.colorScheme = theme
}
