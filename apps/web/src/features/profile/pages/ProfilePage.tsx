import { zodResolver } from '@hookform/resolvers/zod'
import { Check, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import {
  changePasswordSchema,
  profileUpdateSchema,
  type ProfileResponse,
  type ProfileUpdateInput,
} from '@app/shared'
import { PageHeader } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { FormField, Input } from '@/components/ui/Input'
import {
  useChangePassword,
  useProfile,
  useUpdateProfile,
} from '@/features/profile/api/use-profile'
import { ApiClientError } from '@/lib/api'

// Self-service: everyone edits their OWN details here. No permission gate — the
// server operates on the actor's id, never a target from the request.

export default function ProfilePage() {
  const { data, isLoading } = useProfile()

  if (isLoading || !data) {
    return (
      <div className="p-6">
        <div className="h-4 w-40 animate-pulse rounded bg-surface-hover" />
      </div>
    )
  }

  return (
    <>
      <PageHeader
        title="Your profile"
        description="Manage your own details and password."
      />
      <div className="mx-auto grid max-w-2xl gap-6 p-6">
        <DetailsCard profile={data} />
        <PasswordCard />
      </div>
    </>
  )
}

function DetailsCard({ profile }: { profile: ProfileResponse }) {
  const update = useUpdateProfile()
  const [saved, setSaved] = useState(false)
  const isAgent = profile.agent !== null

  const form = useForm<ProfileUpdateInput>({
    resolver: zodResolver(profileUpdateSchema),
    defaultValues: {
      fullName: profile.fullName,
      email: profile.email,
      phone: profile.phone ?? '',
      specialization: profile.agent?.specialization ?? '',
      experienceYears: profile.agent?.experienceYears ?? undefined,
      address: profile.agent?.address ?? '',
    },
  })

  const onSubmit = form.handleSubmit(async (values) => {
    setSaved(false)
    try {
      await update.mutateAsync(values)
      setSaved(true)
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.details) {
          for (const [path, messages] of Object.entries(err.details)) {
            form.setError(path as keyof ProfileUpdateInput, { message: messages[0] })
          }
          return
        }
        if (err.code === 'CONFLICT') {
          form.setError('email', { message: err.message })
          return
        }
      }
      form.setError('root', { message: err instanceof Error ? err.message : 'Could not save' })
    }
  })

  return (
    <Card>
      <Card.Header>
        <Card.Title>Details</Card.Title>
        <Card.Description>
          {profile.roles.map((r) => r.name).join(', ')}
          {profile.agent ? ` · ${profile.agent.code}` : ''}
        </Card.Description>
      </Card.Header>
      <Card.Body>
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
          <FormField label="Full name" error={form.formState.errors.fullName?.message} required>
            {(p) => <Input {...p} {...form.register('fullName')} />}
          </FormField>
          <FormField label="Email" error={form.formState.errors.email?.message} required>
            {(p) => <Input {...p} {...form.register('email')} type="email" />}
          </FormField>
          <FormField label="Mobile number" error={form.formState.errors.phone?.message}>
            {(p) => <Input {...p} {...form.register('phone')} placeholder="+91 98765 43210" />}
          </FormField>

          {isAgent ? (
            <>
              <FormField label="Specialization" error={form.formState.errors.specialization?.message}>
                {(p) => <Input {...p} {...form.register('specialization')} />}
              </FormField>
              <FormField label="Experience (years)" error={form.formState.errors.experienceYears?.message}>
                {(p) => (
                  <Input {...p} type="number" {...form.register('experienceYears', { valueAsNumber: true })} />
                )}
              </FormField>
              <FormField
                label="Commission rate"
                hint="Set by an admin — shown for reference."
              >
                {(p) => (
                  <Input
                    {...p}
                    value={profile.agent?.commissionRate ? `${profile.agent.commissionRate}%` : '—'}
                    disabled
                    readOnly
                  />
                )}
              </FormField>
              <div className="sm:col-span-2">
                <FormField label="Address" error={form.formState.errors.address?.message}>
                  {(p) => <Input {...p} {...form.register('address')} />}
                </FormField>
              </div>
            </>
          ) : null}

          {form.formState.errors.root ? (
            <p role="alert" className="text-xs text-text-danger sm:col-span-2">
              {form.formState.errors.root.message}
            </p>
          ) : null}

          <div className="flex items-center gap-3 sm:col-span-2">
            <Button type="submit" variant="primary" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden="true" />
                  Saving…
                </>
              ) : (
                'Save details'
              )}
            </Button>
            {saved ? (
              <span className="flex items-center gap-1 text-xs text-text-success">
                <Check className="size-3.5" aria-hidden="true" />
                Saved
              </span>
            ) : null}
          </div>
        </form>
      </Card.Body>
    </Card>
  )
}

function PasswordCard() {
  const change = useChangePassword()
  const [done, setDone] = useState(false)

  const form = useForm<{ currentPassword: string; newPassword: string; confirmPassword: string }>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  })

  const onSubmit = form.handleSubmit(async (values) => {
    setDone(false)
    try {
      await change.mutateAsync(values)
      form.reset()
      setDone(true)
    } catch (err) {
      if (err instanceof ApiClientError && err.details) {
        for (const [path, messages] of Object.entries(err.details)) {
          form.setError(path as 'currentPassword' | 'newPassword' | 'confirmPassword', {
            message: messages[0],
          })
        }
        return
      }
      form.setError('root', { message: err instanceof Error ? err.message : 'Could not change password' })
    }
  })

  return (
    <Card>
      <Card.Header>
        <Card.Title>Password</Card.Title>
        <Card.Description>
          Changing it signs you out of every other device, but keeps this one.
        </Card.Description>
      </Card.Header>
      <Card.Body>
        <form onSubmit={onSubmit} className="flex max-w-sm flex-col gap-4" noValidate>
          <FormField label="Current password" error={form.formState.errors.currentPassword?.message} required>
            {(p) => (
              <Input {...p} {...form.register('currentPassword')} type="password" autoComplete="current-password" />
            )}
          </FormField>
          <FormField label="New password" error={form.formState.errors.newPassword?.message} required>
            {(p) => (
              <Input {...p} {...form.register('newPassword')} type="password" autoComplete="new-password" />
            )}
          </FormField>
          <FormField label="Confirm new password" error={form.formState.errors.confirmPassword?.message} required>
            {(p) => (
              <Input {...p} {...form.register('confirmPassword')} type="password" autoComplete="new-password" />
            )}
          </FormField>

          {form.formState.errors.root ? (
            <p role="alert" className="text-xs text-text-danger">
              {form.formState.errors.root.message}
            </p>
          ) : null}

          <div className="flex items-center gap-3">
            <Button type="submit" variant="primary" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden="true" />
                  Changing…
                </>
              ) : (
                'Change password'
              )}
            </Button>
            {done ? (
              <span className="flex items-center gap-1 text-xs text-text-success">
                <Check className="size-3.5" aria-hidden="true" />
                Password changed
              </span>
            ) : null}
          </div>
        </form>
      </Card.Body>
    </Card>
  )
}
