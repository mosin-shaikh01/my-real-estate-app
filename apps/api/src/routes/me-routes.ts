import { Router } from 'express'
import { userPreferencesUpdateSchema } from '@app/shared'
import { publicRoute } from '../middleware/route-registry.js'
import { getUserPreferences, updateUserPreferences } from '../services/preference-service.js'

// Self-service preferences, mounted at /api/me and behind authenticate(). Like
// /auth/me and /profile, it needs no permission — it is the "you may act on
// yourself" footing. Every handler operates on req.actor.userId, so a user can
// only ever touch their own preferences (an admin cannot reach another user's).
export const meRouter = Router()

meRouter.get(
  '/preferences',
  publicRoute('Any authenticated user reads their own preferences'),
  async (req, res) => {
    res.json({ data: await getUserPreferences(req.actor!.userId) })
  },
)

meRouter.patch(
  '/preferences',
  publicRoute('Any authenticated user updates their own preferences'),
  async (req, res) => {
    const input = userPreferencesUpdateSchema.parse(req.body)
    res.json({ data: await updateUserPreferences(req.actor!.userId, input) })
  },
)
