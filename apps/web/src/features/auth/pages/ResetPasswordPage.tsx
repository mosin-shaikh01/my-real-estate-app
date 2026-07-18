import { zodResolver } from '@hookform/resolvers/zod'
import { CheckCircle2, Loader2, XCircle } from 'lucide-react'
import { useForm, useWatch } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { FormField, Input } from '@/components/ui/Input'
import { AuthLayout } from '@/features/auth/components/AuthLayout'
import { useResetPassword, useVerifyResetToken } from '@/features/auth/api/use-auth'
import { ApiClientError } from '@/lib/api'
import { cn } from '@/lib/cn'

// Confirm-match is a client-only concern (the server only needs the new
// password), so this form schema lives here rather than in @app/shared. The
// 10-char minimum matches the server's resetPasswordSchema.
const resetFormSchema = z
  .object({
    password: z.string().min(10, 'Use at least 10 characters'),
    confirmPassword: z.string().min(1, 'Confirm your new password'),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
type ResetFormValues = z.infer<typeof resetFormSchema>

// A cheap, honest strength signal — enough to nudge users off "1234567890",
// not a security control (the server's length rule is). Score 0–4.
function scorePassword(pw: string): number {
  if (!pw) return 0
  let score = 0
  if (pw.length >= 10) score++
  if (pw.length >= 14) score++
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++
  return Math.min(score, 4)
}
const STRENGTH = [
  { label: '', className: '' },
  { label: 'Weak', className: 'bg-status-archived' },
  { label: 'Fair', className: 'bg-status-under-offer' },
  { label: 'Good', className: 'bg-status-rented' },
  { label: 'Strong', className: 'bg-status-available' },
] as const

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token') ?? ''
  const verify = useVerifyResetToken(token)
  const reset = useResetPassword()

  const form = useForm<ResetFormValues>({
    resolver: zodResolver(resetFormSchema),
    defaultValues: { password: '', confirmPassword: '' },
  })
  // useWatch (not form.watch) so the React Compiler can memoize this component.
  const password = useWatch({ control: form.control, name: 'password' })
  const strength = scorePassword(password)
  const meter = STRENGTH[strength] ?? STRENGTH[0]

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await reset.mutateAsync({ token, password: values.password })
      // Sign-in fresh with the new password. Small delay so the success state
      // is legible, then hand off to the login screen.
      setTimeout(() => void navigate('/login', { replace: true }), 2500)
    } catch (err) {
      if (err instanceof ApiClientError) {
        // Invalid/expired/used tokens and rate limits arrive without field
        // details — surface them at the form root.
        form.setError('root', { message: err.message })
      }
    }
  })

  // ---- Link states -------------------------------------------------------
  if (!token || (verify.data && !verify.data.valid)) {
    return (
      <AuthLayout title="Reset link invalid">
        <div className="mt-6 flex flex-col items-center gap-3 rounded-lg border border-border-subtle bg-surface-raised p-6 text-center">
          <XCircle className="size-8 text-text-danger" aria-hidden="true" />
          <p className="text-base text-text-secondary">
            This password reset link is invalid or has expired. Reset links are valid for 30 minutes
            and can be used once.
          </p>
        </div>
        <p className="mt-6 text-center text-sm">
          <Link
            to="/forgot-password"
            className="font-medium text-text-brand underline-offset-2 hover:underline"
          >
            Request a new link
          </Link>
        </p>
      </AuthLayout>
    )
  }

  if (verify.isLoading) {
    return (
      <AuthLayout title="Reset your password">
        <div className="mt-6 flex items-center gap-2 text-base text-text-secondary" role="status">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Checking your reset link…
        </div>
      </AuthLayout>
    )
  }

  // ---- Success -----------------------------------------------------------
  if (reset.isSuccess) {
    return (
      <AuthLayout title="Password updated">
        <div
          role="status"
          className="mt-6 flex flex-col items-center gap-3 rounded-lg border border-border-subtle bg-surface-raised p-6 text-center"
        >
          <CheckCircle2 className="size-8 text-text-success" aria-hidden="true" />
          <p className="text-base text-text-secondary">
            Your password has been changed and you&apos;ve been signed out everywhere. Redirecting
            you to sign in…
          </p>
        </div>
        <p className="mt-6 text-center text-sm">
          <Link to="/login" className="font-medium text-text-brand underline-offset-2 hover:underline">
            Continue to sign in
          </Link>
        </p>
      </AuthLayout>
    )
  }

  // ---- Form --------------------------------------------------------------
  return (
    <AuthLayout title="Reset your password" subtitle="Choose a new password for your account.">
      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4" noValidate>
        <FormField label="New password" error={form.formState.errors.password?.message} required>
          {(p) => (
            <Input
              {...p}
              {...form.register('password')}
              type="password"
              autoComplete="new-password"
              autoFocus
            />
          )}
        </FormField>

        {password ? (
          <div aria-live="polite">
            <div className="flex gap-1">
              {[1, 2, 3, 4].map((i) => (
                <span
                  key={i}
                  className={cn(
                    'h-1 flex-1 rounded-full',
                    i <= strength ? meter.className : 'bg-surface-hover',
                  )}
                />
              ))}
            </div>
            {strength > 0 ? (
              <p className="mt-1 text-2xs text-text-muted">Password strength: {meter.label}</p>
            ) : null}
          </div>
        ) : null}

        <FormField
          label="Confirm new password"
          error={form.formState.errors.confirmPassword?.message}
          required
        >
          {(p) => (
            <Input
              {...p}
              {...form.register('confirmPassword')}
              type="password"
              autoComplete="new-password"
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
              Updating…
            </>
          ) : (
            'Update password'
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
