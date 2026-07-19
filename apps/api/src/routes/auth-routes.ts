import { Router } from 'express'
import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  resetTokenSchema,
  type MeResponse,
} from '@app/shared'
import { clearAuthCookies, REFRESH_COOKIE, setAuthCookies } from '../auth/cookies.js'
import { signAccessToken, verifyAccessToken, verifyPassword } from '../auth/tokens.js'
import { authenticate } from '../middleware/authenticate.js'
import { rateLimit } from '../middleware/rate-limit.js'
import { publicRoute } from '../middleware/route-registry.js'
import { badRequest, unauthenticated } from '../lib/errors.js'
import { idParamSchema } from '../lib/params.js'
import {
  findOwnSession,
  findUserForLogin,
  findUserWithRoles,
  logAuthEvent,
} from '../services/auth-service.js'
import {
  requestPasswordReset,
  ResetTokenError,
  resetPassword,
  verifyResetToken,
} from '../services/password-reset-service.js'
import { getUserPreferences } from '../services/preference-service.js'
import {
  createSession,
  listSessions,
  RefreshReuseError,
  revokeAllSessions,
  revokeSession,
  rotateSession,
} from '../services/session-service.js'

export const authRouter = Router()

// A real argon2 digest. Verified even when the user does not exist, so response
// timing doesn't reveal which emails are registered.
const DUMMY_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHR2YWx1ZTEy$Yx0Ck7bJ7XvQZ2p1n8vB5xk9K3mQ7wRtYuIoPaSdFgH'

authRouter.post('/login', publicRoute('Login is how you obtain a session'), async (req, res) => {
  const { email, password } = loginSchema.parse(req.body)

  const user = await findUserForLogin(email)
  const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH)

  // One message for every failure mode. "No such user" vs "wrong password" is
  // free account enumeration.
  if (!user || !ok) throw unauthenticated('Incorrect email or password')
  if (user.status !== 'ACTIVE') throw unauthenticated('This account is suspended')

  const { sessionId, refreshToken } = await createSession(user.id, req)
  const accessToken = await signAccessToken({ sub: user.id, sid: sessionId })
  setAuthCookies(res, accessToken, refreshToken)

  await logAuthEvent({
    userId: user.id,
    action: 'auth.login',
    entityId: user.id,
    summary: 'Signed in',
    req,
  })

  res.status(204).end()
})

// ---------------------------------------------------------------------------
// Password reset — all public (they run before a session exists) and all rate
// limited per IP, because they're unauthenticated and take an email/token.
// ---------------------------------------------------------------------------
const forgotLimiter = rateLimit({ windowMs: 15 * 60_000, max: 5 })
const resetLimiter = rateLimit({ windowMs: 15 * 60_000, max: 10 })

authRouter.post(
  '/forgot-password',
  forgotLimiter,
  publicRoute('Anyone may request a reset link for their own email'),
  async (req, res) => {
    const { email } = forgotPasswordSchema.parse(req.body)
    await requestPasswordReset(email, req)
    // ALWAYS 200, whether or not the email exists — no account enumeration.
    res.json({ ok: true })
  },
)

authRouter.post(
  '/reset-password/verify',
  resetLimiter,
  publicRoute('Lets the reset page show whether a link is still valid'),
  async (req, res) => {
    const { token } = resetTokenSchema.parse(req.body)
    res.json({ valid: await verifyResetToken(token) })
  },
)

authRouter.post(
  '/reset-password',
  resetLimiter,
  publicRoute('Completing a reset happens before a session exists'),
  async (req, res) => {
    const { token, password } = resetPasswordSchema.parse(req.body)
    try {
      await resetPassword(token, password, req)
    } catch (err) {
      // Invalid/expired/used all surface as one message, shown at the form root.
      if (err instanceof ResetTokenError) throw badRequest(err.message)
      throw err
    }
    res.json({ ok: true })
  },
)

authRouter.post(
  '/refresh',
  publicRoute('Refresh authenticates via the refresh cookie, not an access token'),
  async (req, res) => {
    const raw = req.cookies?.[REFRESH_COOKIE]
    if (typeof raw !== 'string' || !raw) throw unauthenticated('No refresh token')

    try {
      const { sessionId, refreshToken, userId } = await rotateSession(raw, req)
      const accessToken = await signAccessToken({ sub: userId, sid: sessionId })
      setAuthCookies(res, accessToken, refreshToken)
      res.status(204).end()
    } catch (err) {
      if (err instanceof RefreshReuseError) {
        // rotateSession already revoked every session for that user. Clear the
        // cookies so the client stops retrying a chain that is now dead.
        clearAuthCookies(res)
        throw unauthenticated('Please sign in again')
      }
      throw err
    }
  },
)

authRouter.post(
  '/logout',
  publicRoute('Logging out must work even with an expired access token'),
  async (req, res) => {
    // Best-effort: an expired token should still clear cookies rather than trap
    // someone in a session they cannot end.
    const token = req.cookies?.['rec_at']
    if (typeof token === 'string' && token) {
      const claims = await verifyAccessToken(token)
      if (claims) await revokeSession(claims.sid)
    }
    clearAuthCookies(res)
    res.status(204).end()
  },
)

authRouter.post(
  '/logout-all',
  authenticate,
  publicRoute('Any signed-in user may end their own sessions'),
  async (req, res) => {
    await revokeAllSessions(req.actor!.userId)
    clearAuthCookies(res)
    res.status(204).end()
  },
)

// What <Can> and usePermissions() are built on: one source of truth for the
// client's view of what it may do.
authRouter.get(
  '/me',
  authenticate,
  publicRoute('Any authenticated user may read their own identity'),
  async (req, res) => {
    const actor = req.actor!
    const [user, preferences] = await Promise.all([
      findUserWithRoles(actor.userId),
      getUserPreferences(actor.userId),
    ])

    const body: MeResponse = {
      user: { id: user.id, email: user.email, fullName: user.fullName, phone: user.phone },
      roles: user.roles.map((r) => r.role),
      permissions: [...actor.permissions].sort(),
      preferences,
    }
    res.json(body)
  },
)

authRouter.get('/sessions', authenticate, publicRoute('Own sessions only'), async (req, res) => {
  res.json({ data: await listSessions(req.actor!.userId) })
})

authRouter.delete(
  '/sessions/:id',
  authenticate,
  publicRoute('Own sessions only'),
  async (req, res) => {
    const { id } = idParamSchema.parse(req.params)
    const owned = await findOwnSession(id, req.actor!.userId)
    if (owned) await revokeSession(owned.id)
    res.status(204).end()
  },
)
