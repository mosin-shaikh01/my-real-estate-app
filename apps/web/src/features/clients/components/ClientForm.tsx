import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router'
import {
  BUYER_TYPE_LABELS,
  clientCreateSchema,
  PROPERTY_TYPE_LABELS,
  type ClientCreateInput,
  type ClientUpdateInput,
  type RequirementInput,
} from '@app/shared'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { FormField, Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Switch } from '@/components/ui/Switch'
import { useToast } from '@/components/ui/use-toast'
import { usePermissions } from '@/features/auth/api/use-auth'
import {
  useCreateClient,
  useUpdateClient,
  useUpsertRequirement,
  type ClientDetailDTO,
} from '@/features/clients/api/use-client'
import { ApiClientError } from '@/lib/api'
import { useUnsavedChanges } from '@/lib/use-unsaved-changes'

// ============================================================================
// ONE form for create AND edit — the same component both pages render, so the
// two can never drift. Mirrors PropertyForm's mode split.
// ============================================================================
//   create → atomic POST /clients { ...client, requirement }
//   edit   → PATCH /clients/:id with ONLY the changed client fields, plus a
//            requirement upsert when a requirement field changed. Sending only
//            dirty fields keeps the activity-log diff exact AND means a field
//            the actor can't see (redacted, so absent from the prefill) is never
//            blanked — you cannot wipe what you never touched.
// ============================================================================

const PRIORITY_OPTIONS = [
  { value: 'HIGH', label: 'High' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'LOW', label: 'Low' },
]
const BUYER_TYPE_OPTIONS = [
  { value: '', label: '— Not set —' },
  ...Object.entries(BUYER_TYPE_LABELS).map(([value, label]) => ({ value, label })),
]
const TYPE_OPTIONS = [
  { value: '', label: 'Any' },
  ...Object.entries(PROPERTY_TYPE_LABELS).map(([value, label]) => ({ value, label })),
]
// A client's PURPOSE maps onto the same listing-type enum a property carries.
const PURPOSE_OPTIONS = [
  { value: '', label: 'Any' },
  { value: 'SALE', label: 'Looking to buy' },
  { value: 'RENT', label: 'Looking to rent' },
  { value: 'BOTH', label: 'Buy or rent' },
]

const CLIENT_FIELD_KEYS = [
  'fullName',
  'phone',
  'email',
  'whatsapp',
  'buyerType',
  'city',
  'importantLead',
  'priority',
  'source',
  'notes',
] as const

/** '' → undefined so an untouched optional never sends a value the schema rejects. */
const blank = (v: unknown) => (v === '' || v == null ? undefined : v)

/** Map the detail DTO onto the form shape for edit-mode prefill. */
function toFormValues(c: ClientDetailDTO): ClientCreateInput {
  const r = c.requirement
  return {
    fullName: c.fullName,
    phone: c.phone ?? '',
    email: c.email ?? '',
    whatsapp: c.whatsapp ?? '',
    buyerType: (c.buyerType ?? undefined) as ClientCreateInput['buyerType'],
    city: c.city ?? '',
    importantLead: c.importantLead,
    priority: c.priority as ClientCreateInput['priority'],
    source: c.source ?? '',
    notes: c.notes ?? '',
    requirement: r
      ? {
          budgetMin: r.budgetMin ?? undefined,
          budgetMax: r.budgetMax ?? undefined,
          areaMin: r.areaMin ?? undefined,
          areaMax: r.areaMax ?? undefined,
          propertyType: (r.propertyType ?? undefined) as RequirementInput['propertyType'],
          listingType: (r.listingType ?? undefined) as RequirementInput['listingType'],
          bedrooms: r.bedrooms ?? undefined,
          city: r.city ?? '',
          locality: r.locality ?? '',
        }
      : {},
  }
}

/** Strip empties from a requirement block; return undefined if nothing is set. */
function cleanRequirement(req: ClientCreateInput['requirement']): RequirementInput | undefined {
  if (!req) return undefined
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(req)) {
    const cleaned = blank(v)
    if (cleaned !== undefined) out[k] = cleaned
  }
  return Object.keys(out).length ? (out as RequirementInput) : undefined
}

export function ClientForm({ mode, client }: { mode: 'create' | 'edit'; client?: ClientDetailDTO }) {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { has } = usePermissions()
  // Internal notes are gated on read; if the actor can't see them, don't offer
  // to edit them (and never risk blanking a value they can't read).
  const canSeeNotes = has('client.internalNotes.view')

  const createClient = useCreateClient()
  const updateClient = useUpdateClient(client?.id ?? '')
  const upsertRequirement = useUpsertRequirement(client?.id ?? '')

  const form = useForm<ClientCreateInput>({
    resolver: zodResolver(clientCreateSchema),
    defaultValues: { fullName: '', phone: '', priority: 'MEDIUM', requirement: {} },
    // `values` re-syncs the baseline once the client loads — RHF's external-data
    // binding, and it makes dirtyFields relative to the saved record.
    values: mode === 'edit' && client ? toFormValues(client) : undefined,
  })

  const errors = form.formState.errors
  const reg = form.register

  // A programmatic redirect after save must not trip the unsaved-changes guard,
  // so we drop `when` to false first (via `saved`), then navigate in an effect.
  const [saved, setSaved] = useState(false)
  useUnsavedChanges(form.formState.isDirty && !saved)

  const goAfterSave = (id: string) => {
    setSaved(true)
    // Defer past the render that clears the guard, or the blocker still fires.
    setTimeout(() => void navigate(`/clients/${id}`), 0)
  }

  const applyServerErrors = (err: unknown, fallback: string) => {
    if (err instanceof ApiClientError && err.details) {
      for (const [path, messages] of Object.entries(err.details)) {
        form.setError(path as keyof ClientCreateInput, { message: messages[0] })
      }
      toast({ variant: 'error', title: 'Check the highlighted fields' })
      return
    }
    form.setError('root', { message: err instanceof Error ? err.message : fallback })
    toast({ variant: 'error', title: fallback, description: err instanceof Error ? err.message : undefined })
  }

  const onSubmit = form.handleSubmit(async (values) => {
    if (mode === 'create') {
      const requirement = cleanRequirement(values.requirement)
      try {
        const res = await createClient.mutateAsync({
          fullName: values.fullName,
          phone: values.phone,
          email: blank(values.email) as string | undefined,
          whatsapp: blank(values.whatsapp) as string | undefined,
          buyerType: values.buyerType ?? undefined,
          city: blank(values.city) as string | undefined,
          importantLead: values.importantLead,
          priority: values.priority,
          source: blank(values.source) as string | undefined,
          notes: blank(values.notes) as string | undefined,
          requirement,
        })
        toast({ variant: 'success', title: 'Client created' })
        goAfterSave(res.data.id)
      } catch (err) {
        applyServerErrors(err, 'Could not create the client')
      }
      return
    }

    // ---- edit ----
    if (!client) return
    const dirty = form.formState.dirtyFields
    // Only the client fields the user actually changed. Empty optionals go as
    // '' so the server's orNull clears them intentionally.
    const patch: ClientUpdateInput = {}
    for (const key of CLIENT_FIELD_KEYS) {
      if (dirty[key]) (patch as Record<string, unknown>)[key] = values[key] ?? ''
    }
    const reqChanged = Boolean(dirty.requirement && Object.keys(dirty.requirement).length)

    try {
      if (Object.keys(patch).length) await updateClient.mutateAsync(patch)
      if (reqChanged) {
        const requirement = cleanRequirement(values.requirement) ?? {}
        await upsertRequirement.mutateAsync(requirement)
      }
      if (!Object.keys(patch).length && !reqChanged) {
        toast({ variant: 'info', title: 'No changes to save' })
        goAfterSave(client.id)
        return
      }
      toast({ variant: 'success', title: 'Client updated' })
      goAfterSave(client.id)
    } catch (err) {
      applyServerErrors(err, 'Could not update the client')
    }
  })

  const submitting = form.formState.isSubmitting
  const cancelHref = mode === 'edit' && client ? `/clients/${client.id}` : '/clients'

  return (
    <form onSubmit={onSubmit} className="mx-auto flex max-w-2xl flex-col gap-6 p-6" noValidate>
      {/* ---- Personal information ---- */}
      <Card>
        <Card.Header>
          <Card.Title>Contact</Card.Title>
        </Card.Header>
        <Card.Body className="grid gap-4 sm:grid-cols-2">
          <FormField label="Full name" error={errors.fullName?.message} required>
            {(p) => <Input {...p} {...reg('fullName')} placeholder="Vikram Malhotra" />}
          </FormField>
          <FormField label="Contact number" error={errors.phone?.message} required>
            {(p) => <Input {...p} {...reg('phone')} placeholder="+91 98765 43210" />}
          </FormField>
          <FormField label="Alternate / WhatsApp number" error={errors.whatsapp?.message}>
            {(p) => <Input {...p} {...reg('whatsapp')} placeholder="+91 90000 00000" />}
          </FormField>
          <FormField label="Email" error={errors.email?.message}>
            {(p) => <Input {...p} {...reg('email')} type="email" placeholder="optional" />}
          </FormField>
          <FormField label="Buyer type" error={errors.buyerType?.message}>
            {() => (
              <Select
                options={BUYER_TYPE_OPTIONS}
                {...reg('buyerType', { setValueAs: (v: string) => (v === '' ? null : v) })}
                value={form.watch('buyerType') ?? ''}
              />
            )}
          </FormField>
          <FormField label="Buyer city" error={errors.city?.message}>
            {(p) => <Input {...p} {...reg('city')} placeholder="Pune" />}
          </FormField>
          <FormField label="Priority" help="How urgently this client needs attention — used to sort and surface follow-ups.">
            {() => (
              <Select options={PRIORITY_OPTIONS} {...reg('priority')} value={form.watch('priority') ?? 'MEDIUM'} />
            )}
          </FormField>
          <FormField label="Source" error={errors.source?.message}>
            {(p) => <Input {...p} {...reg('source')} placeholder="Referral, website…" />}
          </FormField>
          <div className="flex items-center gap-2.5 sm:col-span-2">
            <Switch {...reg('importantLead')} aria-label="Important lead" />
            <div>
              <p className="text-xs font-medium text-text-secondary">Important lead</p>
              <p className="text-2xs text-text-muted">Surfaces first in the clients list with a badge, and is filterable.</p>
            </div>
          </div>
        </Card.Body>
      </Card>

      {/* ---- Requirement ---- */}
      <Card>
        <Card.Header>
          <Card.Title>Requirement</Card.Title>
          <Card.Description>
            What the client is looking for — this drives property matching. All optional.
          </Card.Description>
        </Card.Header>
        <Card.Body className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="Budget min (₹)"
            error={errors.requirement?.budgetMin?.message}
            help="The client's price range — used to match inventory. Visible only to staff with budget access."
          >
            {(p) => <Input {...p} {...reg('requirement.budgetMin')} inputMode="numeric" placeholder="5000000" />}
          </FormField>
          <FormField label="Budget max (₹)" error={errors.requirement?.budgetMax?.message}>
            {(p) => <Input {...p} {...reg('requirement.budgetMax')} inputMode="numeric" placeholder="8000000" />}
          </FormField>
          <FormField label="Area min (sq ft)" error={errors.requirement?.areaMin?.message}>
            {(p) => <Input {...p} {...reg('requirement.areaMin')} inputMode="numeric" placeholder="800" />}
          </FormField>
          <FormField label="Area max (sq ft)" error={errors.requirement?.areaMax?.message}>
            {(p) => <Input {...p} {...reg('requirement.areaMax')} inputMode="numeric" placeholder="1500" />}
          </FormField>
          <FormField label="Property type">
            {() => (
              <Select
                options={TYPE_OPTIONS}
                {...reg('requirement.propertyType', { setValueAs: (v: string) => (v === '' ? null : v) })}
                value={form.watch('requirement.propertyType') ?? ''}
              />
            )}
          </FormField>
          <FormField label="Purpose">
            {() => (
              <Select
                options={PURPOSE_OPTIONS}
                {...reg('requirement.listingType', { setValueAs: (v: string) => (v === '' ? null : v) })}
                value={form.watch('requirement.listingType') ?? ''}
              />
            )}
          </FormField>
          <FormField label="Preferred city" error={errors.requirement?.city?.message}>
            {(p) => <Input {...p} {...reg('requirement.city')} placeholder="Mumbai" />}
          </FormField>
          <FormField label="Preferred locality" error={errors.requirement?.locality?.message}>
            {(p) => <Input {...p} {...reg('requirement.locality')} placeholder="Bandra West" />}
          </FormField>
          <FormField label="Bedrooms" error={errors.requirement?.bedrooms?.message}>
            {(p) => (
              <Input
                {...p}
                type="number"
                min={0}
                {...reg('requirement.bedrooms', {
                  setValueAs: (v: string) => (v === '' ? undefined : Number(v)),
                })}
                placeholder="2"
              />
            )}
          </FormField>
        </Card.Body>
      </Card>

      {/* ---- Internal notes: gated by the same permission that reveals them ---- */}
      {canSeeNotes ? (
        <Card>
          <Card.Header>
            <Card.Title>Notes</Card.Title>
            <Card.Description>Private — visible only to admins and permitted users, never to agents.</Card.Description>
          </Card.Header>
          <Card.Body>
            <FormField label="Internal notes" error={errors.notes?.message}>
              {(p) => (
                <textarea
                  {...p}
                  {...reg('notes')}
                  rows={3}
                  placeholder="e.g. Prefers a high floor; decision-maker is the spouse."
                  className="w-full rounded-md border border-border-default bg-surface px-3 py-2 text-base placeholder:text-text-muted hover:border-border-strong focus-visible:border-brand-500 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-brand-500"
                />
              )}
            </FormField>
          </Card.Body>
        </Card>
      ) : null}

      {errors.root ? (
        <p role="alert" className="rounded-md border border-border-danger-soft bg-surface-danger-soft/40 px-3 py-2 text-xs text-text-danger">
          {errors.root.message}
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-2">
        <Button variant="secondary" onClick={() => void navigate(cancelHref)}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={submitting}>
          {submitting ? (
            <>
              <Loader2 className="animate-spin" aria-hidden="true" />
              {mode === 'edit' ? 'Saving…' : 'Creating…'}
            </>
          ) : mode === 'edit' ? (
            'Save changes'
          ) : (
            'Create client'
          )}
        </Button>
      </div>
    </form>
  )
}
