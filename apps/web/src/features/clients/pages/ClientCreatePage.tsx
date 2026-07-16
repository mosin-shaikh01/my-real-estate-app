import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router'
import {
  clientCreateSchema,
  PROPERTY_TYPE_LABELS,
  type ClientCreateInput,
} from '@app/shared'
import { PageHeader } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { FormField, Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { useCreateClient } from '@/features/clients/api/use-client'
import { ApiClientError } from '@/lib/api'

const TYPE_OPTIONS = Object.entries(PROPERTY_TYPE_LABELS).map(([value, label]) => ({ value, label }))

// A contact + an optional first requirement. This is the reduced form of what
// Phase 5's matching screen posts — same clientCreateSchema, same atomic POST.
export default function ClientCreatePage() {
  const navigate = useNavigate()
  const create = useCreateClient()

  const form = useForm<ClientCreateInput>({
    resolver: zodResolver(clientCreateSchema),
    defaultValues: { fullName: '', phone: '', priority: 'MEDIUM' },
  })

  const onSubmit = form.handleSubmit(async (values) => {
    // Drop an empty requirement block so the schema's optional stays optional.
    const payload: ClientCreateInput = { ...values }
    if (payload.requirement && !payload.requirement.budgetMax && !payload.requirement.city) {
      delete payload.requirement
    }
    try {
      const res = await create.mutateAsync(payload)
      void navigate(`/clients/${res.data.id}`)
    } catch (err) {
      if (err instanceof ApiClientError && err.details) {
        for (const [path, messages] of Object.entries(err.details)) {
          form.setError(path as keyof ClientCreateInput, { message: messages[0] })
        }
        return
      }
      form.setError('root', { message: err instanceof Error ? err.message : 'Could not create the client' })
    }
  })

  return (
    <>
      <PageHeader title="New client" description="Capture a contact and, optionally, what they're looking for." />
      <form onSubmit={onSubmit} className="mx-auto flex max-w-2xl flex-col gap-6 p-6" noValidate>
        <Card>
          <Card.Header>
            <Card.Title>Contact</Card.Title>
          </Card.Header>
          <Card.Body className="grid gap-4 sm:grid-cols-2">
            <FormField label="Full name" error={form.formState.errors.fullName?.message} required>
              {(p) => <Input {...p} {...form.register('fullName')} placeholder="Vikram Malhotra" />}
            </FormField>
            <FormField label="Phone" error={form.formState.errors.phone?.message} required>
              {(p) => <Input {...p} {...form.register('phone')} placeholder="+91 98765 43210" />}
            </FormField>
            <FormField label="Email" error={form.formState.errors.email?.message}>
              {(p) => <Input {...p} {...form.register('email')} type="email" placeholder="optional" />}
            </FormField>
            <FormField label="Priority">
              {() => (
                <Select
                  options={[
                    { value: 'HIGH', label: 'High' },
                    { value: 'MEDIUM', label: 'Medium' },
                    { value: 'LOW', label: 'Low' },
                  ]}
                  {...form.register('priority')}
                  value={form.watch('priority') ?? 'MEDIUM'}
                />
              )}
            </FormField>
            <FormField label="Source">
              {(p) => <Input {...p} {...form.register('source')} placeholder="Referral, website…" />}
            </FormField>
          </Card.Body>
        </Card>

        <Card>
          <Card.Header>
            <Card.Title>Requirement</Card.Title>
            <Card.Description>Optional — you can add this later from the client page.</Card.Description>
          </Card.Header>
          <Card.Body className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Budget min (₹)"
              error={form.formState.errors.requirement?.budgetMin?.message}
            >
              {(p) => <Input {...p} {...form.register('requirement.budgetMin')} inputMode="numeric" placeholder="5000000" />}
            </FormField>
            <FormField
              label="Budget max (₹)"
              error={form.formState.errors.requirement?.budgetMax?.message}
            >
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
            <FormField label="City">
              {(p) => <Input {...p} {...form.register('requirement.city')} placeholder="Mumbai" />}
            </FormField>
          </Card.Body>
        </Card>

        {form.formState.errors.root ? (
          <p role="alert" className="rounded-md border border-danger-100 bg-danger-100/40 px-3 py-2 text-xs text-danger-700">
            {form.formState.errors.root.message}
          </p>
        ) : null}

        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={() => void navigate('/clients')}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? (
              <>
                <Loader2 className="animate-spin" aria-hidden="true" />
                Creating…
              </>
            ) : (
              'Create client'
            )}
          </Button>
        </div>
      </form>
    </>
  )
}
