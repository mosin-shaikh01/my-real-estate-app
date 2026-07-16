import { Building2, Search, Users } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useSearch } from '@/features/search/api/use-search'
import { cn } from '@/lib/cn'

// A debounced global search with a results popover, scoped by the server. An
// agent searching finds only their own inventory and clients — the scope
// resolvers run on the query, so the box can't leak what the lists wouldn't.
export function GlobalSearch() {
  const [q, setQ] = useState('')
  const [debounced, setDebounced] = useState('')
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const rootRef = useRef<HTMLDivElement>(null)

  // Debounce: ILIKE has no index, so don't fire a query on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 200)
    return () => clearTimeout(t)
  }, [q])

  const { data, isFetching } = useSearch(debounced)

  // Close on outside click.
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const go = (to: string) => {
    setOpen(false)
    setQ('')
    void navigate(to)
  }

  const hasResults = (data?.properties.length ?? 0) + (data?.clients.length ?? 0) > 0
  const showPanel = open && debounced.trim().length >= 2

  return (
    <div ref={rootRef} className="relative hidden min-w-0 flex-1 sm:block">
      <Search
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-muted"
        aria-hidden="true"
      />
      <input
        type="search"
        value={q}
        onChange={(e) => {
          setQ(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search properties, clients, phone numbers…"
        aria-label="Global search"
        className="h-9 w-full max-w-md rounded-md border border-border-default bg-surface pr-3 pl-9 text-base text-text-primary placeholder:text-text-muted hover:border-border-strong focus-visible:border-brand-500 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-brand-500"
      />

      {showPanel ? (
        <div className="absolute top-full left-0 z-50 mt-1.5 w-full max-w-md overflow-hidden rounded-md border border-border-subtle bg-surface-raised shadow-e2">
          {!hasResults ? (
            <p className="px-3 py-4 text-center text-xs text-text-muted">
              {isFetching ? 'Searching…' : 'No matches'}
            </p>
          ) : (
            <div className="max-h-96 overflow-y-auto py-1">
              {data?.properties.length ? (
                <Section label="Properties">
                  {data.properties.map((p) => (
                    <Row
                      key={p.id}
                      icon={Building2}
                      title={p.title}
                      meta={`${p.code} · ${p.city}`}
                      onSelect={() => go(`/properties/${p.id}`)}
                    />
                  ))}
                </Section>
              ) : null}
              {data?.clients.length ? (
                <Section label="Clients">
                  {data.clients.map((c) => (
                    <Row
                      key={c.id}
                      icon={Users}
                      title={c.fullName}
                      meta={c.code}
                      onSelect={() => go(`/clients/${c.id}`)}
                    />
                  ))}
                </Section>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-1">
      <p className="px-3 py-1 text-2xs font-semibold tracking-wide text-text-muted uppercase">{label}</p>
      {children}
    </div>
  )
}

function Row({
  icon: Icon,
  title,
  meta,
  onSelect,
}: {
  icon: typeof Building2
  title: string
  meta: string
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex w-full items-center gap-2.5 px-3 py-1.5 text-left',
        'hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-none',
      )}
    >
      <Icon className="size-4 shrink-0 text-text-muted" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-text-primary">{title}</span>
        <span className="block truncate text-2xs text-text-muted">{meta}</span>
      </span>
    </button>
  )
}
