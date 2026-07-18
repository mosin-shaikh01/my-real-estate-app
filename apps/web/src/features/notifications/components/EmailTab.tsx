import { zodResolver } from '@hookform/resolvers/zod'
import { CheckCircle2, Loader2, Send, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import {
  EMAIL_PROVIDER_PRESETS,
  SMTP_ENCRYPTIONS,
  emailProviderConfigSchema,
  testEmailSchema,
  type EmailProviderConfigInput,
} from '@app/shared'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { FormField, Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { ApiClientError } from '@/lib/api'
import { cn } from '@/lib/cn'
import {
  useEmailConfig,
  useSendTestEmail,
  useUpdateEmailConfig,
} from '@/features/notifications/api/use-notifications'

const ENCRYPTION_OPTIONS = [
  { value: 'none', label: 'None (not recommended)' },
  { value: 'ssl', label: 'SSL/TLS — implicit (port 465)' },
  { value: 'tls', label: 'STARTTLS (port 587)' },
] satisfies { value: (typeof SMTP_ENCRYPTIONS)[number]; label: string }[]

const PROVIDER_OPTIONS = EMAIL_PROVIDER_PRESETS.map((p) => ({ value: p.id, label: p.label }))

export function EmailTab() {
  const { data: config, isLoading } = useEmailConfig()
  const update = useUpdateEmailConfig()
  const [saved, setSaved] = useState(false)

  const form = useForm<EmailProviderConfigInput>({
    resolver: zodResolver(emailProviderConfigSchema),
    defaultValues: {
      enabled: false,
      provider: 'custom',
      host: '',
      port: 587,
      encryption: 'tls',
      username: '',
      password: '',
      senderName: '',
      senderEmail: '',
      replyTo: '',
    },
  })
  const { register, handleSubmit, reset, setValue, control, formState } = form

  // Load stored config into the form. Password stays blank — a blank submit means
  // "keep the stored one" (the DTO only tells us whether one exists).
  useEffect(() => {
    if (config) {
      reset({
        enabled: config.enabled,
        provider: config.provider,
        host: config.host,
        port: config.port,
        encryption: config.encryption,
        username: config.username,
        password: '',
        senderName: config.senderName,
        senderEmail: config.senderEmail,
        replyTo: config.replyTo,
      })
    }
  }, [config, reset])

  const provider = useWatch({ control, name: 'provider' })
  const enabled = useWatch({ control, name: 'enabled' })
  const encryption = useWatch({ control, name: 'encryption' })

  // Selecting a provider preset fills host/port/encryption (still overridable).
  function applyPreset(id: string) {
    setValue('provider', id, { shouldDirty: true })
    const preset = EMAIL_PROVIDER_PRESETS.find((p) => p.id === id)
    if (preset && id !== 'custom') {
      setValue('host', preset.host, { shouldDirty: true })
      setValue('port', preset.port, { shouldDirty: true })
      setValue('encryption', preset.encryption, { shouldDirty: true })
    }
  }

  const presetNote = EMAIL_PROVIDER_PRESETS.find((p) => p.id === provider)?.note

  const onSubmit = handleSubmit(async (values) => {
    setSaved(false)
    try {
      await update.mutateAsync(values)
      setSaved(true)
      setValue('password', '') // clear the just-saved secret from the field
    } catch (err) {
      if (err instanceof ApiClientError && err.details) {
        for (const [path, messages] of Object.entries(err.details)) {
          form.setError(path as keyof EmailProviderConfigInput, { message: messages[0] })
        }
      } else if (err instanceof ApiClientError) {
        form.setError('root', { message: err.message })
      }
    }
  })

  if (isLoading) return <Card><Card.Body>Loading…</Card.Body></Card>

  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={onSubmit} noValidate>
        <Card>
          <Card.Header action={
            <label className="flex items-center gap-2 text-xs font-medium text-text-secondary">
              <input type="checkbox" {...register('enabled')} className="size-4 accent-[var(--color-brand-600)]" />
              {enabled ? 'Enabled' : 'Disabled'}
            </label>
          }>
            <Card.Title>Email (SMTP)</Card.Title>
            <Card.Description>
              Configure how the CRM sends email. When disabled or unconfigured, messages are logged to
              the server console instead of being delivered.
            </Card.Description>
          </Card.Header>
          <Card.Body className="flex flex-col gap-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <FormField label="Provider">
                {() => (
                  <Select
                    options={PROVIDER_OPTIONS}
                    value={provider}
                    onChange={(e) => applyPreset(e.target.value)}
                  />
                )}
              </FormField>
              <FormField label="Encryption" error={formState.errors.encryption?.message}>
                {() => (
                  <Select
                    options={ENCRYPTION_OPTIONS}
                    value={encryption}
                    onChange={(e) => setValue('encryption', e.target.value as EmailProviderConfigInput['encryption'], { shouldDirty: true })}
                  />
                )}
              </FormField>
            </div>

            {presetNote ? (
              <p className="-mt-2 rounded-md bg-surface-brand-soft/50 px-3 py-2 text-xs text-text-secondary">
                {presetNote}
              </p>
            ) : null}

            <div className="grid gap-5 sm:grid-cols-2">
              <FormField label="SMTP host" error={formState.errors.host?.message} required>
                {(p) => <Input {...p} {...register('host')} placeholder="smtp.example.com" />}
              </FormField>
              <FormField label="SMTP port" error={formState.errors.port?.message} required>
                {(p) => <Input {...p} type="number" {...register('port', { valueAsNumber: true })} placeholder="587" />}
              </FormField>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <FormField label="Username" error={formState.errors.username?.message}>
                {(p) => <Input {...p} {...register('username')} autoComplete="off" placeholder="you@example.com" />}
              </FormField>
              <FormField
                label="Password"
                error={formState.errors.password?.message}
                help={config?.hasPassword ? 'A password is stored. Leave blank to keep it.' : undefined}
              >
                {(p) => (
                  <Input
                    {...p}
                    type="password"
                    {...register('password')}
                    autoComplete="new-password"
                    placeholder={config?.hasPassword ? '•••••••• (unchanged)' : 'SMTP password / API key'}
                  />
                )}
              </FormField>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <FormField label="Sender name" error={formState.errors.senderName?.message} required>
                {(p) => <Input {...p} {...register('senderName')} placeholder="Estate CRM" />}
              </FormField>
              <FormField label="Sender email" error={formState.errors.senderEmail?.message} required>
                {(p) => <Input {...p} type="email" {...register('senderEmail')} placeholder="no-reply@example.com" />}
              </FormField>
            </div>

            <FormField label="Reply-to (optional)" error={formState.errors.replyTo?.message}>
              {(p) => <Input {...p} type="email" {...register('replyTo')} placeholder="support@example.com" />}
            </FormField>

            {formState.errors.root ? (
              <p role="alert" className="rounded-md border border-border-danger-soft bg-surface-danger-soft/40 px-3 py-2 text-xs text-text-danger">
                {formState.errors.root.message}
              </p>
            ) : null}
          </Card.Body>
          <Card.Footer>
            {saved ? (
              <span className="mr-auto flex items-center gap-1.5 text-xs text-text-success">
                <CheckCircle2 className="size-4" aria-hidden="true" /> Saved
              </span>
            ) : null}
            <Button type="submit" variant="primary" disabled={update.isPending}>
              {update.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
              Save configuration
            </Button>
          </Card.Footer>
        </Card>
      </form>

      <TestEmailCard />
    </div>
  )
}

function TestEmailCard() {
  const send = useSendTestEmail()
  const form = useForm<{ to: string }>({
    resolver: zodResolver(testEmailSchema),
    defaultValues: { to: '' },
  })

  const onSubmit = form.handleSubmit(async ({ to }) => {
    send.reset()
    await send.mutateAsync(to).catch(() => {})
  })

  const result = send.data

  return (
    <Card>
      <Card.Header>
        <Card.Title>Send a test email</Card.Title>
        <Card.Description>Verify your configuration by sending a real email to an address you control.</Card.Description>
      </Card.Header>
      <Card.Body>
        <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end" noValidate>
          <div className="flex-1">
            <FormField label="Recipient" error={form.formState.errors.to?.message}>
              {(p) => <Input {...p} type="email" {...form.register('to')} placeholder="you@example.com" />}
            </FormField>
          </div>
          <Button type="submit" variant="secondary" disabled={send.isPending}>
            {send.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
            Send test
          </Button>
        </form>

        {result ? (
          <div
            role="status"
            className={cn(
              'mt-4 flex items-start gap-2 rounded-md border px-3 py-2 text-xs',
              result.status === 'sent'
                ? 'border-border-success-soft bg-surface-success-soft/40 text-text-success'
                : 'border-border-danger-soft bg-surface-danger-soft/40 text-text-danger',
            )}
          >
            {result.status === 'sent' ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            ) : (
              <XCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            )}
            <div>
              {result.status === 'sent' ? (
                <p>Test email sent via {result.provider ?? 'email'}.</p>
              ) : (
                <p>Failed to send{result.error ? `: ${result.error}` : ''}.</p>
              )}
              {result.previewUrl ? (
                <a href={result.previewUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                  View the preview (Ethereal)
                </a>
              ) : null}
            </div>
          </div>
        ) : null}
      </Card.Body>
    </Card>
  )
}
