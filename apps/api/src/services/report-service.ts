import type {
  AgentPerformanceRow,
  ClientConversion,
  FollowUpStatusRow,
  InventoryReport,
  MonthlyRevenueRow,
  PropertySalesRow,
  ReportsBundle,
} from '@app/shared'
import { prisma } from '../lib/prisma.js'

// Reports — an admin-only surface (report.view). No scope resolver: agents hold
// no report permission, so the route guard is the whole gate. Every figure is a
// string on the wire (Decimal never survives JSON as a number).

type Decimalish = { toFixed: (d: number) => string } | null | undefined
const money = (d: Decimalish): string => (d == null ? '0.00' : d.toFixed(2))
const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

// Agent performance — every active agent with their closed-deal totals. Starts
// from the agent list (not the deals) so a zero-deal agent still appears.
export async function agentPerformance(): Promise<AgentPerformanceRow[]> {
  const [agents, dealStats] = await Promise.all([
    prisma.user.findMany({
      where: { deletedAt: null, agentProfile: { isNot: null } },
      select: {
        id: true,
        fullName: true,
        agentProfile: { select: { code: true } },
        _count: {
          select: {
            assignedClients: { where: { deletedAt: null } },
            assignedProperties: { where: { deletedAt: null } },
          },
        },
      },
      orderBy: { fullName: 'asc' },
    }),
    prisma.deal.groupBy({
      by: ['agentId'],
      _count: { _all: true },
      _sum: { closedPrice: true, commissionAmount: true },
    }),
  ])

  const byAgent = new Map(dealStats.map((d) => [d.agentId, d]))
  return agents.map((a) => {
    const s = byAgent.get(a.id)
    return {
      agentId: a.id,
      agentName: a.fullName,
      agentCode: a.agentProfile?.code ?? null,
      dealsClosed: s?._count._all ?? 0,
      revenue: money(s?._sum.closedPrice),
      commission: money(s?._sum.commissionAmount),
      activeClients: a._count.assignedClients,
      activeProperties: a._count.assignedProperties,
    }
  })
}

// Client conversion — the funnel from a captured client to a closed deal.
export async function clientConversion(): Promise<ClientConversion> {
  const [totalClients, withAssignments, converted] = await Promise.all([
    prisma.client.count({ where: { deletedAt: null } }),
    prisma.client.count({ where: { deletedAt: null, assignments: { some: { removedAt: null } } } }),
    prisma.client.count({ where: { deletedAt: null, deals: { some: {} } } }),
  ])
  const conversionRate = totalClients ? Math.round((converted / totalClients) * 1000) / 10 : 0
  return { totalClients, withAssignments, converted, conversionRate }
}

// Property sales — closed deals by property type. propertyType lives on the
// joined property, so aggregate in memory rather than a groupBy.
export async function propertySales(): Promise<PropertySalesRow[]> {
  const deals = await prisma.deal.findMany({
    select: { closedPrice: true, property: { select: { propertyType: true } } },
  })
  const map = new Map<string, { count: number; revenue: number }>()
  for (const d of deals) {
    const t = d.property.propertyType
    const cur = map.get(t) ?? { count: 0, revenue: 0 }
    cur.count += 1
    cur.revenue += Number(d.closedPrice)
    map.set(t, cur)
  }
  return [...map.entries()]
    .map(([propertyType, v]) => ({ propertyType, dealsClosed: v.count, revenue: v.revenue.toFixed(2) }))
    .sort((a, b) => Number(b.revenue) - Number(a.revenue))
}

// Inventory — live property counts by status and by type (active rows only).
export async function inventory(): Promise<InventoryReport> {
  const [byStatus, byType, total] = await Promise.all([
    prisma.property.groupBy({ by: ['status'], where: { deletedAt: null }, _count: { _all: true } }),
    prisma.property.groupBy({ by: ['propertyType'], where: { deletedAt: null }, _count: { _all: true } }),
    prisma.property.count({ where: { deletedAt: null } }),
  ])
  return {
    total,
    byStatus: byStatus
      .map((r) => ({ status: r.status, count: r._count._all }))
      .sort((a, b) => b.count - a.count),
    byType: byType
      .map((r) => ({ propertyType: r.propertyType, count: r._count._all }))
      .sort((a, b) => b.count - a.count),
  }
}

// Follow-up status — client pipeline distribution.
export async function followUpStatus(): Promise<FollowUpStatusRow[]> {
  const rows = await prisma.client.groupBy({
    by: ['followUpStatus'],
    where: { deletedAt: null },
    _count: { _all: true },
  })
  return rows
    .map((r) => ({ status: r.followUpStatus, count: r._count._all }))
    .sort((a, b) => b.count - a.count)
}

// Monthly revenue — the last `months` months of closed-deal value. All months
// are pre-seeded so a gap renders as zero rather than vanishing from the chart.
export async function monthlyRevenue(months = 12): Promise<MonthlyRevenueRow[]> {
  const since = new Date()
  since.setDate(1)
  since.setHours(0, 0, 0, 0)
  since.setMonth(since.getMonth() - (months - 1))

  const deals = await prisma.deal.findMany({
    where: { closedAt: { gte: since } },
    select: { closedAt: true, closedPrice: true },
  })

  const buckets = new Map<string, { count: number; revenue: number }>()
  const cursor = new Date(since)
  for (let i = 0; i < months; i++) {
    buckets.set(monthKey(cursor), { count: 0, revenue: 0 })
    cursor.setMonth(cursor.getMonth() + 1)
  }
  for (const d of deals) {
    const b = buckets.get(monthKey(d.closedAt))
    if (b) {
      b.count += 1
      b.revenue += Number(d.closedPrice)
    }
  }
  return [...buckets.entries()].map(([month, v]) => ({
    month,
    dealsClosed: v.count,
    revenue: v.revenue.toFixed(2),
  }))
}

export async function reportsBundle(): Promise<ReportsBundle> {
  const [ap, cc, ps, inv, fu, mr] = await Promise.all([
    agentPerformance(),
    clientConversion(),
    propertySales(),
    inventory(),
    followUpStatus(),
    monthlyRevenue(),
  ])
  return {
    agentPerformance: ap,
    clientConversion: cc,
    propertySales: ps,
    inventory: inv,
    followUpStatus: fu,
    monthlyRevenue: mr,
  }
}
