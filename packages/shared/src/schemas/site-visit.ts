import { z } from 'zod'
import { siteVisitStatusSchema } from '../enums.js'

// A scheduled property visit for a client. Shape/format only; the server checks
// that the property/client/agent exist and are in the actor's scope.

// Accept anything Date can parse — both a browser <input type="datetime-local">
// value ("2026-07-19T19:37", no timezone) AND a full ISO string. The client
// normalises to ISO before sending; the server parses with new Date(). Using
// z.string().datetime() here rejected the datetime-local value and blocked the
// form before it could convert.
const dateTimeString = z
  .string()
  .refine((v) => v.length > 0 && !Number.isNaN(Date.parse(v)), 'Pick a date and time')

export const siteVisitCreateSchema = z.object({
  propertyId: z.string().min(1, 'Select a property'),
  clientId: z.string().min(1, 'Select a client'),
  agentId: z.string().nullish(),
  scheduledAt: dateTimeString,
  remarks: z.string().trim().max(2000).nullish().or(z.literal('')),
})
export type SiteVisitCreateInput = z.infer<typeof siteVisitCreateSchema>

export const siteVisitUpdateSchema = z.object({
  status: siteVisitStatusSchema.optional(),
  scheduledAt: dateTimeString.optional(),
  agentId: z.string().nullish(),
  feedback: z.string().trim().max(2000).nullish().or(z.literal('')),
  remarks: z.string().trim().max(2000).nullish().or(z.literal('')),
})
export type SiteVisitUpdateInput = z.infer<typeof siteVisitUpdateSchema>

export const siteVisitListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  status: siteVisitStatusSchema.optional(),
  clientId: z.string().optional(),
  propertyId: z.string().optional(),
  /** Inclusive date window on scheduledAt. */
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  sort: z.string().optional(),
})
export type SiteVisitListQuery = z.infer<typeof siteVisitListQuerySchema>

export interface SiteVisitDTO {
  id: string
  scheduledAt: string
  status: string
  feedback: string | null
  remarks: string | null
  property: { id: string; code: string; title: string }
  client: { id: string; code: string; fullName: string }
  agent: { id: string; fullName: string } | null
  createdAt: string
}
