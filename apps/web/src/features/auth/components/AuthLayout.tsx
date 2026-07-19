import { Building2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { useSettings } from '@/features/settings/api/use-settings'

// The shared frame for every unauthenticated screen (login, forgot, reset): the
// branded mark + name, a title and subtitle, then the page's own content. Keeps
// the three pages visually identical without each re-implementing the header.
export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: ReactNode
  children: ReactNode
}) {
  const { data: settings } = useSettings()

  return (
    <main className="grid min-h-dvh place-items-center bg-surface-sunken px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2">
          {settings?.logoUrl ? (
            <img src={settings.logoUrl} alt="" className="size-7 shrink-0 rounded object-contain" />
          ) : (
            <div
              className="grid size-7 shrink-0 place-items-center rounded text-white"
              style={{
                backgroundImage:
                  'linear-gradient(135deg, var(--color-brand-primary), var(--color-brand-secondary))',
              }}
            >
              <Building2 className="size-4" aria-hidden="true" />
            </div>
          )}
          <span className="text-md font-semibold text-text-primary">
            {settings?.crmName ?? 'Estate'}
          </span>
        </div>

        <h1 className="text-xl font-semibold text-text-primary">{title}</h1>
        {subtitle ? <p className="mt-1 text-base text-text-secondary">{subtitle}</p> : null}

        {children}
      </div>
    </main>
  )
}
