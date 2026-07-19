import { AnimatePresence, motion } from 'motion/react'
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'
import { useCallback, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { ToastContext, type Toast, type ToastOptions, type ToastVariant } from './use-toast'

// ============================================================================
// Toasts — transient feedback for actions that navigate away or happen in the
// background (save, delete, assign). The one place the app confirms "that
// worked" without a full-page state change.
// ============================================================================
// Deliberately tiny and dependency-free: a provider holding a queue, a portal-
// free fixed viewport, and `motion` for the enter/exit (the ONE overlay use the
// design system sanctions for animation). Accessibility is not optional — the
// viewport is an aria-live region so a screen reader announces every toast, and
// errors use role="alert" (assertive) while successes use role="status".
//
// The context + `useToast` hook live in ./use-toast so this file can export
// only components (react-refresh).
// ============================================================================

const VARIANT_STYLE: Record<ToastVariant, { icon: typeof Info; ring: string; iconTone: string }> = {
  success: { icon: CheckCircle2, ring: 'border-border-success-soft', iconTone: 'text-text-success' },
  error: { icon: AlertCircle, ring: 'border-border-danger-soft', iconTone: 'text-text-danger' },
  info: { icon: Info, ring: 'border-border-strong', iconTone: 'text-text-secondary' },
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const seq = useRef(0)
  // Track timers so a manual dismiss also clears the pending auto-dismiss.
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>())

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
  }, [])

  const toast = useCallback(
    ({ title, description, variant = 'info', duration }: ToastOptions) => {
      const id = ++seq.current
      setToasts((prev) => [...prev, { id, title, description, variant }])
      const ms = duration ?? (variant === 'error' ? 6000 : 4000)
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), ms),
      )
    },
    [dismiss],
  )

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss])

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Above dialogs (z-50) so a "saved" toast is never hidden behind a modal.
          aria-live so it is announced; the individual role is set per toast. */}
      <div
        aria-live="polite"
        aria-relevant="additions"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:items-end"
      >
        <AnimatePresence initial={false}>
          {toasts.map((t) => {
            const style = VARIANT_STYLE[t.variant]
            const Icon = style.icon
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.12 } }}
                transition={{ duration: 0.18, ease: [0.25, 1, 0.5, 1] }}
                role={t.variant === 'error' ? 'alert' : 'status'}
                className={cn(
                  'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border bg-surface-raised px-4 py-3 shadow-overlay',
                  style.ring,
                )}
              >
                <Icon className={cn('mt-0.5 size-4 shrink-0', style.iconTone)} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text-primary">{t.title}</p>
                  {t.description ? (
                    <p className="mt-0.5 text-xs text-text-secondary">{t.description}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(t.id)}
                  aria-label="Dismiss notification"
                  className="-mr-1 -mt-0.5 rounded p-1 text-text-muted hover:bg-surface-hover hover:text-text-secondary"
                >
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}
