import type { NotificationChannel } from '@app/shared'
import { InlineDispatcher, type Dispatcher } from './notification-queue.js'
import type {
  NotificationProvider,
  NotificationStore,
  OutboundMessage,
  ProviderResult,
  SendInput,
  SendResult,
  TemplateRecord,
} from './notification-types.js'
import { wrapWithBranding } from './templates/layout.js'
import { buildVars, htmlToText, renderTemplate } from './utils/render.js'

// ============================================================================
// NotificationService — the single entry point for ALL outbound communication.
// ============================================================================
// Nothing in the CRM talks to SMTP (or any provider) directly. Every feature
// calls notificationService.send({ channel, template, recipient, data }); the
// service resolves the template, injects branding, renders, dispatches to the
// channel's provider (via a queue-ready Dispatcher), and logs the outcome.
//
// It is Prisma-free by construction: persistence is the injected Notification
// store, providers are injected, and the dispatcher is swappable. That's what
// keeps it unit-testable and lets a queue slot in later.
// ============================================================================

export class NotificationService {
  private readonly providers: Partial<Record<NotificationChannel, NotificationProvider>>

  constructor(
    private readonly store: NotificationStore,
    providers: NotificationProvider[],
    private readonly dispatcher: Dispatcher = new InlineDispatcher(),
  ) {
    this.providers = Object.fromEntries(providers.map((p) => [p.channel, p]))
  }

  async send(input: SendInput): Promise<SendResult> {
    const { channel } = input
    const to = this.addressFor(input)
    const provider = this.providers[channel]

    // No provider, or a "coming soon" stub → honest "not implemented", before we
    // bother resolving a template. This is the future-channel path.
    if (!provider || !provider.implemented) {
      return this.record(input, to, null, {
        status: 'not_implemented',
        provider: null,
        error: `The ${channel} channel is not implemented yet`,
        retryCount: 0,
      })
    }

    const template = await this.store.getTemplate(input.template, channel)
    if (!template) {
      return this.record(input, to, null, {
        status: 'failed',
        provider: null,
        error: `No template named '${input.template}'`,
        retryCount: 0,
      })
    }
    if (!template.enabled) {
      return this.record(input, to, null, {
        status: 'skipped',
        provider: null,
        error: 'Template is disabled',
        retryCount: 0,
      })
    }
    if (!to) {
      return this.record(input, to, template, {
        status: 'failed',
        provider: null,
        error: `Recipient has no ${channel} address`,
        retryCount: 0,
      })
    }

    const message = await this.render(input, template, to)
    const config = channel === 'email' ? await this.store.getEmailTransport() : null

    // Dispatcher is the queue seam — today it runs inline.
    const result = await this.dispatcher.dispatch(() => provider.send(message, config))
    return this.record(input, to, template, result, message.subject)
  }

  private addressFor(input: SendInput): string {
    if (input.channel === 'email') return input.recipient.email?.trim() ?? ''
    if (input.channel === 'sms' || input.channel === 'whatsapp') return input.recipient.phone?.trim() ?? ''
    return input.recipient.userId ?? ''
  }

  private async render(
    input: SendInput,
    template: TemplateRecord,
    to: string,
  ): Promise<OutboundMessage> {
    const branding = await this.store.getBranding()
    const vars = buildVars(branding, input.recipient, input.data)
    const subject = renderTemplate(template.subject, vars)
    const inner = renderTemplate(template.bodyHtml, vars)
    const html = wrapWithBranding(inner, branding)
    return {
      channel: input.channel,
      to,
      recipientName: input.recipient.name ?? '',
      subject,
      html,
      text: htmlToText(html),
    }
  }

  private async record(
    input: SendInput,
    to: string,
    template: TemplateRecord | null,
    result: ProviderResult,
    subject?: string,
  ): Promise<SendResult> {
    const logId = await this.store.writeLog({
      channel: input.channel,
      templateKey: input.template,
      provider: result.provider,
      recipient: to || '(none)',
      subject: subject ?? template?.subject ?? null,
      status: result.status,
      error: result.error,
      retryCount: result.retryCount,
      sentAt: result.status === 'sent' ? new Date() : null,
    })
    return { ...result, logId }
  }
}
