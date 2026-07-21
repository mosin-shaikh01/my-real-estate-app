// Report response shapes. Admin-only (report.view); no scope resolver — the
// route guard is the whole gate. All money is a string (Decimal never survives
// JSON as a number). These are read models, so no Zod — just the wire types,
// shared so the API serializer and the web page can't drift.

export interface AgentPerformanceRow {
  agentId: string
  agentName: string
  agentCode: string | null
  dealsClosed: number
  revenue: string
  commission: string
  activeClients: number
  activeProperties: number
}

export interface ClientConversion {
  totalClients: number
  withAssignments: number
  converted: number
  /** Percentage 0–100, one decimal. */
  conversionRate: number
}

export interface PropertySalesRow {
  propertyType: string
  dealsClosed: number
  revenue: string
}

export interface InventoryReport {
  total: number
  byStatus: Array<{ status: string; count: number }>
  byType: Array<{ propertyType: string; count: number }>
}

export interface FollowUpStatusRow {
  status: string
  count: number
}

export interface MonthlyRevenueRow {
  /** 'YYYY-MM'. */
  month: string
  dealsClosed: number
  revenue: string
}

export interface ReportsBundle {
  agentPerformance: AgentPerformanceRow[]
  clientConversion: ClientConversion
  propertySales: PropertySalesRow[]
  inventory: InventoryReport
  followUpStatus: FollowUpStatusRow[]
  monthlyRevenue: MonthlyRevenueRow[]
}

/** The exportable reports — the `:report` path segment for CSV export. */
export const EXPORTABLE_REPORTS = [
  'agent-performance',
  'property-sales',
  'follow-up-status',
  'monthly-revenue',
] as const
export type ExportableReport = (typeof EXPORTABLE_REPORTS)[number]
