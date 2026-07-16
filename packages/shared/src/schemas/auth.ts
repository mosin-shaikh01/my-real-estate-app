import { z } from 'zod'

// Shared: shape, format, coercion. The server ADDS a refinement layer for what
// needs the database (uniqueness, cross-field DB rules). One schema does not do
// both — pretending otherwise is how you end up with client-only validation.

export const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
})
export type LoginInput = z.infer<typeof loginSchema>

export const forgotPasswordSchema = z.object({
  email: z.string().email('Enter a valid email'),
})

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(10, 'Use at least 10 characters'),
})

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: z.string().min(10, 'Use at least 10 characters'),
    confirmPassword: z.string().min(1, 'Confirm your new password'),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export interface MeResponse {
  user: {
    id: string
    email: string
    fullName: string
    phone: string | null
  }
  roles: Array<{ slug: string; name: string }>
  /** Effective permission keys. What <Can> and usePermissions() read. */
  permissions: string[]
}

// ---------------------------------------------------------------------------
// Self-service profile
// ---------------------------------------------------------------------------
// Any authenticated user manages their OWN identity here — no special
// permission, the same "you may act on yourself" footing as /auth/me.
const profilePhone = z
  .string()
  .trim()
  .max(32)
  .regex(/^[+\d][\d\s-]*$/, 'Enter a valid phone number')
  .nullish()
  .or(z.literal(''))

export const profileUpdateSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter your name').max(160).optional(),
  email: z.string().trim().email('Enter a valid email').max(255).optional(),
  phone: profilePhone,
  // Agent-only descriptive fields; the server ignores them for non-agents.
  // Commission is deliberately NOT here — it is an admin-set financial field,
  // not something an agent edits about themselves.
  specialization: z.string().trim().max(120).nullish(),
  experienceYears: z.number().int().min(0).max(70).nullish(),
  address: z.string().trim().max(500).nullish(),
})
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>

export interface ProfileResponse {
  id: string
  fullName: string
  email: string
  phone: string | null
  roles: Array<{ slug: string; name: string }>
  /** Present only for agents. */
  agent: {
    code: string
    specialization: string | null
    experienceYears: number | null
    address: string | null
    /** Read-only here — shown for reference, edited by an admin. */
    commissionRate: string | null
  } | null
}
