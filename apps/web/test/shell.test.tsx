import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { AppShell } from '@/components/layout/AppShell'
import { StatusBadge } from '@/components/ui/StatusBadge'
import DashboardPage from '@/features/dashboard/pages/DashboardPage'
import { formatMoney, formatMoneyShort } from '@/lib/format'

// A smoke test, not a suite. It answers the one question a passing build
// cannot: does the app actually mount, or does it white-screen? Everything
// below would be caught only by opening a browser otherwise.

function renderAt(path: string) {
  const router = createMemoryRouter(
    [{ element: <AppShell />, children: [{ index: true, element: <DashboardPage /> }] }],
    { initialEntries: [path] },
  )
  return render(<RouterProvider router={router} />)
}

describe('app shell', () => {
  it('mounts and renders the dashboard inside the shell', () => {
    renderAt('/')
    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeDefined()
  })

  it('renders one navigation, shared by admin and agent', () => {
    renderAt('/')
    const navs = screen.getAllByRole('navigation', { name: 'Main' })
    // Two route trees would mean two navs. There is deliberately one.
    expect(navs).toHaveLength(1)
    expect(within(navs[0]!).getByRole('link', { name: /Properties/ })).toBeDefined()
  })

  it('exposes the mobile nav trigger with an accessible name', async () => {
    renderAt('/')
    const trigger = screen.getByRole('button', { name: 'Open navigation' })
    await userEvent.click(trigger)
    expect(screen.getByRole('button', { name: 'Close navigation' })).toBeDefined()
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
    // 7,25,00,000 — not 72,500,000. Getting this wrong is instantly visible
    // to the client and invisible to a developer who doesn't look.
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
    // ₹99,99,99,999.99 — the value Int-paise and Float both mangle.
    expect(formatMoney('999999999.99')).toBe('₹1,00,00,00,000')
  })
})
