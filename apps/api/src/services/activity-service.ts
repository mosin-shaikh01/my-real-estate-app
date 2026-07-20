import type { Request } from 'express'
import type { Prisma } from '../generated/prisma/client.js'
import { prisma } from '../lib/prisma.js'

// ============================================================================
// Activity log
// ============================================================================
// A PRODUCT feature, not application logging. Different audience, different
// retention. Request logs go to stdout; this is queryable history an admin
// reads. Don't conflate them.
//
// Polymorphic by necessity: entityType/entityId are strings with NO foreign
// key, so a log row outlives the thing it describes. That is the point — "who
// deleted this?" is unanswerable if the log row cascades away with it.
// ============================================================================

/**
 * Fields whose VALUES must never reach this table.
 *
 * THE PII TRAP: logging before/after values of a property or client copies
 * `internalNotes`, phone numbers and budgets into a second table that the
 * redaction serializer does not cover. An agent with activity.list would then
 * read, in the audit trail, exactly the negotiating position they were denied
 * on the record itself.
 *
 * So for these we log that the field CHANGED, never what it changed to.
 */
const SENSITIVE_FIELDS = new Set([
  'internalNotes',
  'notes',
  'salePrice',
  'rentPricePerMonth',
  'securityDeposit',
  'maintenanceCharges',
  'commissionRate',
  'commissionAmount',
  'budgetMin',
  'budgetMax',
  'phone',
  'whatsapp',
  'email',
  'pan',
  'aadhaar',
  'passwordHash',
])

// ============================================================================
// Human-readable field names for activity summaries
// ============================================================================
// The diff tracks raw column keys (rentPricePerMonth, areaSqft…). An activity
// feed is read by people, so a summary must say "rent, area", not the code
// identifier. Anything not overridden here falls back to a camelCase→words
// split, which reads fine for the plain names (city, address, bedrooms…).
// ============================================================================
const FIELD_LABELS: Record<string, string> = {
  assignedAgentId: 'assigned agent',
  internalNotes: 'internal notes',
  // property
  salePrice: 'sale price',
  rentPricePerMonth: 'rent',
  securityDeposit: 'security deposit',
  maintenanceCharges: 'maintenance',
  pricePerSqft: 'price per sq ft',
  governmentValue: 'government value',
  areaSqft: 'area',
  plotArea: 'plot area',
  builtUpArea: 'built-up area',
  carpetArea: 'carpet area',
  areaUnit: 'area unit',
  propertyType: 'type',
  listingType: 'listing',
  constructionStatus: 'construction status',
  builtYear: 'built year',
  totalFloor: 'total floors',
  googleMapUrl: 'map link',
  ownerId: 'owner',
  sellerType: 'seller type',
  surveyNumber: 'survey number',
  propertyNumber: 'property number',
  videoUrls: 'video links',
  // client
  fullName: 'name',
  buyerType: 'buyer type',
  importantLead: 'important lead',
  budgetMin: 'budget',
  budgetMax: 'budget',
}

// Derived / duplicate columns that mirror a real field — never surface them in a
// human summary (the real field is already listed).
const HIDDEN_SUMMARY_FIELDS = new Set(['phoneNormalized', 'mobileNormalized'])

function humanizeField(key: string): string {
  return (
    FIELD_LABELS[key] ??
    key
      .replace(/_/g, ' ')
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .toLowerCase()
  )
}

/** Turn a list of changed column keys into a human, de-duplicated field list. */
export function humanizeFields(keys: string[]): string {
  const labels: string[] = []
  const seen = new Set<string>()
  for (const key of keys) {
    if (HIDDEN_SUMMARY_FIELDS.has(key)) continue
    const label = humanizeField(key)
    if (seen.has(label)) continue // phone + phoneNormalized, budgetMin + budgetMax…
    seen.add(label)
    labels.push(label)
  }
  return labels.join(', ')
}

export interface LogParams {
  actorUserId: string | null
  action: string
  entityType: string
  entityId: string
  summary: string
  metadata?: Prisma.InputJsonValue
  req?: Request
}

function clientMeta(req?: Request) {
  return {
    ip: req?.ip?.slice(0, 64) ?? null,
    userAgent: req?.get('user-agent')?.slice(0, 512) ?? null,
  }
}

/**
 * Log inside the caller's transaction.
 *
 * Takes the tx client so the mutation and its log row commit together. A log
 * written after the fact is a log that lies the moment anything fails between
 * the two.
 */
export async function logActivityTx(
  tx: Prisma.TransactionClient,
  params: LogParams,
): Promise<void> {
  await tx.activityLog.create({
    data: {
      actorUserId: params.actorUserId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      summary: params.summary,
      metadata: params.metadata,
      ...clientMeta(params.req),
    },
  })
}

export async function logActivity(params: LogParams): Promise<void> {
  await logActivityTx(prisma, params)
}

/** JSON-safe by construction — this lands in a Prisma Json column. */
export interface FieldDiff {
  changed: string[]
  values: Record<string, { from: string | null; to: string | null }>
}

/**
 * Diff two records into a safe changed-field summary.
 *
 * Returns field NAMES for sensitive fields, and names WITH values for the rest,
 * so an admin can read "price changed" without the log quietly becoming a
 * second, unguarded copy of the price.
 *
 * Values are stringified rather than passed through: Prisma Decimal and Date
 * are not JSON-serializable, and a Json column will reject them at runtime —
 * long after this looked fine in a type check.
 */
export function diffForLog(before: Record<string, unknown>, after: Record<string, unknown>): FieldDiff {
  const changed: string[] = []
  const values: FieldDiff['values'] = {}

  for (const key of Object.keys(after)) {
    const from = normalizeForDiff(before[key])
    const to = normalizeForDiff(after[key])
    if (from === to) continue

    changed.push(key)
    if (!SENSITIVE_FIELDS.has(key)) values[key] = { from, to }
  }

  return { changed, values }
}

/** True when `after` differs from `before` on any of `after`'s keys. */
export function hasChanges(before: Record<string, unknown>, after: Record<string, unknown>): boolean {
  return diffForLog(before, after).changed.length > 0
}

/**
 * Canonical comparison form. This is the whole reason a no-op save used to log a
 * change: the DB holds a Decimal (`45000`) while the form submits the string
 * `"45000.00"`, and a naive `String()` made those look different. Normalising
 * kills the false positives across every value kind:
 *   - Decimal / number / numeric string → the same canonical number ("45000")
 *   - boolean → 'true' / 'false' (a checkbox posting "true"/"false"/on all fold)
 *   - Date → ISO
 *   - array (amenities, video links, multi-selects) → order-independent
 *   - string → trimmed, so a stray space is not a change
 */
export function normalizeForDiff(v: unknown): string | null {
  if (v === null || v === undefined) return null
  if (v instanceof Date) return v.toISOString()
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  if (Array.isArray(v)) return JSON.stringify(v.map((x) => normalizeForDiff(x) ?? '').sort())
  // Prisma Decimal (decimal.js) exposes toFixed — treat it as a number.
  if (typeof v === 'object' && typeof (v as { toFixed?: unknown }).toFixed === 'function') {
    return canonicalNumber(String(v))
  }
  return canonicalNumber(String(v).trim())
}

/** Collapse a purely-numeric string to its canonical number, so "45000.00" and
 *  "45000" compare equal. Ids, codes and mixed strings pass through untouched. */
function canonicalNumber(s: string): string {
  if (s !== '' && /^-?\d+(\.\d+)?$/.test(s)) {
    const n = Number(s)
    if (Number.isFinite(n)) return String(n)
  }
  return s
}

export function isSensitiveField(field: string): boolean {
  return SENSITIVE_FIELDS.has(field)
}

// ---------------------------------------------------------------------------
// Reading the log
// ---------------------------------------------------------------------------
// activity.list is admin-only (agents don't hold it), so a flat list is correct
// — an admin sees all activity. There is deliberately no per-row scoping: the
// gate is the permission. If activity.list were ever granted to a non-admin,
// this would need a scope pass, and that decision belongs with whoever grants
// it, not baked in silently here.

export interface ActivityQuery {
  page: number
  pageSize: number
  action?: string
  entityType?: string
  actorUserId?: string
}

export async function listActivity(query: ActivityQuery) {
  const where: Prisma.ActivityLogWhereInput = {}
  if (query.action) where.action = { startsWith: query.action }
  if (query.entityType) where.entityType = query.entityType
  if (query.actorUserId) where.actorUserId = query.actorUserId

  const [rows, total] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        summary: true,
        createdAt: true,
        actor: { select: { id: true, fullName: true } },
      },
    }),
    prisma.activityLog.count({ where }),
  ])

  return { rows, total }
}
