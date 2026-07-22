// ============================================================================
// Formatters
// ============================================================================
// Money arrives from the API as a STRING and stays one until it is rendered.
//
// This is not pedantry. Prisma Decimal does not JSON-serialize, and a JS number
// cannot hold ₹99,99,99,999.99 without precision loss. Every function here takes
// `string` deliberately — if you find yourself reaching for parseFloat to call
// one of these, the bug is upstream.
// ============================================================================

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

const inrPrecise = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
})

/** "72500000.00" -> "₹7,25,00,000" (Indian lakh/crore grouping). */
export function formatMoney(value: string | null | undefined): string {
  if (value == null || value === '') return '—'
  const n = Number(value)
  return Number.isNaN(n) ? '—' : inr.format(n)
}

/** Use where paise matter (deals, invoices). */
export function formatMoneyPrecise(value: string | null | undefined): string {
  if (value == null || value === '') return '—'
  const n = Number(value)
  return Number.isNaN(n) ? '—' : inrPrecise.format(n)
}

/**
 * "72500000.00" -> "₹7.25 Cr". For dense table cells where the full number is
 * noise. Indian convention: crore above 1e7, lakh above 1e5.
 */
export function formatMoneyShort(value: string | null | undefined): string {
  if (value == null || value === '') return '—'
  const n = Number(value)
  if (Number.isNaN(n)) return '—'
  if (n >= 1e7) return `₹${trimZeros(n / 1e7)} Cr`
  if (n >= 1e5) return `₹${trimZeros(n / 1e5)} L`
  return inr.format(n)
}

function trimZeros(n: number): string {
  return n.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1')
}

/** "1850.00" -> "1,850 sq ft" */
export function formatArea(value: string | null | undefined): string {
  if (value == null || value === '') return '—'
  const n = Number(value)
  if (Number.isNaN(n)) return '—'
  return `${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n)} sq ft`
}

const dateFmt = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

/** DD MMM YYYY. */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const d = typeof value === 'string' ? new Date(value) : value
  return Number.isNaN(d.getTime()) ? '—' : dateFmt.format(d)
}

const timeFmt = new Intl.DateTimeFormat('en-IN', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
})

/**
 * Exact date AND time for activity/audit rows: "Today • 10:42 AM",
 * "Yesterday • 6:15 PM", else "18 Jul 2026 • 10:42 AM". Reuses formatDate for the
 * absolute day, so the date format stays consistent with the rest of the app.
 */
export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return '—'

  // Calendar-day difference (not a 24h window), so 11pm → 1am reads "Yesterday".
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const startOfThatDay = new Date(d)
  startOfThatDay.setHours(0, 0, 0, 0)
  const dayDiff = Math.round((startOfThatDay.getTime() - startOfToday.getTime()) / 86_400_000)

  const day =
    dayDiff === 0
      ? 'Today'
      : dayDiff === -1
        ? 'Yesterday'
        : dayDiff === 1
          ? 'Tomorrow'
          : formatDate(d)
  // en-IN renders a lowercase meridiem ("pm"); uppercase it to read "10:42 PM".
  const time = timeFmt.format(d).replace(/\b(am|pm)\b/i, (m) => m.toUpperCase())
  return `${day} • ${time}`
}

/** "3 days ago" / "in 2 days". Falls back to an absolute date past ~a month. */
export function formatRelative(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return '—'

  const diffMs = d.getTime() - Date.now()
  const diffDays = Math.round(diffMs / 86_400_000)

  if (Math.abs(diffDays) > 30) return formatDate(d)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Tomorrow'
  if (diffDays === -1) return 'Yesterday'

  const rtf = new Intl.RelativeTimeFormat('en-IN', { numeric: 'auto' })
  return rtf.format(diffDays, 'day')
}

/** builtYear -> "6 years old". Derived, never stored — age is wrong next year. */
export function formatPropertyAge(builtYear: number | null | undefined): string {
  if (!builtYear) return '—'
  const age = new Date().getFullYear() - builtYear
  if (age <= 0) return 'New'
  return age === 1 ? '1 year old' : `${age} years old`
}

/** Derived from lat/lng. We deliberately store no googleMap column. */
export function mapsUrl(lat: string | null, lng: string | null): string | null {
  if (!lat || !lng) return null
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
}
