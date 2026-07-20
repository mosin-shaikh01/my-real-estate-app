import { Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from './Button'
import { Dialog } from './Dialog'

// ONE confirmation surface for the whole app. Every destructive-or-reversible
// action (delete, archive, restore, remove) confirms through this, so they all
// look and behave identically — the styled Dialog, never the browser's native
// window.confirm alert. Controlled: the caller owns `open` and the mutation's
// `pending`, and runs the action in `onConfirm`.

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  children,
  confirmLabel = 'Confirm',
  pendingLabel,
  confirmVariant = 'primary',
  pending = false,
  error,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  children: ReactNode
  confirmLabel?: string
  /** Shown on the confirm button while pending; defaults to confirmLabel. */
  pendingLabel?: string
  /** `danger` for irreversible/permanent actions; `primary` otherwise. */
  confirmVariant?: 'primary' | 'danger'
  pending?: boolean
  /** A server error to surface inside the dialog (e.g. a delete-guard message). */
  error?: string | null
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button variant={confirmVariant} onClick={onConfirm} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            {pending ? (pendingLabel ?? confirmLabel) : confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-sm text-text-secondary">{children}</div>
      {error ? (
        <p role="alert" className="mt-2 text-xs text-text-danger">
          {error}
        </p>
      ) : null}
    </Dialog>
  )
}
