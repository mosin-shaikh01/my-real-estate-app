import { Router } from 'express'
import {
  agentCreateSchema,
  agentPermissionsSchema,
  agentStatusSchema,
  agentUpdateSchema,
} from '@app/shared'
import { requireAnyPermission, requirePermission } from '../middleware/authenticate.js'
import { idParamSchema } from '../lib/params.js'
import {
  createAgent,
  getAgent,
  getAgentPermissions,
  listAgents,
  listAssignableAgents,
  setAgentPermissions,
  setAgentStatus,
  updateAgent,
} from '../services/agent-service.js'
import { toAgentDTO } from '../serializers/agent-serializer.js'

// Agent management is admin-only. There is no scope resolver here — an agent
// holds no agent.* permission, so the route guard is the whole gate.
export const agentRouter = Router()

agentRouter.get('/', requirePermission('agent.list'), async (req, res) => {
  const page = Number(req.query.page ?? 1)
  const pageSize = Number(req.query.pageSize ?? 25)
  const q = typeof req.query.q === 'string' ? req.query.q : undefined
  const result = await listAgents({
    q,
    page: Number.isFinite(page) ? page : 1,
    pageSize: Number.isFinite(pageSize) ? pageSize : 25,
  })
  res.json({
    data: result.rows.map((r) => toAgentDTO(r, req.actor!)),
    meta: {
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      totalPages: Math.ceil(result.total / result.pageSize) || 1,
    },
  })
})

// A lighter list for assignment dropdowns — used by BOTH "assign agent to a
// client" and "assign agent to a property". Guarded by the union of those
// permissions, not agent.list: needing the names is not the authority to manage
// agents, and a role with only one assignment power must still get the list.
agentRouter.get(
  '/assignable',
  requireAnyPermission('client.assignAgent', 'client.assignProperty', 'property.assignAgent'),
  async (_req, res) => {
    res.json({ data: await listAssignableAgents() })
  },
)

agentRouter.post('/', requirePermission('agent.create'), async (req, res) => {
  const input = agentCreateSchema.parse(req.body)
  const agent = await createAgent(req.actor!.userId, input, req)
  res.status(201).json({ data: agent })
})

agentRouter.get('/:id', requirePermission('agent.view'), async (req, res) => {
  const { id } = idParamSchema.parse(req.params)
  res.json({ data: toAgentDTO(await getAgent(id), req.actor!) })
})

agentRouter.patch('/:id', requirePermission('agent.update'), async (req, res) => {
  const { id } = idParamSchema.parse(req.params)
  const input = agentUpdateSchema.parse(req.body)
  res.json({ data: await updateAgent(req.actor!.userId, id, input, req) })
})

agentRouter.post('/:id/status', requirePermission('agent.status.update'), async (req, res) => {
  const { id } = idParamSchema.parse(req.params)
  const { status } = agentStatusSchema.parse(req.body)
  res.json({ data: toAgentDTO(await setAgentStatus(req.actor!.userId, id, status, req), req.actor!) })
})

agentRouter.get('/:id/permissions', requirePermission('agent.permissions.update'), async (req, res) => {
  const { id } = idParamSchema.parse(req.params)
  res.json({ data: await getAgentPermissions(id) })
})

agentRouter.put('/:id/permissions', requirePermission('agent.permissions.update'), async (req, res) => {
  const { id } = idParamSchema.parse(req.params)
  const input = agentPermissionsSchema.parse(req.body)
  res.json({ data: await setAgentPermissions(req.actor!.userId, id, input, req) })
})
