import { Router } from 'express'
import { dealCreateSchema, dealListQuerySchema } from '@app/shared'
import { requirePermission } from '../middleware/authenticate.js'
import { createDeal, listDeals } from '../services/deal-service.js'
import { toDealDTO } from '../serializers/deal-serializer.js'

// Closed deals — admin-only (deal.list / deal.create). No scope resolver: the
// route guard is the whole gate, like owners and agents.
export const dealRouter = Router()

dealRouter.get('/', requirePermission('deal.list'), async (req, res) => {
  const query = dealListQuerySchema.parse(req.query)
  const { rows, total, page, pageSize } = await listDeals(query)
  res.json({
    data: rows.map(toDealDTO),
    meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  })
})

dealRouter.post('/', requirePermission('deal.create'), async (req, res) => {
  const input = dealCreateSchema.parse(req.body)
  const deal = await createDeal(req.actor!.userId, input, req)
  res.status(201).json({ data: toDealDTO(deal) })
})
