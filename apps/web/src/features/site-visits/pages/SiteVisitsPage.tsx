import { CalendarClock, Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  SITE_VISIT_STATUS_LABELS,
  siteVisitCreateSchema,
  siteVisitStatusSchema,
  siteVisitUpdateSchema,
  type SiteVisitCreateInput,
  type SiteVisitDTO,
  type SiteVisitStatus,
  type SiteVisitUpdateInput,
} from '@app/shared'
import { Can } from '@/components/auth/Can'
import { PageHeader } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Dialog } from '@/components/ui/Dialog'
import { FormField, Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Table, TableEmpty, TableWrapper, TD, TH, THead, TR } from '@/components/ui/Table'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/cn'
import { ApiClientError } from '@/lib/api'
import { usePermissions } from '@/features/auth/api/use-auth'
import { useAssignableAgents } from '@/features/agents/api/use-assignable-agents'
import { useClients } from '@/features/clients/api/use-clients'
import { useProperties } from '@/features/properties/api/use-properties'
import {
  useCreateSiteVisit,
  useDeleteSiteVisit,
  useSiteVisits,
  useUpdateSiteVisit,
} from '@/features/site-visits/api/use-site-visits'

const STATUS_TONE: Record<string, string> = {
  SCHEDULED: 'bg-surface-brand-soft text-text-brand',
  COMPLETED: 'bg-surface-success-soft text-text-success',
  CANCELLED: 'bg-surface-danger-soft text-text-danger',
  RESCHEDULED: 'bg-surface-warning-soft text-text-warning',
}
const STATUS_OPTIONS = siteVisitStatusSchema.options.map((s) => ({ value: s, label: SITE_VISIT_STATUS_LABELS[s] }))

function fmt(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

/** ISO → the local 'YYYY-MM-DDTHH:mm' a datetime-local input expects. */
function toDatetimeLocal(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function SiteVisitsPage() {
  const [status, setStatus] = useState('')
  const [creating, setCreating] = useState(false)
  const { has } = usePermissions()
  const canManage = has('sitevisit.update')

  const { data, isLoading, isError, error } = useSiteVisits({ status: status || undefined })
  const rows = data?.data ?? []

  return (
    <>
      <PageHeader
        title="Site visits"
        description={data ? `${data.meta.total} visit${data.meta.total === 1 ? '' : 's'}` : undefined}
        action={
          <Can permission="sitevisit.create">
            <Button variant="primary" onClick={() => setCreating(true)}>
              <Plus aria-hidden="true" />
              Schedule visit
            </Button>
          </Can>
        }
      />

      <div className="flex flex-col gap-4 p-6">
        <div className="max-w-[200px]">
          <Select
            options={[{ value: '', label: 'All statuses' }, ...STATUS_OPTIONS]}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            aria-label="Filter by status"
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
                  <TH className="w-44">When</TH>
                  <TH>Property</TH>
                  <TH>Client</TH>
                  <TH className="w-36">Agent</TH>
                  <TH className="w-40">Status</TH>
                  <TH className="w-16" />
                </tr>
              </THead>
              <tbody>
                {isLoading ? (
                  <TableEmpty colSpan={6} title="Loading…" />
                ) : rows.length ? (
                  rows.map((v) => <VisitRow key={v.id} visit={v} canManage={canManage} />)
                ) : (
                  <TableEmpty colSpan={6} title="No site visits" hint="Schedule a visit to see it here." />
                )}
              </tbody>
            </Table>
          </TableWrapper>
        )}
      </div>

      {creating ? <ScheduleDialog onClose={() => setCreating(false)} /> : null}
    </>
  )
}

function VisitRow({ visit, canManage }: { visit: SiteVisitDTO; canManage: boolean }) {
  const update = useUpdateSiteVisit(visit.id)
  const del = useDeleteSiteVisit()
  const { toast } = useToast()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [editing, setEditing] = useState(false)

  // The inline status change is a real modify — give it feedback (it was
  // fire-and-forget before, so a failure looked like nothing happened).
  const onStatusChange = async (status: SiteVisitStatus) => {
    try {
      await update.mutateAsync({ status })
      toast({ variant: 'success', title: 'Status updated' })
    } catch (err) {
      toast({ variant: 'error', title: 'Could not update status', description: err instanceof Error ? err.message : undefined })
    }
  }

  const onConfirmDelete = async () => {
    try {
      await del.mutateAsync(visit.id)
      toast({ variant: 'success', title: 'Site visit deleted' })
      setConfirmOpen(false)
    } catch (err) {
      toast({ variant: 'error', title: 'Could not delete site visit', description: err instanceof Error ? err.message : undefined })
    }
  }

  return (
    <TR>
      <TD className="whitespace-nowrap text-text-secondary">
        <CalendarClock className="mr-1.5 inline size-3.5 text-text-muted" aria-hidden="true" />
        {fmt(visit.scheduledAt)}
      </TD>
      <TD>
        <span className="font-medium text-text-primary">{visit.property.title}</span>
        <span className="block font-mono text-2xs text-text-muted">{visit.property.code}</span>
      </TD>
      <TD className="text-text-secondary">{visit.client.fullName}</TD>
      <TD className="text-text-secondary">{visit.agent?.fullName ?? '—'}</TD>
      <TD>
        {canManage ? (
          <Select
            options={STATUS_OPTIONS}
            value={visit.status}
            onChange={(e) => void onStatusChange(e.target.value as SiteVisitStatus)}
            disabled={update.isPending}
            aria-label="Update status"
          />
        ) : (
          <span className={cn('inline-flex rounded-full px-2 py-0.5 text-2xs font-medium', STATUS_TONE[visit.status])}>
            {SITE_VISIT_STATUS_LABELS[visit.status as SiteVisitStatus] ?? visit.status}
          </span>
        )}
      </TD>
      <TD>
        <div className="flex items-center justify-end gap-0.5">
          <Can permission="sitevisit.update">
            <button
              type="button"
              onClick={() => setEditing(true)}
              aria-label="Edit visit"
              title="Edit"
              className="rounded-md p-1 text-text-secondary hover:bg-surface-hover hover:text-text-brand"
            >
              <Pencil className="size-4" aria-hidden="true" />
            </button>
          </Can>
          <Can permission="sitevisit.delete">
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              className="rounded-md p-1 text-text-secondary hover:bg-surface-danger-soft/40 hover:text-text-danger"
              title="Delete"
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </button>
          </Can>
        </div>

        <ConfirmDialog
          open={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          onConfirm={() => void onConfirmDelete()}
          title="Delete site visit"
          confirmLabel="Delete"
          pendingLabel="Deleting…"
          confirmVariant="danger"
          pending={del.isPending}
        >
          Delete this scheduled visit for{' '}
          <span className="font-medium text-text-primary">{visit.property.title}</span>? This can&rsquo;t be
          undone.
        </ConfirmDialog>
        {editing ? <EditVisitDialog visit={visit} onClose={() => setEditing(false)} /> : null}
      </TD>
    </TR>
  )
}

function ScheduleDialog({ onClose }: { onClose: () => void }) {
  const create = useCreateSiteVisit()
  const { toast } = useToast()
  const { has } = usePermissions()
  const canPickAgent = has('property.assignAgent') || has('client.assignAgent') || has('client.assignProperty')
  const { data: props } = useProperties({})
  const { data: clients } = useClients({})
  const { data: agents } = useAssignableAgents(canPickAgent)

  const form = useForm<SiteVisitCreateInput>({
    resolver: zodResolver(siteVisitCreateSchema),
    defaultValues: { propertyId: '', clientId: '', agentId: '', scheduledAt: '', remarks: '' },
  })

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await create.mutateAsync({
        ...values,
        agentId: values.agentId || null,
        // datetime-local gives 'YYYY-MM-DDTHH:mm' — turn it into a real ISO string.
        scheduledAt: new Date(values.scheduledAt).toISOString(),
        remarks: values.remarks || null,
      })
      toast({ variant: 'success', title: 'Site visit scheduled' })
      onClose()
    } catch (err) {
      if (err instanceof ApiClientError && err.details) {
        for (const [path, messages] of Object.entries(err.details)) {
          form.setError(path as keyof SiteVisitCreateInput, { message: messages[0] })
        }
        return
      }
      form.setError('root', { message: err instanceof Error ? err.message : 'Could not schedule the visit' })
      toast({ variant: 'error', title: 'Could not schedule the visit', description: err instanceof Error ? err.message : undefined })
    }
  })

  return (
    <Dialog
      open
      onClose={onClose}
      title="Schedule a site visit"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="visit-form" variant="primary" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            Schedule
          </Button>
        </>
      }
    >
      <form id="visit-form" onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <div className="sm:col-span-2">
          <FormField label="Property" error={form.formState.errors.propertyId?.message} required>
            {() => (
              <Select
                options={[
                  { value: '', label: 'Select a property…' },
                  ...(props?.data ?? []).map((p) => ({ value: p.id, label: `${p.code} — ${p.title}` })),
                ]}
                {...form.register('propertyId')}
                value={form.watch('propertyId')}
              />
            )}
          </FormField>
        </div>
        <div className="sm:col-span-2">
          <FormField label="Client" error={form.formState.errors.clientId?.message} required>
            {() => (
              <Select
                options={[
                  { value: '', label: 'Select a client…' },
                  ...(clients?.data ?? []).map((c) => ({ value: c.id, label: `${c.code} — ${c.fullName}` })),
                ]}
                {...form.register('clientId')}
                value={form.watch('clientId')}
              />
            )}
          </FormField>
        </div>
        <FormField label="Date & time" error={form.formState.errors.scheduledAt?.message} required>
          {(p) => <Input {...p} type="datetime-local" {...form.register('scheduledAt')} />}
        </FormField>
        {canPickAgent ? (
          <FormField label="Agent">
            {() => (
              <Select
                options={[
                  { value: '', label: 'Unassigned' },
                  ...(agents ?? []).map((a) => ({ value: a.id, label: a.fullName })),
                ]}
                {...form.register('agentId')}
                value={form.watch('agentId') ?? ''}
              />
            )}
          </FormField>
        ) : null}
        <div className="sm:col-span-2">
          <FormField label="Remarks" error={form.formState.errors.remarks?.message}>
            {(p) => <Input {...p} {...form.register('remarks')} placeholder="Optional" />}
          </FormField>
        </div>

        {form.formState.errors.root ? (
          <p role="alert" className="text-xs text-text-danger sm:col-span-2">{form.formState.errors.root.message}</p>
        ) : null}
      </form>
    </Dialog>
  )
}

// Modify an existing visit — reschedule, reassign the agent, change status, and
// record remarks/feedback. Property and client are fixed for a visit, so they're
// shown for context but not editable. Backed by PATCH /site-visits/:id.
function EditVisitDialog({ visit, onClose }: { visit: SiteVisitDTO; onClose: () => void }) {
  const update = useUpdateSiteVisit(visit.id)
  const { toast } = useToast()
  const { has } = usePermissions()
  const canPickAgent = has('property.assignAgent') || has('client.assignAgent') || has('client.assignProperty')
  const { data: agents } = useAssignableAgents(canPickAgent)

  const form = useForm<SiteVisitUpdateInput>({
    resolver: zodResolver(siteVisitUpdateSchema),
    defaultValues: {
      status: visit.status as SiteVisitStatus,
      scheduledAt: toDatetimeLocal(visit.scheduledAt),
      agentId: visit.agent?.id ?? '',
      remarks: visit.remarks ?? '',
      feedback: visit.feedback ?? '',
    },
  })

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await update.mutateAsync({
        status: values.status,
        scheduledAt: values.scheduledAt ? new Date(values.scheduledAt).toISOString() : undefined,
        agentId: values.agentId || null,
        remarks: values.remarks || null,
        feedback: values.feedback || null,
      })
      toast({ variant: 'success', title: 'Site visit updated' })
      onClose()
    } catch (err) {
      if (err instanceof ApiClientError && err.details) {
        for (const [path, messages] of Object.entries(err.details)) {
          form.setError(path as keyof SiteVisitUpdateInput, { message: messages[0] })
        }
        return
      }
      form.setError('root', { message: err instanceof Error ? err.message : 'Could not update the visit' })
      toast({ variant: 'error', title: 'Could not update the visit', description: err instanceof Error ? err.message : undefined })
    }
  })

  return (
    <Dialog
      open
      onClose={onClose}
      title="Edit site visit"
      description={`${visit.property.code} · ${visit.client.fullName}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={form.formState.isSubmitting}>Cancel</Button>
          <Button type="submit" form="visit-edit-form" variant="primary" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            Save changes
          </Button>
        </>
      }
    >
      <form id="visit-edit-form" onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <div className="rounded-md border border-border-subtle bg-surface-sunken px-3 py-2 text-sm sm:col-span-2">
          <span className="font-medium text-text-primary">{visit.property.title}</span>
          <span className="text-text-muted"> — for {visit.client.fullName}</span>
        </div>
        <FormField label="Date & time" error={form.formState.errors.scheduledAt?.message} required>
          {(p) => <Input {...p} type="datetime-local" {...form.register('scheduledAt')} />}
        </FormField>
        <FormField label="Status" error={form.formState.errors.status?.message}>
          {() => <Select options={STATUS_OPTIONS} {...form.register('status')} value={form.watch('status')} />}
        </FormField>
        {canPickAgent ? (
          <FormField label="Agent">
            {() => (
              <Select
                options={[
                  { value: '', label: 'Unassigned' },
                  ...(agents ?? []).map((a) => ({ value: a.id, label: a.fullName })),
                ]}
                {...form.register('agentId')}
                value={form.watch('agentId') ?? ''}
              />
            )}
          </FormField>
        ) : null}
        <div className="sm:col-span-2">
          <FormField label="Remarks" error={form.formState.errors.remarks?.message}>
            {(p) => <Input {...p} {...form.register('remarks')} placeholder="Notes for the team" />}
          </FormField>
        </div>
        <div className="sm:col-span-2">
          <FormField label="Feedback" error={form.formState.errors.feedback?.message}>
            {(p) => <Input {...p} {...form.register('feedback')} placeholder="What the client thought after the visit" />}
          </FormField>
        </div>

        {form.formState.errors.root ? (
          <p role="alert" className="text-xs text-text-danger sm:col-span-2">{form.formState.errors.root.message}</p>
        ) : null}
      </form>
    </Dialog>
  )
}
