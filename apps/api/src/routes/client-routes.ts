import { Router } from 'express'
import {
  assignAgentSchema,
  clientCreateSchema,
  clientListQuerySchema,
  clientUpdateSchema,
  interactionCreateSchema,
  requirementSchema,
  type Paginated,
} from '@app/shared'
import { requirePermission } from '../middleware/authenticate.js'
import { idParamSchema } from '../lib/params.js'
import { getClientDetail, listClients } from '../services/client-service.js'
import {
  addInteraction,
  assignClientAgent,
  createClient,
  updateClient,
  upsertRequirement,
} from '../services/client-write-service.js'
import {
  toClientDetailDTO,
  toClientDTO,
  type ClientDTO,
} from '../serializers/client-serializer.js'

export const clientRouter = Router()

// Three layers, three problems:
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

clientRouter.post('/', requirePermission('client.create'), async (req, res) => {
  const input = clientCreateSchema.parse(req.body)
  const client = await createClient(req.actor!, input, req)
  res.status(201).json({ data: client })
})

clientRouter.get('/:id', requirePermission('client.view'), async (req, res) => {
  const actor = req.actor!
  const { id } = idParamSchema.parse(req.params)
  const row = await getClientDetail(actor, id)
  res.json({ data: toClientDetailDTO(row, actor) })
})

clientRouter.patch('/:id', requirePermission('client.update'), async (req, res) => {
  const { id } = idParamSchema.parse(req.params)
  const input = clientUpdateSchema.parse(req.body)
  res.json({ data: await updateClient(req.actor!, id, input, req) })
})

// followUp.edit gates BOTH logging an interaction and moving the follow-up
// state — an agent's core loop. Deliberately not client.update: an agent may
// work their pipeline without being able to rename the client or reassign them.
clientRouter.post('/:id/interactions', requirePermission('client.interaction.create'), async (req, res) => {
  const { id } = idParamSchema.parse(req.params)
  const input = interactionCreateSchema.parse(req.body)
  res.status(201).json({ data: await addInteraction(req.actor!, id, input, req) })
})

clientRouter.post('/:id/requirements', requirePermission('client.update'), async (req, res) => {
  const { id } = idParamSchema.parse(req.params)
  const input = requirementSchema.parse(req.body)
  res.status(201).json({ data: await upsertRequirement(req.actor!, id, input, req) })
})

clientRouter.post('/:id/assign-agent', requirePermission('client.assignAgent'), async (req, res) => {
  const { id } = idParamSchema.parse(req.params)
  const { agentId } = assignAgentSchema.parse(req.body)
  await assignClientAgent(req.actor!, id, agentId, req)
  res.status(204).end()
})
