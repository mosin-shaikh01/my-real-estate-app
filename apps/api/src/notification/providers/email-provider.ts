import nodemailer from 'nodemailer'
import type {
  EmailTransportConfig,
  NotificationProvider,
  OutboundMessage,
  ProviderResult,
} from '../notification-types.js'
import { withRetry } from '../utils/retry.js'

// ============================================================================
// Email provider (SMTP via nodemailer)
// ============================================================================
// Real delivery when a transport is configured; a safe CONSOLE fallback when it
// isn't (logs the message so dev/demo works with zero setup — the reset link is
// right there in the logs). Retries transient failures, never auth failures, and
// bounds every attempt with connection/socket timeouts.
// ============================================================================

// Transient SMTP failures worth retrying. Auth (EAUTH) and bad-recipient
// (EENVELOPE) are permanent — retrying just delays the inevitable.
function isTransient(err: unknown): boolean {
  const code = (err as { code?: string })?.code
  if (!code) return true // unknown → give it one more try
  return !['EAUTH', 'EENVELOPE', 'EMESSAGE'].includes(code)
}

function consoleFallback(message: OutboundMessage): ProviderResult {
  console.log(
    JSON.stringify({
      level: 'info',
      msg: 'email.send',
      transport: 'console',
      to: message.to,
      subject: message.subject,
      body: message.text,
    }),
  )
  return { status: 'sent', provider: 'console', error: null, retryCount: 0 }
}

export const emailProvider: NotificationProvider = {
  channel: 'email',
  implemented: true,

  async send(message: OutboundMessage, config: unknown): Promise<ProviderResult> {
    const cfg = config as EmailTransportConfig | null

    // No transport configured → log to console and report success. This is the
    // "email not yet set up" path and is intentionally non-fatal.
    if (!cfg || !cfg.host || !cfg.senderEmail) return consoleFallback(message)

    const transporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.encryption === 'ssl', // 465 = implicit TLS
      requireTLS: cfg.encryption === 'tls', // 587 = STARTTLS
      auth: cfg.username ? { user: cfg.username, pass: cfg.password } : undefined,
      // Generous timeouts: some hosts are slow to complete the TLS handshake on
      // 465, and a too-tight limit reads as a false "connection timeout".
      connectionTimeout: 25_000,
      greetingTimeout: 25_000,
      socketTimeout: 40_000,
    })

    const from = cfg.senderName
      ? `"${cfg.senderName.replace(/"/g, '')}" <${cfg.senderEmail}>`
      : cfg.senderEmail

    const outcome = await withRetry(
      () =>
        transporter.sendMail({
          from,
          to: message.recipientName ? `"${message.recipientName.replace(/"/g, '')}" <${message.to}>` : message.to,
          replyTo: cfg.replyTo || undefined,
          subject: message.subject,
          html: message.html,
          text: message.text,
        }),
      { retries: 2, delayMs: 600, shouldRetry: isTransient },
    )

    transporter.close()

    if (outcome.error) {
      return {
        status: 'failed',
        provider: cfg.provider || 'smtp',
        error: (outcome.error as Error)?.message ?? 'Failed to send email',
        retryCount: outcome.attempts - 1,
      }
    }

    const info = outcome.value!
    return {
      status: 'sent',
      provider: cfg.provider || 'smtp',
      error: null,
      retryCount: outcome.attempts - 1,
      messageId: info.messageId,
      // Ethereal returns a preview URL; real providers return false.
      previewUrl: nodemailer.getTestMessageUrl(info) || undefined,
    }
  },
}
