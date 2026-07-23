import { cn } from '@/lib/cn'

// A tiny initials avatar. We store no user photos yet, so "if available" means
// initials — a deterministic, theme-safe stand-in. Size is a `size-*` utility the
// caller can override (tailwind-merge lets the passed class win).

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  // Array.from is code-POINT aware — a name starting with an emoji or astral
  // character yields that whole glyph, not a broken half-surrogate.
  const firstOf = (s: string | undefined) => (s ? (Array.from(s)[0] ?? '') : '')
  const first = firstOf(parts[0])
  const last = parts.length > 1 ? firstOf(parts[parts.length - 1]) : ''
  return (first + last).toUpperCase()
}

export function Avatar({ name, className }: { name: string | null | undefined; className?: string }) {
  // Gate once on the trimmed value so the glyph and the title never disagree
  // (a whitespace-only name resolves to "System"/"SY", not "?"/"System").
  const trimmed = name?.trim()
  return (
    <span
      aria-hidden="true"
      title={trimmed || 'System'}
      className={cn(
        'inline-grid size-7 shrink-0 select-none place-items-center rounded-full bg-surface-brand-soft text-2xs font-semibold text-text-brand',
        className,
      )}
    >
      {trimmed ? initials(trimmed) : 'SY'}
    </span>
  )
}
