import { z } from 'zod'
import {
  areaUnitSchema,
  constructionStatusSchema,
  facingSchema,
  furnishedStatusSchema,
  listingTypeSchema,
  propertyConditionSchema,
  propertyStatusSchema,
  propertyTypeSchema,
  sellerTypeSchema,
  visibilitySchema,
} from '../enums.js'

// ---------------------------------------------------------------------------
// Money on the wire
// ---------------------------------------------------------------------------
// A STRING, always. Prisma Decimal does not JSON-serialize, and a JS number
// cannot hold ₹99,99,99,999.99. Validating the shape here means a bad value is
// a 400 rather than a silent precision bug three tables deep.
const moneyString = z
  .string()
  .regex(/^\d{1,12}(\.\d{1,2})?$/, 'Enter an amount like 7500000 or 7500000.00')

/**
 * Comma-separated multi-select, e.g. ?bedrooms=2,3
 *
 * Written out per-field rather than behind a generic helper: Zod 4's `.pipe()`
 * needs the transform's output type to line up with the target's input, and a
 * `<T extends ZodType>` wrapper loses exactly the information TS needs to check
 * that. Three explicit lines beat a clever one that doesn't compile.
 */
const splitCsv = (s: string) => s.split(',').map((v) => v.trim()).filter(Boolean)

export const propertyListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),

  q: z.string().trim().min(1).optional(),
  status: z.string().transform(splitCsv).pipe(z.array(propertyStatusSchema)).optional(),
  propertyType: z.string().transform(splitCsv).pipe(z.array(propertyTypeSchema)).optional(),
  listingType: listingTypeSchema.optional(),
  bedrooms: z
    .string()
    .transform((s) => splitCsv(s).map(Number))
    .pipe(z.array(z.number().int().min(0)))
    .optional(),
  city: z.string().trim().optional(),
  locality: z.string().trim().optional(),
  furnished: furnishedStatusSchema.optional(),
  constructionStatus: constructionStatusSchema.optional(),
  featured: z.enum(['true', 'false']).optional(),
  /** Excludes archived unless explicitly asked for. */
  includeArchived: z.enum(['true', 'false']).optional(),

  minPrice: moneyString.optional(),
  maxPrice: moneyString.optional(),
  minArea: z.coerce.number().optional(),
  maxArea: z.coerce.number().optional(),

  /** `-field` = descending. Validated against a PERMISSION-FILTERED allowlist. */
  sort: z.string().optional(),
})

export type PropertyListQuery = z.infer<typeof propertyListQuerySchema>

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------
// Shape/format/coercion only. The server adds a refinement layer for what needs
// the database — "assignedAgentId must reference an ACTIVE agent" cannot be
// expressed here, and pretending otherwise is how you get client-only checks.

/**
 * The base shape, WITHOUT cross-field refinements.
 *
 * Split out because PATCH needs a partial with no refinements: re-running
 * "sale price is required when listing is for sale" against an update that only
 * touches `title` would reject a perfectly valid edit. Zod 4 attaches checks to
 * the object itself (no ZodEffects wrapper to unwrap), so the base has to exist
 * separately rather than be recovered later.
 */
// CRITICAL: no `.default()` anywhere in this shape.
//
// `.partial()` KEEPS defaults, so a defaulted field would arrive on every PATCH
// even when the caller never sent it — a one-field edit would silently rewrite
// status, visibility, parking and furnished back to their defaults. That is
// data corruption, and it passes every unit test because the value is
// syntactically valid.
//
// These fields already have @default in prisma/schema.prisma, so on CREATE an
// omitted field is filled by the database. The Zod default was redundant there
// and poison here. Optional throughout; the DB owns create-time defaults.
const propertyBaseSchema = z.object({
    title: z.string().trim().min(5, 'Give the listing a descriptive title').max(200),
    description: z.string().trim().min(10, 'Add a description'),

    // Legal identifiers + owner (master) reference. All optional; the server
    // normalises "" to null. Duplicate detection on survey/property number is a
    // warning surfaced by the form, not a schema rule.
    surveyNumber: z.string().trim().max(64).nullish().or(z.literal('')),
    propertyNumber: z.string().trim().max(64).nullish().or(z.literal('')),
    ownerId: z.string().trim().nullish().or(z.literal('')),

    propertyType: propertyTypeSchema,
    listingType: listingTypeSchema,
    status: propertyStatusSchema.optional(),
    constructionStatus: constructionStatusSchema.optional(),
    condition: propertyConditionSchema.nullish(),
    sellerType: sellerTypeSchema.nullish(),
    visibility: visibilitySchema.optional(),
    featured: z.boolean().optional(),

    salePrice: moneyString.nullish(),
    rentPricePerMonth: moneyString.nullish(),
    securityDeposit: moneyString.nullish(),
    maintenanceCharges: moneyString.nullish(),
    pricePerSqft: moneyString.nullish(),
    governmentValue: moneyString.nullish(),
    negotiable: z.boolean().optional(),

    areaSqft: moneyString,
    plotArea: moneyString.nullish(),
    builtUpArea: moneyString.nullish(),
    carpetArea: moneyString.nullish(),
    areaUnit: areaUnitSchema.nullish(),
    bedrooms: z.number().int().min(0).nullish(),
    bathrooms: z.number().int().min(0).nullish(),
    parking: z.number().int().min(0).optional(),
    furnished: furnishedStatusSchema.optional(),
    facing: facingSchema.nullish(),
    floor: z.number().int().nullish(),
    totalFloor: z.number().int().min(0).nullish(),
    builtYear: z
      .number()
      .int()
      .min(1800)
      .max(new Date().getFullYear() + 10)
      .nullish(),

    address: z.string().trim().min(5, 'Add an address'),
    locality: z.string().trim().max(120).nullish(),
    landmark: z.string().trim().max(160).nullish(),
    city: z.string().trim().min(1, 'City is required').max(120),
    state: z.string().trim().min(1, 'State is required').max(120),
    country: z.string().trim().optional(),
    pincode: z.string().trim().regex(/^\d{6}$/, 'Enter a 6-digit pincode'),

    latitude: z.string().regex(/^-?\d{1,3}(\.\d{1,6})?$/).nullish(),
    longitude: z.string().regex(/^-?\d{1,3}(\.\d{1,6})?$/).nullish(),

    // A pasted Google Maps link. Accept the empty string (a cleared field) as
    // well as a valid URL, so blanking it in the edit form isn't a validation
    // error. The server normalises "" to null.
    googleMapUrl: z.string().url('Enter a valid Google Maps link').nullish().or(z.literal('')),

    // External video links (YouTube/Vimeo/direct). Each must be a valid URL;
    // the array is replaced wholesale on write, like amenityIds. Undefined on
    // update means "not sent" (leave as-is); [] means "remove them all".
    videoUrls: z.array(z.string().url('Enter a valid video URL')).max(20).optional(),
    internalNotes: z.string().nullish(),
    assignedAgentId: z.string().nullish(),
    // Optional, not defaulted: create treats undefined as [], update treats it
    // as "not sent" so it doesn't wipe existing amenities.
    amenityIds: z.array(z.string()).optional(),
  })

// A listing's price must match what it is listed FOR. This is cross-FIELD, not
// cross-table, so it belongs here where the form shows it inline rather than
// after a round trip. Anything needing the database (does this agent exist and
// is she active?) stays in the server's refinement layer.
export const propertyCreateSchema = propertyBaseSchema
  .refine((v) => (v.listingType === 'RENT' ? true : v.salePrice != null), {
    message: 'Sale price is required when the listing is for sale',
    path: ['salePrice'],
  })
  .refine((v) => (v.listingType === 'SALE' ? true : v.rentPricePerMonth != null), {
    message: 'Rent is required when the listing is for rent',
    path: ['rentPricePerMonth'],
  })

export type PropertyCreateInput = z.infer<typeof propertyCreateSchema>

/** PATCH: partial, un-refined. The base carries no defaults, so `.partial()`
 *  is safe — an omitted field is genuinely absent, never a silent default. */
export const propertyUpdateSchema = propertyBaseSchema.partial()
export type PropertyUpdateInput = z.infer<typeof propertyUpdateSchema>

export const propertyStatusUpdateSchema = z.object({
  status: propertyStatusSchema,
})
