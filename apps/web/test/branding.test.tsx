import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SettingsDTO } from '@app/shared'
import { BrandingEffects } from '@/app/branding'
import { SETTINGS_KEY } from '@/features/settings/api/use-settings'

// Does BrandingEffects actually swap the <link rel="icon"> when the settings
// favicon changes? This isolates "code applied it" from "the browser refused to
// repaint the tab" (a browser-level favicon-cache quirk we can't test).

const base: SettingsDTO = {
  crmName: 'Estate',
  tagline: null,
  primaryColor: null,
  secondaryColor: null,
  logoUrl: null,
  faviconUrl: null,
  companyName: null,
  ownerName: null,
  email: null,
  phone: null,
  mobile: null,
  website: null,
  gstNumber: null,
  registrationNumber: null,
  addressLine1: null,
  addressLine2: null,
  city: null,
  state: null,
  country: null,
  pincode: null,
  googleMapUrl: null,
  facebookUrl: null,
  instagramUrl: null,
  linkedinUrl: null,
  youtubeUrl: null,
  twitterUrl: null,
  whatsappNumber: null,
  businessHours: null,
  description: null,
  about: null,
  mission: null,
  vision: null,
}

const iconHref = () =>
  document.querySelector<HTMLLinkElement>("link[rel~='icon']")?.getAttribute('href') ?? null
const iconCount = () => document.querySelectorAll("link[rel~='icon']").length

beforeEach(() => {
  document.head.querySelectorAll("link[rel~='icon']").forEach((l) => l.remove())
  const seed = document.createElement('link')
  seed.rel = 'icon'
  seed.setAttribute('type', 'image/svg+xml')
  seed.href = '/favicon.svg'
  document.head.appendChild(seed)
  // The provider fetches the favicon bytes and inlines them as a data: URL.
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }))),
  )
})
afterEach(() => {
  vi.unstubAllGlobals()
  document.head.querySelectorAll("link[rel~='icon']").forEach((l) => l.remove())
})

describe('BrandingEffects favicon', () => {
  it('inlines an uploaded favicon as a data URL — one link, never a dead reference', async () => {
    const qc = new QueryClient()
    qc.setQueryData<SettingsDTO>(SETTINGS_KEY, { ...base, faviconUrl: '/api/settings/favicon?v=111' })
    render(
      <QueryClientProvider client={qc}>
        <BrandingEffects />
      </QueryClientProvider>,
    )

    // The link is a self-contained data: URL of the fetched bytes — not a blob:
    // (revocable → the browser's generic globe) and not left stale.
    await waitFor(() => expect(iconHref()).toMatch(/^data:/))
    expect(iconHref()).not.toMatch(/^blob:/)
    await waitFor(() => expect(iconCount()).toBe(1))
  })

  it('restores the bundled default when no favicon is set', async () => {
    const qc = new QueryClient()
    qc.setQueryData<SettingsDTO>(SETTINGS_KEY, { ...base, faviconUrl: null })
    render(
      <QueryClientProvider client={qc}>
        <BrandingEffects />
      </QueryClientProvider>,
    )
    await waitFor(() => expect(iconHref()).toBe('/favicon.svg'))
    expect(iconCount()).toBe(1)
  })

  it('sets the document title from the CRM name', async () => {
    const qc = new QueryClient()
    qc.setQueryData(SETTINGS_KEY, { ...base, crmName: 'Acme Realty' })
    render(
      <QueryClientProvider client={qc}>
        <BrandingEffects />
      </QueryClientProvider>,
    )
    await waitFor(() => expect(document.title).toBe('Acme Realty'))
  })
})
