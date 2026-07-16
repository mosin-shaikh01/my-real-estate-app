import type { SearchResult } from '@app/shared'
import type { Actor } from '../auth/permissions.js'
import { scopeForClient, scopeForProperty } from '../auth/scope.js'
import { prisma } from '../lib/prisma.js'

// ============================================================================
// Global search — properties + clients
// ============================================================================
// SCOPED: results run through the same scope resolvers as the lists, so an
// agent searching finds only their own inventory and clients. A search that
// leaked another agent's client by code or phone would be a hole the list
// endpoints don't have.
//
// The clients section is additionally gated by client.list — an actor who
// can't list clients doesn't get client hits. Properties by property.list.
// Both roles hold both today; the checks are here so a narrower future role
// behaves correctly.
//
// Scope: properties + clients only (not agents / 5 entity types). ILIKE uses no
// btree index; at demo scale a bounded LIKE is honest, and pg_trgm is the
// upgrade path when it hurts. See docs/ROADMAP.md.
// ============================================================================

const LIMIT = 6

export async function search(actor: Actor, q: string): Promise<SearchResult> {
  const digits = q.replace(/\D/g, '')
  const canClients = actor.has('client.list')
  const canProps = actor.has('property.list')

  // CRITICAL: compose scope and search with AND, never by spreading both.
  // scopeForProperty returns an object that CONTAINS `OR` (the agent's
  // "assigned to me OR to my client" clause). Spreading it and then adding a
  // second top-level `OR` for the search terms silently OVERWRITES the scope's
  // OR — an agent's search would then return every property. The list endpoints
  // avoid this by building an AND array; search must do the same. Found by
  // diffing search results against the scoped list, not by a unit test.
  const [properties, clients] = await Promise.all([
    canProps
      ? prisma.property.findMany({
          where: {
            AND: [
              scopeForProperty(actor),
              { archivedAt: null },
              {
                OR: [
                  { title: { contains: q, mode: 'insensitive' } },
                  { code: { contains: q, mode: 'insensitive' } },
                  { locality: { contains: q, mode: 'insensitive' } },
                  { city: { contains: q, mode: 'insensitive' } },
                ],
              },
            ],
          },
          select: { id: true, code: true, title: true, city: true, status: true },
          take: LIMIT,
          orderBy: { createdAt: 'desc' },
        })
      : Promise.resolve([]),

    canClients
      ? prisma.client.findMany({
          where: {
            AND: [
              scopeForClient(actor),
              {
                OR: [
                  { fullName: { contains: q, mode: 'insensitive' } },
                  { code: { contains: q, mode: 'insensitive' } },
                  // Normalised phone: "9876543210" must match "+91 98765 43210".
                  // Guarded on length so a 1-digit query doesn't match everyone.
                  ...(digits.length >= 4 ? [{ phoneNormalized: { contains: digits } }] : []),
                ],
              },
            ],
          },
          select: { id: true, code: true, fullName: true, followUpStatus: true },
          take: LIMIT,
          orderBy: { createdAt: 'desc' },
        })
      : Promise.resolve([]),
  ])

  return { properties, clients }
}
