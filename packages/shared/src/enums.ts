import { z } from 'zod'

// ============================================================================
// ENUMS — hand-written, mirrored from prisma/schema.prisma
// ============================================================================
// Why hand-written rather than imported from @prisma/client: this package is
// consumed by the browser bundle, and importing Prisma would drag its runtime
// into the client. The cost of that isolation is drift risk, which is bought
// off by a parity test (apps/api/test/enum-parity.test.ts) asserting these are
// deep-equal to the generated Prisma enums. That test is cheap and it is the
// only thing standing between you and a silent enum drift.
//
// Note: TS `enum` is banned repo-wide (tsconfig sets erasableSyntaxOnly).
// Zod enums are better here anyway — one declaration gives a runtime validator
// AND a static union.
// ============================================================================

export const userStatusSchema = z.enum(['ACTIVE', 'SUSPENDED'])
export type UserStatus = z.infer<typeof userStatusSchema>

export const permissionEffectSchema = z.enum(['ALLOW', 'DENY'])
export type PermissionEffect = z.infer<typeof permissionEffectSchema>

export const propertyTypeSchema = z.enum([
  'APARTMENT',
  'VILLA',
  'INDEPENDENT_HOUSE',
  'PLOT',
  'COMMERCIAL_OFFICE',
  'COMMERCIAL_SHOP',
  'WAREHOUSE',
  'FARMHOUSE',
])
export type PropertyType = z.infer<typeof propertyTypeSchema>

export const listingTypeSchema = z.enum(['SALE', 'RENT', 'BOTH'])
export type ListingType = z.infer<typeof listingTypeSchema>

export const propertyStatusSchema = z.enum([
  'AVAILABLE',
  'RESERVED',
  'UNDER_OFFER',
  'ON_HOLD',
  'SOLD',
  'RENTED',
  'CANCELLED',
])
export type PropertyStatus = z.infer<typeof propertyStatusSchema>

export const propertyConditionSchema = z.enum(['NEW', 'RESALE'])
export type PropertyCondition = z.infer<typeof propertyConditionSchema>

export const sellerTypeSchema = z.enum(['OWNER', 'FARMER', 'BUILDER', 'BROKER', 'OTHER'])
export type SellerType = z.infer<typeof sellerTypeSchema>

export const areaUnitSchema = z.enum(['SQFT', 'SQM', 'SQYD', 'ACRE', 'GUNTHA', 'HECTARE'])
export type AreaUnit = z.infer<typeof areaUnitSchema>

export const visibilitySchema = z.enum(['PUBLIC', 'INTERNAL', 'PRIVATE'])
export type Visibility = z.infer<typeof visibilitySchema>

export const furnishedStatusSchema = z.enum(['UNFURNISHED', 'SEMI_FURNISHED', 'FULLY_FURNISHED'])
export type FurnishedStatus = z.infer<typeof furnishedStatusSchema>

export const facingSchema = z.enum([
  'NORTH',
  'SOUTH',
  'EAST',
  'WEST',
  'NORTH_EAST',
  'NORTH_WEST',
  'SOUTH_EAST',
  'SOUTH_WEST',
])
export type Facing = z.infer<typeof facingSchema>

export const constructionStatusSchema = z.enum(['READY_TO_MOVE', 'UNDER_CONSTRUCTION'])
export type ConstructionStatus = z.infer<typeof constructionStatusSchema>

export const mediaTypeSchema = z.enum(['IMAGE', 'VIDEO', 'DOCUMENT', 'FLOOR_PLAN'])
export type MediaType = z.infer<typeof mediaTypeSchema>

export const documentTypeSchema = z.enum([
  'SALE_DEED',
  'EXTRACT_7_12',
  'NA_ORDER',
  'LAYOUT_PLAN',
  'TITLE_DOCUMENT',
  'TAX_RECEIPT',
  'OTHER',
])
export type DocumentType = z.infer<typeof documentTypeSchema>

export const clientPrioritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH'])
export type ClientPriority = z.infer<typeof clientPrioritySchema>

export const followUpStatusSchema = z.enum([
  'NEW',
  'CONTACTED',
  'INTERESTED',
  'NEGOTIATING',
  'CONVERTED',
  'LOST',
  'ON_HOLD',
])
export type FollowUpStatus = z.infer<typeof followUpStatusSchema>

export const interactionTypeSchema = z.enum([
  'NOTE',
  'CALL',
  'MEETING',
  'WHATSAPP',
  'EMAIL',
  'SITE_VISIT',
])
export type InteractionType = z.infer<typeof interactionTypeSchema>

export const assignmentStatusSchema = z.enum([
  'SHORTLISTED',
  'SHARED',
  'VISITED',
  'INTERESTED',
  'REJECTED',
])
export type AssignmentStatus = z.infer<typeof assignmentStatusSchema>

export const dealTypeSchema = z.enum(['SALE', 'RENT'])
export type DealType = z.infer<typeof dealTypeSchema>

// ============================================================================
// DISPLAY LABELS
// ============================================================================
// Enum values are SCREAMING_SNAKE; humans are not. Centralised so a label is
// never re-invented per screen.

export const PROPERTY_STATUS_LABELS: Record<PropertyStatus, string> = {
  AVAILABLE: 'Available',
  RESERVED: 'Reserved',
  UNDER_OFFER: 'Under offer',
  ON_HOLD: 'On hold',
  SOLD: 'Sold',
  RENTED: 'Rented',
  CANCELLED: 'Cancelled',
}

export const PROPERTY_CONDITION_LABELS: Record<PropertyCondition, string> = {
  NEW: 'New',
  RESALE: 'Resale',
}

export const SELLER_TYPE_LABELS: Record<SellerType, string> = {
  OWNER: 'Owner',
  FARMER: 'Farmer',
  BUILDER: 'Builder',
  BROKER: 'Broker',
  OTHER: 'Other',
}

export const AREA_UNIT_LABELS: Record<AreaUnit, string> = {
  SQFT: 'Sq ft',
  SQM: 'Sq m',
  SQYD: 'Sq yd',
  ACRE: 'Acre',
  GUNTHA: 'Guntha',
  HECTARE: 'Hectare',
}

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  SALE_DEED: 'Sale Deed',
  EXTRACT_7_12: '7/12 Extract',
  NA_ORDER: 'NA Order',
  LAYOUT_PLAN: 'Layout Plan',
  TITLE_DOCUMENT: 'Title Document',
  TAX_RECEIPT: 'Tax Receipt',
  OTHER: 'Other Document',
}

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  APARTMENT: 'Apartment',
  VILLA: 'Villa',
  INDEPENDENT_HOUSE: 'Independent house',
  PLOT: 'Plot',
  COMMERCIAL_OFFICE: 'Office',
  COMMERCIAL_SHOP: 'Shop',
  WAREHOUSE: 'Warehouse',
  FARMHOUSE: 'Farmhouse',
}

export const FOLLOW_UP_STATUS_LABELS: Record<FollowUpStatus, string> = {
  NEW: 'New',
  CONTACTED: 'Contacted',
  INTERESTED: 'Interested',
  NEGOTIATING: 'Negotiating',
  CONVERTED: 'Converted',
  LOST: 'Lost',
  ON_HOLD: 'On hold',
}

export const ASSIGNMENT_STATUS_LABELS: Record<AssignmentStatus, string> = {
  SHORTLISTED: 'Shortlisted',
  SHARED: 'Shared',
  VISITED: 'Visited',
  INTERESTED: 'Interested',
  REJECTED: 'Rejected',
}
