import { zodResolver } from '@hookform/resolvers/zod'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Link, Navigate } from 'react-router'
import { forgotPasswordSchema, type ForgotPasswordInput } from '@app/shared'
import { Button } from '@/components/ui/Button'
import { FormField, Input } from '@/components/ui/Input'
import { AuthLayout } from '@/features/auth/components/AuthLayout'
import { useForgotPassword, useMe } from '@/features/auth/api/use-auth'
import { ApiClientError } from '@/lib/api'

export default function ForgotPasswordPage() {
  const { data: me, isLoading } = useMe()
  const forgot = useForgotPassword()

  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  })

  // Already signed in? Nothing to reset — send them home.
  if (isLoading) return null
  if (me) return <Navigate to="/" replace />

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await forgot.mutateAsync(values.email)
      // Success is intentionally identical whether or not the email exists.
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.details) {
          for (const [path, messages] of Object.entries(err.details)) {
            form.setError(path as keyof ForgotPasswordInput, { message: messages[0] })
          }
          return
        }
        // Rate-limited or an unexpected error — show it, don't pretend success.
        form.setError('root', { message: err.message })
      }
    }
  })

  // The server never reveals whether the address exists, so neither do we.
  if (forgot.isSuccess) {
    return (
      <AuthLayout title="Check your email">
        <div
          role="status"
          className="mt-6 flex flex-col items-center gap-3 rounded-lg border border-border-subtle bg-surface-raised p-6 text-center"
        >
          <CheckCircle2 className="size-8 text-text-success" aria-hidden="true" />
          <p className="text-base text-text-secondary">
            If an account exists for <span className="font-medium text-text-primary">{form.getValues('email')}</span>,
            we&apos;ve sent a link to reset your password. It expires in 30 minutes.
          </p>
          <p className="text-xs text-text-muted">
            Didn&apos;t get it? Check your spam folder, or{' '}
            <button
              type="button"
              className="font-medium text-text-brand underline-offset-2 hover:underline"
              onClick={() => forgot.reset()}
            >
              try a different email
            </button>
            .
          </p>
        </div>
        <p className="mt-6 text-center text-sm">
          <Link to="/login" className="font-medium text-text-brand underline-offset-2 hover:underline">
            Back to sign in
          </Link>
        </p>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Forgot your password?"
      subtitle="Enter your account email and we'll send you a link to reset it."
    >
      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4" noValidate>
        <FormField label="Email" error={form.formState.errors.email?.message} required>
          {(p) => (
            <Input
              {...p}
              {...form.register('email')}
              type="email"
              autoComplete="username"
              autoFocus
              placeholder="you@company.com"
            />
          )}
        </FormField>

        {form.formState.errors.root ? (
          <p
            role="alert"
            className="rounded-md border border-border-danger-soft bg-surface-danger-soft/40 px-3 py-2 text-xs text-text-danger"
          >
            {form.formState.errors.root.message}
          </p>
        ) : null}

        <Button type="submit" variant="primary" disabled={form.formState.isSubmitting} className="mt-1">
          {form.formState.isSubmitting ? (
            <>
              <Loader2 className="animate-spin" aria-hidden="true" />
              Sending…
            </>
          ) : (
            'Send reset link'
          )}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm">
        <Link to="/login" className="font-medium text-text-brand underline-offset-2 hover:underline">
          Back to sign in
        </Link>
      </p>
    </AuthLayout>
  )
}
