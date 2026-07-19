import { randomUUID } from 'node:crypto'
import dns from 'node:dns'
import nodemailer from 'nodemailer'
import { env } from '../../lib/env.js'
import type {
  EmailTransportConfig,
  NotificationProvider,
  OutboundMessage,
  ProviderResult,
} from '../notification-types.js'
import { withRetry } from '../utils/retry.js'

// ============================================================================
// Email provider (SMTP via nodemailer) — instrumented, per-request, stateless
// ============================================================================
// DESIGN NOTE (read before "optimising" with a pool):
// A fresh, NON-POOLED transporter is created per send and closed after. There is
// deliberately NO module-level transporter, NO pool, NO keepAlive:
//   * This is a low-volume CRM (occasional resets/notifications). A pooled or
//     kept-alive connection would sit idle between sends, get reaped by the
//     platform/host, and go STALE — the classic "works once, then every
//     subsequent send times out" bug. Per-request is the reliable choice here.
//   * Because nothing is shared between sends, stale-socket reuse and stale-cache
//     bugs are architecturally impossible.
//
// Every stage is logged (DNS → TCP → greeting → STARTTLS → AUTH → DATA → QUIT)
// with the exact Node error `code` and SMTP `command`, so a failure on any host
// (including a server whose IP a mail provider rate-limits) is diagnosable from
// the logs without a repro. Set SMTP_DEBUG=1 for the full protocol transcript.
// ============================================================================

const CONNECTION_TIMEOUT = 15_000
const GREETING_TIMEOUT = 10_000
const SOCKET_TIMEOUT = 20_000
const DNS_TIMEOUT = 10_000

function slog(cid: string, event: string, extra: Record<string, unknown> = {}): void {
  const level = event.endsWith('.fail') ? 'error' : 'info'
  const line = JSON.stringify({ level, msg: 'smtp', cid, event, ...extra })
  if (level === 'error') console.error(line)
  else console.log(line)
}

/** Pull the diagnostic fields off a nodemailer/Node error. `command` is the SMTP
 *  stage that failed (CONN, EHLO, STARTTLS, AUTH, MAIL FROM, DATA, …). */
function errorDetails(err: unknown): Record<string, unknown> {
  const e = err as {
    code?: string
    command?: string
    response?: string
    responseCode?: number
    errno?: number
    syscall?: string
    message?: string
  }
  return {
    code: e?.code,
    command: e?.command,
    responseCode: e?.responseCode,
    response: e?.response,
    errno: e?.errno,
    syscall: e?.syscall,
    error: e?.message,
  }
}

/** Turn a raw SMTP/network error into an actionable message, tagged with its code. */
function humanize(err: unknown): string {
  const e = err as { code?: string; command?: string; response?: string; message?: string }
  switch (e?.code) {
    case 'ETIMEDOUT':
    case 'ESOCKET':
    case 'ECONNECTION':
      return `Couldn't reach the mail server (timed out at ${e.command ?? 'connection'}). If this works from your laptop but not from the deployed server, the mail host is almost certainly rate-limiting/blocking SMTP from the server's IP — use a transactional provider (SendGrid, Brevo, Amazon SES) on the server. [${e.code}]`
    case 'ECONNREFUSED':
      return `The mail server refused the connection on that port — check host, port and encryption. [${e.code}]`
    case 'EDNS':
      return `Could not resolve the SMTP host name — check the host is spelled correctly. [${e.code}]`
    case 'EAUTH':
      return `Authentication failed — check the username and password (Gmail needs an App Password). [${e.code}]`
    case 'EENVELOPE':
      return `Sender or recipient rejected: ${e.response ?? 'address not accepted by the server'}. [${e.code}]`
    case 'ETLS':
      return `TLS negotiation failed — try switching between SSL (port 465) and STARTTLS (port 587). [${e.code}]`
    default:
      return e?.message ?? 'Failed to send email'
  }
}

// Transient failures worth ONE retry. Auth / bad-envelope / bad-message are
// permanent — retrying only delays the inevitable.
function isTransient(err: unknown): boolean {
  const code = (err as { code?: string })?.code
  if (!code) return true
  return !['EAUTH', 'EENVELOPE', 'EMESSAGE'].includes(code)
}

function transportOptions(cfg: EmailTransportConfig) {
  return {
    host: cfg.host,
    port: cfg.port,
    secure: cfg.encryption === 'ssl', // 465 = implicit TLS
    requireTLS: cfg.encryption === 'tls', // 587 = STARTTLS upgrade required
    auth: cfg.username ? { user: cfg.username, pass: cfg.password } : undefined,
    connectionTimeout: CONNECTION_TIMEOUT,
    greetingTimeout: GREETING_TIMEOUT,
    socketTimeout: SOCKET_TIMEOUT,
    dnsTimeout: DNS_TIMEOUT,
    // Full protocol transcript when SMTP_DEBUG is on; quiet otherwise.
    logger: env.SMTP_DEBUG,
    debug: env.SMTP_DEBUG,
  }
}

/** Resolve the SMTP host up-front so a DNS problem is a distinct, logged stage
 *  rather than being hidden inside a generic "connection" failure. */
async function resolveDns(cid: string, host: string): Promise<boolean> {
  const start = Date.now()
  try {
    const { address, family } = await dns.promises.lookup(host)
    slog(cid, 'dns.ok', { host, address, family, ms: Date.now() - start })
    return true
  } catch (err) {
    slog(cid, 'dns.fail', { host, ms: Date.now() - start, ...errorDetails(err) })
    return false
  }
}

/**
 * Connectivity + auth check with NO message sent (SMTP VRFY-equivalent EHLO +
 * STARTTLS + AUTH). Fully staged-logged. Use it to prove whether the server is
 * reachable and the credentials work, independent of any message.
 */
export async function verifyEmailConnection(
  cfg: EmailTransportConfig,
): Promise<{ ok: boolean; error?: string }> {
  const cid = randomUUID().slice(0, 8)
  const start = Date.now()
  slog(cid, 'verify.start', { host: cfg.host, port: cfg.port, encryption: cfg.encryption })

  if (!(await resolveDns(cid, cfg.host))) {
    return { ok: false, error: `DNS lookup failed for ${cfg.host}` }
  }

  const transporter = nodemailer.createTransport(transportOptions(cfg))
  try {
    await transporter.verify()
    slog(cid, 'verify.ok', { ms: Date.now() - start })
    return { ok: true }
  } catch (err) {
    slog(cid, 'verify.fail', { ms: Date.now() - start, ...errorDetails(err) })
    return { ok: false, error: humanize(err) }
  } finally {
    transporter.close()
    slog(cid, 'transport.closed', {})
  }
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

    // No transport configured → log to console (the "email not set up" path).
    if (!cfg || !cfg.host || !cfg.senderEmail) return consoleFallback(message)

    const cid = randomUUID().slice(0, 8)
    const start = Date.now()
    slog(cid, 'send.start', {
      host: cfg.host,
      port: cfg.port,
      secure: cfg.encryption === 'ssl',
      requireTLS: cfg.encryption === 'tls',
      pooled: false,
      to: message.to,
    })

    if (!(await resolveDns(cid, cfg.host))) {
      return {
        status: 'failed',
        provider: cfg.provider || 'smtp',
        error: `DNS lookup failed for ${cfg.host}`,
        retryCount: 0,
      }
    }

    const transporter = nodemailer.createTransport(transportOptions(cfg))
    const from = cfg.senderName
      ? `"${cfg.senderName.replace(/"/g, '')}" <${cfg.senderEmail}>`
      : cfg.senderEmail

    const outcome = await withRetry(
      () =>
        transporter.sendMail({
          from,
          to: message.recipientName
            ? `"${message.recipientName.replace(/"/g, '')}" <${message.to}>`
            : message.to,
          replyTo: cfg.replyTo || undefined,
          subject: message.subject,
          html: message.html,
          text: message.text,
        }),
      // ONE retry only — connection timeouts must not be hammered 3× (that turns
      // a 15s failure into a 30s+ hang and re-triggers any per-IP rate limit).
      { retries: 1, delayMs: 1000, shouldRetry: isTransient },
    )

    // Always release the socket, success or failure.
    transporter.close()
    slog(cid, 'transport.closed', { ms: Date.now() - start })

    if (outcome.error) {
      slog(cid, 'send.fail', {
        attempts: outcome.attempts,
        ms: Date.now() - start,
        ...errorDetails(outcome.error),
      })
      return {
        status: 'failed',
        provider: cfg.provider || 'smtp',
        error: humanize(outcome.error),
        retryCount: outcome.attempts - 1,
      }
    }

    const info = outcome.value!
    slog(cid, 'send.ok', {
      messageId: info.messageId,
      attempts: outcome.attempts,
      ms: Date.now() - start,
    })
    return {
      status: 'sent',
      provider: cfg.provider || 'smtp',
      error: null,
      retryCount: outcome.attempts - 1,
      messageId: info.messageId,
      previewUrl: nodemailer.getTestMessageUrl(info) || undefined,
    }
  },
}
