import type { PropertyStatus } from '@app/shared'
import { PROPERTY_STATUS_LABELS } from '@app/shared'
import { cn } from '@/lib/cn'

// ============================================================================
// Status is a DOT PLUS A LABEL. Never colour alone.
// ============================================================================
// WCAG 1.4.1, and also just legible -- roughly 1 in 12 men has a colour vision
// deficiency, and a bare coloured pill is unreadable to them.
//
// Note `SOLD` is neutral, not red. Red means destructive. Sold is a terminal
// SUCCESS and must not shout over the AVAILABLE rows, which are the actionable
// ones. This is the single decision that separates a considered CRM from one
// that looks like a traffic light.
// ============================================================================

const DOT: Record<PropertyStatus, string> = {
  AVAILABLE: 'bg-status-available',
  RESERVED: 'bg-status-reserved',
  UNDER_OFFER: 'bg-status-under-offer',
  ON_HOLD: 'bg-status-on-hold',
  RENTED: 'bg-status-rented',
  SOLD: 'bg-status-sold',
  CANCELLED: 'bg-status-cancelled',
}

export function StatusBadge({
  status,
  className,
}: {
  status: PropertyStatus
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-border-subtle',
        'bg-surface-raised py-0.5 pr-2.5 pl-2 text-xs font-medium text-text-secondary',
        className,
      )}
    >
      <span className={cn('size-1.5 rounded-full', DOT[status])} aria-hidden="true" />
      {PROPERTY_STATUS_LABELS[status]}
    </span>
  )
}
