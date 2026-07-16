import { APP_NAME } from '@app/shared'

const STATUSES = [
  { label: 'Available', cls: 'bg-status-available' },
  { label: 'Under offer', cls: 'bg-status-under-offer' },
  { label: 'Rented', cls: 'bg-status-rented' },
  { label: 'Sold', cls: 'bg-status-sold' },
  { label: 'Archived', cls: 'bg-status-archived' },
] as const

const NEUTRALS = [
  '0',
  '50',
  '100',
  '200',
  '300',
  '400',
  '500',
  '600',
  '700',
  '800',
  '900',
  '950',
] as const

function App() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <p className="text-2xs font-medium tracking-widest text-text-muted uppercase">
        Foundation check
      </p>
      <h1 className="text-xl font-semibold text-text-primary">{APP_NAME}</h1>
      <p className="mt-1 text-text-secondary">
        Design tokens are live. Tailwind 4 CSS-first is compiling under Vite 8.
      </p>

      <section className="mt-10 rounded-lg border border-border-subtle bg-surface-raised p-5 shadow-e1">
        <h2 className="text-md font-semibold text-text-primary">Status colors</h2>
        <p className="mt-1 text-xs text-text-muted">
          Never colour-only &mdash; every status is a dot plus a text label. Sold is
          neutral, not red: red is reserved for destructive actions.
        </p>
        <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-3">
          {STATUSES.map((s) => (
            <li key={s.label} className="flex items-center gap-2">
              <span className={`size-2 rounded-full ${s.cls}`} aria-hidden="true" />
              <span className="text-sm text-text-secondary">{s.label}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6 rounded-lg border border-border-subtle bg-surface-raised p-5 shadow-e1">
        <h2 className="text-md font-semibold text-text-primary">Neutral ramp</h2>
        <p className="mt-1 text-xs text-text-muted">
          A CRM is 90% grey. This ramp is most of what &ldquo;premium&rdquo; means here.
        </p>
        <div className="mt-4 flex overflow-hidden rounded-md border border-border-subtle">
          {NEUTRALS.map((n) => (
            <div
              key={n}
              className="h-10 flex-1"
              style={{ backgroundColor: `var(--color-neutral-${n})` }}
              title={`neutral-${n}`}
            />
          ))}
        </div>
      </section>

      <section className="mt-6 rounded-lg border border-border-subtle bg-surface-raised p-5 shadow-e1">
        <h2 className="text-md font-semibold text-text-primary">Tabular numerals</h2>
        <p className="mt-1 text-xs text-text-muted">
          Money is a string in DTOs, formatted with Intl. Digits must align.
        </p>
        <table className="mt-4 w-full text-sm">
          <tbody>
            {['1,25,00,000', '84,50,000', '2,10,00,000'].map((amt) => (
              <tr key={amt} className="border-b border-border-subtle last:border-0">
                <td className="py-2 text-text-secondary">Sale price</td>
                <td className="py-2 text-right text-text-primary tabular">
                  &#8377;{amt}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  )
}

export default App
