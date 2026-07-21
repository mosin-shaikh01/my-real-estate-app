import type { DealDTO } from '@app/shared'

// Deals are an admin-only surface (deal.list) — no scope, no per-field
// redaction: the route guard is the whole gate, exactly like owners/agents.

type Decimalish = { toFixed: (d: number) => string } | null
const money = (d: Decimalish): string | null => (d == null ? null : d.toFixed(2))

export interface DealRow {
  id: string
  dealType: string
  closedAt: Date
  closedPrice: Decimalish
  commissionRate: Decimalish
  commissionAmount: Decimalish
  notes: string | null
  createdAt: Date
  property: { id: string; code: string; title: string }
  client: { id: string; code: string; fullName: string }
  agent: { id: string; fullName: string } | null
}

export function toDealDTO(row: DealRow): DealDTO {
  return {
    id: row.id,
    dealType: row.dealType,
    closedAt: row.closedAt.toISOString(),
    // closedPrice is non-null in the DB; money() keeps the string contract.
    closedPrice: money(row.closedPrice) ?? '0.00',
    commissionRate: money(row.commissionRate),
    commissionAmount: money(row.commissionAmount),
    notes: row.notes,
    property: row.property,
    client: row.client,
    agent: row.agent,
    createdAt: row.createdAt.toISOString(),
  }
}
