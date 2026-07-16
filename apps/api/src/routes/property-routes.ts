import { Router } from 'express'
import { propertyListQuerySchema, type Paginated } from '@app/shared'
import { requirePermission } from '../middleware/authenticate.js'
import { idParamSchema } from '../lib/params.js'
import {
  getProperty,
  listProperties,
  listPropertyCities,
} from '../services/property-service.js'
import { toPropertyDTO, type PropertyDTO } from '../serializers/property-serializer.js'

export const propertyRouter = Router()

// Same three layers as clients, in the same order:
//   requirePermission -> authorization
//   scopeForProperty  -> scoping     (in the service)
//   toPropertyDTO     -> projection  (serializer)

propertyRouter.get('/', requirePermission('property.list'), async (req, res) => {
  const query = propertyListQuerySchema.parse(req.query)
  const actor = req.actor!

  const { rows, total } = await listProperties(actor, query)

  const body: Paginated<PropertyDTO> = {
    data: rows.map((r) => toPropertyDTO(r, actor)),
    meta: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    },
  }
  res.json(body)
})

// Declared BEFORE /:id — Express matches in order, so '/cities' would otherwise
// be swallowed as an id and 404 with a confusing message.
propertyRouter.get('/cities', requirePermission('property.list'), async (req, res) => {
  res.json({ data: await listPropertyCities(req.actor!) })
})

propertyRouter.get('/:id', requirePermission('property.view'), async (req, res) => {
  const actor = req.actor!
  const { id } = idParamSchema.parse(req.params)
  res.json({ data: toPropertyDTO(await getProperty(actor, id), actor) })
})
