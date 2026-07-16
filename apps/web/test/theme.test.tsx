import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MeResponse, Theme } from '@app/shared'
import { ThemeProvider } from '@/app/theme-provider'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { resolveInitialTheme, THEME_STORAGE_KEY } from '@/lib/theme'

// The toggle is the one piece of UI every signed-in user touches. These pin the
// contract: the DB is the source of truth (server pref adopted, toggles PATCHed),
// with localStorage as a cache and a graceful unauthenticated fallback.

function makeMe(theme: Theme | null): MeResponse {
  return {
    user: { id: 'u1', email: 'a@demo.local', fullName: 'A', phone: null },
    roles: [],
    permissions: [],
    preferences: { theme },
  }
}

// A tiny stateful API stub: /auth/me reflects the current stored theme, and
// PATCH /me/preferences updates it — the real optimistic-then-reconcile flow.
function stubApi(initial: Theme | null) {
  let theme = initial
  const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
    const url = String(input)
    const json = (body: unknown) =>
      new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
    if (url.includes('/api/me/preferences') && init?.method === 'PATCH') {
      theme = JSON.parse(String(init.body)).theme
      return json({ data: { theme } })
    }
    if (url.includes('/api/auth/me')) return json(makeMe(theme))
    return json({})
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function renderWithProviders(ui: ReactNode) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={qc}>
      <ThemeProvider>{ui}</ThemeProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  localStorage.clear()
  document.documentElement.classList.remove('dark')
})
afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
  document.documentElement.classList.remove('dark')
})

describe('theme resolution', () => {
  it('prefers a cached choice over the system setting', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark')
    expect(resolveInitialTheme()).toBe('dark')
  })

  it('falls back to system (mocked light) when nothing is cached', () => {
    expect(resolveInitialTheme()).toBe('light')
  })
})

describe('ThemeToggle — unauthenticated', () => {
  it('toggles the .dark class and caches locally without a server call', async () => {
    // No session: /auth/me is 401, so isAuthed is false and no PATCH is issued.
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ error: { code: 'UNAUTHENTICATED' } }), { status: 401 }),
    )
    vi.stubGlobal('fetch', fetchMock)

    renderWithProviders(<ThemeToggle />)
    const toDark = await screen.findByRole('button', { name: 'Switch to dark mode' })

    await userEvent.click(toDark)
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
    // No preferences PATCH while unauthenticated.
    expect(fetchMock.mock.calls.some((c) => String(c[0]).includes('/me/preferences'))).toBe(false)
  })
})

describe('ThemeToggle — authenticated (DB-backed)', () => {
  it('adopts the saved server theme on load', async () => {
    stubApi('dark')
    renderWithProviders(<ThemeToggle />)
    await waitFor(() => expect(document.documentElement.classList.contains('dark')).toBe(true))
    expect(screen.getByRole('button', { name: 'Switch to light mode' })).toBeDefined()
  })

  it('persists a toggle to the database', async () => {
    const fetchMock = stubApi('light')
    renderWithProviders(<ThemeToggle />)

    const toDark = await screen.findByRole('button', { name: 'Switch to dark mode' })
    await userEvent.click(toDark)

    // UI flips immediately (optimistic)…
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    // …and a PATCH persists it as the source of truth.
    await waitFor(() => {
      const patched = fetchMock.mock.calls.find(
        (c) => String(c[0]).includes('/me/preferences') && (c[1] as RequestInit)?.method === 'PATCH',
      )
      expect(patched).toBeTruthy()
      expect(JSON.parse(String((patched![1] as RequestInit).body))).toEqual({ theme: 'dark' })
    })
  })

  it('seeds a default in the DB when the user has no saved preference', async () => {
    const fetchMock = stubApi(null) // authenticated, but preferences.theme === null
    renderWithProviders(<ThemeToggle />)

    await waitFor(() => {
      const patched = fetchMock.mock.calls.find(
        (c) => String(c[0]).includes('/me/preferences') && (c[1] as RequestInit)?.method === 'PATCH',
      )
      expect(patched, 'expected a default to be persisted').toBeTruthy()
      // The seeded value is the resolved system default (mocked light).
      expect(JSON.parse(String((patched![1] as RequestInit).body))).toEqual({ theme: 'light' })
    })
  })
})
