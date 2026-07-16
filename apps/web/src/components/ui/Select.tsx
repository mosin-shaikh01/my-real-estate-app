import type { SelectHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/cn'

// A native <select>, deliberately.
//
// Radix Select is in the stack for cases that need rich content or async
// options. A filter dropdown of ten strings is not that case: native gives
// correct keyboard behaviour, screen-reader semantics, and the platform mobile
// picker for free, at zero bundle cost. Reach for Radix when the platform
// stops being enough — not before.

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  options: ReadonlyArray<{ value: string; label: string }>
  placeholder?: string
}

export function Select({ className, options, placeholder, ...props }: SelectProps) {
  return (
    <div className="relative">
      <select
        className={cn(
          'h-8 w-full appearance-none rounded-md border border-border-default bg-surface',
          'pr-8 pl-2.5 text-xs text-text-primary',
          'transition-colors duration-[120ms] hover:border-border-strong',
          'focus-visible:border-brand-500 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-brand-500',
          !props.value && 'text-text-muted',
          className,
        )}
        {...props}
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-2 size-3.5 -translate-y-1/2 text-text-muted"
        aria-hidden="true"
      />
    </div>
  )
}
