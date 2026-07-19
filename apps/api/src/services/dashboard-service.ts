import type { Actor } from '../auth/permissions.js'
import { scopeForClient, scopeForProperty } from '../auth/scope.js'
import { prisma } from '../lib/prisma.js'
import { scopeForSiteVisit } from './sitevisit-service.js'

// ============================================================================
// Dashboard
// ============================================================================
// Every count runs through the SAME scope resolver as the list endpoints. That
// is not a nicety: a tile reading "6 properties" next to a list showing 4 makes
// an agent think the app is broken — or worse, tells them how much inventory
// exists that they cannot see. A dashboard is a query surface like any other.
// ============================================================================

export interface DashboardSummary {
  activeProperties: number
  totalProperties: number
  reservedProperties: number
  soldProperties: number
  rentedProperties: number
  totalClients: number
  importantLeads: number
  totalAgents: number | null
  followUpsDue: number
  todaySiteVisits: number | null
  upcomingSiteVisits: number | null
  commissionEarned: string | null
  recentActivity: Array<{
    id: string
    action: string
    summary: string
    createdAt: string
    actorName: string | null
  }>
}

export async function getDashboard(actor: Actor): Promise<DashboardSummary> {
  const propertyScope = scopeForProperty(actor)
  const clientScope = scopeForClient(actor)

  // "Active" is DEFINED, not vibes: AVAILABLE and not archived and not deleted.
  // The definition lives in CLAUDE.md because the tile was ambiguous otherwise.
  const activeWhere = { ...propertyScope, status: 'AVAILABLE' as const, archivedAt: null }

  // Today's window for site-visit tiles (local server day).
  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const endOfDay = new Date(startOfDay.getTime() + 86_400_000)
  const visitScope = scopeForSiteVisit(actor)
  const canSeeVisits = actor.has('sitevisit.list')

  const [
    activeProperties,
    totalProperties,
    reservedProperties,
    soldProperties,
    rentedProperties,
    totalClients,
    importantLeads,
    totalAgents,
    followUpsDue,
    todaySiteVisits,
    upcomingSiteVisits,
    deals,
    recent,
  ] = await Promise.all([
    prisma.property.count({ where: activeWhere }),
    prisma.property.count({ where: { ...propertyScope, archivedAt: null } }),
    prisma.property.count({ where: { ...propertyScope, status: 'RESERVED' } }),
    prisma.property.count({ where: { ...propertyScope, status: 'SOLD' } }),
    prisma.property.count({ where: { ...propertyScope, status: 'RENTED' } }),
    prisma.client.count({ where: clientScope }),
    prisma.client.count({ where: { ...clientScope, importantLead: true } }),

    // Agent headcount is admin-only information. An agent has no agent.list
    // permission, and a tile is not an exemption — null means "not for you",
    // and the UI omits the card rather than rendering a zero that reads as
    // "there are no agents".
    actor.has('agent.list')
      ? prisma.user.count({ where: { deletedAt: null, agentProfile: { isNot: null } } })
      : Promise.resolve(null),

    prisma.client.count({
      where: {
        ...clientScope,
        nextFollowUp: { lte: new Date() },
        followUpStatus: { notIn: ['CONVERTED', 'LOST'] },
      },
    }),

    // Site-visit tiles are omitted (null) for an actor without sitevisit.list —
    // a zero would read as "no visits" rather than "not your information".
    canSeeVisits
      ? prisma.siteVisit.count({
          where: { ...visitScope, scheduledAt: { gte: startOfDay, lt: endOfDay } },
        })
      : Promise.resolve(null),
    canSeeVisits
      ? prisma.siteVisit.count({
          where: { ...visitScope, status: 'SCHEDULED', scheduledAt: { gte: endOfDay } },
        })
      : Promise.resolve(null),

    // Commission is gated by agent.commission.view. Aggregating it for someone
    // who cannot see the rate would leak it in totalled form.
    actor.has('agent.commission.view')
      ? prisma.deal.aggregate({ _sum: { commissionAmount: true } })
      : Promise.resolve(null),

    actor.has('activity.list')
      ? prisma.activityLog.findMany({
          take: 8,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            action: true,
            summary: true,
            createdAt: true,
            actor: { select: { fullName: true } },
          },
        })
      : Promise.resolve([]),
  ])

  return {
    activeProperties,
    totalProperties,
    reservedProperties,
    soldProperties,
    rentedProperties,
    totalClients,
    importantLeads,
    totalAgents,
    followUpsDue,
    todaySiteVisits,
    upcomingSiteVisits,
    // Decimal -> string. Never a number: this is money.
    commissionEarned: deals?._sum.commissionAmount?.toFixed(2) ?? null,
    recentActivity: recent.map((r) => ({
      id: r.id,
      action: r.action,
      summary: r.summary,
      createdAt: r.createdAt.toISOString(),
      actorName: r.actor?.fullName ?? null,
    })),
  }
}
