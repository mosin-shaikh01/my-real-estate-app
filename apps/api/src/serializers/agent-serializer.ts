import type { Actor } from '../auth/permissions.js'

// Agent = User + AgentProfile flattened for the wire. commissionRate is gated by
// agent.commission.view: aggregated or not, a rate an actor may not see must not
// appear, and its absence (not a zero) is what the UI renders as locked.

type Decimalish = { toFixed: (d: number) => string } | null
const money = (d: Decimalish): string | null => (d == null ? null : d.toFixed(2))

export interface AgentRow {
  id: string
  fullName: string
  email: string
  phone: string | null
  status: string
  createdAt: Date
  agentProfile: {
    address: string | null
    experienceYears: number | null
    specialization: string | null
    commissionRate: Decimalish
    photoStorageKey: string | null
  } | null
  _count?: { assignedClients: number; assignedProperties: number }
}

export interface AgentDTO {
  id: string
  fullName: string
  email: string
  phone: string | null
  status: string
  createdAt: string
  address: string | null
  experienceYears: number | null
  specialization: string | null
  assignedClientCount: number
  assignedPropertyCount: number

  commissionRate?: string | null
  _redacted: string[]
}

export function toAgentDTO(row: AgentRow, actor: Actor): AgentDTO {
  const redacted: string[] = []
  const p = row.agentProfile

  const dto: AgentDTO = {
    id: row.id,
    fullName: row.fullName,
    email: row.email,
    phone: row.phone,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    address: p?.address ?? null,
    experienceYears: p?.experienceYears ?? null,
    specialization: p?.specialization ?? null,
    assignedClientCount: row._count?.assignedClients ?? 0,
    assignedPropertyCount: row._count?.assignedProperties ?? 0,
    _redacted: redacted,
  }

  if (actor.has('agent.commission.view')) {
    dto.commissionRate = money(p?.commissionRate ?? null)
  } else {
    redacted.push('commissionRate')
  }

  return dto
}
