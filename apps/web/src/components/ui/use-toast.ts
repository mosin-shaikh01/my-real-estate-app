import { createContext, useContext } from 'react'

// The context + hook live apart from the <ToastProvider>/<Toaster> component so
// that file can export only components (react-refresh/only-export-components).
// A module that exports just a hook and types is fine.

export type ToastVariant = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: number
  title: string
  description?: string
  variant: ToastVariant
  /** Per-toast override; falls back to the variant default in the component. */
  duration?: number
}

export interface ToastOptions {
  title: string
  description?: string
  variant?: ToastVariant
  /** Milliseconds before auto-dismiss. Errors linger longer than successes. */
  duration?: number
}

export interface ToastContextValue {
  toast: (opts: ToastOptions) => void
  dismiss: (id: number) => void
}

export const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>')
  return ctx
}
