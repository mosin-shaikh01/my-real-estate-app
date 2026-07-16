import { z } from 'zod'

// ---------------------------------------------------------------------------
// CRM settings (the AppSetting singleton)
// ---------------------------------------------------------------------------
// Branding, company info, address, social links and business copy. Shape and
// format only; the server normalises empty strings to NULL and owns the single
// row. Logo/favicon are NOT here — they are multipart uploads with their own
// endpoints.

// Optional text: accept a trimmed value or the empty string (a cleared field).
const text = (max: number) => z.string().trim().max(max).optional().or(z.literal(''))
// Optional URL: a valid URL or empty. Blanking a link must not be a 400.
const url = (msg = 'Enter a valid URL') =>
  z.string().trim().url(msg).optional().or(z.literal(''))
// Loose phone: digits, spaces, +, -, (). Empty allowed.
const phone = z
  .string()
  .trim()
  .max(40)
  .regex(/^[+\d][\d\s()-]*$/, 'Enter a valid number')
  .optional()
  .or(z.literal(''))
// CSS color: #RGB, #RRGGBB, or #RRGGBBAA. Empty clears it.
const color = z
  .string()
  .trim()
  .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/, 'Use a hex colour like #4f46e5')
  .optional()
  .or(z.literal(''))

export const settingsUpdateSchema = z.object({
  // Branding
  crmName: z.string().trim().min(1, 'A name is required').max(120).optional(),
  tagline: text(200),
  primaryColor: color,
  secondaryColor: color,

  // Company information
  companyName: text(200),
  ownerName: text(200),
  email: z.string().trim().email('Enter a valid email').max(255).optional().or(z.literal('')),
  phone,
  mobile: phone,
  website: url(),
  gstNumber: text(64),
  registrationNumber: text(64),

  // Office address
  addressLine1: text(255),
  addressLine2: text(255),
  city: text(120),
  state: text(120),
  country: text(120),
  pincode: text(20),
  googleMapUrl: url('Enter a valid Google Maps link'),

  // Social media
  facebookUrl: url(),
  instagramUrl: url(),
  linkedinUrl: url(),
  youtubeUrl: url(),
  twitterUrl: url(),
  whatsappNumber: phone,

  // Business information
  businessHours: text(255),
  description: text(4000),
  about: text(8000),
  mission: text(4000),
  vision: text(4000),
})

export type SettingsUpdateInput = z.infer<typeof settingsUpdateSchema>

/** The editable keys, in section order — the client renders forms from this and
 *  the server whitelists writes against it. */
export type SettingsField = keyof SettingsUpdateInput

export interface SettingsDTO {
  crmName: string
  tagline: string | null
  primaryColor: string | null
  secondaryColor: string | null
  /** Versioned URLs (or null). The version busts the browser cache after a
   *  logo/favicon replacement. Served from the public streaming routes. */
  logoUrl: string | null
  faviconUrl: string | null

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
}

/** Which branding asset an upload/delete targets. */
export const brandingAssetSchema = z.enum(['logo', 'favicon'])
export type BrandingAsset = z.infer<typeof brandingAssetSchema>
