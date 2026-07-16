import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { agentUpdateSchema, type AgentUpdateInput } from '@app/shared'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { FormField, Input } from '@/components/ui/Input'
import { useUpdateAgent, type AgentDTO } from '@/features/agents/api/use-agents'
import { ApiClientError } from '@/lib/api'

export function AgentEditDialog({ agent, onClose }: { agent: AgentDTO; onClose: () => void }) {
  const update = useUpdateAgent(agent.id)
  const form = useForm<AgentUpdateInput>({
    resolver: zodResolver(agentUpdateSchema),
    // Pre-fill from the current values; nulls become empty strings for inputs.
    defaultValues: {
      fullName: agent.fullName,
      email: agent.email,
      phone: agent.phone ?? '',
      specialization: agent.specialization ?? '',
      address: agent.address ?? '',
      experienceYears: agent.experienceYears ?? undefined,
      commissionRate: agent.commissionRate ?? '',
    },
  })

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await update.mutateAsync(values)
      onClose()
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.details) {
          for (const [path, messages] of Object.entries(err.details)) {
            form.setError(path as keyof AgentUpdateInput, { message: messages[0] })
          }
          return
        }
        // 409 on a duplicate email — attach to the field the admin can fix.
        if (err.code === 'CONFLICT') {
          form.setError('email', { message: err.message })
          return
        }
      }
      form.setError('root', { message: err instanceof Error ? err.message : 'Could not save changes' })
    }
  })

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Edit ${agent.fullName}`}
      description={agent.code ? `Profile ${agent.code}` : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="agent-edit" variant="primary" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? (
              <>
                <Loader2 className="animate-spin" aria-hidden="true" />
                Saving…
              </>
            ) : (
              'Save changes'
            )}
          </Button>
        </>
      }
    >
      <form id="agent-edit" onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <div className="sm:col-span-2">
          <FormField label="Full name" error={form.formState.errors.fullName?.message} required>
            {(p) => <Input {...p} {...form.register('fullName')} />}
          </FormField>
        </div>
        <FormField label="Email" error={form.formState.errors.email?.message} required>
          {(p) => <Input {...p} {...form.register('email')} type="email" />}
        </FormField>
        <FormField label="Mobile number" error={form.formState.errors.phone?.message}>
          {(p) => <Input {...p} {...form.register('phone')} placeholder="+91 98201 44556" />}
        </FormField>
        <FormField label="Specialization" error={form.formState.errors.specialization?.message}>
          {(p) => <Input {...p} {...form.register('specialization')} placeholder="Residential — West" />}
        </FormField>
        <FormField label="Experience (years)" error={form.formState.errors.experienceYears?.message}>
          {(p) => (
            <Input {...p} type="number" {...form.register('experienceYears', { valueAsNumber: true })} />
          )}
        </FormField>
        <FormField label="Commission rate (%)" error={form.formState.errors.commissionRate?.message}>
          {(p) => <Input {...p} {...form.register('commissionRate')} inputMode="decimal" placeholder="2.5" />}
        </FormField>
        <FormField label="Address" error={form.formState.errors.address?.message}>
          {(p) => <Input {...p} {...form.register('address')} />}
        </FormField>

        {form.formState.errors.root ? (
          <p role="alert" className="text-xs text-danger-700 sm:col-span-2">
            {form.formState.errors.root.message}
          </p>
        ) : null}
      </form>
    </Dialog>
  )
}
