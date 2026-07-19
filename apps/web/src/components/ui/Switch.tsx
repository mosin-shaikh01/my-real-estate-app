import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

// The one on/off switch for the whole app.
//
// Built on a NATIVE checkbox (visually hidden) rather than a div-with-onClick:
// that gives correct keyboard behaviour (Space toggles), screen-reader state,
// and `react-hook-form` register() support for free — reach for the platform
// before reinventing it, same call as the native <Select>. `role="switch"` makes
// assistive tech announce it as a switch, not a checkbox.
//
// Visual language matches the CRM: brand-600 on, border-strong off, white thumb,
// WCAG focus ring in brand-500, 200ms ease-out. Semantic tokens, so light/dark
// adapt automatically. Fixed 36×20 track — no layout shift, responsive as-is.

type SwitchProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'role' | 'size'>

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(function Switch(
  { className, disabled, ...props },
  ref,
) {
  return (
    <label
      className={cn(
        'group relative inline-flex shrink-0',
        disabled ? 'cursor-not-allowed' : 'cursor-pointer',
        className,
      )}
    >
      <input ref={ref} type="checkbox" role="switch" disabled={disabled} className="peer sr-only" {...props} />
      <span
        aria-hidden="true"
        className={cn(
          'relative h-5 w-9 rounded-full bg-border-strong transition-colors duration-200 ease-out',
          'group-hover:brightness-95',
          'peer-checked:bg-brand-600',
          'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-500',
          'peer-disabled:opacity-50',
          // thumb
          'after:absolute after:top-0.5 after:left-0.5 after:size-4 after:rounded-full after:bg-white after:shadow-sm',
          'after:transition-transform after:duration-200 after:ease-out',
          'peer-checked:after:translate-x-4',
        )}
      />
    </label>
  )
})
