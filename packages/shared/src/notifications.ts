import { z } from 'zod'

// ============================================================================
// Notification contract — shared by the API and the admin UI.
// ============================================================================
// The single source of truth for channels, provider presets, template keys, the
// wire schemas the admin panel submits, and the DTOs the API returns. Secrets
// (SMTP passwords) NEVER appear in a DTO — only a `hasPassword` flag.
// ============================================================================

export const NOTIFICATION_CHANNELS = [
  'email',
  'sms',
  'whatsapp',
  'push',
  'in_app',
  'webhook',
] as const
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number]

/** Channels with a working provider today. Everything else is "Coming soon". */
export const IMPLEMENTED_CHANNELS: readonly NotificationChannel[] = ['email']

export const NOTIFICATION_STATUSES = [
  'queued',
  'sent',
  'failed',
  'skipped',
  'not_implemented',
] as const
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number]

export const SMTP_ENCRYPTIONS = ['none', 'ssl', 'tls'] as const
export type SmtpEncryption = (typeof SMTP_ENCRYPTIONS)[number]

// ---------------------------------------------------------------------------
// SMTP provider presets — selecting one auto-fills host/port/encryption, all
// still overridable. Kept in shared so the form and the server agree.
// ---------------------------------------------------------------------------
export interface EmailProviderPreset {
  id: string
  label: string
  host: string
  port: number
  encryption: SmtpEncryption
  usernameHint?: string
  note?: string
}

export const EMAIL_PROVIDER_PRESETS: readonly EmailProviderPreset[] = [
  { id: 'gmail', label: 'Gmail', host: 'smtp.gmail.com', port: 465, encryption: 'ssl', usernameHint: 'your full Gmail address', note: 'Requires a Google App Password (2-Step Verification on).' },
  { id: 'outlook', label: 'Outlook.com', host: 'smtp-mail.outlook.com', port: 587, encryption: 'tls' },
  { id: 'office365', label: 'Microsoft 365', host: 'smtp.office365.com', port: 587, encryption: 'tls' },
  { id: 'zoho', label: 'Zoho Mail', host: 'smtp.zoho.com', port: 465, encryption: 'ssl' },
  { id: 'hostinger', label: 'Hostinger', host: 'smtp.hostinger.com', port: 465, encryption: 'ssl' },
  { id: 'godaddy', label: 'GoDaddy', host: 'smtpout.secureserver.net', port: 465, encryption: 'ssl' },
  { id: 'cpanel', label: 'cPanel / generic host', host: 'mail.yourdomain.com', port: 465, encryption: 'ssl', note: 'Replace the host with your cPanel mail server.' },
  { id: 'sendgrid', label: 'SendGrid', host: 'smtp.sendgrid.net', port: 587, encryption: 'tls', usernameHint: "the literal word 'apikey'" },
  { id: 'brevo', label: 'Brevo (Sendinblue)', host: 'smtp-relay.brevo.com', port: 587, encryption: 'tls' },
  { id: 'ses', label: 'Amazon SES', host: 'email-smtp.us-east-1.amazonaws.com', port: 587, encryption: 'tls', note: 'Use your region host and SMTP credentials.' },
  { id: 'mailgun', label: 'Mailgun', host: 'smtp.mailgun.org', port: 587, encryption: 'tls' },
  { id: 'custom', label: 'Custom SMTP', host: '', port: 587, encryption: 'tls' },
]

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------
export const NOTIFICATION_TEMPLATE_KEYS = [
  'welcome',
  'forgot-password',
  'password-reset',
  'user-invitation',
  'property-assignment',
  'client-assignment',
  'appointment-reminder',
  'daily-report',
  'weekly-report',
  'monthly-report',
  'general-notification',
] as const
export type NotificationTemplateKey = (typeof NOTIFICATION_TEMPLATE_KEYS)[number]

export function isNotificationTemplateKey(v: string): v is NotificationTemplateKey {
  return (NOTIFICATION_TEMPLATE_KEYS as readonly string[]).includes(v)
}

export const TEMPLATE_LABELS: Record<NotificationTemplateKey, string> = {
  welcome: 'Welcome Email',
  'forgot-password': 'Forgot Password',
  'password-reset': 'Password Reset Confirmation',
  'user-invitation': 'User Invitation',
  'property-assignment': 'Property Assignment',
  'client-assignment': 'Client Assignment',
  'appointment-reminder': 'Appointment Reminder',
  'daily-report': 'Daily Report',
  'weekly-report': 'Weekly Report',
  'monthly-report': 'Monthly Report',
  'general-notification': 'General Notification',
}

/** Placeholders any template may reference as {{name}}. */
export const TEMPLATE_PLACEHOLDERS = [
  'company_name',
  'company_logo',
  'user_name',
  'agent_name',
  'client_name',
  'property_name',
  'reset_link',
  'action_url',
  'support_email',
  'company_website',
  'company_address',
  'current_year',
] as const
export type TemplatePlaceholder = (typeof TEMPLATE_PLACEHOLDERS)[number]

// ---------------------------------------------------------------------------
// Wire schemas (admin panel -> API)
// ---------------------------------------------------------------------------
export const emailProviderConfigSchema = z.object({
  enabled: z.boolean(),
  provider: z.string().min(1).max(40),
  host: z.string().min(1, 'SMTP host is required').max(255),
  port: z.number({ message: 'Enter a valid port' }).int().min(1).max(65535),
  encryption: z.enum(SMTP_ENCRYPTIONS),
  username: z.string().max(255).optional().or(z.literal('')),
  // Optional on update: an empty/absent password means "keep the stored one".
  password: z.string().max(512).optional(),
  senderName: z.string().min(1, 'Sender name is required').max(120),
  senderEmail: z.string().email('Enter a valid sender email').max(255),
  replyTo: z.string().email('Enter a valid reply-to email').max(255).optional().or(z.literal('')),
})
export type EmailProviderConfigInput = z.infer<typeof emailProviderConfigSchema>

export const templateUpdateSchema = z.object({
  subject: z.string().min(1, 'Subject is required').max(300),
  bodyHtml: z.string().min(1, 'Body is required').max(100_000),
  enabled: z.boolean().optional(),
})
export type TemplateUpdateInput = z.infer<typeof templateUpdateSchema>

export const templatePreviewSchema = z.object({
  subject: z.string().max(300),
  bodyHtml: z.string().max(100_000),
})

export const testEmailSchema = z.object({
  to: z.string().email('Enter a valid email address'),
})
export type TestEmailInput = z.infer<typeof testEmailSchema>

// ---------------------------------------------------------------------------
// DTOs (API -> admin panel). Never carry the SMTP password.
// ---------------------------------------------------------------------------
export interface EmailProviderConfigDTO {
  enabled: boolean
  provider: string
  host: string
  port: number
  encryption: SmtpEncryption
  username: string
  senderName: string
  senderEmail: string
  replyTo: string
  /** Whether a password is stored — the UI shows a masked placeholder if true. */
  hasPassword: boolean
  updatedAt: string | null
}

export interface NotificationTemplateDTO {
  key: string
  name: string
  channel: NotificationChannel
  subject: string
  bodyHtml: string
  enabled: boolean
  updatedAt: string | null
}

export interface NotificationLogDTO {
  id: string
  channel: NotificationChannel
  templateKey: string | null
  provider: string | null
  recipient: string
  subject: string | null
  status: NotificationStatus
  error: string | null
  retryCount: number
  createdAt: string
  sentAt: string | null
}
