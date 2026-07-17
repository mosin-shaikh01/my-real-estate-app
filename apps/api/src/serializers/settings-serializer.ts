import type { SettingsDTO } from '@app/shared'

// A row shape loose enough to accept the Prisma model without importing it here.
export interface SettingsRow {
  crmName: string
  tagline: string | null
  showTagline: boolean
  primaryColor: string | null
  secondaryColor: string | null
  logoStorageKey: string | null
  faviconStorageKey: string | null
  companyName: string | null
  ownerName: string | null
  email: string | null
  phone: string | null
  mobile: string | null
  website: string | null
  gstNumber: string | null
  registrationNumber: string | null
  addressLine1: string | null
  addressLine2: string | null
  city: string | null
  state: string | null
  country: string | null
  pincode: string | null
  googleMapUrl: string | null
  facebookUrl: string | null
  instagramUrl: string | null
  linkedinUrl: string | null
  youtubeUrl: string | null
  twitterUrl: string | null
  whatsappNumber: string | null
  businessHours: string | null
  description: string | null
  about: string | null
  mission: string | null
  vision: string | null
  updatedAt: Date
}

// Public DTO. Settings are branding + company contact info shown on the login
// screen and across the app, so nothing here is redacted. Logo/favicon are
// exposed as VERSIONED URLs — the `?v=` (the row's updatedAt) busts the browser
// cache the instant an admin replaces an asset, and it is null when unset so the
// UI knows to fall back to the name/monogram.
export function toSettingsDTO(row: SettingsRow): SettingsDTO {
  const v = row.updatedAt.getTime()
  return {
    crmName: row.crmName,
    tagline: row.tagline,
    showTagline: row.showTagline,
    primaryColor: row.primaryColor,
    secondaryColor: row.secondaryColor,
    logoUrl: row.logoStorageKey ? `/api/settings/logo?v=${v}` : null,
    faviconUrl: row.faviconStorageKey ? `/api/settings/favicon?v=${v}` : null,

    companyName: row.companyName,
    ownerName: row.ownerName,
    email: row.email,
    phone: row.phone,
    mobile: row.mobile,
    website: row.website,
    gstNumber: row.gstNumber,
    registrationNumber: row.registrationNumber,

    addressLine1: row.addressLine1,
    addressLine2: row.addressLine2,
    city: row.city,
    state: row.state,
    country: row.country,
    pincode: row.pincode,
    googleMapUrl: row.googleMapUrl,

    facebookUrl: row.facebookUrl,
    instagramUrl: row.instagramUrl,
    linkedinUrl: row.linkedinUrl,
    youtubeUrl: row.youtubeUrl,
    twitterUrl: row.twitterUrl,
    whatsappNumber: row.whatsappNumber,

    businessHours: row.businessHours,
    description: row.description,
    about: row.about,
    mission: row.mission,
    vision: row.vision,
  }
}
