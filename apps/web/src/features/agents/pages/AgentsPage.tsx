import { KeyRound, Pencil, Plus, Search, UserX } from 'lucide-react'
import { useState } from 'react'
import { Can, Locked } from '@/components/auth/Can'
import { PageHeader } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Table, TableEmpty, TableWrapper, TD, TH, THead, TR } from '@/components/ui/Table'
import { InfoHint, Tooltip } from '@/components/ui/Tooltip'
import { useAgents, useSetAgentStatus, type AgentDTO } from '@/features/agents/api/use-agents'
import { AgentAccessDialog } from '@/features/agents/components/AgentAccessDialog'
import { AgentCreateDialog } from '@/features/agents/components/AgentCreateDialog'
import { AgentEditDialog } from '@/features/agents/components/AgentEditDialog'
import { cn } from '@/lib/cn'

// Admin-only surface — the route is guarded by <RequirePermission agent.list>.
// This page never renders for an agent, so no per-row permission checks here.
export default function AgentsPage() {
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [creating, setCreating] = useState(false)

  const { data, isLoading, isError, error } = useAgents({ q, page })
  const rows = data?.data ?? []
  const meta = data?.meta

  return (
    <>
      <PageHeader
        title="Agents"
        description={meta ? `${meta.total} agent${meta.total === 1 ? '' : 's'}` : undefined}
        action={
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus aria-hidden="true" />
            New agent
          </Button>
        }
      />

      <div className="flex flex-col gap-4 p-6">
        <div className="relative max-w-sm">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-text-muted"
            aria-hidden="true"
          />
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setPage(1)
            }}
            placeholder="Name, email, mobile, specialization…"
            className="pl-8"
            aria-label="Search agents"
          />
        </div>

        {isError ? (
          <div role="alert" className="rounded-lg border border-border-danger-soft bg-surface-danger-soft/40 p-4 text-base text-text-danger">
            {(error as Error).message}
          </div>
        ) : (
          <TableWrapper>
            <Table>
              <THead>
                <tr>
                  <TH className="w-28">ID</TH>
                  <TH>Agent</TH>
                  <TH className="w-36">Mobile</TH>
                  <TH>Specialization</TH>
                  <TH numeric className="w-20">Clients</TH>
                  <TH numeric className="w-24">Properties</TH>
                  <TH numeric className="w-24">
                    <span className="inline-flex items-center gap-1">
                      Commission
                      <InfoHint content="Commission rate applied on this agent's closed deals. Visible to admins only." />
                    </span>
                  </TH>
                  <TH className="w-24">Status</TH>
                  <TH className="w-40" />
                </tr>
              </THead>
              <tbody>
                {isLoading ? (
                  <TableEmpty colSpan={9} title="Loading…" />
                ) : rows.length ? (
                  rows.map((a) => <AgentRow key={a.id} agent={a} />)
                ) : (
                  <TableEmpty
                    colSpan={9}
                    title={q ? 'No agents match your search' : 'No agents yet'}
                    hint={q ? undefined : 'Add your first agent to start assigning work.'}
                  />
                )}
              </tbody>
            </Table>

            {meta && meta.totalPages > 1 ? (
              <div className="flex items-center justify-between border-t border-border-subtle px-4 py-2.5 text-xs text-text-muted">
                <span>Page {meta.page} of {meta.totalPages}</span>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    Previous
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={page >= meta.totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            ) : null}
          </TableWrapper>
        )}
      </div>

      {creating ? <AgentCreateDialog onClose={() => setCreating(false)} /> : null}
    </>
  )
}

function AgentRow({ agent }: { agent: AgentDTO }) {
  const setStatus = useSetAgentStatus(agent.id)
  const [editingAccess, setEditingAccess] = useState(false)
  const [editing, setEditing] = useState(false)
  const suspended = agent.status === 'SUSPENDED'

  return (
    <TR className={cn(suspended && 'opacity-60')}>
      <TD className="font-mono text-xs text-text-muted">{agent.code ?? '—'}</TD>
      <TD>
        <span className="font-medium text-text-primary">{agent.fullName}</span>
        <span className="block text-2xs text-text-muted">{agent.email}</span>
      </TD>
      <TD className="text-text-secondary">
        {agent.phone ? (
          <a href={`tel:${agent.phone}`} className="hover:text-text-brand hover:underline">
            {agent.phone}
          </a>
        ) : (
          '—'
        )}
      </TD>
      <TD className="text-text-secondary">{agent.specialization ?? '—'}</TD>
      <TD numeric className="text-text-secondary">{agent.assignedClientCount}</TD>
      <TD numeric className="text-text-secondary">{agent.assignedPropertyCount}</TD>
      <TD numeric>
        {/* Absent = redacted. An admin holds agent.commission.view, so they see
            it; the lock only appears if that permission is ever revoked. */}
        {'commissionRate' in agent ? (
          agent.commissionRate ? `${agent.commissionRate}%` : '—'
        ) : (
          <Locked />
        )}
      </TD>
      <TD>
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-2xs font-medium',
            suspended ? 'bg-surface-hover text-text-muted' : 'bg-surface-success-soft text-text-success',
          )}
        >
          <span className={cn('size-1.5 rounded-full', suspended ? 'bg-status-archived' : 'bg-status-available')} />
          {suspended ? 'Suspended' : 'Active'}
        </span>
      </TD>
      <TD>
        <div className="flex items-center justify-end gap-1">
          <Can permission="agent.update">
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
              <Pencil aria-hidden="true" />
              Edit
            </Button>
          </Can>
          <Can permission="agent.permissions.update">
            <Tooltip content="Choose which information this agent can view and manage.">
              <Button variant="ghost" size="sm" onClick={() => setEditingAccess(true)}>
                <KeyRound aria-hidden="true" />
                Access
              </Button>
            </Tooltip>
          </Can>
          <Tooltip
            content={
              suspended
                ? 'Reactivate this agent and restore their access.'
                : 'Deactivating signs the agent out of every device immediately.'
            }
          >
            <Button
              variant="ghost"
              size="sm"
              disabled={setStatus.isPending}
              onClick={() => setStatus.mutate(suspended ? 'ACTIVE' : 'SUSPENDED')}
            >
              {suspended ? 'Activate' : (
                <>
                  <UserX aria-hidden="true" />
                  Deactivate
                </>
              )}
            </Button>
          </Tooltip>
        </div>
      </TD>
      {editing ? <AgentEditDialog agent={agent} onClose={() => setEditing(false)} /> : null}
      {editingAccess ? (
        <AgentAccessDialog
          agentId={agent.id}
          agentName={agent.fullName}
          onClose={() => setEditingAccess(false)}
        />
      ) : null}
    </TR>
  )
}
