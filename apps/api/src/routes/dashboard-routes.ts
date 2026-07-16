import { Router } from 'express'
import { requirePermission } from '../middleware/authenticate.js'
import { getDashboard } from '../services/dashboard-service.js'

export const dashboardRouter = Router()

// property.list is the honest gate: the dashboard is a summary of scoped
// inventory, so anyone who may list properties may see counts of what they can
// already list. The service scopes and gates each tile individually.
dashboardRouter.get('/', requirePermission('property.list'), async (req, res) => {
  res.json({ data: await getDashboard(req.actor!) })
})
