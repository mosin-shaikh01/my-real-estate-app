import { zodResolver } from '@hookform/resolvers/zod'
import { Check, Loader2, TriangleAlert } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useState } from 'react'
import { useForm, type UseFormReturn } from 'react-hook-form'
import {
  settingsUpdateSchema,
  type SettingsDTO,
  type SettingsField,
  type SettingsUpdateInput,
} from '@app/shared'
import { PageHeader } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { FormField, Input } from '@/components/ui/Input'
import { useSettings, useUpdateSettings } from '@/features/settings/api/use-settings'
import { AssetUpload } from '@/features/settings/components/AssetUpload'
import { ApiClientError } from '@/lib/api'
import { cn } from '@/lib/cn'

// ============================================================================
// Admin CRM settings — branding + company configuration
// ============================================================================
// One RHF form over the whole settings singleton; tabs just switch which section
// is visible. RHF keeps unmounted fields registered (shouldUnregister defaults
// to false), so values on hidden tabs are still submitted, and a validation error
// on a hidden tab switches to it rather than failing silently.
// ============================================================================

type FieldKind = 'text' | 'email' | 'url' | 'tel' | 'color' | 'multiline'
interface FieldDef {
  name: SettingsField
  label: string
  kind?: FieldKind
  placeholder?: string
  hint?: string
  full?: boolean
  required?: boolean
}
interface SectionDef {
  id: string
  label: string
  description?: string
  fields: FieldDef[]
}

const SECTIONS: SectionDef[] = [
  {
    id: 'branding',
    label: 'Branding',
    description: 'How the CRM presents itself across the app and on the login screen.',
    fields: [
      { name: 'crmName', label: 'CRM / Company name', required: true, placeholder: 'Estate' },
      { name: 'tagline', label: 'Tagline', placeholder: 'Find your next home', full: true },
      { name: 'primaryColor', label: 'Primary brand colour', kind: 'color' },
      { name: 'secondaryColor', label: 'Secondary brand colour', kind: 'color' },
    ],
  },
  {
    id: 'company',
    label: 'Company',
    description: 'Contact and registration details, reused on documents and footers.',
    fields: [
      { name: 'companyName', label: 'Company name' },
      { name: 'ownerName', label: 'Owner / organization name' },
      { name: 'email', label: 'Email address', kind: 'email', placeholder: 'hello@company.com' },
      { name: 'phone', label: 'Phone number', kind: 'tel', placeholder: '+91 22 4000 1000' },
      { name: 'mobile', label: 'Mobile number', kind: 'tel', placeholder: '+91 98765 43210' },
      { name: 'website', label: 'Website', kind: 'url', placeholder: 'https://company.com' },
      { name: 'gstNumber', label: 'GST / Tax ID' },
      { name: 'registrationNumber', label: 'Registration number' },
    ],
  },
  {
    id: 'address',
    label: 'Office address',
    fields: [
      { name: 'addressLine1', label: 'Address line 1', full: true },
      { name: 'addressLine2', label: 'Address line 2', full: true },
      { name: 'city', label: 'City' },
      { name: 'state', label: 'State' },
      { name: 'country', label: 'Country' },
      { name: 'pincode', label: 'ZIP / Postal code' },
      {
        name: 'googleMapUrl',
        label: 'Google Maps link',
        kind: 'url',
        placeholder: 'https://maps.google.com/...',
        full: true,
      },
    ],
  },
  {
    id: 'social',
    label: 'Social media',
    fields: [
      { name: 'facebookUrl', label: 'Facebook', kind: 'url', placeholder: 'https://facebook.com/...' },
      { name: 'instagramUrl', label: 'Instagram', kind: 'url', placeholder: 'https://instagram.com/...' },
      { name: 'linkedinUrl', label: 'LinkedIn', kind: 'url', placeholder: 'https://linkedin.com/company/...' },
      { name: 'youtubeUrl', label: 'YouTube', kind: 'url', placeholder: 'https://youtube.com/@...' },
      { name: 'twitterUrl', label: 'X (Twitter)', kind: 'url', placeholder: 'https://x.com/...' },
      { name: 'whatsappNumber', label: 'WhatsApp', kind: 'tel', placeholder: '+91 98765 43210' },
    ],
  },
  {
    id: 'business',
    label: 'Business',
    fields: [
      { name: 'businessHours', label: 'Business hours', placeholder: 'Mon–Sat, 10:00–19:00', full: true },
      { name: 'description', label: 'Company description', kind: 'multiline', full: true },
      { name: 'about', label: 'About company', kind: 'multiline', full: true },
      { name: 'mission', label: 'Mission', kind: 'multiline', full: true },
      { name: 'vision', label: 'Vision', kind: 'multiline', full: true },
    ],
  },
]

// Which tab a given field lives on — used to jump to a validation error.
const FIELD_TAB = new Map<string, string>(
  SECTIONS.flatMap((s) => s.fields.map((f) => [f.name, s.id] as const)),
)

function toDefaults(s: SettingsDTO): SettingsUpdateInput {
  const out: Record<string, string> = {}
  for (const section of SECTIONS) {
    for (const f of section.fields) {
      const v = s[f.name as keyof SettingsDTO]
      out[f.name] = typeof v === 'string' ? v : ''
    }
  }
  return out as SettingsUpdateInput
}

export default function SettingsPage() {
  const { data, isLoading } = useSettings()

  if (isLoading || !data) {
    return (
      <div className="p-6">
        <div className="h-4 w-40 animate-pulse rounded bg-surface-hover" />
      </div>
    )
  }
  return <SettingsForm settings={data} />
}

function SettingsForm({ settings }: { settings: SettingsDTO }) {
  const reduce = useReducedMotion()
  const update = useUpdateSettings()
  const [tab, setTab] = useState('branding')
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null)

  const form = useForm<SettingsUpdateInput>({
    resolver: zodResolver(settingsUpdateSchema),
    defaultValues: toDefaults(settings),
  })
  const { errors } = form.formState

  const onSubmit = form.handleSubmit(
    async (values) => {
      setToast(null)
      try {
        await update.mutateAsync(values)
        setToast({ kind: 'ok', msg: 'Settings saved' })
      } catch (err) {
        if (err instanceof ApiClientError && err.details) {
          for (const [path, messages] of Object.entries(err.details)) {
            form.setError(path as SettingsField, { message: messages[0] })
          }
          const first = Object.keys(err.details)[0]
          if (first && FIELD_TAB.has(first)) setTab(FIELD_TAB.get(first)!)
          setToast({ kind: 'err', msg: 'Check the highlighted fields' })
          return
        }
        setToast({ kind: 'err', msg: err instanceof Error ? err.message : 'Could not save' })
      }
    },
    (invalid) => {
      // Client-side validation failed — jump to the first errored field's tab.
      const first = Object.keys(invalid)[0]
      if (first && FIELD_TAB.has(first)) setTab(FIELD_TAB.get(first)!)
      setToast({ kind: 'err', msg: 'Check the highlighted fields' })
    },
  )

  const active = SECTIONS.find((s) => s.id === tab)!

  return (
    <>
      <PageHeader title="Settings" description="Manage CRM branding and company configuration." />

      <form onSubmit={onSubmit} className="mx-auto max-w-3xl p-6" noValidate>
        {/* Tabs */}
        <div
          role="tablist"
          aria-label="Settings sections"
          className="mb-5 flex flex-wrap gap-1 border-b border-border-subtle"
        >
          {SECTIONS.map((s) => {
            const selected = s.id === tab
            const hasError = s.fields.some((f) => errors[f.name])
            return (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setTab(s.id)}
                className={cn(
                  'relative -mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
                  selected
                    ? 'border-brand-500 text-text-brand'
                    : 'border-transparent text-text-secondary hover:text-text-primary',
                )}
              >
                {s.label}
                {hasError ? (
                  <TriangleAlert className="size-3.5 text-text-danger" aria-label="has errors" />
                ) : null}
              </button>
            )
          })}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={reduce ? undefined : { opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            <Card>
              <Card.Header>
                <Card.Title>{active.label}</Card.Title>
                {active.description ? <Card.Description>{active.description}</Card.Description> : null}
              </Card.Header>
              <Card.Body className="flex flex-col gap-5">
                {active.id === 'branding' ? (
                  <div className="grid gap-5 sm:grid-cols-2">
                    <AssetUpload
                      asset="logo"
                      currentUrl={settings.logoUrl}
                      label="Company logo"
                      hint="PNG/JPEG/WebP, up to 2 MB. Shown in the sidebar and on login."
                    />
                    <AssetUpload
                      asset="favicon"
                      currentUrl={settings.faviconUrl}
                      label="Favicon"
                      hint="PNG or ICO, up to 2 MB. The browser-tab icon."
                    />
                  </div>
                ) : null}

                <div className="grid gap-4 sm:grid-cols-2">
                  {active.fields.map((f) => (
                    <FieldRow key={f.name} field={f} form={form} />
                  ))}
                </div>
              </Card.Body>
            </Card>
          </motion.div>
        </AnimatePresence>

        <div className="mt-6 flex items-center justify-end gap-3">
          <Button type="submit" variant="primary" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? (
              <>
                <Loader2 className="animate-spin" aria-hidden="true" />
                Saving…
              </>
            ) : (
              'Save settings'
            )}
          </Button>
        </div>
      </form>

      {/* Toast */}
      <AnimatePresence>
        {toast ? (
          <motion.div
            role="status"
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={reduce ? undefined : { opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: 12 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onAnimationComplete={() => {
              if (toast.kind === 'ok') window.setTimeout(() => setToast(null), 2200)
            }}
            className={cn(
              'fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-lg border px-4 py-2.5 text-sm shadow-e3',
              toast.kind === 'ok'
                ? 'border-border-subtle bg-surface-raised text-text-primary'
                : 'border-border-danger-soft bg-surface-danger-soft text-text-danger',
            )}
          >
            {toast.kind === 'ok' ? (
              <Check className="size-4 text-text-success" aria-hidden="true" />
            ) : (
              <TriangleAlert className="size-4" aria-hidden="true" />
            )}
            {toast.msg}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  )
}

function FieldRow({ field, form }: { field: FieldDef; form: UseFormReturn<SettingsUpdateInput> }) {
  const error = form.formState.errors[field.name]?.message
  const span = field.full || field.kind === 'multiline' ? 'sm:col-span-2' : ''

  if (field.kind === 'color') {
    const value = (form.watch(field.name) as string) || ''
    const valid = /^#[0-9a-fA-F]{6}$/.test(value)
    return (
      <div className={span}>
        <FormField label={field.label} error={error} hint="Hex, e.g. #4f46e5">
          {(p) => (
            <div className="flex items-center gap-2">
              <input
                type="color"
                aria-label={`${field.label} picker`}
                value={valid ? value : '#4f46e5'}
                onChange={(e) => form.setValue(field.name, e.target.value, { shouldDirty: true })}
                className="size-9 shrink-0 cursor-pointer rounded-md border border-border-default bg-surface"
              />
              <Input {...p} {...form.register(field.name)} placeholder="#4f46e5" className="font-mono" />
            </div>
          )}
        </FormField>
      </div>
    )
  }

  return (
    <div className={span}>
      <FormField label={field.label} error={error} hint={field.hint} required={field.required}>
        {(p) =>
          field.kind === 'multiline' ? (
            <textarea
              {...p}
              {...form.register(field.name)}
              rows={3}
              className="w-full rounded-md border border-border-default bg-surface px-3 py-2 text-base placeholder:text-text-muted hover:border-border-strong focus-visible:border-brand-500 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-brand-500"
            />
          ) : (
            <Input
              {...p}
              {...form.register(field.name)}
              type={field.kind === 'email' ? 'email' : field.kind === 'tel' ? 'tel' : 'text'}
              inputMode={field.kind === 'url' ? 'url' : undefined}
              placeholder={field.placeholder}
            />
          )
        }
      </FormField>
    </div>
  )
}
