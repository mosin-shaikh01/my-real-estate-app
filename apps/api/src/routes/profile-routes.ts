import { Router } from 'express'
import { changePasswordSchema, profileUpdateSchema } from '@app/shared'
import { publicRoute } from '../middleware/route-registry.js'
import {
  changeOwnPassword,
  getOwnProfile,
  updateOwnProfile,
} from '../services/profile-service.js'

// Self-service. Mounted behind authenticate() but needs no specific permission:
// a user acting on their OWN identity is the "you may act on yourself" footing,
// same as /auth/me. publicRoute here means "authenticated, no permission gate"
// — the manifest test still requires that declaration.
export const profileRouter = Router()

profileRouter.get('/', publicRoute('Any authenticated user reads their own profile'), async (req, res) => {
  res.json({ data: await getOwnProfile(req.actor!.userId) })
})

profileRouter.patch('/', publicRoute('Any authenticated user edits their own profile'), async (req, res) => {
  const input = profileUpdateSchema.parse(req.body)
  res.json({ data: await updateOwnProfile(req.actor!, input, req) })
})

profileRouter.post(
  '/change-password',
  publicRoute('Any authenticated user changes their own password'),
  async (req, res) => {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body)
    await changeOwnPassword(req.actor!, currentPassword, newPassword, req)
    res.status(204).end()
  },
)
