import { zodResolver } from '@hookform/resolvers/zod'
import { Building2, Loader2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { loginSchema, type LoginInput } from '@app/shared'
import { Button } from '@/components/ui/Button'
import { FormField, Input } from '@/components/ui/Input'
import { useLogin, useMe } from '@/features/auth/api/use-auth'
import { useSettings } from '@/features/settings/api/use-settings'
import { ApiClientError } from '@/lib/api'

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { data: me, isLoading } = useMe()
  const { data: settings } = useSettings()
  const login = useLogin()

  const form = useForm<LoginInput>({
    // The SAME schema the server parses. Shape/format only — the server adds
    // its own refinement layer for anything needing the database.
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  const from = (location.state as { from?: string } | null)?.from ?? '/'

  if (isLoading) return null
  if (me) return <Navigate to={from} replace />

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await login.mutateAsync(values)
      void navigate(from, { replace: true })
    } catch (err) {
      if (err instanceof ApiClientError) {
        // Server details are keyed by field path, so they map straight onto
        // RHF. Same schema, same paths, no translation layer.
        if (err.details) {
          for (const [path, messages] of Object.entries(err.details)) {
            form.setError(path as keyof LoginInput, { message: messages[0] })
          }
          return
        }
        // A credential failure is deliberately not attached to a field — the
        // server will not say which of the two was wrong, and neither should we.
        form.setError('root', { message: err.message })
      }
    }
  })

  return (
    <main className="grid min-h-dvh place-items-center bg-surface-sunken px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2">
          {settings?.logoUrl ? (
            <img src={settings.logoUrl} alt="" className="size-7 shrink-0 rounded object-contain" />
          ) : (
            <div
              className="grid size-7 shrink-0 place-items-center rounded text-white"
              style={{ backgroundColor: 'var(--brand-mark, var(--color-brand-600))' }}
            >
              <Building2 className="size-4" aria-hidden="true" />
            </div>
          )}
          <span className="text-md font-semibold text-text-primary">{settings?.crmName ?? 'Estate'}</span>
        </div>

        <h1 className="text-xl font-semibold text-text-primary">Sign in</h1>
        <p className="mt-1 text-base text-text-secondary">
          {settings?.tagline || 'Use your work account to continue.'}
        </p>

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

          <FormField label="Password" error={form.formState.errors.password?.message} required>
            {(p) => (
              <Input
                {...p}
                {...form.register('password')}
                type="password"
                autoComplete="current-password"
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

          <Button
            type="submit"
            variant="primary"
            disabled={form.formState.isSubmitting}
            className="mt-1"
          >
            {form.formState.isSubmitting ? (
              <>
                <Loader2 className="animate-spin" aria-hidden="true" />
                Signing in…
              </>
            ) : (
              'Sign in'
            )}
          </Button>
        </form>

        {/* Demo affordance. Delete before this ever leaves a laptop. */}
        <div className="mt-8 rounded-md border border-border-subtle bg-surface-raised p-3">
          <p className="text-2xs font-semibold tracking-wide text-text-muted uppercase">
            Demo accounts
          </p>
          <ul className="mt-2 flex flex-col gap-1 text-xs text-text-secondary">
            <li>
              <button
                type="button"
                className="font-mono underline-offset-2 hover:underline"
                onClick={() =>
                  form.reset({ email: 'admin@demo.local', password: 'Passw0rd!' })
                }
              >
                admin@demo.local
              </button>{' '}
              — sees all 4 clients, budgets included
            </li>
            <li>
              <button
                type="button"
                className="font-mono underline-offset-2 hover:underline"
                onClick={() =>
                  form.reset({ email: 'agent@demo.local', password: 'Passw0rd!' })
                }
              >
                agent@demo.local
              </button>{' '}
              — sees 2 assigned clients, budgets absent
            </li>
          </ul>
        </div>
      </div>
    </main>
  )
}
