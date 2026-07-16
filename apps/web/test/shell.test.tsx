import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryRouter, RouterProvider } from 'react-router'
import type { MeResponse } from '@app/shared'
import { PERMISSION_KEYS } from '@app/shared'
import { ThemeProvider } from '@/app/theme-provider'
import { AppShell } from '@/components/layout/AppShell'
import { Sidebar } from '@/components/layout/Sidebar'
import { StatusBadge } from '@/components/ui/StatusBadge'
import DashboardPage from '@/features/dashboard/pages/DashboardPage'
import { formatMoney, formatMoneyShort } from '@/lib/format'

// A smoke test, not a suite. It answers the one question a passing build
// cannot: does the app actually mount, or does it white-screen?

const ME: MeResponse = {
  user: { id: 'u1', email: 'admin@demo.local', fullName: 'Priya Deshmukh', phone: null },
  roles: [{ slug: 'super_admin', name: 'Super Admin' }],
  permissions: ['client.list', 'property.list'],
}

beforeEach(() => {
  // The shell reads /auth/me through TanStack Query. Stub the transport, not
  // the hook — mocking the hook would test the mock rather than the wiring.
  // Stub the transport, and return the real envelope shapes. Returning a bare
  // {} would crash the dashboard's `recent?.data.length` — the API contract
  // guarantees a `data` field, so a stub that omits it is testing a state the
  // server never produces.
  const json = (body: unknown) =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })

  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL) => {
      const url = String(input)
      if (url.includes('/api/auth/me')) return json(ME)
      if (url.includes('/api/dashboard')) {
        return json({
          data: {
            activeProperties: 3,
            totalProperties: 6,
            soldProperties: 1,
            rentedProperties: 1,
            totalClients: 4,
            totalAgents: 2,
            followUpsDue: 1,
            commissionEarned: '987500.00',
            recentActivity: [],
          },
        })
      }
      if (url.includes('/api/properties')) {
        return json({ data: [], meta: { page: 1, pageSize: 25, total: 0, totalPages: 1 } })
      }
      return json({})
    }),
  )
})

function withProviders(ui: ReactNode) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return (
    <ThemeProvider>
      <QueryClientProvider client={qc}>{ui}</QueryClientProvider>
    </ThemeProvider>
  )
}

function renderShell(path = '/') {
  const router = createMemoryRouter(
    [{ element: <AppShell />, children: [{ index: true, element: <DashboardPage /> }] }],
    { initialEntries: [path] },
  )
  return render(withProviders(<RouterProvider router={router} />))
}

describe('app shell', () => {
  it('mounts and renders the dashboard inside the shell', () => {
    renderShell()
    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeDefined()
  })

  it('renders one navigation, shared by admin and agent', async () => {
    renderShell()
    // The sidebar filters on the async /me query, so links appear once it
    // resolves — await, don't assume synchronous.
    expect(await screen.findByRole('link', { name: /Properties/ })).toBeDefined()
    const navs = screen.getAllByRole('navigation', { name: 'Main' })
    // Two route trees would mean two navs. There is deliberately one.
    expect(navs).toHaveLength(1)
  })

  it('shows an AGENT only Dashboard, Properties and Clients — no admin items', async () => {
    // ME here holds client.list + property.list only (an agent). The sidebar is
    // filtered from the permission config, so the admin sections must be absent
    // even though the same NAV array declares them.
    renderShell()
    const nav = await screen.findByRole('navigation', { name: 'Main' })
    // Wait for the permission-gated items to appear after /me resolves.
    expect(await within(nav).findByRole('link', { name: /Clients/ })).toBeDefined()
    for (const shown of ['Dashboard', 'Properties', 'Clients']) {
      expect(within(nav).getByRole('link', { name: new RegExp(shown) }), shown).toBeDefined()
    }
    for (const hidden of ['Requirements', 'Agents', 'Activity log', 'Roles & access']) {
      expect(within(nav).queryByRole('link', { name: new RegExp(hidden) }), hidden).toBeNull()
    }
  })

  it('shows an ADMIN every nav item', () => {
    // Seed the ['me'] cache with the full permission set (super admin) and
    // render the sidebar directly. Same config, but every gated item now shows.
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const adminMe: MeResponse = {
      user: { id: 'a1', email: 'admin@demo.local', fullName: 'Priya', phone: null },
      roles: [{ slug: 'super_admin', name: 'Super Admin' }],
      permissions: [...PERMISSION_KEYS],
    }
    qc.setQueryData(['me'], adminMe)
    const router = createMemoryRouter([{ path: '/', element: <Sidebar /> }], {
      initialEntries: ['/'],
    })
    render(
      <QueryClientProvider client={qc}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    )
    const nav = screen.getByRole('navigation', { name: 'Main' })
    for (const shown of ['Dashboard', 'Properties', 'Clients', 'Requirements', 'Agents', 'Activity log', 'Roles & access']) {
      expect(within(nav).getByRole('link', { name: new RegExp(shown) }), shown).toBeDefined()
    }
  })

  it('exposes the mobile nav trigger with an accessible name', async () => {
    renderShell()
    await userEvent.click(screen.getByRole('button', { name: 'Open navigation' }))
    expect(screen.getByRole('button', { name: 'Close navigation' })).toBeDefined()
  })

  it('shows the signed-in user once /me resolves', async () => {
    renderShell()
    expect(await screen.findByText('Priya Deshmukh')).toBeDefined()
    expect(screen.getByText('Super Admin')).toBeDefined()
  })
})

describe('status badge', () => {
  it('renders a text label, never colour alone', () => {
    // The WCAG 1.4.1 guarantee, asserted rather than assumed.
    render(<StatusBadge status="SOLD" />)
    expect(screen.getByText('Sold')).toBeDefined()
  })

  it('renders every status with a label', () => {
    const { rerender } = render(<StatusBadge status="AVAILABLE" />)
    expect(screen.getByText('Available')).toBeDefined()
    rerender(<StatusBadge status="UNDER_OFFER" />)
    expect(screen.getByText('Under offer')).toBeDefined()
    rerender(<StatusBadge status="RENTED" />)
    expect(screen.getByText('Rented')).toBeDefined()
  })
})

describe('money formatting', () => {
  it('uses Indian lakh/crore grouping', () => {
    // 7,25,00,000 — not 72,500,000. Instantly visible to the client, and
    // invisible to a developer who doesn't look.
    expect(formatMoney('72500000.00')).toBe('₹7,25,00,000')
  })

  it('shortens to crore and lakh', () => {
    expect(formatMoneyShort('72500000.00')).toBe('₹7.25 Cr')
    expect(formatMoneyShort('850000.00')).toBe('₹8.5 L')
    expect(formatMoneyShort('24000000.00')).toBe('₹2.4 Cr')
  })

  it('renders missing money as an em dash, never NaN or 0', () => {
    expect(formatMoney(null)).toBe('—')
    expect(formatMoney('')).toBe('—')
    expect(formatMoneyShort(undefined)).toBe('—')
  })

  it('takes strings, because Decimal does not survive a JS number', () => {
    expect(formatMoney('999999999.99')).toBe('₹1,00,00,00,000')
  })
})
