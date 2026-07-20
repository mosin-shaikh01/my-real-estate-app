import { Check, Lock, Minus, Pencil, Plus } from 'lucide-react'
import { Fragment, useState } from 'react'
import { Can } from '@/components/auth/Can'
import { PageHeader } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { TableWrapper } from '@/components/ui/Table'
import { RoleEditorDialog } from '@/features/rbac/components/RoleEditorDialog'
import { usePermissionCatalog, useRoles, type RoleWithPermissions } from '@/features/rbac/api/use-rbac'

// The catalog is CODE (packages/shared) and the assignment is DATA (these rows)
// — that split is what the grid makes visible. Custom roles are editable here;
// SYSTEM roles show a lock and no editor, so an admin can't lock everyone out.
// See docs/RBAC.md.

export default function RolesPage() {
  const { data: roles, isLoading: rolesLoading } = useRoles()
  const { data: catalog, isLoading: catLoading } = usePermissionCatalog()
  // 'new' opens the create dialog; a role object opens it in edit mode.
  const [editing, setEditing] = useState<RoleWithPermissions | 'new' | null>(null)

  if (rolesLoading || catLoading || !roles || !catalog) {
    return (
      <div className="p-6">
        <div className="h-4 w-40 animate-pulse rounded bg-surface-hover" />
      </div>
    )
  }

  const roleHas = (role: (typeof roles)[number], key: string) => role.permissionKeys.includes(key)

  return (
    <>
      <PageHeader
        title="Roles & access"
        description="Who can do what. The catalog is code; the grants are data — add or edit custom roles without a deploy."
        action={
          <Can permission="rbac.role.create">
            <Button variant="primary" onClick={() => setEditing('new')}>
              <Plus aria-hidden="true" />
              New role
            </Button>
          </Can>
        }
      />

      <div className="p-6">
        <div className="mb-4 flex flex-wrap gap-3">
          {roles.map((r) => (
            <Card key={r.id} className="min-w-48 flex-1">
              <Card.Body className="py-3">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-text-primary">{r.name}</span>
                  {r.isSystem ? (
                    <span title="System role — cannot be edited or deleted">
                      <Lock className="size-3 text-text-muted" aria-hidden="true" />
                    </span>
                  ) : null}
                  {!r.isSystem ? (
                    <Can permission="rbac.role.update">
                      <button
                        type="button"
                        onClick={() => setEditing(r)}
                        aria-label={`Edit ${r.name}`}
                        title="Edit role"
                        className="ml-auto inline-flex rounded p-1 text-text-muted hover:bg-surface-hover hover:text-text-brand focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500"
                      >
                        <Pencil className="size-3.5" aria-hidden="true" />
                      </button>
                    </Can>
                  ) : null}
                </div>
                <p className="mt-0.5 text-2xs text-text-muted">
                  {r.userCount} user{r.userCount === 1 ? '' : 's'} · {r.permissionKeys.length} permissions
                </p>
              </Card.Body>
            </Card>
          ))}
        </div>

        <TableWrapper>
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-surface-sunken">
              <tr>
                <th className="border-b border-border-subtle px-3 py-2 text-left text-2xs font-semibold tracking-wide text-text-muted uppercase">
                  Permission
                </th>
                {roles.map((r) => (
                  <th
                    key={r.id}
                    className="w-28 border-b border-border-subtle px-3 py-2 text-center text-2xs font-semibold tracking-wide text-text-muted uppercase"
                  >
                    {r.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {catalog.map((group) => (
                <Fragment key={group.resource}>
                  {/* Category separator. A recessed band (surface-sunken, one
                      step darker than the raised rows), bracketed top and bottom
                      by a border stronger than the row hairlines, with a bold
                      uppercase label. All semantic tokens, so it remaps for dark
                      mode and keeps AA contrast. The permission rows below are
                      untouched. */}
                  <tr>
                    <th
                      scope="colgroup"
                      colSpan={roles.length + 1}
                      className="border-y border-border-default bg-surface-sunken px-3 py-2.5 text-left text-2xs font-bold tracking-wider text-text-secondary uppercase"
                    >
                      {group.resource}
                    </th>
                  </tr>
                  {group.permissions.map((p) => (
                    <tr key={p.key} className="border-b border-border-subtle last:border-0 hover:bg-surface-hover">
                      <td className="px-3 py-1.5">
                        <span className="text-text-primary">{p.description}</span>
                        <span className="ml-2 font-mono text-2xs text-text-muted">{p.key}</span>
                      </td>
                      {roles.map((r) => (
                        <td key={r.id} className="px-3 py-1.5 text-center">
                          {roleHas(r, p.key) ? (
                            <Check className="mx-auto size-4 text-text-success" aria-label="granted" />
                          ) : (
                            <Minus className="mx-auto size-3.5 text-border-strong" aria-label="not granted" />
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </TableWrapper>
      </div>

      {editing ? (
        <RoleEditorDialog role={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />
      ) : null}
    </>
  )
}
