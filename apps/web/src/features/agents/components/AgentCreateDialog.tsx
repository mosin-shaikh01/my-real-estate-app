import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { agentCreateSchema, type AgentCreateInput } from '@app/shared'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { FormField, Input } from '@/components/ui/Input'
import { useCreateAgent } from '@/features/agents/api/use-agents'
import { ApiClientError } from '@/lib/api'

export function AgentCreateDialog({ onClose }: { onClose: () => void }) {
  const create = useCreateAgent()
  const form = useForm<AgentCreateInput>({
    resolver: zodResolver(agentCreateSchema),
    defaultValues: { fullName: '', email: '', temporaryPassword: '' },
  })

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await create.mutateAsync(values)
      onClose()
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.details) {
          for (const [path, messages] of Object.entries(err.details)) {
            form.setError(path as keyof AgentCreateInput, { message: messages[0] })
          }
          return
        }
        // 409 on a duplicate email arrives without field details — attach it to
        // the field the admin can actually fix.
        if (err.code === 'CONFLICT') {
          form.setError('email', { message: err.message })
          return
        }
      }
      form.setError('root', { message: err instanceof Error ? err.message : 'Could not create the agent' })
    }
  })

  return (
    <Dialog
      open
      onClose={onClose}
      title="New agent"
      description="Creates the login and profile. The agent sets their own password via reset."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="agent-create" variant="primary" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? (
              <>
                <Loader2 className="animate-spin" aria-hidden="true" />
                Creating…
              </>
            ) : (
              'Create agent'
            )}
          </Button>
        </>
      }
    >
      <form id="agent-create" onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <div className="sm:col-span-2">
          <FormField label="Full name" error={form.formState.errors.fullName?.message} required>
            {(p) => <Input {...p} {...form.register('fullName')} placeholder="Rohan Kulkarni" />}
          </FormField>
        </div>
        <FormField label="Email" error={form.formState.errors.email?.message} required>
          {(p) => <Input {...p} {...form.register('email')} type="email" placeholder="rohan@agency.com" />}
        </FormField>
        <FormField label="Phone" error={form.formState.errors.phone?.message}>
          {(p) => <Input {...p} {...form.register('phone')} placeholder="+91 98201 44556" />}
        </FormField>
        <FormField label="Specialization" error={form.formState.errors.specialization?.message}>
          {(p) => <Input {...p} {...form.register('specialization')} placeholder="Residential — West" />}
        </FormField>
        <FormField label="Commission rate (%)" error={form.formState.errors.commissionRate?.message}>
          {(p) => <Input {...p} {...form.register('commissionRate')} inputMode="decimal" placeholder="2.5" />}
        </FormField>
        <div className="sm:col-span-2">
          <FormField
            label="Temporary password"
            error={form.formState.errors.temporaryPassword?.message}
            hint="At least 10 characters. The agent resets it on first sign-in."
            required
          >
            {(p) => <Input {...p} {...form.register('temporaryPassword')} type="text" />}
          </FormField>
        </div>

        {form.formState.errors.root ? (
          <p role="alert" className="text-xs text-danger-700 sm:col-span-2">
            {form.formState.errors.root.message}
          </p>
        ) : null}
      </form>
    </Dialog>
  )
}
