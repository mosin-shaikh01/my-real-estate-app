import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MeResponse, Theme } from '@app/shared'
import { ThemeProvider } from '@/app/theme-provider'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { resolveBootTheme, THEME_LAST_USER_KEY, THEME_MAP_KEY } from '@/lib/theme'

// These pin the contract that fixes the cross-user bug: the applied theme is
// always the CURRENT authenticated user's saved preference; logout forgets the
// previous user; and the localStorage cache is keyed by user id, never global.

function makeMe(userId: string, theme: Theme | null): MeResponse {
  return {
    user: { id: userId, email: `${userId}@demo.local`, fullName: userId, phone: null },
    roles: [],
    permissions: [],
    preferences: { theme },
  }
}

const isDark = () => document.documentElement.classList.contains('dark')

// A mutable, stateful API stub: /auth/me reflects the current session, and PATCH
// /me/preferences updates the stored theme — the real optimistic-then-reconcile
// flow, plus login/logout by flipping `session`.
function stubApi(initial: { userId: string; theme: Theme | null } | null) {
  const state = { session: initial }
  const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
    const url = String(input)
    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
    if (url.includes('/api/me/preferences') && init?.method === 'PATCH') {
      if (state.session) state.session.theme = JSON.parse(String(init.body)).theme
      return json({ data: { theme: state.session?.theme ?? null } })
    }
    if (url.includes('/api/auth/me')) {
      return state.session
        ? json(makeMe(state.session.userId, state.session.theme))
        : json({ error: { code: 'UNAUTHENTICATED' } }, 401)
    }
    return json({})
  })
  vi.stubGlobal('fetch', fetchMock)
  return { fetchMock, state }
}

function renderApp(ui: ReactNode) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  })
  const utils = render(
    <QueryClientProvider client={qc}>
      <ThemeProvider>{ui}</ThemeProvider>
    </QueryClientProvider>,
  )
  return { qc, ...utils }
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

describe('boot theme resolution', () => {
  it('resolves the ACTIVE user’s cached theme, not a global value', () => {
    localStorage.setItem(THEME_MAP_KEY, JSON.stringify({ u1: 'dark', u2: 'light' }))
    localStorage.setItem(THEME_LAST_USER_KEY, 'u1')
    expect(resolveBootTheme()).toBe('dark')
    localStorage.setItem(THEME_LAST_USER_KEY, 'u2')
    expect(resolveBootTheme()).toBe('light')
  })

  it('falls back to system (mocked light) when no user is active', () => {
    localStorage.setItem(THEME_MAP_KEY, JSON.stringify({ u1: 'dark' }))
    // No last-user pointer (e.g. after logout) → never resurface u1's dark.
    expect(resolveBootTheme()).toBe('light')
  })
})

describe('authenticated (DB-backed)', () => {
  it('adopts the saved server theme and caches it under the user id', async () => {
    stubApi({ userId: 'admin', theme: 'dark' })
    renderApp(<ThemeToggle />)
    await waitFor(() => expect(isDark()).toBe(true))
    expect(screen.getByRole('button', { name: 'Switch to light mode' })).toBeDefined()
    expect(JSON.parse(localStorage.getItem(THEME_MAP_KEY)!)).toMatchObject({ admin: 'dark' })
    expect(localStorage.getItem(THEME_LAST_USER_KEY)).toBe('admin')
  })

  it('persists a toggle to the database', async () => {
    const { fetchMock } = stubApi({ userId: 'admin', theme: 'light' })
    renderApp(<ThemeToggle />)
    const toDark = await screen.findByRole('button', { name: 'Switch to dark mode' })
    await userEvent.click(toDark)
    expect(isDark()).toBe(true)
    await waitFor(() => {
      const patched = fetchMock.mock.calls.find(
        (c) => String(c[0]).includes('/me/preferences') && (c[1] as RequestInit)?.method === 'PATCH',
      )
      expect(patched).toBeTruthy()
      expect(JSON.parse(String((patched![1] as RequestInit).body))).toEqual({ theme: 'dark' })
    })
  })

  it('seeds a default in the DB when the user has no saved preference', async () => {
    const { fetchMock } = stubApi({ userId: 'admin', theme: null })
    renderApp(<ThemeToggle />)
    await waitFor(() => {
      const patched = fetchMock.mock.calls.find(
        (c) => String(c[0]).includes('/me/preferences') && (c[1] as RequestInit)?.method === 'PATCH',
      )
      expect(patched, 'expected a default to be persisted').toBeTruthy()
      expect(JSON.parse(String((patched![1] as RequestInit).body))).toEqual({ theme: 'light' })
    })
  })
})

describe('cross-user handoff on the same browser (the bug)', () => {
  it('never shows the previous user’s theme after logout + new login', async () => {
    // Admin is Light, Agent is Dark. system (matchMedia) is mocked Light.
    const { state } = stubApi({ userId: 'admin', theme: 'light' })
    const { qc } = renderApp(<ThemeToggle />)

    // resetQueries is the reliable way to drive the ['me'] query through a full
    // logout/login in the test harness (a bare clear()+invalidate leaves stale
    // data because react-query keeps data across a background-refetch error).
    const applySession = (session: typeof state.session) =>
      act(async () => {
        state.session = session
        await qc.resetQueries({ queryKey: ['me'] })
      })

    // Admin logs in → Light.
    await waitFor(() => expect(isDark()).toBe(false))

    // Repeat the handoff several times — the bug only surfaced across repeated
    // logout/login cycles on the same browser, so prove it stays fixed.
    for (let i = 0; i < 3; i++) {
      // Agent logs in → Dark.
      await applySession({ userId: 'agent', theme: 'dark' })
      await waitFor(() => expect(isDark()).toBe(true))

      // Agent logs out: fall back to SYSTEM (light), never linger on the Agent's
      // dark, and clear the active-user pointer.
      await applySession(null)
      await waitFor(() => expect(isDark()).toBe(false))
      expect(localStorage.getItem(THEME_LAST_USER_KEY)).toBeNull()

      // Admin logs back in → immediately Light, no dark flash from the Agent.
      await applySession({ userId: 'admin', theme: 'light' })
      await waitFor(() => expect(isDark()).toBe(false))
      expect(screen.getByRole('button', { name: 'Switch to dark mode' })).toBeDefined()

      // Admin logs out too, so the next iteration starts clean.
      await applySession(null)
      await waitFor(() => expect(isDark()).toBe(false))
    }
  })
})
