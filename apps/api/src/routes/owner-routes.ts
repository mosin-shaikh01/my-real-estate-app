import { Router } from 'express'
import { ownerCreateSchema, ownerUpdateSchema, type OwnerDuplicate } from '@app/shared'
import { requireAnyPermission, requirePermission } from '../middleware/authenticate.js'
import { idParamSchema } from '../lib/params.js'
import {
  createOwner,
  deleteOwner,
  findOwnerByMobile,
  getOwner,
  listOwnerOptions,
  listOwners,
  restoreOwner,
  updateOwner,
} from '../services/owner-service.js'
import { toOwnerDTO, toOwnerListItem } from '../serializers/owner-serializer.js'

// Property Owner master. Admin-only (owner.* permissions); the route guard is the
// whole gate — no scope resolver, an agent holds no owner.* permission.
export const ownerRouter = Router()

ownerRouter.get('/', requirePermission('owner.list'), async (req, res) => {
  const page = Number(req.query.page ?? 1)
  const pageSize = Number(req.query.pageSize ?? 25)
  const q = typeof req.query.q === 'string' ? req.query.q : undefined
  const result = await listOwners({
    q,
    page: Number.isFinite(page) ? page : 1,
    pageSize: Number.isFinite(pageSize) ? pageSize : 25,
    deleted: req.query.deleted === 'only',
  })
  res.json({
    data: result.rows.map(toOwnerListItem),
    meta: {
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      totalPages: Math.ceil(result.total / result.pageSize) || 1,
    },
  })
})

// Compact list for the property form's owner picker. Available to owner managers
// AND anyone who can create/edit a property (they need to pick an owner).
ownerRouter.get(
  '/options',
  requireAnyPermission('owner.list', 'property.create', 'property.update'),
  async (_req, res) => {
    res.json({ data: await listOwnerOptions() })
  },
)

// Duplicate detection — a WARNING surfaced by the form before save, never a block.
ownerRouter.get('/duplicate', requireAnyPermission('owner.create', 'owner.update'), async (req, res) => {
  const mobile = typeof req.query.mobile === 'string' ? req.query.mobile : ''
  const excludeId = typeof req.query.excludeId === 'string' ? req.query.excludeId : undefined
  const dup = mobile ? await findOwnerByMobile(mobile, excludeId) : null
  res.json({ data: { duplicate: (dup as OwnerDuplicate | null) ?? null } })
})

ownerRouter.post('/', requirePermission('owner.create'), async (req, res) => {
  const input = ownerCreateSchema.parse(req.body)
  const owner = await createOwner(req.actor!.userId, input, req)
  res.status(201).json({ data: toOwnerDTO(owner) })
})

ownerRouter.get('/:id', requirePermission('owner.view'), async (req, res) => {
  const { id } = idParamSchema.parse(req.params)
  res.json({ data: toOwnerDTO(await getOwner(id)) })
})

ownerRouter.patch('/:id', requirePermission('owner.update'), async (req, res) => {
  const { id } = idParamSchema.parse(req.params)
  const input = ownerUpdateSchema.parse(req.body)
  res.json({ data: toOwnerDTO(await updateOwner(req.actor!.userId, id, input, req)) })
})

ownerRouter.delete('/:id', requirePermission('owner.delete'), async (req, res) => {
  const { id } = idParamSchema.parse(req.params)
  await deleteOwner(req.actor!.userId, id, req)
  res.status(204).end()
})

// Restore a soft-deleted owner — the reverse of delete, same permission.
ownerRouter.post('/:id/restore', requirePermission('owner.delete'), async (req, res) => {
  const { id } = idParamSchema.parse(req.params)
  res.json({ data: toOwnerDTO(await restoreOwner(req.actor!.userId, id, req)) })
})
