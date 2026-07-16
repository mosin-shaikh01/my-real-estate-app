import { Router } from 'express'
import { activityQuerySchema, searchQuerySchema, type Paginated } from '@app/shared'
import { requirePermission } from '../middleware/authenticate.js'
import { listActivity } from '../services/activity-service.js'
import { listPermissionCatalog, listRolesWithPermissions } from '../services/rbac-service.js'
import { search } from '../services/search-service.js'

// Activity log, global search and the RBAC catalog. Small read surfaces grouped
// into one router; each still declares its own permission.

export const activityRouter = Router()

activityRouter.get('/', requirePermission('activity.list'), async (req, res) => {
  const query = activityQuerySchema.parse(req.query)
  const { rows, total } = await listActivity(query)
  const body: Paginated<(typeof rows)[number]> = {
    data: rows,
    meta: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    },
  }
  res.json(body)
})

export const searchRouter = Router()

// Guarded by property.list — the broadest read permission both roles hold. The
// service internally gates the clients section behind client.list, so a future
// property-only role still searches properties and just sees no client hits.
searchRouter.get('/', requirePermission('property.list'), async (req, res) => {
  const { q } = searchQuerySchema.parse(req.query)
  res.json({ data: await search(req.actor!, q) })
})

export const rbacRouter = Router()

rbacRouter.get('/roles', requirePermission('rbac.role.list'), async (_req, res) => {
  res.json({ data: await listRolesWithPermissions() })
})

rbacRouter.get('/permissions', requirePermission('rbac.permission.list'), async (_req, res) => {
  res.json({ data: await listPermissionCatalog() })
})
