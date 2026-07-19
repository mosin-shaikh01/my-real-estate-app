import { z } from 'zod'

// Property Owner (master) — the reusable seller record. Shape/format only; the
// server adds duplicate detection (a warning, never a block) on top.

const mobile = z
  .string()
  .trim()
  .min(1, 'Mobile number is required')
  .max(32)
  .regex(/^[+\d][\d\s-]*$/, 'Enter a valid mobile number')

const optMobile = z
  .string()
  .trim()
  .max(32)
  .regex(/^[+\d][\d\s-]*$/, 'Enter a valid mobile number')
  .nullish()
  .or(z.literal(''))

const optEmail = z.string().trim().email('Enter a valid email').max(255).nullish().or(z.literal(''))

const ownerFields = z.object({
  fullName: z.string().trim().min(2, 'Enter the owner name').max(160),
  mobile,
  altMobile: optMobile,
  email: optEmail,
  address: z.string().trim().max(500).nullish().or(z.literal('')),
  city: z.string().trim().max(120).nullish().or(z.literal('')),
  // PAN/Aadhaar are optional and lightly validated — kept permissive so valid
  // but differently-formatted values are never blocked (tighten later if needed).
  pan: z.string().trim().max(16).nullish().or(z.literal('')),
  aadhaar: z.string().trim().max(20).nullish().or(z.literal('')),
  notes: z.string().trim().max(2000).nullish().or(z.literal('')),
})

export const ownerCreateSchema = ownerFields
export type OwnerCreateInput = z.infer<typeof ownerCreateSchema>

export const ownerUpdateSchema = ownerFields.partial()
export type OwnerUpdateInput = z.infer<typeof ownerUpdateSchema>

export interface OwnerDTO {
  id: string
  code: string
  fullName: string
  mobile: string
  altMobile: string | null
  email: string | null
  address: string | null
  city: string | null
  pan: string | null
  aadhaar: string | null
  notes: string | null
  propertyCount: number
  createdAt: string
  updatedAt: string
}

/** Row shape for the owners list. */
export interface OwnerListItem {
  id: string
  code: string
  fullName: string
  mobile: string
  city: string | null
  propertyCount: number
  createdAt: string
}

/** Compact option for the property form's owner picker. */
export interface OwnerOption {
  id: string
  code: string
  fullName: string
  mobile: string
}

/** Duplicate-detection result — a warning surfaced before save, never a block. */
export interface OwnerDuplicate {
  id: string
  code: string
  fullName: string
  mobile: string
}
