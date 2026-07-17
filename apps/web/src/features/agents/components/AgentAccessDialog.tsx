import { Loader2 } from 'lucide-react'
import { Fragment, useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { useAgentPermissions, useSetAgentPermissions } from '@/features/agents/api/use-agents'
import { usePermissionCatalog } from '@/features/rbac/api/use-rbac'
import { cn } from '@/lib/cn'

// ============================================================================
// Per-agent access editor
// ============================================================================
// effective = (rolePermissions ∪ ALLOWs) \ DENYs. Each checkbox shows the
// agent's EFFECTIVE state. Toggling AWAY from what the role grants creates an
// override (a badge marks it); toggling back removes it. The client sends only
// the diffs, so the stored set stays minimal and a future role change still
// flows through the un-overridden permissions.
//
// Takes effect on the agent's next request — no re-login, no token refresh.
// ============================================================================

export function AgentAccessDialog({
  agentId,
  agentName,
  onClose,
}: {
  agentId: string
  agentName: string
  onClose: () => void
}) {
  const { data: perms, isLoading: permsLoading } = useAgentPermissions(agentId)
  const { data: catalog, isLoading: catLoading } = usePermissionCatalog()
  const save = useSetAgentPermissions(agentId)
  const [error, setError] = useState<string | null>(null)

  // Local desired state: the set of permission keys that should be effective.
  // Seeded from the server's effective set once both queries resolve.
  const [checked, setChecked] = useState<Set<string> | null>(null)
  const roleKeys = useMemo(() => new Set(perms?.rolePermissionKeys ?? []), [perms])

  // Seed once, during render (not an effect) — the adjust-during-render pattern.
  if (checked === null && perms) {
    setChecked(new Set(perms.effectivePermissionKeys))
  }

  const loading = permsLoading || catLoading || checked === null || !catalog
  const current = checked ?? new Set<string>()

  const toggle = (key: string) => {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // An override exists where the desired state differs from the role default.
  const overrideCount = catalog
    ? catalog
        .flatMap((g) => g.permissions)
        .filter((p) => current.has(p.key) !== roleKeys.has(p.key)).length
    : 0

  const onSave = async () => {
    if (!catalog) return
    setError(null)
    const overrides = catalog
      .flatMap((g) => g.permissions)
      .filter((p) => current.has(p.key) !== roleKeys.has(p.key))
      .map((p) => ({
        key: p.key,
        // Differs-and-checked → the role withholds it, so ALLOW. Differs-and-
        // unchecked → the role grants it, so DENY.
        effect: current.has(p.key) ? ('ALLOW' as const) : ('DENY' as const),
      }))
    try {
      await save.mutateAsync({ overrides })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save access')
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Access — ${agentName}`}
      description="Grant or restrict individual permissions. Overrides take effect on the agent's next action."
      footer={
        <>
          <span className="mr-auto text-xs text-text-muted">
            {overrideCount} override{overrideCount === 1 ? '' : 's'} vs the Agent role
          </span>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void onSave()} disabled={loading || save.isPending}>
            {save.isPending ? (
              <>
                <Loader2 className="animate-spin" aria-hidden="true" />
                Saving…
              </>
            ) : (
              'Save access'
            )}
          </Button>
        </>
      }
    >
      {loading ? (
        <p className="py-8 text-center text-sm text-text-muted">Loading…</p>
      ) : (
        <div className="flex flex-col gap-4">
          {error ? (
            <p role="alert" className="text-xs text-text-danger">{error}</p>
          ) : null}

          {catalog!.map((group) => (
            <Fragment key={group.resource}>
              <p className="text-2xs font-semibold tracking-wide text-text-muted uppercase">
                {group.resource}
              </p>
              <ul className="flex flex-col gap-1">
                {group.permissions.map((p) => {
                  const isChecked = current.has(p.key)
                  const isOverride = isChecked !== roleKeys.has(p.key)
                  return (
                    <li key={p.key}>
                      <label className="flex cursor-pointer items-center gap-2.5 rounded px-1.5 py-1 hover:bg-surface-hover">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggle(p.key)}
                          className="size-3.5 accent-brand-600"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="text-sm text-text-primary">{p.description}</span>
                          <span className="ml-1.5 font-mono text-2xs text-text-muted">{p.key}</span>
                        </span>
                        {isOverride ? (
                          <span
                            className={cn(
                              'shrink-0 rounded px-1.5 py-0.5 text-2xs font-medium',
                              isChecked ? 'bg-surface-success-soft text-text-success' : 'bg-surface-warning-soft text-text-warning',
                            )}
                          >
                            {isChecked ? 'Granted' : 'Denied'}
                          </span>
                        ) : null}
                      </label>
                    </li>
                  )
                })}
              </ul>
            </Fragment>
          ))}
        </div>
      )}
    </Dialog>
  )
}
