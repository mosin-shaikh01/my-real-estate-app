import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowRight, Check, Loader2, Wand2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate, useSearchParams } from 'react-router'
import {
  clientCreateSchema,
  PROPERTY_TYPE_LABELS,
  type ClientCreateInput,
  type PropertyStatus,
} from '@app/shared'
import { PageHeader } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { FormField, Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Table, TableEmpty, TableWrapper, TD, TH, THead, TR } from '@/components/ui/Table'
import { useClient, useBulkAssign, useCreateClient } from '@/features/clients/api/use-client'
import {
  useProperties,
  type PropertyFilters,
} from '@/features/properties/api/use-properties'
import { requirementToFilters } from '@/features/requirements/lib/requirement-to-filters'
import { ApiClientError } from '@/lib/api'
import { formatMoneyShort } from '@/lib/format'

const TYPE_OPTIONS = Object.entries(PROPERTY_TYPE_LABELS).map(([value, label]) => ({ value, label }))

// The detail DTO types enum fields as plain `string` (it serialises whatever the
// DB holds); the form's schema wants the enum. This one cast, in one place,
// keeps that boundary honest instead of scattering `as` through the JSX.
type ReqInput = NonNullable<ClientCreateInput['requirement']>
function mapRequirement(r: { propertyType: string | null; bedrooms: number | null; city: string | null; budgetMin?: string | null; budgetMax?: string | null } | undefined): ReqInput {
  if (!r) return {}
  return {
    propertyType: (r.propertyType ?? undefined) as ReqInput['propertyType'],
    bedrooms: r.bedrooms ?? undefined,
    city: r.city ?? undefined,
    budgetMin: r.budgetMin ?? undefined,
    budgetMax: r.budgetMax ?? undefined,
  }
}

// ============================================================================
// The Requirement → Match → Assign screen. The core feature.
// ============================================================================
// TWO STRUCTURALLY SEPARATE FORMS. The requirement is a real <form>; the search
// filters are controls OUTSIDE it. That is deliberate: nest the search inside
// the requirement form and Enter in a filter submits the wrong thing. Making
// them siblings means Enter in a filter does nothing — exactly what we want.
//
// The search PREFILLS FROM THE REQUIREMENT (budget → price band, city, beds).
// That's what makes the screen feel intelligent instead of like two widgets
// stacked. "Match from requirement" re-syncs on demand rather than fighting the
// admin every keystroke.
//
// Two modes:
//   new client (default) → atomic POST /clients { client, requirement, propertyIds }
//   ?clientId=X          → existing client, requirement prefilled, bulk-assign
// ============================================================================

export default function RequirementMatchPage() {
  const [params] = useSearchParams()
  const clientId = params.get('clientId') ?? undefined
  const isExisting = Boolean(clientId)

  const navigate = useNavigate()
  const { data: existingClient } = useClient(clientId)
  const createClient = useCreateClient()
  const bulkAssign = useBulkAssign(clientId ?? '')

  const [filters, setFilters] = useState<PropertyFilters>({ status: 'AVAILABLE' })
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [submitError, setSubmitError] = useState<string | null>(null)

  // `values` (not defaultValues) so the form re-syncs once the existing client
  // loads — RHF's idiomatic external-data binding, and it avoids a setState in
  // an effect. undefined in new-client mode leaves the defaults untouched.
  const syncedValues: ClientCreateInput | undefined =
    isExisting && existingClient
      ? {
          fullName: existingClient.fullName,
          phone: ('phone' in existingClient ? existingClient.phone : '') ?? '',
          priority: existingClient.priority as ClientCreateInput['priority'],
          requirement: mapRequirement(existingClient.requirement),
        }
      : undefined

  const form = useForm<ClientCreateInput>({
    resolver: zodResolver(clientCreateSchema),
    defaultValues: { fullName: '', phone: '', priority: 'MEDIUM', requirement: {} },
    values: syncedValues,
  })

  const syncFilters = () => {
    setFilters(requirementToFilters(form.getValues('requirement') ?? {}))
  }

  const { data, isLoading } = useProperties({ ...filters, page: 1 })
  const results = data?.data ?? []

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const onAssign = form.handleSubmit(async (values) => {
    setSubmitError(null)
    const propertyIds = [...selected]
    try {
      if (isExisting && clientId) {
        if (propertyIds.length === 0) {
          setSubmitError('Select at least one property to assign.')
          return
        }
        await bulkAssign.mutateAsync(propertyIds)
        void navigate(`/clients/${clientId}`)
      } else {
        // Drop an all-empty requirement so we don't persist a blank row. If any
        // field was filled, keep the whole thing.
        const req = values.requirement
        const hasReq = req && Object.values(req).some((v) => v != null && v !== '')
        const res = await createClient.mutateAsync({
          ...values,
          requirement: hasReq ? req : undefined,
          propertyIds,
        })
        void navigate(`/clients/${res.data.id}`)
      }
    } catch (err) {
      if (err instanceof ApiClientError && err.details) {
        for (const [path, messages] of Object.entries(err.details)) {
          form.setError(path as keyof ClientCreateInput, { message: messages[0] })
        }
        return
      }
      setSubmitError(err instanceof Error ? err.message : 'Could not assign')
    }
  })

  const submitting = form.formState.isSubmitting

  return (
    <>
      <PageHeader
        title={isExisting ? `Match properties for ${existingClient?.fullName ?? '…'}` : 'New client & match'}
        description="Capture what the client wants, find matching inventory, and share it."
      />

      <div className="grid gap-6 p-6 lg:grid-cols-5">
        {/* ---- Requirement form (a real <form>) ---- */}
        <div className="lg:col-span-2">
          <Card>
            <Card.Header>
              <Card.Title>{isExisting ? 'Requirement' : 'Client & requirement'}</Card.Title>
              <Card.Description>
                {isExisting ? 'Prefilled from the saved requirement.' : 'Everything but name and phone is optional.'}
              </Card.Description>
            </Card.Header>
            <Card.Body>
              <form id="requirement-form" onSubmit={onAssign} className="flex flex-col gap-4" noValidate>
                {!isExisting ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField label="Client name" error={form.formState.errors.fullName?.message} required>
                      {(p) => <Input {...p} {...form.register('fullName')} placeholder="Vikram Malhotra" />}
                    </FormField>
                    <FormField label="Phone" error={form.formState.errors.phone?.message} required>
                      {(p) => <Input {...p} {...form.register('phone')} placeholder="+91 98765 43210" />}
                    </FormField>
                  </div>
                ) : null}

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField label="Budget min (₹)">
                    {(p) => <Input {...p} {...form.register('requirement.budgetMin')} inputMode="numeric" placeholder="5000000" />}
                  </FormField>
                  <FormField label="Budget max (₹)">
                    {(p) => <Input {...p} {...form.register('requirement.budgetMax')} inputMode="numeric" placeholder="8000000" />}
                  </FormField>
                  <FormField label="Property type">
                    {() => (
                      <Select
                        placeholder="Any"
                        options={TYPE_OPTIONS}
                        {...form.register('requirement.propertyType')}
                        value={form.watch('requirement.propertyType') ?? ''}
                      />
                    )}
                  </FormField>
                  <FormField label="Bedrooms">
                    {(p) => <Input {...p} type="number" {...form.register('requirement.bedrooms', { valueAsNumber: true })} placeholder="2" />}
                  </FormField>
                  <div className="sm:col-span-2">
                    <FormField label="City">
                      {(p) => <Input {...p} {...form.register('requirement.city')} placeholder="Mumbai" />}
                    </FormField>
                  </div>
                </div>

                <Button type="button" variant="secondary" onClick={syncFilters}>
                  <Wand2 aria-hidden="true" />
                  Match from requirement
                  <ArrowRight aria-hidden="true" />
                </Button>
              </form>
            </Card.Body>
          </Card>
        </div>

        {/* ---- Search + results (siblings of the form, NOT nested) ---- */}
        <div className="lg:col-span-3">
          <Card className="overflow-hidden">
            <Card.Header
              action={
                <span className="text-xs text-text-muted">
                  {selected.size} selected
                </span>
              }
            >
              <Card.Title>Matching properties</Card.Title>
              <Card.Description>
                {filtersSummary(filters)} · tick the ones to share.
              </Card.Description>
            </Card.Header>

            <TableWrapper className="rounded-none border-0">
              <Table>
                <THead>
                  <tr>
                    <TH className="w-10"><span className="sr-only">Select</span></TH>
                    <TH>Property</TH>
                    <TH className="w-28">Status</TH>
                    <TH numeric className="w-20">Beds</TH>
                    <TH numeric className="w-28">Price</TH>
                  </tr>
                </THead>
                <tbody>
                  {isLoading ? (
                    <TableEmpty colSpan={5} title="Searching…" />
                  ) : results.length ? (
                    results.map((p) => {
                      const checked = selected.has(p.id)
                      return (
                        <TR key={p.id} selected={checked}>
                          <TD>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggle(p.id)}
                              aria-label={`Select ${p.code}`}
                              className="size-3.5 accent-brand-600"
                            />
                          </TD>
                          <TD className="max-w-0">
                            <span className="block truncate font-medium text-text-primary">{p.title}</span>
                            <span className="block truncate text-2xs text-text-muted">
                              <span className="font-mono">{p.code}</span> · {[p.locality, p.city].filter(Boolean).join(', ')}
                            </span>
                          </TD>
                          <TD><StatusBadge status={p.status as PropertyStatus} /></TD>
                          <TD numeric className="text-text-secondary">{p.bedrooms ?? '—'}</TD>
                          <TD numeric className="font-medium">
                            {p.salePrice
                              ? formatMoneyShort(p.salePrice)
                              : p.rentPricePerMonth
                                ? `${formatMoneyShort(p.rentPricePerMonth)}/mo`
                                : '—'}
                          </TD>
                        </TR>
                      )
                    })
                  ) : (
                    <TableEmpty
                      colSpan={5}
                      title="No matching properties"
                      hint="Widen the budget or clear a filter, then Match from requirement again."
                    />
                  )}
                </tbody>
              </Table>
            </TableWrapper>

            <Card.Footer>
              {submitError ? (
                <p role="alert" className="mr-auto text-xs text-danger-700">{submitError}</p>
              ) : (
                <p className="mr-auto text-xs text-text-muted">
                  {isExisting ? 'Assigns to this client.' : 'Creates the client and shares these in one step.'}
                </p>
              )}
              <Button
                type="submit"
                form="requirement-form"
                variant="primary"
                disabled={submitting || (isExisting && selected.size === 0)}
              >
                {submitting ? (
                  <>
                    <Loader2 className="animate-spin" aria-hidden="true" />
                    Assigning…
                  </>
                ) : (
                  <>
                    <Check aria-hidden="true" />
                    {isExisting ? `Assign ${selected.size} selected` : 'Create & assign'}
                  </>
                )}
              </Button>
            </Card.Footer>
          </Card>
        </div>
      </div>
    </>
  )
}

function filtersSummary(f: PropertyFilters): string {
  const parts: string[] = []
  if (f.city) parts.push(f.city)
  if (f.bedrooms) parts.push(`${f.bedrooms} BHK`)
  if (f.propertyType) parts.push(PROPERTY_TYPE_LABELS[f.propertyType as keyof typeof PROPERTY_TYPE_LABELS] ?? f.propertyType)
  if (f.minPrice || f.maxPrice) parts.push('within budget')
  return parts.length ? parts.join(' · ') : 'Available inventory'
}
