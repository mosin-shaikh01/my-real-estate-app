import { Sparkles } from 'lucide-react'
import { Card } from '@/components/ui/Card'

// Placeholder for the not-yet-implemented channels. The architecture is ready —
// a provider file and one registry line light each of these up — but there's
// nothing to configure yet, so we say so plainly instead of showing a dead form.
export function ComingSoon({ channel, blurb }: { channel: string; blurb: string }) {
  return (
    <Card>
      <Card.Body className="flex flex-col items-center gap-3 py-12 text-center">
        <div className="grid size-11 place-items-center rounded-full bg-surface-brand-soft text-text-brand">
          <Sparkles className="size-5" aria-hidden="true" />
        </div>
        <div>
          <p className="text-md font-semibold text-text-primary">{channel} — coming soon</p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-text-muted">{blurb}</p>
        </div>
        <span className="rounded-full bg-surface-hover px-2.5 py-0.5 text-2xs font-medium text-text-secondary">
          Architecture ready
        </span>
      </Card.Body>
    </Card>
  )
}
