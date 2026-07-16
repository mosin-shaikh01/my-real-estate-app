import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ThemeProvider } from '@/app/theme-provider'
import { useLogin, useLogout, useMe } from '@/features/auth/api/use-auth'

// The regression test for the cross-user theme bug, driven through the REAL
// auth hooks (useLogin / useLogout / useMe) and a stateful mock server — the
// only setup that reproduces it.
//
// Root cause it guards: `useLogout` used `qc.clear()`, which drops cached data
// but ORPHANS long-lived observers. The ThemeProvider's `useMe` would freeze on
// the previous user and keep applying their theme until a full refresh. The fix
// is `resetQueries()` — empties the data AND keeps observers subscribed.

const isDark = () => document.documentElement.classList.contains('dark')

function Harness() {
  const login = useLogin()
  const logout = useLogout()
  const me = useMe()
  return (
    <div>
      <button onClick={() => login.mutate({ email: 'admin@demo.local', password: 'x' })}>login-admin</button>
      <button onClick={() => login.mutate({ email: 'agent@demo.local', password: 'x' })}>login-agent</button>
      <button onClick={() => logout.mutate()}>logout</button>
      <span data-testid="probe">user={me.data?.user.id ?? 'none'}</span>
    </div>
  )
}

let session: { userId: string; theme: 'light' | 'dark' } | null = null

beforeEach(() => {
  localStorage.clear()
  document.documentElement.classList.remove('dark')
  session = null
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'
      const json = (b: unknown, s = 200) =>
        new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } })
      if (url.includes('/api/auth/login')) {
        const email = JSON.parse(String(init!.body)).email as string
        // Admin prefers Light, Agent prefers Dark — the reported setup.
        session = { userId: email.split('@')[0], theme: email.startsWith('admin') ? 'light' : 'dark' }
        return new Response(null, { status: 204 })
      }
      if (url.includes('/api/auth/logout')) {
        session = null
        return new Response(null, { status: 204 })
      }
      if (url.includes('/api/me/preferences') && method === 'PATCH') {
        if (session) session.theme = JSON.parse(String(init!.body)).theme
        return json({ data: { theme: session?.theme ?? null } })
      }
      if (url.includes('/api/auth/me')) {
        return session
          ? json({
              user: { id: session.userId, email: 'x', fullName: 'x', phone: null },
              roles: [],
              permissions: [],
              preferences: { theme: session.theme },
            })
          : json({ error: { code: 'UNAUTHENTICATED' } }, 401)
      }
      return json({})
    }),
  )
})
afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
  document.documentElement.classList.remove('dark')
})

describe('cross-user theme handoff (real login/logout hooks)', () => {
  it('Admin(Light) → logout → Agent(Dark) → logout → Admin opens LIGHT, repeated', async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: 60_000 }, mutations: { retry: false } },
    })
    render(
      <QueryClientProvider client={qc}>
        <ThemeProvider>
          <MemoryRouter>
            <Harness />
          </MemoryRouter>
        </ThemeProvider>
      </QueryClientProvider>,
    )
    const u = userEvent.setup()
    const probe = () => screen.getByTestId('probe').textContent

    for (let i = 0; i < 4; i++) {
      await u.click(screen.getByText('login-admin'))
      await waitFor(() => expect(probe()).toContain('user=admin'))
      await waitFor(() => expect(isDark(), `cycle ${i}: Admin must be Light`).toBe(false))

      await u.click(screen.getByText('logout'))
      await waitFor(() => expect(probe()).toContain('user=none'))

      await u.click(screen.getByText('login-agent'))
      await waitFor(() => expect(probe()).toContain('user=agent'))
      await waitFor(() => expect(isDark(), `cycle ${i}: Agent must be Dark`).toBe(true))

      await u.click(screen.getByText('logout'))
      await waitFor(() => expect(probe()).toContain('user=none'))
    }
  })
})
