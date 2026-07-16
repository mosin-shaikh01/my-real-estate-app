import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import {
  FOLLOW_UP_STATUS_LABELS,
  interactionCreateSchema,
  type FollowUpStatus,
  type InteractionCreateInput,
  type InteractionType,
} from '@app/shared'
import { Button } from '@/components/ui/Button'
import { FormField } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { useAddInteraction } from '@/features/clients/api/use-client'
import { ApiClientError } from '@/lib/api'

const TYPE_OPTIONS: Array<{ value: InteractionType; label: string }> = [
  { value: 'CALL', label: 'Call' },
  { value: 'NOTE', label: 'Note' },
  { value: 'MEETING', label: 'Meeting' },
  { value: 'WHATSAPP', label: 'WhatsApp' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'SITE_VISIT', label: 'Site visit' },
]

const FOLLOW_OPTIONS = (Object.keys(FOLLOW_UP_STATUS_LABELS) as FollowUpStatus[]).map((s) => ({
  value: s,
  label: FOLLOW_UP_STATUS_LABELS[s],
}))

// Logging an interaction and advancing the follow-up state are ONE action here,
// because that is the agent's real loop: you make the call, then record where it
// leaves the client. The server writes both in a single transaction.
export function InteractionForm({ clientId }: { clientId: string }) {
  const add = useAddInteraction(clientId)
  const form = useForm<InteractionCreateInput>({
    resolver: zodResolver(interactionCreateSchema),
    defaultValues: { type: 'CALL', body: '' },
  })

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await add.mutateAsync(values)
      form.reset({ type: values.type, body: '' })
    } catch (err) {
      if (err instanceof ApiClientError && err.details) {
        for (const [path, messages] of Object.entries(err.details)) {
          form.setError(path as keyof InteractionCreateInput, { message: messages[0] })
        }
        return
      }
      form.setError('root', { message: err instanceof Error ? err.message : 'Could not save' })
    }
  })

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Type">
          {() => <Select options={TYPE_OPTIONS} {...form.register('type')} value={form.watch('type')} />}
        </FormField>
        <FormField label="Update follow-up (optional)">
          {() => (
            <Select
              placeholder="No change"
              options={FOLLOW_OPTIONS}
              {...form.register('followUpStatus')}
              value={form.watch('followUpStatus') ?? ''}
            />
          )}
        </FormField>
      </div>

      <FormField label="Note" error={form.formState.errors.body?.message}>
        {(p) => (
          <textarea
            {...p}
            {...form.register('body')}
            rows={2}
            placeholder="What happened? e.g. Called, discussed budget, keen on Baner."
            className="w-full rounded-md border border-border-default bg-surface px-3 py-2 text-base placeholder:text-text-muted hover:border-border-strong focus-visible:border-brand-500 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-brand-500"
          />
        )}
      </FormField>

      {form.formState.errors.root ? (
        <p role="alert" className="text-xs text-danger-700">
          {form.formState.errors.root.message}
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" variant="primary" size="sm" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? (
            <>
              <Loader2 className="animate-spin" aria-hidden="true" />
              Saving…
            </>
          ) : (
            'Log interaction'
          )}
        </Button>
      </div>
    </form>
  )
}
