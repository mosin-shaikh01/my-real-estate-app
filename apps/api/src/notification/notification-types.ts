import type { NotificationChannel, NotificationStatus, SmtpEncryption } from '@app/shared'

// ============================================================================
// Notification module — the shared vocabulary
// ============================================================================
// These interfaces are the seams that let the module stay Prisma-free (the DB
// lives behind NotificationStore, injected) and channel-agnostic (every channel
// implements NotificationProvider). Adding a channel is a new provider + a new
// registry entry; no existing type changes.
// ============================================================================

/** Branding pulled from CRM Settings and injected into every message. */
export interface ResolvedBranding {
  companyName: string
  companyLogo: string
  supportEmail: string
  companyWebsite: string
  companyAddress: string
  primaryColor: string
  secondaryColor: string
  footer: string
  currentYear: string
}

export interface TemplateRecord {
  key: string
  channel: NotificationChannel
  subject: string
  bodyHtml: string
  enabled: boolean
}

/** Decrypted SMTP settings the email provider needs. Never leaves the server. */
export interface EmailTransportConfig {
  provider: string
  host: string
  port: number
  encryption: SmtpEncryption
  username: string
  password: string
  senderName: string
  senderEmail: string
  replyTo: string
}

export interface NotificationRecipient {
  email?: string | null
  name?: string | null
  phone?: string | null
  userId?: string | null
}

/** Free-form template variables supplied by the caller (merged over branding). */
export type NotificationData = Record<string, string | number | null | undefined>

export interface SendInput {
  channel: NotificationChannel
  /** A template key, e.g. 'forgot-password'. */
  template: string
  recipient: NotificationRecipient
  data?: NotificationData
}

/** The fully-rendered, channel-ready message handed to a provider. */
export interface OutboundMessage {
  channel: NotificationChannel
  to: string
  recipientName: string
  subject: string
  html: string
  text: string
}

export interface ProviderResult {
  status: NotificationStatus
  provider: string | null
  error: string | null
  retryCount: number
  messageId?: string
  /** Ethereal/preview URL when the transport provides one. */
  previewUrl?: string
}

/** Every channel implements this. The `config` is the channel's resolved config. */
export interface NotificationProvider {
  readonly channel: NotificationChannel
  /** False for the "coming soon" stubs — the service short-circuits to not_implemented. */
  readonly implemented: boolean
  send(message: OutboundMessage, config: unknown): Promise<ProviderResult>
}

export interface SendResult extends ProviderResult {
  logId?: string
}

export interface NotificationLogEntry {
  channel: NotificationChannel
  templateKey: string | null
  provider: string | null
  recipient: string
  subject: string | null
  status: NotificationStatus
  error: string | null
  retryCount: number
  sentAt: Date | null
}

/**
 * The persistence seam. The module never touches Prisma; the API's services
 * layer implements this against the DB and injects it. That is what keeps the
 * "Prisma only in services/**" rule intact while the module stays testable.
 */
export interface NotificationStore {
  getTemplate(key: string, channel: NotificationChannel): Promise<TemplateRecord | null>
  getBranding(): Promise<ResolvedBranding>
  getEmailTransport(): Promise<EmailTransportConfig | null>
  writeLog(entry: NotificationLogEntry): Promise<string>
}
