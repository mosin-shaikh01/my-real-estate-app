import { describe, expect, it } from 'vitest'
import { toSettingsDTO, type SettingsRow } from '../src/serializers/settings-serializer.js'

// The serializer is the boundary that turns a stored key into a safe, versioned
// public URL. Pin the two things that matter: assets become versioned URLs (or
// null), and nothing leaks a raw storage path.

const baseRow: SettingsRow = {
  crmName: 'Estate',
  tagline: null,
  showTagline: true,
  primaryColor: null,
  secondaryColor: null,
  logoStorageKey: null,
  faviconStorageKey: null,
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
  updatedAt: new Date('2026-07-18T00:00:00.000Z'),
}

describe('toSettingsDTO', () => {
  it('exposes null asset URLs when nothing is uploaded', () => {
    const dto = toSettingsDTO(baseRow)
    expect(dto.logoUrl).toBeNull()
    expect(dto.faviconUrl).toBeNull()
    expect(dto.crmName).toBe('Estate')
  })

  it('carries the tagline value AND its visibility flag independently', () => {
    // Hidden but not deleted — the value survives so re-enabling restores it.
    const dto = toSettingsDTO({ ...baseRow, tagline: 'Find your next home', showTagline: false })
    expect(dto.tagline).toBe('Find your next home')
    expect(dto.showTagline).toBe(false)
  })

  it('turns a stored key into a versioned URL, never a raw path', () => {
    const dto = toSettingsDTO({
      ...baseRow,
      logoStorageKey: 'settings/logo-abc.png',
      faviconStorageKey: 'settings/favicon-xyz.ico',
    })
    const v = baseRow.updatedAt.getTime()
    expect(dto.logoUrl).toBe(`/api/settings/logo?v=${v}`)
    expect(dto.faviconUrl).toBe(`/api/settings/favicon?v=${v}`)
    // The storage path must never reach the client.
    expect(JSON.stringify(dto)).not.toContain('settings/logo-abc.png')
  })

  it('the version changes when the row is updated (busts the cache)', () => {
    const a = toSettingsDTO({ ...baseRow, logoStorageKey: 'settings/l.png' })
    const b = toSettingsDTO({
      ...baseRow,
      logoStorageKey: 'settings/l.png',
      updatedAt: new Date('2026-07-19T00:00:00.000Z'),
    })
    expect(a.logoUrl).not.toBe(b.logoUrl)
  })
})
