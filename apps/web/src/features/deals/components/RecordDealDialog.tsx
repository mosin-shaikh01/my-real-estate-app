import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import {
  DEAL_TYPE_LABELS,
  dealCreateSchema,
  dealTypeSchema,
  type DealCreateInput,
} from '@app/shared'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { FormField, Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { useToast } from '@/components/ui/use-toast'
import { ApiClientError } from '@/lib/api'
import { useAssignableAgents } from '@/features/agents/api/use-assignable-agents'
import { useClients } from '@/features/clients/api/use-clients'
import { useProperties } from '@/features/properties/api/use-properties'
import { useCreateDeal } from '@/features/deals/api/use-deals'

const TYPE_OPTIONS = dealTypeSchema.options.map((t) => ({ value: t, label: DEAL_TYPE_LABELS[t] }))
const today = () => new Date().toISOString().slice(0, 10)

// Record a closed deal. Admin-only surface (deal.create). The commission rate is
// snapshotted server-side from the chosen agent — not entered here — so history
// can't be rewritten by editing the agent's rate later.
export function RecordDealDialog({ onClose }: { onClose: () => void }) {
  const create = useCreateDeal()
  const { toast } = useToast()
  const { data: props } = useProperties({})
  const { data: clients } = useClients({})
  const { data: agents } = useAssignableAgents(true)

  const form = useForm<DealCreateInput>({
    resolver: zodResolver(dealCreateSchema),
    defaultValues: {
      propertyId: '',
      clientId: '',
      agentId: '',
      dealType: 'SALE',
      closedAt: today(),
      closedPrice: '',
      notes: '',
    },
  })

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await create.mutateAsync({
        ...values,
        agentId: values.agentId || null,
        notes: values.notes || null,
      })
      toast({ variant: 'success', title: 'Deal recorded' })
      onClose()
    } catch (err) {
      if (err instanceof ApiClientError && err.details) {
        for (const [path, messages] of Object.entries(err.details)) {
          form.setError(path as keyof DealCreateInput, { message: messages[0] })
        }
        return
      }
      form.setError('root', { message: err instanceof Error ? err.message : 'Could not record the deal' })
      toast({ variant: 'error', title: 'Could not record the deal', description: err instanceof Error ? err.message : undefined })
    }
  })

  return (
    <Dialog
      open
      onClose={onClose}
      title="Record a deal"
      description="Log a closed sale or rental. The agent's commission is captured automatically from their current rate."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="deal-form" variant="primary" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            Record deal
          </Button>
        </>
      }
    >
      <form id="deal-form" onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <div className="sm:col-span-2">
          <FormField label="Property" error={form.formState.errors.propertyId?.message} required>
            {() => (
              <Select
                options={[
                  { value: '', label: 'Select a property…' },
                  ...(props?.data ?? []).map((p) => ({ value: p.id, label: `${p.code} — ${p.title}` })),
                ]}
                {...form.register('propertyId')}
                value={form.watch('propertyId')}
              />
            )}
          </FormField>
        </div>

        <div className="sm:col-span-2">
          <FormField label="Client" error={form.formState.errors.clientId?.message} required>
            {() => (
              <Select
                options={[
                  { value: '', label: 'Select a client…' },
                  ...(clients?.data ?? []).map((c) => ({ value: c.id, label: `${c.code} — ${c.fullName}` })),
                ]}
                {...form.register('clientId')}
                value={form.watch('clientId')}
              />
            )}
          </FormField>
        </div>

        <FormField label="Deal type" error={form.formState.errors.dealType?.message} required>
          {() => <Select options={TYPE_OPTIONS} {...form.register('dealType')} value={form.watch('dealType')} />}
        </FormField>

        <FormField label="Closing date" error={form.formState.errors.closedAt?.message} required>
          {(p) => <Input {...p} type="date" max={today()} {...form.register('closedAt')} />}
        </FormField>

        <FormField
          label="Closed price (₹)"
          error={form.formState.errors.closedPrice?.message}
          required
        >
          {(p) => <Input {...p} inputMode="decimal" placeholder="4500000" {...form.register('closedPrice')} />}
        </FormField>

        <FormField label="Agent" error={form.formState.errors.agentId?.message}>
          {() => (
            <Select
              options={[
                { value: '', label: 'Unassigned' },
                ...(agents ?? []).map((a) => ({ value: a.id, label: a.fullName })),
              ]}
              {...form.register('agentId')}
              value={form.watch('agentId') ?? ''}
            />
          )}
        </FormField>

        <div className="sm:col-span-2">
          <FormField label="Notes" error={form.formState.errors.notes?.message}>
            {(p) => <Input {...p} placeholder="Anything worth remembering about this deal" {...form.register('notes')} />}
          </FormField>
        </div>

        {form.formState.errors.root ? (
          <p role="alert" className="text-xs text-text-danger sm:col-span-2">
            {form.formState.errors.root.message}
          </p>
        ) : null}
      </form>
    </Dialog>
  )
}
