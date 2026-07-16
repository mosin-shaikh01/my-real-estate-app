import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

// Compound, not configured. A `showHeader`/`headerAction`/`dense` prop list
// becomes an API nobody can remember; composition stays legible at 20 usages.

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        // Flat: border + surface step. Shadows are for overlays only --
        // shadows everywhere reads 2016 Bootstrap; hairlines read premium.
        'rounded-lg border border-border-subtle bg-surface-raised shadow-e1',
        className,
      )}
      {...props}
    />
  )
}

Card.Header = function CardHeader({
  children,
  action,
  className,
}: {
  children: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 border-b border-border-subtle px-5 py-3.5',
        className,
      )}
    >
      <div className="min-w-0">{children}</div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

Card.Title = function CardTitle({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <h2 className={cn('text-md font-semibold text-text-primary', className)}>{children}</h2>
  )
}

Card.Description = function CardDescription({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <p className={cn('mt-0.5 text-xs text-text-muted', className)}>{children}</p>
}

Card.Body = function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5', className)} {...props} />
}

Card.Footer = function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex items-center justify-end gap-2 border-t border-border-subtle px-5 py-3.5',
        className,
      )}
      {...props}
    />
  )
}
