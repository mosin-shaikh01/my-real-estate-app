import * as LabelPrimitive from '@radix-ui/react-label'
import { useId, type InputHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

// The FormField wrapper owns label + error + aria-describedby wiring so that no
// screen re-invents it, and so accessibility can't be forgotten one field at a
// time. RHF plugs in via ...register(name).

interface FieldProps {
  label: string
  error?: string
  hint?: string
  required?: boolean
  children: (props: {
    id: string
    'aria-describedby': string | undefined
    'aria-invalid': boolean | undefined
  }) => ReactNode
}

export function FormField({ label, error, hint, required, children }: FieldProps) {
  const id = useId()
  const errorId = `${id}-error`
  const hintId = `${id}-hint`
  const describedBy = [error ? errorId : null, hint ? hintId : null]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="flex flex-col gap-1.5">
      <LabelPrimitive.Root
        htmlFor={id}
        className="text-xs font-medium text-text-secondary"
      >
        {label}
        {required ? (
          <span className="ml-0.5 text-danger-500" aria-hidden="true">
            *
          </span>
        ) : null}
      </LabelPrimitive.Root>

      {children({
        id,
        'aria-describedby': describedBy || undefined,
        'aria-invalid': error ? true : undefined,
      })}

      {hint && !error ? (
        <p id={hintId} className="text-xs text-text-muted">
          {hint}
        </p>
      ) : null}

      {error ? (
        // role="alert" so a screen reader announces it on async validation.
        <p id={errorId} role="alert" className="text-xs text-text-danger">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'h-9 w-full rounded-md border border-border-default bg-surface px-3',
        'text-base text-text-primary placeholder:text-text-muted',
        'transition-colors duration-[120ms]',
        'hover:border-border-strong',
        'focus-visible:border-brand-500 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-brand-500',
        'disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-text-muted',
        'aria-[invalid=true]:border-danger-500 aria-[invalid=true]:focus-visible:outline-danger-500',
        className,
      )}
      {...props}
    />
  )
}
