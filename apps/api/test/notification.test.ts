import { describe, expect, it, vi } from 'vitest'
import { NotificationService } from '../src/notification/notification-service.js'
import { makeStubProvider } from '../src/notification/notification-provider.js'
import type {
  NotificationProvider,
  NotificationStore,
  OutboundMessage,
  ProviderResult,
  ResolvedBranding,
} from '../src/notification/notification-types.js'
import { buildVars, escapeHtml, renderTemplate } from '../src/notification/utils/render.js'

// The notification module is Prisma-free by design, so it unit-tests with a fake
// store + fake providers — no DB, no SMTP. These pin the contract the whole CRM
// now depends on: templating + escaping, branding injection, channel routing,
// and that every attempt is logged.

const branding: ResolvedBranding = {
  companyName: 'Estate',
  companyLogo: '',
  supportEmail: 'help@estate.test',
  companyWebsite: '',
  companyAddress: '',
  primaryColor: '#4f46e5',
  secondaryColor: '#6366f1',
  footer: '',
  currentYear: '2026',
}

function fakeStore(overrides: Partial<NotificationStore> = {}) {
  const writeLog = vi.fn(async () => 'log_1')
  const store: NotificationStore = {
    getBranding: async () => branding,
    getEmailTransport: async () => null,
    getTemplate: async (key, channel) => ({
      key,
      channel,
      subject: 'Hi {{user_name}}',
      bodyHtml: '<p>Reset: {{reset_link}}</p>',
      enabled: true,
    }),
    writeLog,
    ...overrides,
  }
  return { store, writeLog }
}

const capturingEmailProvider = () => {
  const sent: OutboundMessage[] = []
  const provider: NotificationProvider = {
    channel: 'email',
    implemented: true,
    async send(message: OutboundMessage): Promise<ProviderResult> {
      sent.push(message)
      return { status: 'sent', provider: 'fake', error: null, retryCount: 0 }
    },
  }
  return { provider, sent }
}

describe('render utils', () => {
  it('substitutes and HTML-escapes placeholders', () => {
    const out = renderTemplate('Hi {{name}}', { name: '<b>x</b>' })
    expect(out).toBe('Hi &lt;b&gt;x&lt;/b&gt;')
  })
  it('renders missing placeholders as empty', () => {
    expect(renderTemplate('a {{missing}} b', {})).toBe('a  b')
  })
  it('buildVars merges branding, recipient, then data (data wins)', () => {
    const vars = buildVars(branding, { name: 'Jane' }, { user_name: 'Override', reset_link: 'u' })
    expect(vars.company_name).toBe('Estate')
    expect(vars.user_name).toBe('Override')
    expect(vars.reset_link).toBe('u')
  })
  it('escapeHtml handles the dangerous set', () => {
    expect(escapeHtml(`<>&"'`)).toBe('&lt;&gt;&amp;&quot;&#39;')
  })
})

describe('NotificationService', () => {
  it('renders a template, sends via the channel provider, and logs it', async () => {
    const { store, writeLog } = fakeStore()
    const { provider, sent } = capturingEmailProvider()
    const service = new NotificationService(store, [provider])

    const result = await service.send({
      channel: 'email',
      template: 'forgot-password',
      recipient: { email: 'a@b.com', name: 'Jane' },
      data: { reset_link: 'https://x/reset?token=t' },
    })

    expect(result.status).toBe('sent')
    expect(sent).toHaveLength(1)
    expect(sent[0]?.subject).toBe('Hi Jane')
    expect(sent[0]?.html).toContain('https://x/reset?token=t')
    expect(sent[0]?.html).toContain('Estate') // branding wrapper injected
    expect(writeLog).toHaveBeenCalledOnce()
  })

  it('returns not_implemented for a stub channel and still logs', async () => {
    const { store, writeLog } = fakeStore()
    const service = new NotificationService(store, [makeStubProvider('sms')])
    const result = await service.send({
      channel: 'sms',
      template: 'general-notification',
      recipient: { phone: '+100' },
    })
    expect(result.status).toBe('not_implemented')
    expect(writeLog).toHaveBeenCalledOnce()
  })

  it('skips a disabled template without calling the provider', async () => {
    const { store } = fakeStore({
      getTemplate: async (key, channel) => ({ key, channel, subject: 's', bodyHtml: 'b', enabled: false }),
    })
    const { provider, sent } = capturingEmailProvider()
    const service = new NotificationService(store, [provider])
    const result = await service.send({
      channel: 'email',
      template: 'welcome',
      recipient: { email: 'a@b.com' },
    })
    expect(result.status).toBe('skipped')
    expect(sent).toHaveLength(0)
  })

  it('fails when the recipient has no address for the channel', async () => {
    const { store } = fakeStore()
    const { provider } = capturingEmailProvider()
    const service = new NotificationService(store, [provider])
    const result = await service.send({
      channel: 'email',
      template: 'welcome',
      recipient: {},
    })
    expect(result.status).toBe('failed')
  })
})
