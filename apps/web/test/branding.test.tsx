import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, waitFor } from '@testing-library/react'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
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
})
afterEach(() => {
  document.head.querySelectorAll("link[rel~='icon']").forEach((l) => l.remove())
})

describe('BrandingEffects favicon', () => {
  it('swaps the icon link to the uploaded favicon and back', async () => {
    const qc = new QueryClient()
    qc.setQueryData(SETTINGS_KEY, base)
    render(
      <QueryClientProvider client={qc}>
        <BrandingEffects />
      </QueryClientProvider>,
    )

    // No custom favicon → restores the bundled default (single icon link).
    await waitFor(() => expect(iconHref()).toBe('/favicon.svg'))
    expect(iconCount()).toBe(1)

    // Upload sets a versioned URL — the link must point at it.
    act(() => {
      qc.setQueryData<SettingsDTO>(SETTINGS_KEY, { ...base, faviconUrl: '/api/settings/favicon?v=111' })
    })
    await waitFor(() => expect(iconHref()).toBe('/api/settings/favicon?v=111'))
    expect(iconCount()).toBe(1) // exactly one — the stale link was removed

    // Replacing bumps the version → new URL.
    act(() => {
      qc.setQueryData<SettingsDTO>(SETTINGS_KEY, { ...base, faviconUrl: '/api/settings/favicon?v=222' })
    })
    await waitFor(() => expect(iconHref()).toBe('/api/settings/favicon?v=222'))

    // Removing it falls back to the default.
    act(() => {
      qc.setQueryData<SettingsDTO>(SETTINGS_KEY, { ...base, faviconUrl: null })
    })
    await waitFor(() => expect(iconHref()).toBe('/favicon.svg'))
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
