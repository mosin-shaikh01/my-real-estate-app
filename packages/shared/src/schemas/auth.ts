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
