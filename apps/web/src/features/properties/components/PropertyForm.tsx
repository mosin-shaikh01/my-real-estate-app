import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router'
import {
  PROPERTY_TYPE_LABELS,
  propertyCreateSchema,
  type PropertyCreateInput,
} from '@app/shared'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { FormField, Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { useCreateProperty } from '@/features/properties/api/use-property-mutations'
import { ApiClientError } from '@/lib/api'

// RHF + the SHARED Zod schema — the exact schema the server parses. The
// cross-field price rule ("sale price required when for sale") runs here inline
// AND on the server; the server-only rule (agent must be active) comes back as
// a field-keyed error and maps onto RHF via setError. Same schema, same paths.

const TYPE_OPTIONS = Object.entries(PROPERTY_TYPE_LABELS).map(([value, label]) => ({ value, label }))
const LISTING_OPTIONS = [
  { value: 'SALE', label: 'For sale' },
  { value: 'RENT', label: 'For rent' },
  { value: 'BOTH', label: 'Sale & rent' },
]

export function PropertyForm() {
  const navigate = useNavigate()
  const create = useCreateProperty()

  const form = useForm<PropertyCreateInput>({
    resolver: zodResolver(propertyCreateSchema),
    defaultValues: {
      title: '',
      description: '',
      propertyType: 'APARTMENT',
      listingType: 'SALE',
      city: '',
      state: 'Maharashtra',
      address: '',
      pincode: '',
      areaSqft: '',
    },
  })

  const listingType = form.watch('listingType')
  const showSale = listingType === 'SALE' || listingType === 'BOTH'
  const showRent = listingType === 'RENT' || listingType === 'BOTH'

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const res = await create.mutateAsync(values)
      void navigate(`/properties/${res.data.id}`)
    } catch (err) {
      if (err instanceof ApiClientError && err.details) {
        for (const [path, messages] of Object.entries(err.details)) {
          form.setError(path as keyof PropertyCreateInput, { message: messages[0] })
        }
        return
      }
      form.setError('root', {
        message: err instanceof Error ? err.message : 'Could not create the property',
      })
    }
  })

  return (
    <form onSubmit={onSubmit} className="mx-auto flex max-w-3xl flex-col gap-6 p-6" noValidate>
      <Card>
        <Card.Header>
          <Card.Title>Basics</Card.Title>
        </Card.Header>
        <Card.Body className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <FormField label="Title" error={form.formState.errors.title?.message} required>
              {(p) => <Input {...p} {...form.register('title')} placeholder="3 BHK Sea-Facing Apartment in Bandra West" />}
            </FormField>
          </div>
          <div className="sm:col-span-2">
            <FormField label="Description" error={form.formState.errors.description?.message} required>
              {(p) => (
                <textarea
                  {...p}
                  {...form.register('description')}
                  rows={3}
                  className="w-full rounded-md border border-border-default bg-surface px-3 py-2 text-base placeholder:text-text-muted hover:border-border-strong focus-visible:border-brand-500 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-brand-500"
                />
              )}
            </FormField>
          </div>
          <FormField label="Property type" error={form.formState.errors.propertyType?.message} required>
            {() => (
              <Select
                options={TYPE_OPTIONS}
                {...form.register('propertyType')}
                value={form.watch('propertyType')}
              />
            )}
          </FormField>
          <FormField label="Listing" error={form.formState.errors.listingType?.message} required>
            {() => (
              <Select options={LISTING_OPTIONS} {...form.register('listingType')} value={listingType} />
            )}
          </FormField>
        </Card.Body>
      </Card>

      <Card>
        <Card.Header>
          <Card.Title>Pricing & size</Card.Title>
          <Card.Description>Amounts in rupees. A listing shows the price it&rsquo;s listed for.</Card.Description>
        </Card.Header>
        <Card.Body className="grid gap-4 sm:grid-cols-2">
          {/* Fields appear based on listingType via watch() — the whole reason
              the two prices are separate columns. */}
          {showSale ? (
            <FormField label="Sale price (₹)" error={form.formState.errors.salePrice?.message}>
              {(p) => <Input {...p} {...form.register('salePrice')} inputMode="numeric" placeholder="7500000" />}
            </FormField>
          ) : null}
          {showRent ? (
            <FormField label="Rent per month (₹)" error={form.formState.errors.rentPricePerMonth?.message}>
              {(p) => <Input {...p} {...form.register('rentPricePerMonth')} inputMode="numeric" placeholder="45000" />}
            </FormField>
          ) : null}
          <FormField label="Area (sq ft)" error={form.formState.errors.areaSqft?.message} required>
            {(p) => <Input {...p} {...form.register('areaSqft')} inputMode="numeric" placeholder="1200" />}
          </FormField>
          <FormField label="Bedrooms" error={form.formState.errors.bedrooms?.message}>
            {(p) => <Input {...p} type="number" {...form.register('bedrooms', { valueAsNumber: true })} />}
          </FormField>
        </Card.Body>
      </Card>

      <Card>
        <Card.Header>
          <Card.Title>Location</Card.Title>
        </Card.Header>
        <Card.Body className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <FormField label="Address" error={form.formState.errors.address?.message} required>
              {(p) => <Input {...p} {...form.register('address')} />}
            </FormField>
          </div>
          <FormField label="City" error={form.formState.errors.city?.message} required>
            {(p) => <Input {...p} {...form.register('city')} placeholder="Mumbai" />}
          </FormField>
          <FormField label="Pincode" error={form.formState.errors.pincode?.message} required>
            {(p) => <Input {...p} {...form.register('pincode')} inputMode="numeric" placeholder="400050" />}
          </FormField>
        </Card.Body>
      </Card>

      {form.formState.errors.root ? (
        <p role="alert" className="rounded-md border border-danger-100 bg-danger-100/40 px-3 py-2 text-xs text-danger-700">
          {form.formState.errors.root.message}
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-2">
        <Button variant="secondary" onClick={() => void navigate('/properties')}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? (
            <>
              <Loader2 className="animate-spin" aria-hidden="true" />
              Creating…
            </>
          ) : (
            'Create property'
          )}
        </Button>
      </div>
    </form>
  )
}
