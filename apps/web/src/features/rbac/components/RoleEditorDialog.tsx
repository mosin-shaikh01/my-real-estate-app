import { Loader2, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { FormField, Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/use-toast'
import {
  useCreateRole,
  useDeleteRole,
  usePermissionCatalog,
  useUpdateRole,
  type RoleWithPermissions,
} from '@/features/rbac/api/use-rbac'
import { ApiClientError } from '@/lib/api'
import { cn } from '@/lib/cn'

// Create or edit a CUSTOM role. The permission set is picked from the same
// catalog the read-only matrix renders, grouped by resource with a per-group
// select-all. System roles never reach here — the page offers no editor for them.

export function RoleEditorDialog({ role, onClose }: { role?: RoleWithPermissions; onClose: () => void }) {
  const isEdit = Boolean(role)
  const { data: catalog } = usePermissionCatalog()
  const { toast } = useToast()
  const create = useCreateRole()
  const update = useUpdateRole(role?.id ?? '')
  const del = useDeleteRole()

  const [name, setName] = useState(role?.name ?? '')
  const [description, setDescription] = useState(role?.description ?? '')
  const [selected, setSelected] = useState<Set<string>>(new Set(role?.permissionKeys ?? []))
  const [nameError, setNameError] = useState<string | null>(null)

  const toggle = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const toggleGroup = (keys: string[]) =>
    setSelected((prev) => {
      const next = new Set(prev)
      const allOn = keys.every((k) => next.has(k))
      for (const k of keys) {
        if (allOn) next.delete(k)
        else next.add(k)
      }
      return next
    })

  const busy = create.isPending || update.isPending || del.isPending

  const onSave = async () => {
    setNameError(null)
    if (name.trim().length < 2) {
      setNameError('Enter a role name')
      return
    }
    const input = {
      name: name.trim(),
      description: description.trim() || null,
      permissionKeys: [...selected] as never,
    }
    try {
      if (isEdit && role) await update.mutateAsync(input)
      else await create.mutateAsync(input)
      toast({ variant: 'success', title: isEdit ? 'Role updated' : 'Role created' })
      onClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save the role'
      if (err instanceof ApiClientError && /name/i.test(message)) setNameError(message)
      toast({ variant: 'error', title: isEdit ? 'Could not update role' : 'Could not create role', description: message })
    }
  }

  const onDelete = async () => {
    if (!role) return
    if (!window.confirm(`Delete the role "${role.name}"? This cannot be undone.`)) return
    try {
      await del.mutateAsync(role.id)
      toast({ variant: 'success', title: 'Role deleted' })
      onClose()
    } catch (err) {
      toast({ variant: 'error', title: 'Could not delete role', description: err instanceof Error ? err.message : undefined })
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={isEdit ? `Edit ${role?.name}` : 'New role'}
      description="Pick the permissions this role grants. Changes take effect on each user's next request."
      footer={
        <>
          {isEdit && role && role.userCount === 0 ? (
            <Button variant="ghost" onClick={() => void onDelete()} disabled={busy} className="mr-auto text-text-danger">
              <Trash2 aria-hidden="true" />
              Delete role
            </Button>
          ) : null}
          <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="primary" onClick={() => void onSave()} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            {isEdit ? 'Save changes' : 'Create role'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Role name" error={nameError ?? undefined} required>
            {(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Senior Agent" />}
          </FormField>
          <FormField label="Description">
            {(p) => <Input {...p} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" />}
          </FormField>
        </div>

        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className="text-xs font-medium text-text-secondary">Permissions</span>
            <span className="text-2xs text-text-muted tabular-nums">{selected.size} selected</span>
          </div>
          <div className="flex flex-col gap-3 rounded-md border border-border-subtle p-3">
            {!catalog ? (
              <p className="py-2 text-center text-sm text-text-muted">Loading permissions…</p>
            ) : (
              catalog.map((group) => {
                const keys = group.permissions.map((p) => p.key)
                const allOn = keys.every((k) => selected.has(k))
                const someOn = !allOn && keys.some((k) => selected.has(k))
                return (
                  <div key={group.resource}>
                    <label className="flex cursor-pointer items-center gap-2 border-b border-border-subtle pb-1.5">
                      <input
                        type="checkbox"
                        className="size-3.5 accent-brand-600"
                        checked={allOn}
                        ref={(el) => {
                          if (el) el.indeterminate = someOn
                        }}
                        onChange={() => toggleGroup(keys)}
                      />
                      <span className="text-2xs font-bold tracking-wider text-text-secondary uppercase">{group.resource}</span>
                    </label>
                    <div className="mt-1.5 grid gap-x-4 gap-y-1 sm:grid-cols-2">
                      {group.permissions.map((p) => (
                        <label key={p.key} className="flex cursor-pointer items-center gap-2 py-0.5">
                          <input
                            type="checkbox"
                            className="size-3.5 shrink-0 accent-brand-600"
                            checked={selected.has(p.key)}
                            onChange={() => toggle(p.key)}
                          />
                          <span className="min-w-0 flex-1 truncate text-xs text-text-primary" title={`${p.description} (${p.key})`}>
                            {p.description}
                          </span>
                          <span className={cn('shrink-0 font-mono text-2xs text-text-muted')}>{p.action}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </Dialog>
  )
}
