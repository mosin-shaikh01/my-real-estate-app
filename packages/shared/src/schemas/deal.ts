import { z } from 'zod'
import { dealTypeSchema } from '../enums.js'

// A closed transaction — the row every transactional report is computed from.
// Shape/format only; the server verifies the property/client/agent exist and
// snapshots the agent's commission rate at close (rates change, history must not).

// Money as a string end to end (Decimal never survives JSON as a number). A
// plain positive-decimal check; the DB column is Decimal(14,2).
const money = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, 'Enter an amount like 4500000 or 4500000.00')

// Accept a date-only value ("2026-07-21") or a full ISO string; the server
// parses with new Date(). Empty is rejected.
const dateString = z
  .string()
  .refine((v) => v.length > 0 && !Number.isNaN(Date.parse(v)), 'Pick the closing date')

export const dealCreateSchema = z.object({
  propertyId: z.string().min(1, 'Select a property'),
  clientId: z.string().min(1, 'Select a client'),
  agentId: z.string().nullish(),
  dealType: dealTypeSchema,
  closedAt: dateString,
  closedPrice: money,
  notes: z.string().trim().max(2000).nullish().or(z.literal('')),
})
export type DealCreateInput = z.infer<typeof dealCreateSchema>

export const dealListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  dealType: dealTypeSchema.optional(),
  agentId: z.string().optional(),
})
export type DealListQuery = z.infer<typeof dealListQuerySchema>

export interface DealDTO {
  id: string
  dealType: string
  closedAt: string
  closedPrice: string
  commissionRate: string | null
  commissionAmount: string | null
  notes: string | null
  property: { id: string; code: string; title: string }
  client: { id: string; code: string; fullName: string }
  agent: { id: string; fullName: string } | null
  createdAt: string
}
