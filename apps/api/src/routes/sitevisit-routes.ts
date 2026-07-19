import { Router } from 'express'
import { siteVisitCreateSchema, siteVisitListQuerySchema, siteVisitUpdateSchema } from '@app/shared'
import { requirePermission } from '../middleware/authenticate.js'
import { idParamSchema } from '../lib/params.js'
import {
  createSiteVisit,
  deleteSiteVisit,
  listSiteVisits,
  updateSiteVisit,
} from '../services/sitevisit-service.js'
import { toSiteVisitDTO } from '../serializers/sitevisit-serializer.js'

// Site visits. Scoped in the service (agents see their own / their clients' /
// their properties' visits); the route guard is authorization, the scope is
// which rows.
export const siteVisitRouter = Router()

siteVisitRouter.get('/', requirePermission('sitevisit.list'), async (req, res) => {
  const query = siteVisitListQuerySchema.parse(req.query)
  const { rows, total } = await listSiteVisits(req.actor!, query)
  res.json({
    data: rows.map(toSiteVisitDTO),
    meta: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize) || 1,
    },
  })
})

siteVisitRouter.post('/', requirePermission('sitevisit.create'), async (req, res) => {
  const input = siteVisitCreateSchema.parse(req.body)
  res.status(201).json({ data: toSiteVisitDTO(await createSiteVisit(req.actor!, input, req)) })
})

siteVisitRouter.patch('/:id', requirePermission('sitevisit.update'), async (req, res) => {
  const { id } = idParamSchema.parse(req.params)
  const input = siteVisitUpdateSchema.parse(req.body)
  res.json({ data: toSiteVisitDTO(await updateSiteVisit(req.actor!, id, input, req)) })
})

siteVisitRouter.delete('/:id', requirePermission('sitevisit.delete'), async (req, res) => {
  const { id } = idParamSchema.parse(req.params)
  await deleteSiteVisit(req.actor!, id, req)
  res.status(204).end()
})
