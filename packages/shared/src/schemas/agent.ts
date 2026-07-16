import { z } from 'zod'
import { userStatusSchema } from '../enums.js'

const phone = z
  .string()
  .trim()
  .max(32)
  .regex(/^[+\d][\d\s-]*$/, 'Enter a valid phone number')
  .nullish()
  .or(z.literal(''))

// commissionRate is a PERCENT (e.g. "2.50"), not an amount, and not per-deal —
// it's the agent's default rate, snapshotted onto a Deal at close.
const rate = z
  .string()
  .regex(/^\d{1,2}(\.\d{1,2})?$/, 'Enter a rate like 2.5')
  .nullish()
  .or(z.literal(''))

const agentFields = z.object({
  fullName: z.string().trim().min(2, 'Enter the agent name').max(160),
  email: z.string().trim().email('Enter a valid email').max(255),
  phone,
  address: z.string().trim().max(500).nullish(),
  experienceYears: z.number().int().min(0).max(70).nullish(),
  specialization: z.string().trim().max(120).nullish(),
  commissionRate: rate,
})

/**
 * Creating an agent creates a User (the auth identity) AND an AgentProfile in
 * one transaction, plus the agent role. The two are separate tables because
 * User is the RBAC subject and AgentProfile is its optional extension — see
 * docs/DATABASE.md. A temporary password is set; the agent resets it via the
 * forgot-password flow.
 */
export const agentCreateSchema = agentFields.extend({
  temporaryPassword: z.string().min(10, 'Use at least 10 characters'),
})
export type AgentCreateInput = z.infer<typeof agentCreateSchema>

export const agentUpdateSchema = agentFields.partial()
export type AgentUpdateInput = z.infer<typeof agentUpdateSchema>

export const agentStatusSchema = z.object({
  status: userStatusSchema,
})

// ---------------------------------------------------------------------------
// Per-agent access overrides
// ---------------------------------------------------------------------------
// effective = (rolePermissions ∪ ALLOWs) \ DENYs. The client sends only the
// OVERRIDES — permissions where the desired state differs from what the role
// grants. An ALLOW opens a permission the role withholds; a DENY closes one the
// role grants. No override means "follow the role", so the set stays minimal
// and a later change to the role still flows through.
export const agentPermissionsSchema = z.object({
  overrides: z
    .array(
      z.object({
        key: z.string().min(1),
        effect: z.enum(['ALLOW', 'DENY']),
      }),
    )
    .max(200),
})
export type AgentPermissionsInput = z.infer<typeof agentPermissionsSchema>

export interface AgentPermissionsResponse {
  /** What the agent's roles grant, before overrides. */
  rolePermissionKeys: string[]
  /** The stored overrides. */
  overrides: Array<{ key: string; effect: 'ALLOW' | 'DENY' }>
  /** The net result the server actually enforces. */
  effectivePermissionKeys: string[]
}
