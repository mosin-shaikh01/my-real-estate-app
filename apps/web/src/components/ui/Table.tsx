import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

// ============================================================================
// Table primitives
// ============================================================================
// Deliberate choices, each reversing a common default:
//
//  * NO ZEBRA STRIPING. It's dated, and it fights hover + selection -- and row
//    selection is a core feature here (bulk-assign), so selection must win.
//  * SELECTION IS VISUALLY DISTINCT FROM HOVER: brand tint + a left accent bar,
//    versus a neutral wash. The Requirement screen lives or dies on an admin
//    being able to see which of 40 rows they've ticked.
//  * NUMBERS RIGHT-ALIGNED + tabular-nums. Misaligned digits in a price column
//    are the clearest tell of an amateur data table.
//  * The wrapper scrolls, not the body. A CRM table is wide; the page must
//    never scroll horizontally.
//
// TanStack Table drives the logic; these are the visuals. Its columnVisibility
// state maps directly onto usePermissions(), so field-level permissions become
// hidden columns for free.
// ============================================================================

export function TableWrapper({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'w-full overflow-x-auto rounded-lg border border-border-subtle bg-surface-raised',
        className,
      )}
      {...props}
    />
  )
}

export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return <table className={cn('w-full border-collapse text-sm', className)} {...props} />
}

export function THead({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn('sticky top-0 z-10 bg-surface-sunken', className)}
      {...props}
    />
  )
}

export function TH({
  className,
  numeric,
  ...props
}: ThHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return (
    <th
      scope="col"
      className={cn(
        'border-b border-border-subtle px-3 py-2 text-2xs font-semibold',
        'tracking-wide text-text-muted uppercase whitespace-nowrap',
        numeric ? 'text-right' : 'text-left',
        className,
      )}
      {...props}
    />
  )
}

export function TR({
  className,
  selected,
  ...props
}: HTMLAttributes<HTMLTableRowElement> & { selected?: boolean }) {
  return (
    <tr
      // Screen readers get selection state too, not just sighted users.
      aria-selected={selected}
      className={cn(
        'group border-b border-border-subtle transition-colors duration-[120ms] last:border-0',
        selected
          ? // Left accent bar via inset shadow -- survives horizontal scroll,
            // unlike a border-l which the first cell's padding would hide.
            'bg-surface-selected shadow-[inset_3px_0_0_0_var(--color-brand-500)]'
          : 'hover:bg-surface-hover',
        className,
      )}
      {...props}
    />
  )
}

export function TD({
  className,
  numeric,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return (
    <td
      className={cn(
        'h-row px-3 text-text-primary',
        numeric && 'text-right tabular-nums',
        className,
      )}
      {...props}
    />
  )
}

export function TableEmpty({
  title,
  hint,
  colSpan,
}: {
  title: string
  hint?: string
  colSpan: number
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-3 py-12 text-center">
        <p className="text-base font-medium text-text-secondary">{title}</p>
        {/* Empty states say what to do next. Never just "No data". */}
        {hint ? <p className="mt-1 text-xs text-text-muted">{hint}</p> : null}
      </td>
    </tr>
  )
}
