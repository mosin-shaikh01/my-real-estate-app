import { Router } from 'express'
import { clientListQuerySchema, type Paginated } from '@app/shared'
import { requirePermission } from '../middleware/authenticate.js'
import { idParamSchema } from '../lib/params.js'
import { getClient, listClients } from '../services/client-service.js'
import { toClientDTO, type ClientDTO } from '../serializers/client-serializer.js'

export const clientRouter = Router()

// The vertical slice. Three layers, three different problems:
//   requirePermission  -> authorization (can you call this at all)
//   scopeForClient     -> scoping      (which rows)      [in the service]
//   toClientDTO        -> projection   (which columns)   [serializer]

clientRouter.get('/', requirePermission('client.list'), async (req, res) => {
  const query = clientListQuerySchema.parse(req.query)
  const actor = req.actor!

  const { rows, total } = await listClients(actor, query)

  const body: Paginated<ClientDTO> = {
    data: rows.map((r) => toClientDTO(r, actor)),
    meta: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    },
  }
  res.json(body)
})

clientRouter.get('/:id', requirePermission('client.view'), async (req, res) => {
  const actor = req.actor!
  const { id } = idParamSchema.parse(req.params)
  const row = await getClient(actor, id)
  res.json({ data: toClientDTO(row, actor) })
})
