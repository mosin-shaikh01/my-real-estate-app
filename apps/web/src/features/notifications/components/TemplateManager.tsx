import { CheckCircle2, Eye, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { TEMPLATE_PLACEHOLDERS, type NotificationTemplateDTO } from '@app/shared'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { FormField, Input } from '@/components/ui/Input'
import { Switch } from '@/components/ui/Switch'
import { cn } from '@/lib/cn'
import {
  usePreviewTemplate,
  useTemplates,
  useUpdateTemplate,
} from '@/features/notifications/api/use-notifications'

export function TemplateManager() {
  const { data: templates, isLoading } = useTemplates()
  // Derive the selection during render — no effect. Null means "first template".
  const [activeKey, setActiveKey] = useState<string | null>(null)

  if (isLoading || !templates) return <Card><Card.Body>Loading templates…</Card.Body></Card>
  const active = templates.find((t) => t.key === activeKey) ?? templates[0]

  return (
    <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
      <Card className="h-fit">
        <Card.Body className="p-2">
          <ul className="flex flex-col">
            {templates.map((t) => (
              <li key={t.key}>
                <button
                  type="button"
                  onClick={() => setActiveKey(t.key)}
                  className={cn(
                    'w-full rounded-md px-3 py-2 text-left text-sm transition-colors',
                    t.key === active?.key
                      ? 'bg-surface-brand-soft font-medium text-text-brand'
                      : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary',
                  )}
                >
                  {t.name}
                  {!t.enabled ? <span className="ml-1 text-2xs text-text-muted">(off)</span> : null}
                </button>
              </li>
            ))}
          </ul>
        </Card.Body>
      </Card>

      {active ? <TemplateEditor key={active.key} template={active} /> : null}
    </div>
  )
}

function TemplateEditor({ template }: { template: NotificationTemplateDTO }) {
  const update = useUpdateTemplate()
  const preview = usePreviewTemplate()
  const [subject, setSubject] = useState(template.subject)
  const [bodyHtml, setBodyHtml] = useState(template.bodyHtml)
  const [enabled, setEnabled] = useState(template.enabled)
  const [saved, setSaved] = useState(false)

  // Live preview: debounce a render call as the admin types.
  useEffect(() => {
    const id = setTimeout(() => {
      preview.mutate({ subject, bodyHtml })
    }, 400)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject, bodyHtml])

  async function onSave() {
    setSaved(false)
    await update.mutateAsync({ key: template.key, input: { subject, bodyHtml, enabled } })
    setSaved(true)
  }

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <Card.Header
          action={
            <span className="flex items-center gap-2 text-xs font-medium text-text-secondary">
              <span>{enabled ? 'Enabled' : 'Disabled'}</span>
              <Switch
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                aria-label="Template enabled"
              />
            </span>
          }
        >
          <Card.Title>{template.name}</Card.Title>
          <Card.Description>Edit the subject and HTML. Branding is added automatically around your body.</Card.Description>
        </Card.Header>
        <Card.Body className="flex flex-col gap-4">
          <FormField label="Subject">
            {(p) => <Input {...p} value={subject} onChange={(e) => setSubject(e.target.value)} />}
          </FormField>
          <FormField label="HTML body">
            {(p) => (
              <textarea
                {...p}
                value={bodyHtml}
                onChange={(e) => setBodyHtml(e.target.value)}
                rows={12}
                spellCheck={false}
                className="w-full rounded-md border border-border-default bg-surface px-3 py-2 font-mono text-xs text-text-primary focus-visible:border-brand-500 focus-visible:outline-2 focus-visible:outline-brand-500"
              />
            )}
          </FormField>

          <div>
            <p className="mb-1.5 text-2xs font-semibold tracking-wide text-text-muted uppercase">Placeholders</p>
            <div className="flex flex-wrap gap-1.5">
              {TEMPLATE_PLACEHOLDERS.map((ph) => (
                <button
                  key={ph}
                  type="button"
                  onClick={() => setBodyHtml((b) => `${b}{{${ph}}}`)}
                  className="rounded-full bg-surface-hover px-2 py-0.5 font-mono text-2xs text-text-secondary hover:bg-surface-brand-soft hover:text-text-brand"
                  title={`Insert {{${ph}}}`}
                >
                  {`{{${ph}}}`}
                </button>
              ))}
            </div>
          </div>
        </Card.Body>
        <Card.Footer>
          {saved ? (
            <span className="mr-auto flex items-center gap-1.5 text-xs text-text-success">
              <CheckCircle2 className="size-4" aria-hidden="true" /> Saved
            </span>
          ) : null}
          <Button type="button" variant="primary" onClick={onSave} disabled={update.isPending}>
            {update.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            Save template
          </Button>
        </Card.Footer>
      </Card>

      <Card>
        <Card.Header>
          <Card.Title className="flex items-center gap-1.5">
            <Eye className="size-4 text-text-muted" aria-hidden="true" /> Live preview
          </Card.Title>
          {preview.data ? <Card.Description>Subject: {preview.data.subject}</Card.Description> : null}
        </Card.Header>
        <Card.Body>
          {preview.data ? (
            <iframe
              title="Email preview"
              sandbox=""
              srcDoc={preview.data.html}
              className="h-[460px] w-full rounded-md border border-border-subtle bg-white"
            />
          ) : (
            <p className="py-8 text-center text-xs text-text-muted">Rendering preview…</p>
          )}
        </Card.Body>
      </Card>
    </div>
  )
}
