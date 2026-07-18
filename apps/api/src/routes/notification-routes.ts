import { Router } from 'express'
import {
  emailProviderConfigSchema,
  isNotificationTemplateKey,
  templatePreviewSchema,
  templateUpdateSchema,
  testEmailSchema,
} from '@app/shared'
import { requirePermission } from '../middleware/authenticate.js'
import { rateLimit } from '../middleware/rate-limit.js'
import { notFound, validationFailed } from '../lib/errors.js'
import { notificationService } from '../notification/index.js'
import {
  getEmailConfigDTO,
  getTemplateDTO,
  listLogs,
  listTemplateDTOs,
  previewTemplate,
  updateEmailConfig,
  updateTemplate,
} from '../services/notification-data-service.js'

// All notification management is Super-Admin territory (notifications.manage).
// authenticate is applied at the mount in app.ts; each route declares its
// permission. Reads use notifications.view, writes/tests notifications.manage.
export const notificationRouter = Router()

// Test sends are rate limited — they trigger real outbound email.
const testLimiter = rateLimit({ windowMs: 10 * 60_000, max: 10 })

// -- Email provider config --------------------------------------------------
notificationRouter.get('/email/config', requirePermission('notifications.view'), async (_req, res) => {
  res.json({ data: await getEmailConfigDTO() })
})

notificationRouter.put('/email/config', requirePermission('notifications.manage'), async (req, res) => {
  const input = emailProviderConfigSchema.parse(req.body)
  res.json({ data: await updateEmailConfig(input) })
})

// -- Send a real test email -------------------------------------------------
notificationRouter.post(
  '/email/test',
  testLimiter,
  requirePermission('notifications.manage'),
  async (req, res) => {
    const { to } = testEmailSchema.parse(req.body)
    const result = await notificationService.send({
      channel: 'email',
      template: 'general-notification',
      recipient: { email: to, name: 'there' },
      data: {
        message:
          'This is a test email from your CRM Notification Service. If you can read this, email delivery is working.',
      },
    })
    res.json({
      data: {
        status: result.status,
        provider: result.provider,
        error: result.error,
        previewUrl: result.previewUrl ?? null,
      },
    })
  },
)

// -- Templates --------------------------------------------------------------
notificationRouter.get('/templates', requirePermission('notifications.view'), async (_req, res) => {
  res.json({ data: await listTemplateDTOs() })
})

// A POST (it carries the draft HTML in the body) but non-mutating; gated by
// manage since only template editors use it.
notificationRouter.post('/templates/preview', requirePermission('notifications.manage'), async (req, res) => {
  const { subject, bodyHtml } = templatePreviewSchema.parse(req.body)
  res.json({ data: await previewTemplate(subject, bodyHtml) })
})

notificationRouter.get('/templates/:key', requirePermission('notifications.view'), async (req, res) => {
  const key = req.params.key
  if (typeof key !== 'string' || !isNotificationTemplateKey(key)) throw notFound('Unknown template')
  res.json({ data: await getTemplateDTO(key) })
})

notificationRouter.put('/templates/:key', requirePermission('notifications.manage'), async (req, res) => {
  const key = req.params.key
  if (typeof key !== 'string' || !isNotificationTemplateKey(key)) throw notFound('Unknown template')
  const input = templateUpdateSchema.parse(req.body)
  res.json({ data: await updateTemplate(key, input) })
})

// -- Logs -------------------------------------------------------------------
notificationRouter.get('/logs', requirePermission('notifications.view'), async (req, res) => {
  const page = Number(req.query.page ?? 1)
  const pageSize = Number(req.query.pageSize ?? 25)
  if (!Number.isFinite(page) || !Number.isFinite(pageSize)) {
    throw validationFailed({ page: ['Invalid pagination'] })
  }
  res.json(await listLogs(page, pageSize))
})
