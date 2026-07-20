import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { ToastContext, type Toast, type ToastOptions, type ToastVariant } from './use-toast'

// ============================================================================
// Toasts — the ONE notification surface for the whole CRM.
// ============================================================================
// Transient feedback for actions that navigate away or happen in the background
// (create, save, archive, send). Every module uses `useToast()` — there is no
// second implementation, no per-page snackbar, no bottom-right variant.
//
// STANDARDISED, non-negotiable so it looks identical everywhere:
//   Position    bottom-CENTRE, fixed, consistent bottom gap, stacks upward.
//   Animation   fade in + slide up (~240ms ease-out), smooth fade out.
//   Design      one radius, padding, width, shadow, icon + font size.
//   Variants    success / error / warning / info — icon + accent bar + colour.
//   Behaviour   auto-dismiss 4–5s, PAUSE ON HOVER, manual close, progress bar.
//   a11y        aria-live region; role=alert for errors, role=status otherwise;
//               reduced-motion drops the transform and the progress animation.
// ============================================================================

const DURATION: Record<ToastVariant, number> = {
  success: 4000,
  info: 4000,
  warning: 5000,
  error: 5000,
}

const VARIANT: Record<
  ToastVariant,
  { icon: typeof Info; iconTone: string; bar: string }
> = {
  success: { icon: CheckCircle2, iconTone: 'text-text-success', bar: 'bg-success-500' },
  error: { icon: AlertCircle, iconTone: 'text-text-danger', bar: 'bg-danger-500' },
  warning: { icon: TriangleAlert, iconTone: 'text-text-warning', bar: 'bg-warning-500' },
  info: { icon: Info, iconTone: 'text-text-brand', bar: 'bg-brand-500' },
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const seq = useRef(0)

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback(({ title, description, variant = 'info', duration }: ToastOptions) => {
    const id = ++seq.current
    setToasts((prev) => [...prev, { id, title, description, variant, duration }])
  }, [])

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss])

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Bottom-CENTRE, above dialogs (z-50) so a toast is never hidden behind a
          modal. aria-live announces additions; per-toast role is set below.
          Stacks upward: newest sits nearest the bottom edge. */}
      <div
        aria-live="polite"
        aria-relevant="additions"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:pb-6"
      >
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  const reduce = useReducedMotion()
  const style = VARIANT[toast.variant]
  const Icon = style.icon
  const duration = toast.duration ?? DURATION[toast.variant]

  // Pause-on-hover with a JS timer: remaining time is banked on enter and the
  // timer restarts from it on leave, so hovering truly freezes the countdown.
  const [paused, setPaused] = useState(false)
  const remaining = useRef(duration)
  // Set in the effect (a real timestamp during render would be an impure call).
  const startedAt = useRef(0)

  useEffect(() => {
    if (paused) return
    startedAt.current = Date.now()
    const timer = setTimeout(() => onDismiss(toast.id), remaining.current)
    return () => clearTimeout(timer)
  }, [paused, toast.id, onDismiss])

  const pause = () => {
    remaining.current = Math.max(0, remaining.current - (Date.now() - startedAt.current))
    setPaused(true)
  }

  return (
    <motion.div
      layout
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
      animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, y: 8, transition: { duration: 0.16, ease: 'easeIn' } }}
      transition={{ duration: 0.24, ease: [0.25, 1, 0.5, 1] }}
      role={toast.variant === 'error' ? 'alert' : 'status'}
      onMouseEnter={pause}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={pause}
      onBlurCapture={() => setPaused(false)}
      className="pointer-events-auto relative w-full max-w-sm overflow-hidden rounded-lg border border-border-subtle bg-surface-raised shadow-overlay"
    >
      <div className="flex items-start gap-3 px-4 py-3">
        {/* Left accent bar carries the variant colour top-to-bottom. */}
        <span className={cn('absolute inset-y-0 left-0 w-1', style.bar)} aria-hidden="true" />
        <Icon className={cn('mt-0.5 size-4 shrink-0', style.iconTone)} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-text-primary">{toast.title}</p>
          {toast.description ? (
            <p className="mt-0.5 text-xs text-text-secondary">{toast.description}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          aria-label="Dismiss notification"
          className="-mr-1 -mt-0.5 rounded p-1 text-text-muted hover:bg-surface-hover hover:text-text-secondary focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500"
        >
          <X className="size-3.5" aria-hidden="true" />
        </button>
      </div>

      {/* Progress bar — cosmetic countdown. Full-duration CSS animation whose
          play-state (not its duration) toggles on hover, so it freezes and
          resumes in lock-step with the banked JS timer without remounting.
          Hidden for reduced-motion users (the JS timer still dismisses). */}
      <span
        aria-hidden="true"
        className={cn('absolute inset-x-0 bottom-0 h-0.5 origin-left motion-reduce:hidden', style.bar)}
        style={{
          animation: `toast-progress ${duration}ms linear forwards`,
          animationPlayState: paused ? 'paused' : 'running',
        }}
      />
    </motion.div>
  )
}
