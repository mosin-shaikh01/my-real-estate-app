import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useForm, type UseFormRegisterReturn } from 'react-hook-form'
import { useNavigate } from 'react-router'
import {
  constructionStatusSchema,
  facingSchema,
  furnishedStatusSchema,
  PROPERTY_STATUS_LABELS,
  PROPERTY_TYPE_LABELS,
  propertyCreateSchema,
  visibilitySchema,
  type PropertyCreateInput,
} from '@app/shared'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { FormField, Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { useAssignableAgents } from '@/features/agents/api/use-assignable-agents'
import { usePermissions } from '@/features/auth/api/use-auth'
import type { PropertyDTO } from '@/features/properties/api/use-properties'
import {
  useCreateProperty,
  useUpdateProperty,
} from '@/features/properties/api/use-property-mutations'
import { AmenityPicker } from '@/features/properties/components/AmenityPicker'
import { MediaStagePicker } from '@/features/properties/components/MediaStagePicker'
import { PropertyGallery } from '@/features/properties/components/PropertyGallery'
import { VideoLinkEditor } from '@/features/properties/components/VideoLinkEditor'
import { ApiClientError } from '@/lib/api'

// ============================================================================
// Shared Add / Edit property form
// ============================================================================
// RHF + the SHARED Zod schema, so the exact rules the server parses run here
// too (the cross-field price rule inline; server-only rules like "agent must be
// active" come back field-keyed and map onto RHF via setError). ONE form for
// create and edit keeps the two visually and behaviourally identical — edit is
// just create pre-populated from the property's DTO.
// ============================================================================

const humanize = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ')
const enumOptions = (values: readonly string[]) =>
  values.map((v) => ({ value: v, label: humanize(v) }))

const TYPE_OPTIONS = Object.entries(PROPERTY_TYPE_LABELS).map(([value, label]) => ({ value, label }))
const STATUS_OPTIONS = Object.entries(PROPERTY_STATUS_LABELS).map(([value, label]) => ({ value, label }))
const LISTING_OPTIONS = [
  { value: 'SALE', label: 'For sale' },
  { value: 'RENT', label: 'For rent' },
  { value: 'BOTH', label: 'Sale & rent' },
]
const FURNISHED_OPTIONS = enumOptions(furnishedStatusSchema.options)
const FACING_OPTIONS = enumOptions(facingSchema.options)
const CONSTRUCTION_OPTIONS = enumOptions(constructionStatusSchema.options)
const VISIBILITY_OPTIONS = enumOptions(visibilitySchema.options)

// Number inputs: empty string -> undefined (so an omitted field falls to the DB
// default on create and is left unchanged on edit), otherwise a real number.
// Avoids RHF's valueAsNumber turning an empty field into NaN, which the schema
// would reject.
const numberField = <K extends keyof PropertyCreateInput>(
  register: (name: K, opts: object) => UseFormRegisterReturn,
  name: K,
) => register(name, { setValueAs: (v: string) => (v === '' || v == null ? undefined : Number(v)) })

// Optional <select> fields whose empty option must serialize to null, not "".
// An enum schema (facing) rejects ""; assignedAgentId "" would fail the server's
// active-agent lookup. Mapping "" -> null makes "clear the field" mean "clear".
const nullableField = <K extends keyof PropertyCreateInput>(
  register: (name: K, opts: object) => UseFormRegisterReturn,
  name: K,
) => register(name, { setValueAs: (v: string) => (v === '' || v == null ? null : v) })

/** Build form values from an existing property (edit mode). */
function toFormValues(p: PropertyDTO): PropertyCreateInput {
  return {
    title: p.title,
    description: p.description,
    propertyType: p.propertyType as PropertyCreateInput['propertyType'],
    listingType: p.listingType as PropertyCreateInput['listingType'],
    status: p.status as PropertyCreateInput['status'],
    constructionStatus: p.constructionStatus as PropertyCreateInput['constructionStatus'],
    visibility: p.visibility as PropertyCreateInput['visibility'],
    featured: p.featured,
    negotiable: p.negotiable,
    salePrice: p.salePrice ?? undefined,
    rentPricePerMonth: p.rentPricePerMonth ?? undefined,
    securityDeposit: p.securityDeposit ?? undefined,
    maintenanceCharges: p.maintenanceCharges ?? undefined,
    areaSqft: p.areaSqft ?? '',
    bedrooms: p.bedrooms ?? undefined,
    bathrooms: p.bathrooms ?? undefined,
    parking: p.parking,
    furnished: p.furnished as PropertyCreateInput['furnished'],
    facing: (p.facing ?? undefined) as PropertyCreateInput['facing'],
    floor: p.floor ?? undefined,
    totalFloor: p.totalFloor ?? undefined,
    builtYear: p.builtYear ?? undefined,
    address: p.address,
    locality: p.locality ?? '',
    city: p.city,
    state: p.state,
    country: p.country,
    pincode: p.pincode,
    latitude: p.latitude ?? '',
    longitude: p.longitude ?? '',
    googleMapUrl: p.googleMapUrl ?? '',
    // videoUrls is managed in local state (see the VideoLinkEditor), not RHF —
    // same pattern as amenityIds. Deliberately omitted from RHF defaults.
    internalNotes: p.internalNotes ?? '',
    assignedAgentId: p.assignedAgent?.id ?? undefined,
    amenityIds: p.amenities.map((a) => a.id),
  }
}

interface Props {
  mode: 'create' | 'edit'
  /** Required in edit mode. */
  property?: PropertyDTO
}

export function PropertyForm({ mode, property }: Props) {
  const navigate = useNavigate()
  const { has } = usePermissions()
  const canAssignAgent = has('property.assignAgent')
  const canSeeNotes = has('property.internalNotes.view')

  const create = useCreateProperty()
  const update = useUpdateProperty(property?.id ?? '')
  const { data: agents } = useAssignableAgents(canAssignAgent)

  const [stagedMedia, setStagedMedia] = useState<File[]>([])
  const [amenityIds, setAmenityIds] = useState<string[]>(
    mode === 'edit' && property ? property.amenities.map((a) => a.id) : [],
  )
  const [videoUrls, setVideoUrls] = useState<string[]>(
    mode === 'edit' && property ? property.videoUrls : [],
  )

  const form = useForm<PropertyCreateInput>({
    resolver: zodResolver(propertyCreateSchema),
    defaultValues:
      mode === 'edit' && property
        ? toFormValues(property)
        : {
            title: '',
            description: '',
            propertyType: 'APARTMENT',
            listingType: 'SALE',
            city: '',
            state: 'Maharashtra',
            country: 'India',
            address: '',
            pincode: '',
            areaSqft: '',
          },
  })

  const errors = form.formState.errors
  const listingType = form.watch('listingType')
  const showSale = listingType === 'SALE' || listingType === 'BOTH'
  const showRent = listingType === 'RENT' || listingType === 'BOTH'

  const onSubmit = form.handleSubmit(async (values) => {
    const payload: PropertyCreateInput = {
      ...values,
      amenityIds,
      // Trim blank rows the editor may have left; the schema validates each URL.
      videoUrls: videoUrls.map((u) => u.trim()).filter(Boolean),
    }

    // Phase 1: create/update the property record. A failure here IS a form
    // error — map field-keyed server details onto RHF, otherwise show a banner.
    let propertyId: string
    try {
      if (mode === 'edit' && property) {
        await update.mutateAsync(payload)
        void navigate(`/properties/${property.id}`)
        return
      }
      const res = await create.mutateAsync(payload)
      propertyId = res.data.id
    } catch (err) {
      if (err instanceof ApiClientError && err.details) {
        for (const [path, messages] of Object.entries(err.details)) {
          form.setError(path as keyof PropertyCreateInput, { message: messages[0] })
        }
        return
      }
      form.setError('root', {
        message: err instanceof Error ? err.message : 'Could not save the property',
      })
      return
    }

    // Phase 2 (create only): upload staged media now that the property exists. A
    // failure here must NOT strand the created property behind a form error —
    // navigate to it regardless; media can be added from the edit screen.
    if (stagedMedia.length) {
      try {
        const body = new FormData()
        for (const file of stagedMedia) body.append('files', file)
        const res = await fetch(`/api/properties/${propertyId}/media`, {
          method: 'POST',
          credentials: 'include',
          body,
        })
        if (!res.ok) throw new Error('media upload failed')
      } catch {
        // Swallow — the property is saved. The detail page shows what uploaded.
      }
    }
    void navigate(`/properties/${propertyId}`)
  })

  const reg = form.register
  const submitting = form.formState.isSubmitting

  return (
    <form onSubmit={onSubmit} className="mx-auto flex max-w-3xl flex-col gap-6 p-6" noValidate>
      {/* ---- Overview ---- */}
      <Card>
        <Card.Header>
          <Card.Title>Overview</Card.Title>
        </Card.Header>
        <Card.Body className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <FormField label="Title" error={errors.title?.message} required>
              {(p) => <Input {...p} {...reg('title')} placeholder="3 BHK Sea-Facing Apartment in Bandra West" />}
            </FormField>
          </div>
          <div className="sm:col-span-2">
            <FormField label="Description" error={errors.description?.message} required>
              {(p) => (
                <textarea
                  {...p}
                  {...reg('description')}
                  rows={3}
                  className="w-full rounded-md border border-border-default bg-surface px-3 py-2 text-base placeholder:text-text-muted hover:border-border-strong focus-visible:border-brand-500 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-brand-500"
                />
              )}
            </FormField>
          </div>
          <FormField label="Property type" error={errors.propertyType?.message} required>
            {(p) => <Select {...p} options={TYPE_OPTIONS} {...reg('propertyType')} value={form.watch('propertyType')} />}
          </FormField>
          <FormField label="Status" error={errors.status?.message}>
            {(p) => <Select {...p} options={STATUS_OPTIONS} {...reg('status')} value={form.watch('status') ?? 'AVAILABLE'} />}
          </FormField>
          <FormField label="Listing" error={errors.listingType?.message} required>
            {(p) => <Select {...p} options={LISTING_OPTIONS} {...reg('listingType')} value={listingType} />}
          </FormField>
          <FormField label="Area (sq ft)" error={errors.areaSqft?.message} required>
            {(p) => <Input {...p} {...reg('areaSqft')} inputMode="numeric" placeholder="1200" />}
          </FormField>
          <FormField label="Bedrooms" error={errors.bedrooms?.message}>
            {(p) => <Input {...p} type="number" min={0} {...numberField(reg, 'bedrooms')} />}
          </FormField>
          <FormField label="Bathrooms" error={errors.bathrooms?.message}>
            {(p) => <Input {...p} type="number" min={0} {...numberField(reg, 'bathrooms')} />}
          </FormField>
          <FormField label="Parking spaces" error={errors.parking?.message}>
            {(p) => <Input {...p} type="number" min={0} {...numberField(reg, 'parking')} />}
          </FormField>
          <FormField label="Furnishing" error={errors.furnished?.message}>
            {(p) => <Select {...p} options={FURNISHED_OPTIONS} {...reg('furnished')} value={form.watch('furnished') ?? 'UNFURNISHED'} />}
          </FormField>
          <FormField label="Facing" error={errors.facing?.message}>
            {(p) => (
              <Select
                {...p}
                placeholder="—"
                options={FACING_OPTIONS}
                {...nullableField(reg, 'facing')}
                value={form.watch('facing') ?? ''}
              />
            )}
          </FormField>
          <FormField label="Floor" error={errors.floor?.message}>
            {(p) => <Input {...p} type="number" {...numberField(reg, 'floor')} />}
          </FormField>
          <FormField label="Total floors" error={errors.totalFloor?.message}>
            {(p) => <Input {...p} type="number" min={0} {...numberField(reg, 'totalFloor')} />}
          </FormField>
          <FormField label="Built year" error={errors.builtYear?.message}>
            {(p) => <Input {...p} type="number" {...numberField(reg, 'builtYear')} placeholder="2019" />}
          </FormField>
          <FormField label="Construction" error={errors.constructionStatus?.message}>
            {(p) => (
              <Select
                {...p}
                options={CONSTRUCTION_OPTIONS}
                {...reg('constructionStatus')}
                value={form.watch('constructionStatus') ?? 'READY_TO_MOVE'}
              />
            )}
          </FormField>
          <FormField label="Visibility" error={errors.visibility?.message}>
            {(p) => <Select {...p} options={VISIBILITY_OPTIONS} {...reg('visibility')} value={form.watch('visibility') ?? 'INTERNAL'} />}
          </FormField>
          <label className="flex items-center gap-2 text-sm text-text-secondary">
            <input type="checkbox" {...reg('featured')} className="size-4 accent-brand-600" />
            Featured listing
          </label>
        </Card.Body>
      </Card>

      {/* ---- Pricing ---- */}
      <Card>
        <Card.Header>
          <Card.Title>Pricing</Card.Title>
          <Card.Description>Amounts in rupees. A listing shows the prices it&rsquo;s listed for.</Card.Description>
        </Card.Header>
        <Card.Body className="grid gap-4 sm:grid-cols-2">
          {showSale ? (
            <FormField label="Sale price (₹)" error={errors.salePrice?.message}>
              {(p) => <Input {...p} {...reg('salePrice')} inputMode="numeric" placeholder="7500000" />}
            </FormField>
          ) : null}
          {showRent ? (
            <>
              <FormField label="Rent per month (₹)" error={errors.rentPricePerMonth?.message}>
                {(p) => <Input {...p} {...reg('rentPricePerMonth')} inputMode="numeric" placeholder="45000" />}
              </FormField>
              <FormField label="Security deposit (₹)" error={errors.securityDeposit?.message}>
                {(p) => <Input {...p} {...reg('securityDeposit')} inputMode="numeric" placeholder="270000" />}
              </FormField>
              <FormField label="Maintenance / month (₹)" error={errors.maintenanceCharges?.message}>
                {(p) => <Input {...p} {...reg('maintenanceCharges')} inputMode="numeric" placeholder="5000" />}
              </FormField>
            </>
          ) : null}
          <label className="flex items-center gap-2 text-sm text-text-secondary sm:col-span-2">
            <input type="checkbox" {...reg('negotiable')} className="size-4 accent-brand-600" />
            Price is negotiable
          </label>
        </Card.Body>
      </Card>

      {/* ---- Amenities ---- */}
      <Card>
        <Card.Header>
          <Card.Title>Amenities</Card.Title>
          <Card.Description>Add or remove amenities. Stored with the property.</Card.Description>
        </Card.Header>
        <Card.Body>
          <AmenityPicker value={amenityIds} onChange={setAmenityIds} />
        </Card.Body>
      </Card>

      {/* ---- Internal notes: gated by the same permission that reveals them ---- */}
      {canSeeNotes ? (
        <Card>
          <Card.Header>
            <Card.Title>Internal notes</Card.Title>
            <Card.Description>Private — visible only to admins and permitted users, never to agents.</Card.Description>
          </Card.Header>
          <Card.Body>
            <FormField label="Notes" error={errors.internalNotes?.message}>
              {(p) => (
                <textarea
                  {...p}
                  {...reg('internalNotes')}
                  rows={3}
                  placeholder="e.g. Owner motivated — will consider 6.9cr for a quick close."
                  className="w-full rounded-md border border-border-default bg-surface px-3 py-2 text-base placeholder:text-text-muted hover:border-border-strong focus-visible:border-brand-500 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-brand-500"
                />
              )}
            </FormField>
          </Card.Body>
        </Card>
      ) : null}

      {/* ---- Location ---- */}
      <Card>
        <Card.Header>
          <Card.Title>Location</Card.Title>
        </Card.Header>
        <Card.Body className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <FormField label="Address" error={errors.address?.message} required>
              {(p) => <Input {...p} {...reg('address')} />}
            </FormField>
          </div>
          <FormField label="Locality" error={errors.locality?.message}>
            {(p) => <Input {...p} {...reg('locality')} placeholder="Bandra West" />}
          </FormField>
          <FormField label="City" error={errors.city?.message} required>
            {(p) => <Input {...p} {...reg('city')} placeholder="Mumbai" />}
          </FormField>
          <FormField label="State" error={errors.state?.message} required>
            {(p) => <Input {...p} {...reg('state')} />}
          </FormField>
          <FormField label="Country" error={errors.country?.message}>
            {(p) => <Input {...p} {...reg('country')} placeholder="India" />}
          </FormField>
          <FormField label="ZIP / Pincode" error={errors.pincode?.message} required>
            {(p) => <Input {...p} {...reg('pincode')} inputMode="numeric" placeholder="400050" />}
          </FormField>
          <FormField label="Latitude" error={errors.latitude?.message}>
            {(p) => <Input {...p} {...reg('latitude')} placeholder="19.055000" />}
          </FormField>
          <FormField label="Longitude" error={errors.longitude?.message}>
            {(p) => <Input {...p} {...reg('longitude')} placeholder="72.826500" />}
          </FormField>
          <div className="sm:col-span-2">
            <FormField
              label="Google Maps link"
              error={errors.googleMapUrl?.message}
              hint="Paste a maps.google.com share link — stored for map previews."
            >
              {(p) => <Input {...p} {...reg('googleMapUrl')} inputMode="url" placeholder="https://maps.google.com/..." />}
            </FormField>
          </div>
          {canAssignAgent ? (
            <div className="sm:col-span-2">
              <FormField label="Assigned agent" error={errors.assignedAgentId?.message}>
                {(p) => (
                  <Select
                    {...p}
                    placeholder="Unassigned"
                    options={(agents ?? []).map((a) => ({ value: a.id, label: a.fullName }))}
                    {...nullableField(reg, 'assignedAgentId')}
                    value={form.watch('assignedAgentId') ?? ''}
                  />
                )}
              </FormField>
            </div>
          ) : null}
        </Card.Body>
      </Card>

      {/* ---- Media: staged on create; the live gallery (its own card, with
             immediate upload/delete) on edit. videoLinks={[]} in edit — external
             links are managed by the Video links card below, not the gallery. ---- */}
      {mode === 'edit' && property ? (
        <PropertyGallery
          propertyId={property.id}
          media={property.media}
          canDownload={has('property.media.download')}
        />
      ) : (
        <Card>
          <Card.Header>
            <Card.Title>Media</Card.Title>
            <Card.Description>Upload images and video files for this property.</Card.Description>
          </Card.Header>
          <Card.Body>
            <MediaStagePicker files={stagedMedia} onChange={setStagedMedia} />
          </Card.Body>
        </Card>
      )}

      {/* ---- External video links (YouTube/Vimeo/direct) ---- */}
      <Card>
        <Card.Header>
          <Card.Title>Video links</Card.Title>
          <Card.Description>
            Add YouTube, Vimeo or direct video URLs. Uploaded video files go in the Media section.
          </Card.Description>
        </Card.Header>
        <Card.Body>
          <VideoLinkEditor value={videoUrls} onChange={setVideoUrls} />
        </Card.Body>
      </Card>

      {errors.root ? (
        <p role="alert" className="rounded-md border border-border-danger-soft bg-surface-danger-soft/40 px-3 py-2 text-xs text-text-danger">
          {errors.root.message}
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-2">
        <Button
          variant="secondary"
          onClick={() => void navigate(mode === 'edit' && property ? `/properties/${property.id}` : '/properties')}
        >
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={submitting}>
          {submitting ? (
            <>
              <Loader2 className="animate-spin" aria-hidden="true" />
              {mode === 'edit' ? 'Saving…' : 'Creating…'}
            </>
          ) : mode === 'edit' ? (
            'Save changes'
          ) : (
            'Create property'
          )}
        </Button>
      </div>
    </form>
  )
}
