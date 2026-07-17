import { Slot } from '@radix-ui/react-slot'
import type { ButtonHTMLAttributes, Ref } from 'react'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md'

// `danger` is the ONLY red in the system. Status colours never use it -- sold is
// neutral slate precisely so red keeps meaning "this destroys something".
const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 disabled:bg-brand-300',
  secondary:
    'bg-surface-raised text-text-primary border border-border-default hover:bg-surface-hover active:bg-surface-hover',
  ghost: 'text-text-secondary hover:bg-surface-hover hover:text-text-primary',
  danger: 'bg-danger-500 text-white hover:bg-danger-700 active:bg-danger-700',
}

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-9 px-4 text-base gap-2',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  /** Render as the child element (e.g. a router Link) while keeping styles. */
  asChild?: boolean
  /** Forwarded to the DOM node so a Tooltip (Radix asChild) can anchor to it. */
  ref?: Ref<HTMLButtonElement>
}

export function Button({
  className,
  variant = 'secondary',
  size = 'md',
  asChild = false,
  type,
  ref,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : 'button'
  return (
    <Comp
      ref={ref}
      // Buttons inside a form default to submit, which causes surprise
      // submissions. Opt in explicitly instead.
      type={asChild ? undefined : (type ?? 'button')}
      className={cn(
        'inline-flex items-center justify-center rounded-md font-medium whitespace-nowrap',
        'transition-colors duration-[120ms]',
        'disabled:pointer-events-none disabled:opacity-50',
        // Focus ring is not optional -- this is a keyboard-heavy CRM.
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
        '[&_svg]:size-4 [&_svg]:shrink-0',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  )
}
