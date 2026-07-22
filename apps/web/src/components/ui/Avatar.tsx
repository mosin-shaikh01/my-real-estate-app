import { cn } from '@/lib/cn'

// A tiny initials avatar. We store no user photos yet, so "if available" means
// initials — a deterministic, theme-safe stand-in. Size is a `size-*` utility the
// caller can override (tailwind-merge lets the passed class win).

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''
  return (first + last).toUpperCase()
}

export function Avatar({ name, className }: { name: string | null | undefined; className?: string }) {
  const label = name?.trim() || 'System'
  return (
    <span
      aria-hidden="true"
      title={label}
      className={cn(
        'inline-grid size-7 shrink-0 select-none place-items-center rounded-full bg-surface-brand-soft text-2xs font-semibold text-text-brand',
        className,
      )}
    >
      {name ? initials(name) : 'SY'}
    </span>
  )
}
