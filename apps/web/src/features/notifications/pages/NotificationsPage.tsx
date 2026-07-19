import { useState, type ReactNode } from 'react'
import { PageHeader } from '@/components/layout/AppShell'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/cn'
import { usePermissions } from '@/features/auth/api/use-auth'
import { ComingSoon } from '@/features/notifications/components/ComingSoon'
import { EmailTab } from '@/features/notifications/components/EmailTab'
import { LogsTable } from '@/features/notifications/components/LogsTable'
import { TemplateManager } from '@/features/notifications/components/TemplateManager'

// Settings → Notifications. Email/Templates/Logs are live; the other channels
// are "coming soon" but present so the shape of the platform is visible. Editing
// (config/templates) needs notifications.manage; the page itself needs .view.
type TabId = 'email' | 'templates' | 'logs' | 'sms' | 'whatsapp' | 'push' | 'in_app' | 'general'

const TABS: { id: TabId; label: string }[] = [
  { id: 'email', label: 'Email' },
  { id: 'templates', label: 'Templates' },
  { id: 'logs', label: 'Logs' },
  { id: 'sms', label: 'SMS' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'push', label: 'Push' },
  { id: 'in_app', label: 'In-App' },
  { id: 'general', label: 'General' },
]

export default function NotificationsPage() {
  const [tab, setTab] = useState<TabId>('email')
  const { has } = usePermissions()
  const canManage = has('notifications.manage')

  return (
    <>
      <PageHeader title="Notifications" description="The CRM's communication layer — providers, templates and delivery logs." />

      <div className="mx-auto max-w-4xl p-6">
        <div role="tablist" aria-label="Notification channels" className="mb-5 flex flex-wrap gap-1 border-b border-border-subtle">
          {TABS.map((t) => {
            const selected = t.id === tab
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setTab(t.id)}
                className={cn(
                  'relative -mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
                  selected
                    ? 'border-brand-500 text-text-brand'
                    : 'border-transparent text-text-secondary hover:text-text-primary',
                )}
              >
                {t.label}
              </button>
            )
          })}
        </div>

        {!canManage && (tab === 'email' || tab === 'templates') ? (
          <ReadOnlyNotice />
        ) : null}

        {tab === 'email' ? <EmailTab /> : null}
        {tab === 'templates' ? <TemplateManager /> : null}
        {tab === 'logs' ? <LogsTable /> : null}
        {tab === 'general' ? <GeneralTab /> : null}
        {tab === 'sms' ? <ComingSoon channel="SMS" blurb="Send transactional SMS via Twilio, Vonage or MSG91. The provider interface is already wired." /> : null}
        {tab === 'whatsapp' ? <ComingSoon channel="WhatsApp" blurb="Deliver messages through the WhatsApp Business / Cloud API." /> : null}
        {tab === 'push' ? <ComingSoon channel="Push" blurb="Web and mobile push via FCM / APNs / Web Push." /> : null}
        {tab === 'in_app' ? <ComingSoon channel="In-App" blurb="An in-product notification inbox with a bell and unread counts." /> : null}
      </div>
    </>
  )
}

function ReadOnlyNotice() {
  return (
    <p className="mb-4 rounded-md border border-border-subtle bg-surface-raised px-3 py-2 text-xs text-text-muted">
      You can view these settings. Editing requires the <span className="font-medium">Manage notifications</span> permission.
    </p>
  )
}

function GeneralTab(): ReactNode {
  return (
    <Card>
      <Card.Header>
        <Card.Title>General</Card.Title>
        <Card.Description>How notifications are branded and delivered across every channel.</Card.Description>
      </Card.Header>
      <Card.Body className="flex flex-col gap-3 text-sm text-text-secondary">
        <p>
          Branding (company name, logo, colours, address, website and support email) is pulled from{' '}
          <span className="font-medium text-text-primary">Settings → Branding &amp; Company</span> and injected into every
          message automatically — you don't set it here.
        </p>
        <p>
          Delivery is handled by a single Notification Service. Every feature sends through it, so adding a channel
          (SMS, WhatsApp, …) never touches business logic. Sends are recorded on the <span className="font-medium text-text-primary">Logs</span> tab.
        </p>
      </Card.Body>
    </Card>
  )
}
