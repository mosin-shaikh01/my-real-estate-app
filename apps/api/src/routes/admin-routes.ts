import { Router } from 'express'
import {
  activityQuerySchema,
  roleCreateSchema,
  roleUpdateSchema,
  searchQuerySchema,
  type Paginated,
} from '@app/shared'
import { requirePermission } from '../middleware/authenticate.js'
import { idParamSchema } from '../lib/params.js'
import { listActivity } from '../services/activity-service.js'
import {
  createRole,
  deleteRole,
  listPermissionCatalog,
  listRolesWithPermissions,
  updateRole,
} from '../services/rbac-service.js'
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

// Create / edit / delete CUSTOM roles. System roles are rejected by the service.
rbacRouter.post('/roles', requirePermission('rbac.role.create'), async (req, res) => {
  const input = roleCreateSchema.parse(req.body)
  res.status(201).json({ data: await createRole(req.actor!.userId, input, req) })
})

rbacRouter.patch('/roles/:id', requirePermission('rbac.role.update'), async (req, res) => {
  const { id } = idParamSchema.parse(req.params)
  const input = roleUpdateSchema.parse(req.body)
  res.json({ data: await updateRole(req.actor!.userId, id, input, req) })
})

// No dedicated rbac.role.delete permission exists; deletion is part of role
// management, gated by rbac.role.update (and blocked on system/in-use roles).
rbacRouter.delete('/roles/:id', requirePermission('rbac.role.update'), async (req, res) => {
  const { id } = idParamSchema.parse(req.params)
  await deleteRole(req.actor!.userId, id, req)
  res.status(204).end()
})
