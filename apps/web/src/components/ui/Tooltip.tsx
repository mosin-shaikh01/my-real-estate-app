import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { Info } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useState, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

// ============================================================================
// The ONE tooltip. Radix owns the hard parts — hover + focus open, Esc/blur
// close, aria-describedby wiring, collision-aware positioning — so it is
// keyboard accessible and screen-reader friendly by construction. Framer Motion
// adds the subtle fade/scale (honouring prefers-reduced-motion). One style,
// used everywhere; a global Tooltip.Provider (delay) lives in app/providers.
//
// Content is a ReactNode, so it takes a short string today and rich content or
// a docs link later without changing call sites.
// ============================================================================

type Side = 'top' | 'right' | 'bottom' | 'left'

export function Tooltip({
  content,
  children,
  side = 'top',
  align = 'center',
  delayDuration,
  className,
}: {
  content: ReactNode
  /** The trigger. Must accept a ref/props — Radix clones it via asChild. */
  children: ReactNode
  side?: Side
  align?: 'start' | 'center' | 'end'
  delayDuration?: number
  className?: string
}) {
  const reduce = useReducedMotion()
  // Controlled so AnimatePresence can play an exit; Radix still applies the
  // provider's open/close delay through onOpenChange.
  const [open, setOpen] = useState(false)

  if (content === null || content === undefined || content === '') return <>{children}</>

  return (
    <TooltipPrimitive.Root open={open} onOpenChange={setOpen} delayDuration={delayDuration}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <AnimatePresence>
        {open ? (
          <TooltipPrimitive.Portal forceMount>
            <TooltipPrimitive.Content
              asChild
              side={side}
              align={align}
              sideOffset={6}
              collisionPadding={8}
            >
              <motion.div
                initial={reduce ? false : { opacity: 0, scale: 0.96 }}
                animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.12, ease: 'easeOut' }}
                className={cn(
                  'z-50 max-w-xs rounded-md border border-border-subtle bg-surface-raised px-2.5 py-1.5',
                  'text-xs leading-snug text-text-secondary shadow-e2',
                  className,
                )}
              >
                {content}
                <TooltipPrimitive.Arrow className="fill-surface-raised" width={11} height={5} />
              </motion.div>
            </TooltipPrimitive.Content>
          </TooltipPrimitive.Portal>
        ) : null}
      </AnimatePresence>
    </TooltipPrimitive.Root>
  )
}

// A small info (ⓘ) affordance for next to a label — the preferred pattern over
// attaching a tooltip to the label text itself. It is a real <button> so it is
// tab-reachable and taps focus it on mobile (which opens the tooltip), and it
// never submits a form.
export function InfoHint({
  content,
  label = 'More information',
  side,
  className,
}: {
  content: ReactNode
  /** Accessible name for the icon button. */
  label?: string
  side?: Side
  className?: string
}) {
  return (
    <Tooltip content={content} side={side}>
      <button
        type="button"
        aria-label={label}
        className={cn(
          'inline-grid size-4 place-items-center rounded-full text-text-muted align-middle',
          'transition-colors hover:text-text-secondary',
          'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500',
          className,
        )}
      >
        <Info className="size-3.5" aria-hidden="true" />
      </button>
    </Tooltip>
  )
}
