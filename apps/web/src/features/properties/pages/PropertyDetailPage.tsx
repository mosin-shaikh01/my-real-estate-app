import { ArrowLeft, Archive, ArchiveRestore, ExternalLink, Lock, MapPin, Pencil } from 'lucide-react'
import { Link, useParams } from 'react-router'
import {
  PROPERTY_STATUS_LABELS,
  PROPERTY_TYPE_LABELS,
  type PropertyStatus,
  type PropertyType,
} from '@app/shared'
import { Can, Locked } from '@/components/auth/Can'
import { PageHeader } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Select } from '@/components/ui/Select'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { InfoHint } from '@/components/ui/Tooltip'
import { PropertyDocuments } from '@/features/properties/components/PropertyDocuments'
import { PropertyGallery } from '@/features/properties/components/PropertyGallery'
import { usePermissions } from '@/features/auth/api/use-auth'
import { useAssignableAgents } from '@/features/agents/api/use-assignable-agents'
import { useProperty } from '@/features/properties/api/use-properties'
import {
  useArchiveProperty,
  useAssignPropertyAgent,
  useSetPropertyStatus,
} from '@/features/properties/api/use-property-mutations'
import { ApiClientError } from '@/lib/api'
import { formatArea, formatDate, formatMoney, formatPropertyAge, mapsUrl } from '@/lib/format'

const STATUS_OPTIONS = (Object.keys(PROPERTY_STATUS_LABELS) as PropertyStatus[]).map((s) => ({
  value: s,
  label: PROPERTY_STATUS_LABELS[s],
}))

function PropertyActions({ id, status, archived }: { id: string; status: PropertyStatus; archived: boolean }) {
  const setStatus = useSetPropertyStatus(id)
  const archive = useArchiveProperty(id)
  return (
    <div className="flex items-center gap-2">
      <Can permission="property.status.update">
        <div className="w-32">
          <Select
            aria-label="Change status"
            value={status}
            options={STATUS_OPTIONS}
            disabled={setStatus.isPending}
            onChange={(e) => setStatus.mutate(e.target.value as PropertyStatus)}
          />
        </div>
      </Can>
      <Can permission="property.archive">
        <Button
          variant="ghost"
          size="sm"
          disabled={archive.isPending}
          onClick={() => archive.mutate(!archived)}
        >
          {archived ? (
            <>
              <ArchiveRestore aria-hidden="true" />
              Restore
            </>
          ) : (
            <>
              <Archive aria-hidden="true" />
              Archive
            </>
          )}
        </Button>
      </Can>
    </div>
  )
}

export default function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: p, isLoading, isError, error } = useProperty(id)
  const { has } = usePermissions()

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="h-4 w-40 animate-pulse rounded bg-surface-hover" />
      </div>
    )
  }

  // Strict RBAC: the API returns 403 for a property that exists but isn't
  // assigned to this agent, and 404 for one that genuinely doesn't exist. Show
  // the two distinctly — "Access denied" is exactly what the spec asks an agent
  // to see when they reach for another agent's property by URL.
  if (isError || !p) {
    const denied = error instanceof ApiClientError && error.code === 'FORBIDDEN'
    return (
      <div className="grid place-items-center px-6 py-20">
        <div className="max-w-sm text-center">
          {denied ? (
            <Lock className="mx-auto size-8 text-text-muted" aria-hidden="true" />
          ) : null}
          <h1 className="mt-3 text-lg font-semibold text-text-primary">
            {denied ? 'Access denied' : 'Property not found'}
          </h1>
          <p className="mt-1 text-base text-text-secondary">
            {denied
              ? 'This property is not assigned to you. Ask an admin to assign it if you need access.'
              : ((error as Error | null)?.message ?? 'It may not exist, or it may not be assigned to you.')}
          </p>
          <Button variant="secondary" asChild className="mt-6">
            <Link to="/properties">
              <ArrowLeft aria-hidden="true" />
              Back to properties
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  const maps = mapsUrl(p.latitude, p.longitude)

  return (
    <>
      <PageHeader
        title={p.title}
        description={`${p.code} · ${PROPERTY_TYPE_LABELS[p.propertyType as PropertyType] ?? p.propertyType}`}
        action={
          <div className="flex items-center gap-2">
            <StatusBadge status={p.status as PropertyStatus} />
            <Can permission="property.update">
              <Button variant="secondary" size="sm" asChild>
                <Link to={`/properties/${p.id}/edit`}>
                  <Pencil aria-hidden="true" />
                  Edit
                </Link>
              </Button>
            </Can>
            <PropertyActions
              id={p.id}
              status={p.status as PropertyStatus}
              archived={p.archivedAt != null}
            />
          </div>
        }
      />

      <div className="grid gap-6 p-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <PropertyGallery
            propertyId={p.id}
            media={p.media}
            canDownload={has('property.media.download')}
            videoLinks={p.videoUrls}
          />

          {has('property.media.download') ? (
            <PropertyDocuments
              propertyId={p.id}
              documents={p.documents}
              canManage={has('property.media.upload')}
            />
          ) : null}

          <Card>
            <Card.Header>
              <Card.Title>Overview</Card.Title>
            </Card.Header>
            <Card.Body>
              <p className="text-base whitespace-pre-line text-text-secondary">{p.description}</p>

              <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
                <Fact label="Area" value={formatArea(p.areaSqft)} numeric />
                <Fact label="Bedrooms" value={p.bedrooms?.toString() ?? '—'} numeric />
                <Fact label="Bathrooms" value={p.bathrooms?.toString() ?? '—'} numeric />
                <Fact label="Parking" value={p.parking ? String(p.parking) : '—'} numeric />
                <Fact label="Furnishing" value={title(p.furnished)} />
                <Fact label="Facing" value={p.facing ? title(p.facing) : '—'} />
                <Fact
                  label="Floor"
                  value={p.floor != null ? `${p.floor}${p.totalFloor ? ` of ${p.totalFloor}` : ''}` : '—'}
                />
                {/* Age is DERIVED from builtYear. Storing age would be wrong next year. */}
                <Fact label="Age" value={formatPropertyAge(p.builtYear)} />
                <Fact label="Construction" value={title(p.constructionStatus)} />
              </dl>
            </Card.Body>
          </Card>

          {p.amenities.length ? (
            <Card>
              <Card.Header>
                <Card.Title>Amenities</Card.Title>
                <Card.Description>
                  A catalog, not free text — otherwise &ldquo;Swimming Pool&rdquo; and
                  &ldquo;swimming pool&rdquo; never match a client&rsquo;s requirement.
                </Card.Description>
              </Card.Header>
              <Card.Body className="flex flex-wrap gap-1.5">
                {p.amenities.map((a) => (
                  <span
                    key={a.id}
                    className="rounded-full border border-border-subtle bg-surface-sunken px-2.5 py-1 text-xs text-text-secondary"
                  >
                    {a.name}
                  </span>
                ))}
              </Card.Body>
            </Card>
          ) : null}

          {/* Absent means redacted. The lock is what makes that read as policy
              rather than as a bug. */}
          {'internalNotes' in p ? (
            p.internalNotes ? (
              <Card>
                <Card.Header>
                  <Card.Title>Internal notes</Card.Title>
                  <Card.Description>Not visible to agents.</Card.Description>
                </Card.Header>
                <Card.Body>
                  <p className="text-base whitespace-pre-line text-text-secondary">
                    {p.internalNotes}
                  </p>
                </Card.Body>
              </Card>
            ) : null
          ) : (
            <Card>
              <Card.Header>
                <Card.Title>Internal notes</Card.Title>
              </Card.Header>
              <Card.Body>
                <Locked label="You do not have access to internal notes" />
              </Card.Body>
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <Card.Header>
              <Card.Title>Pricing</Card.Title>
            </Card.Header>
            <Card.Body>
              {'salePrice' in p ? (
                <dl className="flex flex-col gap-3">
                  {p.salePrice ? (
                    <Money label="Sale price" value={p.salePrice} big />
                  ) : null}
                  {p.rentPricePerMonth ? (
                    <Money label="Rent (per month)" value={p.rentPricePerMonth} big />
                  ) : null}
                  {p.securityDeposit ? (
                    <Money label="Security deposit" value={p.securityDeposit} />
                  ) : null}
                  {p.maintenanceCharges ? (
                    <Money label="Maintenance" value={p.maintenanceCharges} />
                  ) : null}
                  {p.negotiable ? (
                    <p className="text-xs text-text-muted">Negotiable</p>
                  ) : null}
                </dl>
              ) : (
                <Locked label="You do not have access to pricing" />
              )}
            </Card.Body>
          </Card>

          <Card>
            <Card.Header>
              <Card.Title>Location</Card.Title>
            </Card.Header>
            <Card.Body className="flex flex-col gap-2">
              <p className="text-base text-text-secondary">
                {p.address}
                <br />
                {[p.locality, p.city, p.state].filter(Boolean).join(', ')} {p.pincode}
              </p>
              {/* Prefer the admin's pasted share link; fall back to one derived
                  from lat/lng. The stored link is the future map-preview seam. */}
              {p.googleMapUrl ?? maps ? (
                <a
                  href={p.googleMapUrl ?? maps ?? undefined}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-text-brand hover:underline"
                >
                  <MapPin className="size-3.5" aria-hidden="true" />
                  Open in Google Maps
                  <ExternalLink className="size-3" aria-hidden="true" />
                </a>
              ) : null}
            </Card.Body>
          </Card>

          <Card>
            <Card.Header>
              <Card.Title>Details</Card.Title>
            </Card.Header>
            <Card.Body>
              <dl className="flex flex-col gap-3">
                <div>
                  <dt className="flex items-center gap-1 text-xs text-text-muted">
                    Assigned agent
                    <Can permission="property.assignAgent">
                      <InfoHint content="The agent responsible for this property. Reassigning also changes who can see it." />
                    </Can>
                  </dt>
                  <dd className="mt-1">
                    {/* Editable for anyone with property.assignAgent; a plain
                        read-out for everyone else. Reassigning changes who can
                        see the property, so it is gated, not just a field edit. */}
                    <Can
                      permission="property.assignAgent"
                      fallback={
                        <span className="text-base text-text-primary">
                          {p.assignedAgent?.fullName ?? 'Unassigned'}
                        </span>
                      }
                    >
                      <AssignAgentControl
                        propertyId={p.id}
                        currentAgentId={p.assignedAgent?.id ?? null}
                      />
                    </Can>
                  </dd>
                </div>
                <Fact label="Shared with" value={`${p.assignedClientCount} client(s)`} />
                <Fact label="Visibility" value={title(p.visibility)} />
                <Fact label="Listed" value={formatDate(p.createdAt)} />
                {p.archivedAt ? <Fact label="Archived" value={formatDate(p.archivedAt)} /> : null}
              </dl>
            </Card.Body>
          </Card>
        </div>
      </div>
    </>
  )
}

function AssignAgentControl({
  propertyId,
  currentAgentId,
}: {
  propertyId: string
  currentAgentId: string | null
}) {
  const { data: agents } = useAssignableAgents()
  const assign = useAssignPropertyAgent(propertyId)

  return (
    <Select
      aria-label="Assign agent"
      placeholder="Unassigned"
      value={currentAgentId ?? ''}
      disabled={assign.isPending}
      options={(agents ?? []).map((a) => ({ value: a.id, label: a.fullName }))}
      // Empty value clears the assignment (agentId: null).
      onChange={(e) => assign.mutate(e.target.value || null)}
    />
  )
}

const title = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ')

function Fact({ label, value, numeric }: { label: string; value: string; numeric?: boolean }) {
  return (
    <div>
      <dt className="text-2xs tracking-wide text-text-muted uppercase">{label}</dt>
      <dd className={`mt-0.5 text-base text-text-primary ${numeric ? 'tabular-nums' : ''}`}>
        {value}
      </dd>
    </div>
  )
}

function Money({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-xs text-text-secondary">{label}</dt>
      <dd
        className={`font-medium text-text-primary tabular-nums ${big ? 'text-md' : 'text-base'}`}
      >
        {formatMoney(value)}
      </dd>
    </div>
  )
}
