import { Check } from 'lucide-react'
import { useMemo } from 'react'
import { useAmenities } from '@/features/properties/api/use-amenities'
import { cn } from '@/lib/cn'

// A grouped multi-select of amenity chips. Selection is a controlled string[]
// of amenity ids — add by clicking an unselected chip, remove by clicking a
// selected one. Used by both the Add and Edit property forms, so amenity
// add/edit/remove behaves identically in each.
export function AmenityPicker({
  value,
  onChange,
}: {
  value: string[]
  onChange: (ids: string[]) => void
}) {
  const { data: amenities, isLoading } = useAmenities()
  const selected = useMemo(() => new Set(value), [value])

  const groups = useMemo(() => {
    const byCategory = new Map<string, typeof amenities>()
    for (const a of amenities ?? []) {
      const key = a.category ?? 'Other'
      const list = byCategory.get(key) ?? []
      list.push(a)
      byCategory.set(key, list)
    }
    return [...byCategory.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [amenities])

  const toggle = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChange([...next])
  }

  if (isLoading) {
    return <p className="text-sm text-text-muted">Loading amenities…</p>
  }

  return (
    <div className="flex flex-col gap-4">
      {groups.map(([category, items]) => (
        <div key={category}>
          <p className="mb-1.5 text-2xs font-semibold tracking-wide text-text-muted uppercase">
            {category}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {(items ?? []).map((a) => {
              const isOn = selected.has(a.id)
              return (
                <button
                  key={a.id}
                  type="button"
                  aria-pressed={isOn}
                  onClick={() => toggle(a.id)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs',
                    'transition-colors duration-[120ms]',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
                    isOn
                      ? 'border-brand-500 bg-surface-selected font-medium text-brand-700'
                      : 'border-border-default bg-surface text-text-secondary hover:border-border-strong hover:text-text-primary',
                  )}
                >
                  {isOn ? <Check className="size-3" aria-hidden="true" /> : null}
                  {a.name}
                </button>
              )
            })}
          </div>
        </div>
      ))}
      <p className="text-2xs text-text-muted">
        {selected.size} selected · click to add or remove
      </p>
    </div>
  )
}
