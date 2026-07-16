import { z } from 'zod'
import {
  clientPrioritySchema,
  constructionStatusSchema,
  followUpStatusSchema,
  furnishedStatusSchema,
  interactionTypeSchema,
  listingTypeSchema,
  propertyTypeSchema,
} from '../enums.js'

const moneyString = z
  .string()
  .regex(/^\d{1,12}(\.\d{1,2})?$/, 'Enter an amount like 5000000 or 5000000.00')

const phone = z
  .string()
  .trim()
  .min(6, 'Enter a phone number')
  .max(32)
  .regex(/^[+\d][\d\s-]+$/, 'Enter a valid phone number')

// ---------------------------------------------------------------------------
// Requirement
// ---------------------------------------------------------------------------
// No `.default()` anywhere — the same lesson from properties. A partial() over a
// defaulted base leaks defaults onto every PATCH and silently rewrites fields
// the caller never sent. Optional throughout.
export const requirementSchema = z.object({
  budgetMin: moneyString.nullish(),
  budgetMax: moneyString.nullish(),
  areaMin: moneyString.nullish(),
  areaMax: moneyString.nullish(),
  propertyType: propertyTypeSchema.nullish(),
  listingType: listingTypeSchema.nullish(),
  bedrooms: z.number().int().min(0).nullish(),
  bathrooms: z.number().int().min(0).nullish(),
  parking: z.number().int().min(0).nullish(),
  furnished: furnishedStatusSchema.nullish(),
  constructionStatus: constructionStatusSchema.nullish(),
  city: z.string().trim().max(120).nullish(),
  locality: z.string().trim().max(120).nullish(),
  notes: z.string().nullish(),
  amenityIds: z.array(z.string()).optional(),
})
  // budgetMin <= budgetMax is cross-FIELD, so it belongs in the shared schema
  // where the form shows it inline. "That agent is active" is cross-TABLE and
  // stays server-side.
  .refine(
    (v) => !v.budgetMin || !v.budgetMax || Number(v.budgetMin) <= Number(v.budgetMax),
    { message: 'Minimum budget cannot exceed maximum', path: ['budgetMax'] },
  )

export type RequirementInput = z.infer<typeof requirementSchema>

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------
const clientFields = z.object({
  fullName: z.string().trim().min(2, 'Enter the client name').max(160),
  phone,
  email: z.string().trim().email('Enter a valid email').nullish().or(z.literal('')),
  whatsapp: phone.nullish().or(z.literal('')),
  priority: clientPrioritySchema.optional(),
  source: z.string().trim().max(80).nullish(),
  notes: z.string().nullish(),
  assignedAgentId: z.string().nullish(),
})

/**
 * Create is ATOMIC — client + first requirement + shortlisted properties in one
 * call.
 *
 * This is the shape the Requirement screen posts. A brand-new client has no id
 * to attach a requirement or an assignment to until it is saved, so all three
 * travel together and are written in one transaction. Everything but the
 * contact fields is optional, so a plain "add a contact" flow still works.
 *
 * `propertyIds` are the rows the admin ticked in the match results — the whole
 * point of the screen. Assigning them atomically means the client never exists
 * in a half-built state the matching view would misrender.
 */
export const clientCreateSchema = clientFields.extend({
  requirement: requirementSchema.optional(),
  propertyIds: z.array(z.string()).optional(),
})
export type ClientCreateInput = z.infer<typeof clientCreateSchema>

/** Bulk-assign to an EXISTING client. Idempotent — safe to re-send. */
export const bulkAssignSchema = z.object({
  propertyIds: z.array(z.string()).min(1, 'Select at least one property'),
})
export type BulkAssignInput = z.infer<typeof bulkAssignSchema>

/** PATCH: partial, no defaults to leak. */
export const clientUpdateSchema = clientFields.partial()
export type ClientUpdateInput = z.infer<typeof clientUpdateSchema>

// ---------------------------------------------------------------------------
// Interaction
// ---------------------------------------------------------------------------
export const interactionCreateSchema = z
  .object({
    type: interactionTypeSchema,
    body: z.string().trim().max(4000).nullish(),
    occurredAt: z.string().datetime().optional(),
    scheduledAt: z.string().datetime().nullish(),
    outcome: z.string().trim().max(160).nullish(),
    // Optionally advance the client's follow-up state in the SAME action —
    // logging a call usually means updating where the client stands.
    followUpStatus: followUpStatusSchema.optional(),
    nextFollowUp: z.string().datetime().nullish(),
  })
  .refine((v) => v.body || v.outcome || v.scheduledAt, {
    message: 'Add a note, an outcome, or a scheduled time',
    path: ['body'],
  })

export type InteractionCreateInput = z.infer<typeof interactionCreateSchema>

export const assignAgentSchema = z.object({
  agentId: z.string().nullable(),
})
