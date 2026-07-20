import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, TriangleAlert } from 'lucide-react'
import { useForm, useWatch } from 'react-hook-form'
import { ownerCreateSchema, type OwnerCreateInput, type OwnerDTO } from '@app/shared'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { FormField, Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/use-toast'
import { ApiClientError } from '@/lib/api'
import { useCreateOwner, useOwnerDuplicate, useUpdateOwner } from '@/features/owners/api/use-owners'

// Create AND edit. Pass `owner` to edit. Duplicate-mobile detection is a WARNING
// shown inline — it never prevents saving.
export function OwnerFormDialog({ owner, onClose }: { owner?: OwnerDTO; onClose: () => void }) {
  const isEdit = Boolean(owner)
  const create = useCreateOwner()
  const update = useUpdateOwner(owner?.id ?? '')
  const { toast } = useToast()

  const form = useForm<OwnerCreateInput>({
    resolver: zodResolver(ownerCreateSchema),
    defaultValues: {
      fullName: owner?.fullName ?? '',
      mobile: owner?.mobile ?? '',
      altMobile: owner?.altMobile ?? '',
      email: owner?.email ?? '',
      address: owner?.address ?? '',
      city: owner?.city ?? '',
      pan: owner?.pan ?? '',
      aadhaar: owner?.aadhaar ?? '',
      notes: owner?.notes ?? '',
    },
  })

  const mobile = useWatch({ control: form.control, name: 'mobile' }) ?? ''
  const { data: duplicate } = useOwnerDuplicate(mobile, owner?.id)

  // Read isDirty DURING RENDER so RHF's formState Proxy subscribes to it —
  // reading it only inside the handler returns a stale `false`.
  const { isDirty } = form.formState

  const onSubmit = form.handleSubmit(async (values) => {
    // Nothing touched → don't call the API (which would no-op anyway).
    if (isEdit && !isDirty) {
      toast({ variant: 'info', title: 'No changes detected' })
      onClose()
      return
    }
    try {
      if (isEdit) await update.mutateAsync(values)
      else await create.mutateAsync(values)
      toast({ variant: 'success', title: isEdit ? 'Owner updated' : 'Owner created' })
      onClose()
    } catch (err) {
      if (err instanceof ApiClientError && err.details) {
        for (const [path, messages] of Object.entries(err.details)) {
          form.setError(path as keyof OwnerCreateInput, { message: messages[0] })
        }
        return
      }
      form.setError('root', {
        message: err instanceof Error ? err.message : 'Could not save the owner',
      })
    }
  })

  return (
    <Dialog
      open
      onClose={onClose}
      title={isEdit ? `Edit ${owner!.fullName}` : 'New owner'}
      description="A reusable owner/seller record. One owner can own many properties."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="owner-form" variant="primary" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? (
              <>
                <Loader2 className="animate-spin" aria-hidden="true" />
                Saving…
              </>
            ) : isEdit ? (
              'Save changes'
            ) : (
              'Create owner'
            )}
          </Button>
        </>
      }
    >
      <form id="owner-form" onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <div className="sm:col-span-2">
          <FormField label="Full name" error={form.formState.errors.fullName?.message} required>
            {(p) => <Input {...p} {...form.register('fullName')} placeholder="Ramesh Patil" />}
          </FormField>
        </div>

        <FormField label="Mobile" error={form.formState.errors.mobile?.message} required>
          {(p) => <Input {...p} {...form.register('mobile')} placeholder="+91 98765 43210" />}
        </FormField>
        <FormField label="Alternate mobile" error={form.formState.errors.altMobile?.message}>
          {(p) => <Input {...p} {...form.register('altMobile')} placeholder="+91 98765 00000" />}
        </FormField>

        {duplicate ? (
          <div className="sm:col-span-2 flex items-start gap-2 rounded-md border border-border-subtle bg-surface-warning-soft/40 px-3 py-2 text-xs text-text-warning">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>
              An owner with this mobile already exists: <strong>{duplicate.fullName}</strong> ({duplicate.code}).
              You can still save if this is intentional.
            </span>
          </div>
        ) : null}

        <FormField label="Email" error={form.formState.errors.email?.message}>
          {(p) => <Input {...p} {...form.register('email')} type="email" placeholder="ramesh@example.com" />}
        </FormField>
        <FormField label="City" error={form.formState.errors.city?.message}>
          {(p) => <Input {...p} {...form.register('city')} placeholder="Pune" />}
        </FormField>

        <div className="sm:col-span-2">
          <FormField label="Address" error={form.formState.errors.address?.message}>
            {(p) => <Input {...p} {...form.register('address')} placeholder="Flat / plot, street, area" />}
          </FormField>
        </div>

        <FormField label="PAN" error={form.formState.errors.pan?.message} hint="Optional">
          {(p) => <Input {...p} {...form.register('pan')} placeholder="ABCDE1234F" />}
        </FormField>
        <FormField label="Aadhaar" error={form.formState.errors.aadhaar?.message} hint="Optional">
          {(p) => <Input {...p} {...form.register('aadhaar')} placeholder="1234 5678 9012" />}
        </FormField>

        <div className="sm:col-span-2">
          <FormField label="Notes" error={form.formState.errors.notes?.message}>
            {(p) => <Input {...p} {...form.register('notes')} placeholder="Anything worth remembering" />}
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
