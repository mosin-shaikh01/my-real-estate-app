import type { SiteVisitDTO } from '@app/shared'

interface SiteVisitRow {
  id: string
  scheduledAt: Date
  status: string
  feedback: string | null
  remarks: string | null
  createdAt: Date
  property: { id: string; code: string; title: string }
  client: { id: string; code: string; fullName: string }
  agent: { id: string; fullName: string } | null
}

export function toSiteVisitDTO(row: SiteVisitRow): SiteVisitDTO {
  return {
    id: row.id,
    scheduledAt: row.scheduledAt.toISOString(),
    status: row.status,
    feedback: row.feedback,
    remarks: row.remarks,
    property: row.property,
    client: row.client,
    agent: row.agent,
    createdAt: row.createdAt.toISOString(),
  }
}
