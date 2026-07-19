import type {
  EmailProviderConfigDTO,
  EmailProviderConfigInput,
  NotificationChannel,
  NotificationLogDTO,
  NotificationStatus,
  NotificationTemplateDTO,
  NotificationTemplateKey,
  Paginated,
  SmtpEncryption,
} from '@app/shared'
import { NOTIFICATION_TEMPLATE_KEYS, TEMPLATE_LABELS } from '@app/shared'
import { decryptSecret, encryptSecret } from '../lib/crypto.js'
import { env } from '../lib/env.js'
import { prisma } from '../lib/prisma.js'
import { emailProvider } from '../notification/providers/email-provider.js'
import type { OutboundMessage } from '../notification/notification-types.js'
import { DEFAULT_TEMPLATES } from '../notification/templates/default-templates.js'
import { wrapWithBranding } from '../notification/templates/layout.js'
import type {
  EmailTransportConfig,
  NotificationLogEntry,
  NotificationStore,
  ResolvedBranding,
  TemplateRecord,
} from '../notification/notification-types.js'
import { buildVars, htmlToText, renderTemplate } from '../notification/utils/render.js'
import { getSettings } from './settings-service.js'

// ============================================================================
// Notification persistence (Prisma). Implements the module's NotificationStore
// and provides the admin read/write functions the routes call. This is the ONLY
// notification file that touches the DB — the module itself is Prisma-free.
// ============================================================================

const EMAIL_CHANNEL = 'email'

function brandingBase(): string {
  return (env.APP_URL ?? env.WEB_ORIGIN).replace(/\/+$/, '')
}

async function resolveBranding(): Promise<ResolvedBranding> {
  const s = await getSettings()
  const logo = s.logoStorageKey
    ? `${brandingBase()}/api/settings/logo?v=${s.updatedAt.getTime()}`
    : ''
  const address = [s.addressLine1, s.addressLine2, s.city, s.state, s.country, s.pincode]
    .filter(Boolean)
    .join(', ')
  return {
    companyName: s.crmName,
    companyLogo: logo,
    supportEmail: s.email ?? '',
    companyWebsite: s.website ?? '',
    companyAddress: address,
    primaryColor: s.primaryColor ?? '#4f46e5',
    secondaryColor: s.secondaryColor ?? '#6366f1',
    footer: '',
    currentYear: String(new Date().getFullYear()),
  }
}

/** Build a transport from a config row, IGNORING the enabled flag. Returns null
 *  only when it's genuinely unusable (no host or no sender). */
function rowToTransport(row: {
  provider: string
  settings: unknown
  secret: string | null
}): EmailTransportConfig | null {
  const s = (row.settings ?? {}) as Record<string, unknown>
  const host = String(s.host ?? '')
  const senderEmail = String(s.senderEmail ?? '')
  if (!host || !senderEmail) return null
  return {
    provider: row.provider,
    host,
    port: Number(s.port ?? 587),
    encryption: (s.encryption as SmtpEncryption) ?? 'tls',
    username: String(s.username ?? ''),
    password: decryptSecret(row.secret) ?? '',
    senderName: String(s.senderName ?? ''),
    senderEmail,
    replyTo: String(s.replyTo ?? ''),
  }
}

// ---------------------------------------------------------------------------
// The injected store the NotificationService depends on.
// ---------------------------------------------------------------------------
export const prismaNotificationStore: NotificationStore = {
  async getTemplate(key: string, channel: NotificationChannel): Promise<TemplateRecord | null> {
    const row = await prisma.notificationTemplate.findUnique({ where: { key } })
    if (row) {
      if (row.channel !== channel) return null
      return {
        key: row.key,
        channel: row.channel as NotificationChannel,
        subject: row.subject,
        bodyHtml: row.bodyHtml,
        enabled: row.enabled,
      }
    }
    // Fall back to the built-in default so a not-yet-seeded template still works.
    const def = DEFAULT_TEMPLATES[key as NotificationTemplateKey]
    if (def && channel === EMAIL_CHANNEL) {
      return { key, channel, subject: def.subject, bodyHtml: def.bodyHtml, enabled: true }
    }
    return null
  },

  getBranding: resolveBranding,

  // The normal path gates on `enabled`: a disabled provider means "log to console"
  // (the dev/unconfigured behaviour), never a hard failure of a business flow.
  async getEmailTransport(): Promise<EmailTransportConfig | null> {
    const row = await prisma.notificationProviderConfig.findUnique({
      where: { channel: EMAIL_CHANNEL },
    })
    if (!row || !row.enabled) return null
    return rowToTransport(row)
  },

  async writeLog(entry: NotificationLogEntry): Promise<string> {
    const row = await prisma.notificationLog.create({
      data: {
        channel: entry.channel,
        templateKey: entry.templateKey,
        provider: entry.provider,
        recipient: entry.recipient.slice(0, 320),
        subject: entry.subject?.slice(0, 300) ?? null,
        status: entry.status,
        error: entry.error?.slice(0, 2000) ?? null,
        retryCount: entry.retryCount,
        sentAt: entry.sentAt,
      },
    })
    return row.id
  },
}

// ---------------------------------------------------------------------------
// Admin read/write — the routes call these (all behind notifications.manage).
// ---------------------------------------------------------------------------

export async function getEmailConfigDTO(): Promise<EmailProviderConfigDTO> {
  const row = await prisma.notificationProviderConfig.findUnique({ where: { channel: EMAIL_CHANNEL } })
  const s = ((row?.settings as Record<string, unknown>) ?? {})
  return {
    enabled: row?.enabled ?? false,
    provider: row?.provider ?? 'custom',
    host: String(s.host ?? ''),
    port: Number(s.port ?? 587),
    encryption: (s.encryption as SmtpEncryption) ?? 'tls',
    username: String(s.username ?? ''),
    senderName: String(s.senderName ?? ''),
    senderEmail: String(s.senderEmail ?? ''),
    replyTo: String(s.replyTo ?? ''),
    hasPassword: Boolean(row?.secret),
    updatedAt: row?.updatedAt.toISOString() ?? null,
  }
}

export async function updateEmailConfig(
  input: EmailProviderConfigInput,
): Promise<EmailProviderConfigDTO> {
  const settings = {
    host: input.host,
    port: input.port,
    encryption: input.encryption,
    username: input.username ?? '',
    senderName: input.senderName,
    senderEmail: input.senderEmail,
    replyTo: input.replyTo ?? '',
  }

  // Empty/absent password means "keep the stored one". A provided password is
  // encrypted before it ever touches the row.
  const secret =
    input.password && input.password.length > 0 ? encryptSecret(input.password) : undefined

  await prisma.notificationProviderConfig.upsert({
    where: { channel: EMAIL_CHANNEL },
    create: {
      channel: EMAIL_CHANNEL,
      enabled: input.enabled,
      provider: input.provider,
      settings,
      secret: secret ?? null,
    },
    update: {
      enabled: input.enabled,
      provider: input.provider,
      settings,
      ...(secret !== undefined ? { secret } : {}),
    },
  })
  return getEmailConfigDTO()
}

function toTemplateDTO(
  key: NotificationTemplateKey,
  row: { subject: string; bodyHtml: string; enabled: boolean; channel: string; updatedAt: Date } | null,
): NotificationTemplateDTO {
  const def = DEFAULT_TEMPLATES[key]
  return {
    key,
    name: TEMPLATE_LABELS[key],
    channel: (row?.channel ?? 'email') as NotificationChannel,
    subject: row?.subject ?? def.subject,
    bodyHtml: row?.bodyHtml ?? def.bodyHtml,
    enabled: row?.enabled ?? true,
    updatedAt: row?.updatedAt.toISOString() ?? null,
  }
}

export async function listTemplateDTOs(): Promise<NotificationTemplateDTO[]> {
  const rows = await prisma.notificationTemplate.findMany()
  const byKey = new Map(rows.map((r) => [r.key, r]))
  return NOTIFICATION_TEMPLATE_KEYS.map((key) => toTemplateDTO(key, byKey.get(key) ?? null))
}

export async function getTemplateDTO(key: NotificationTemplateKey): Promise<NotificationTemplateDTO> {
  const row = await prisma.notificationTemplate.findUnique({ where: { key } })
  return toTemplateDTO(key, row)
}

export async function updateTemplate(
  key: NotificationTemplateKey,
  input: { subject: string; bodyHtml: string; enabled?: boolean },
): Promise<NotificationTemplateDTO> {
  await prisma.notificationTemplate.upsert({
    where: { key },
    create: {
      key,
      name: TEMPLATE_LABELS[key],
      channel: 'email',
      subject: input.subject,
      bodyHtml: input.bodyHtml,
      enabled: input.enabled ?? true,
    },
    update: {
      subject: input.subject,
      bodyHtml: input.bodyHtml,
      ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
    },
  })
  return getTemplateDTO(key)
}

/** Render a subject + body with sample data and branding — for the live preview. */
export async function previewTemplate(
  subject: string,
  bodyHtml: string,
): Promise<{ subject: string; html: string }> {
  const branding = await resolveBranding()
  const sample = {
    agent_name: 'Alex Agent',
    client_name: 'Sam Client',
    property_name: '3 BHK Sea-View Apartment',
    reset_link: `${brandingBase()}/reset-password?token=sample-token`,
    action_url: `${brandingBase()}/`,
    message: 'This is a sample notification body.',
  }
  const vars = buildVars(branding, { name: 'Jane Doe' }, sample)
  return {
    subject: renderTemplate(subject, vars),
    html: wrapWithBranding(renderTemplate(bodyHtml, vars), branding),
  }
}

export interface TestEmailOutcome {
  status: string
  provider: string | null
  error: string | null
  previewUrl: string | null
}

/**
 * Send a REAL test email using the saved SMTP settings — deliberately IGNORING
 * the `enabled` flag so an admin can verify credentials before turning email on.
 * Reports the true SMTP result (auth failures, sender rejections, …) instead of
 * the silent console fallback, and logs the attempt.
 */
export async function sendTestEmail(to: string): Promise<TestEmailOutcome> {
  const row = await prisma.notificationProviderConfig.findUnique({ where: { channel: EMAIL_CHANNEL } })
  const transport = row ? rowToTransport(row) : null

  if (!transport) {
    return {
      status: 'failed',
      provider: null,
      error: 'Email is not configured. Enter the SMTP host, sender email and password, then Save.',
      previewUrl: null,
    }
  }

  const branding = await resolveBranding()
  const inner =
    '<h1 style="margin:0 0 16px;font-size:20px;">Test email</h1>' +
    '<p>This is a test email from your CRM Notification Service. If you can read this, your SMTP configuration is working.</p>'
  const html = wrapWithBranding(inner, branding)
  const message: OutboundMessage = {
    channel: 'email',
    to,
    recipientName: '',
    subject: `Test email from ${branding.companyName}`,
    html,
    text: htmlToText(html),
  }

  const result = await emailProvider.send(message, transport)

  await prismaNotificationStore.writeLog({
    channel: 'email',
    templateKey: null,
    provider: result.provider,
    recipient: to,
    subject: message.subject,
    status: result.status,
    error: result.error,
    retryCount: result.retryCount,
    sentAt: result.status === 'sent' ? new Date() : null,
  })

  return {
    status: result.status,
    provider: result.provider,
    error: result.error,
    previewUrl: result.previewUrl ?? null,
  }
}

export async function listLogs(page: number, pageSize: number): Promise<Paginated<NotificationLogDTO>> {
  const take = Math.min(Math.max(pageSize, 1), 100)
  const skip = (Math.max(page, 1) - 1) * take
  const [rows, total] = await Promise.all([
    prisma.notificationLog.findMany({ orderBy: { createdAt: 'desc' }, skip, take }),
    prisma.notificationLog.count(),
  ])
  return {
    data: rows.map((r) => ({
      id: r.id,
      channel: r.channel as NotificationChannel,
      templateKey: r.templateKey,
      provider: r.provider,
      recipient: r.recipient,
      subject: r.subject,
      status: r.status as NotificationStatus,
      error: r.error,
      retryCount: r.retryCount,
      createdAt: r.createdAt.toISOString(),
      sentAt: r.sentAt?.toISOString() ?? null,
    })),
    meta: { page: Math.max(page, 1), pageSize: take, total, totalPages: Math.ceil(total / take) || 1 },
  }
}

// Re-export the text helper so the test-send route can log a preview if needed.
export { htmlToText }
