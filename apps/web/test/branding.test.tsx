import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, waitFor } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { SettingsDTO } from '@app/shared'
import { BrandingEffects } from '@/app/branding'
import { SETTINGS_KEY } from '@/features/settings/api/use-settings'

// The favicon must be updated IN PLACE — the element from index.html is never
// removed (removing it drops the browser to its generic globe, which is what
// broke even the default), there is always exactly one icon link, and repeated
// applies (React Strict Mode) are no-ops.

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

const iconLink = () => document.querySelector<HTMLLinkElement>("link[rel~='icon']")
const iconHref = () => iconLink()?.getAttribute('href') ?? null
const iconCount = () => document.querySelectorAll("link[rel~='icon']").length

function seedDefaultLink() {
  document.head.querySelectorAll("link[rel~='icon']").forEach((l) => l.remove())
  const seed = document.createElement('link')
  seed.rel = 'icon'
  seed.setAttribute('type', 'image/svg+xml')
  seed.setAttribute('href', '/favicon.svg')
  // Tag it so we can prove the SAME element is reused, never recreated.
  seed.dataset.seed = 'index-html'
  document.head.appendChild(seed)
}

function renderWith(dto: SettingsDTO, strict = false) {
  const qc = new QueryClient()
  qc.setQueryData(SETTINGS_KEY, dto)
  const tree = (
    <QueryClientProvider client={qc}>
      <BrandingEffects />
    </QueryClientProvider>
  )
  return render(strict ? <StrictMode>{tree}</StrictMode> : tree)
}

beforeEach(seedDefaultLink)
afterEach(() => document.head.querySelectorAll("link[rel~='icon']").forEach((l) => l.remove()))

describe('BrandingEffects favicon', () => {
  it('leaves the default favicon untouched (no churn) when none is uploaded', async () => {
    renderWith({ ...base, faviconUrl: null })
    await waitFor(() => expect(iconCount()).toBe(1))
    // The index.html element is REUSED, not removed and recreated.
    expect(iconLink()?.dataset.seed).toBe('index-html')
    expect(iconHref()).toBe('/favicon.svg')
  })

  it('points the SAME link at the uploaded favicon (in place)', async () => {
    renderWith({ ...base, faviconUrl: '/api/settings/favicon?v=111' })
    await waitFor(() => expect(iconHref()).toBe('/api/settings/favicon?v=111'))
    expect(iconCount()).toBe(1)
    // Same element, href updated, and the svg type dropped so a PNG isn't
    // mislabelled.
    expect(iconLink()?.dataset.seed).toBe('index-html')
    expect(iconLink()?.hasAttribute('type')).toBe(false)
    // Never a blob:/data: reference that could go stale.
    expect(iconHref()).not.toMatch(/^(blob:|data:)/)
  })

  it('restores the default when the favicon is removed', async () => {
    renderWith({ ...base, faviconUrl: '/api/settings/favicon?v=111' })
    await waitFor(() => expect(iconHref()).toBe('/api/settings/favicon?v=111'))

    // Simulate delete: the query now reports no favicon.
    renderWith({ ...base, faviconUrl: null })
    await waitFor(() => expect(iconHref()).toBe('/favicon.svg'))
    expect(iconCount()).toBe(1)
  })

  it('is idempotent under React Strict Mode (double-invoked effects) — one link', async () => {
    renderWith({ ...base, faviconUrl: '/api/settings/favicon?v=222' }, true)
    await waitFor(() => expect(iconHref()).toBe('/api/settings/favicon?v=222'))
    expect(iconCount()).toBe(1)
    expect(iconLink()?.dataset.seed).toBe('index-html')
  })

  it('collapses accidental duplicate icon links to one', async () => {
    const dup = document.createElement('link')
    dup.rel = 'shortcut icon'
    dup.href = '/other.ico'
    document.head.appendChild(dup)
    expect(iconCount()).toBe(2)

    renderWith({ ...base, faviconUrl: null })
    await waitFor(() => expect(iconCount()).toBe(1))
    expect(iconHref()).toBe('/favicon.svg')
  })

  it('sets the document title from the CRM name', async () => {
    renderWith({ ...base, crmName: 'Acme Realty' })
    await waitFor(() => expect(document.title).toBe('Acme Realty'))
  })
})
