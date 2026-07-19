import type { Actor } from '../auth/permissions.js'

// Same shape as the client serializer, deliberately. A boundary serializer per
// resource, all pure, all testable without a database. The repetition is the
// point: one generic engine would trade static DTO types for capability nobody
// asked for.

type Decimalish = { toFixed: (d: number) => string } | null
const money = (d: Decimalish): string | null => (d == null ? null : d.toFixed(2))

export interface PropertyRow {
  id: string
  code: string
  title: string
  description: string
  propertyType: string
  listingType: string
  status: string
  constructionStatus: string
  visibility: string
  featured: boolean
  salePrice: Decimalish
  rentPricePerMonth: Decimalish
  securityDeposit: Decimalish
  maintenanceCharges: Decimalish
  negotiable: boolean
  areaSqft: Decimalish
  bedrooms: number | null
  bathrooms: number | null
  parking: number
  furnished: string
  facing: string | null
  floor: number | null
  totalFloor: number | null
  builtYear: number | null
  address: string
  locality: string | null
  city: string
  state: string
  country: string
  pincode: string
  latitude: Decimalish
  longitude: Decimalish
  googleMapUrl: string | null
  videoUrls: string[]
  internalNotes: string | null
  surveyNumber: string | null
  propertyNumber: string | null
  ownerId: string | null
  condition: string | null
  sellerType: string | null
  landmark: string | null
  pricePerSqft: Decimalish
  governmentValue: Decimalish
  plotArea: Decimalish
  builtUpArea: Decimalish
  carpetArea: Decimalish
  areaUnit: string | null
  assignedAgentId: string | null
  createdAt: Date
  updatedAt: Date
  archivedAt: Date | null
  assignedAgent?: { id: string; fullName: string } | null
  owner?: { id: string; code: string; fullName: string; mobile: string } | null
  amenities?: Array<{ amenity: { id: string; name: string; slug: string; category: string | null } }>
  media?: Array<{
    id: string
    type: string
    documentType: string | null
    originalName: string
    mimeType: string
    sizeBytes: number
    storageKey: string
    isCover: boolean
    sortOrder: number
    createdAt: Date
  }>
  _count?: { assignments: number }
}

export interface PropertyDTO {
  id: string
  code: string
  title: string
  description: string
  propertyType: string
  listingType: string
  status: string
  constructionStatus: string
  visibility: string
  featured: boolean
  negotiable: boolean
  areaSqft: string | null
  bedrooms: number | null
  bathrooms: number | null
  parking: number
  furnished: string
  facing: string | null
  floor: number | null
  totalFloor: number | null
  builtYear: number | null
  address: string
  locality: string | null
  city: string
  state: string
  country: string
  pincode: string
  latitude: string | null
  longitude: string | null
  googleMapUrl: string | null
  videoUrls: string[]
  surveyNumber: string | null
  propertyNumber: string | null
  ownerId: string | null
  owner: { id: string; code: string; fullName: string; mobile: string } | null
  condition: string | null
  sellerType: string | null
  landmark: string | null
  pricePerSqft: string | null
  governmentValue: string | null
  plotArea: string | null
  builtUpArea: string | null
  carpetArea: string | null
  areaUnit: string | null
  createdAt: string
  archivedAt: string | null
  assignedAgent: { id: string; fullName: string } | null
  amenities: Array<{ id: string; name: string; slug: string; category: string | null }>
  coverMediaId: string | null
  // storageKey is deliberately NOT exposed — the client references media by id
  // and fetches bytes through the authorized /api/media/:id route, never by a
  // path it could construct itself.
  media: Array<{ id: string; type: string; isCover: boolean }>
  documents: Array<{
    id: string
    documentType: string | null
    originalName: string
    mimeType: string
    sizeBytes: number
    createdAt: string
  }>
  assignedClientCount: number

  // Absent = redacted. Null = empty. The UI must tell them apart.
  salePrice?: string | null
  rentPricePerMonth?: string | null
  securityDeposit?: string | null
  maintenanceCharges?: string | null
  internalNotes?: string | null

  _redacted: string[]
}

export function toPropertyDTO(row: PropertyRow, actor: Actor): PropertyDTO {
  const redacted: string[] = []

  const dto: PropertyDTO = {
    id: row.id,
    code: row.code,
    title: row.title,
    description: row.description,
    propertyType: row.propertyType,
    listingType: row.listingType,
    status: row.status,
    constructionStatus: row.constructionStatus,
    visibility: row.visibility,
    featured: row.featured,
    negotiable: row.negotiable,
    areaSqft: money(row.areaSqft),
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    parking: row.parking,
    furnished: row.furnished,
    facing: row.facing,
    floor: row.floor,
    totalFloor: row.totalFloor,
    builtYear: row.builtYear,
    address: row.address,
    locality: row.locality,
    city: row.city,
    state: row.state,
    country: row.country,
    pincode: row.pincode,
    // We store no googleMap column — two sources of truth would disagree. The
    // UI derives the maps URL from these.
    latitude: money(row.latitude),
    longitude: money(row.longitude),
    googleMapUrl: row.googleMapUrl,
    videoUrls: row.videoUrls ?? [],
    surveyNumber: row.surveyNumber,
    propertyNumber: row.propertyNumber,
    ownerId: row.ownerId,
    owner: row.owner ?? null,
    condition: row.condition,
    sellerType: row.sellerType,
    landmark: row.landmark,
    pricePerSqft: money(row.pricePerSqft),
    governmentValue: money(row.governmentValue),
    plotArea: money(row.plotArea),
    builtUpArea: money(row.builtUpArea),
    carpetArea: money(row.carpetArea),
    areaUnit: row.areaUnit,
    createdAt: row.createdAt.toISOString(),
    archivedAt: row.archivedAt?.toISOString() ?? null,
    assignedAgent: row.assignedAgent ?? null,
    amenities: row.amenities?.map((a) => a.amenity) ?? [],
    coverMediaId: row.media?.find((m) => m.isCover)?.id ?? row.media?.[0]?.id ?? null,
    media: row.media?.map((m) => ({ id: m.id, type: m.type, isCover: m.isCover })) ?? [],
    // Documents are a separate, richer list (name/type/size for the file manager).
    documents:
      row.media
        ?.filter((m) => m.type === 'DOCUMENT')
        .map((m) => ({
          id: m.id,
          documentType: m.documentType,
          originalName: m.originalName,
          mimeType: m.mimeType,
          sizeBytes: m.sizeBytes,
          createdAt: m.createdAt.toISOString(),
        })) ?? [],
    assignedClientCount: row._count?.assignments ?? 0,
    _redacted: redacted,
  }

  if (actor.has('property.price.view')) {
    dto.salePrice = money(row.salePrice)
    dto.rentPricePerMonth = money(row.rentPricePerMonth)
    dto.securityDeposit = money(row.securityDeposit)
    dto.maintenanceCharges = money(row.maintenanceCharges)
  } else {
    redacted.push('salePrice', 'rentPricePerMonth', 'securityDeposit', 'maintenanceCharges')
  }

  if (actor.has('property.internalNotes.view')) {
    dto.internalNotes = row.internalNotes
  } else {
    redacted.push('internalNotes')
  }

  return dto
}

// ---------------------------------------------------------------------------
// Permission-filtered allowlists
// ---------------------------------------------------------------------------
// Agents DO hold property.price.view, so price sorting is not a leak for them
// today. It is still gated, for two reasons: an admin can revoke that
// permission per-agent tomorrow, and the seeded `public` role will eventually
// hit these same endpoints. A gate that only exists once someone needs it is a
// gate that gets forgotten.

const ALWAYS_SORTABLE = ['createdAt', 'title', 'code', 'areaSqft', 'builtYear'] as const
const PRICE_SORTABLE = ['salePrice', 'rentPricePerMonth'] as const

export function sortablePropertyFields(actor: Actor): string[] {
  const fields: string[] = [...ALWAYS_SORTABLE]
  if (actor.has('property.price.view')) fields.push(...PRICE_SORTABLE)
  return fields
}

export function canFilterByPrice(actor: Actor): boolean {
  return actor.has('property.price.view')
}
