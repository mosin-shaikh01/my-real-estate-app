import type { OwnerDTO, OwnerListItem } from '@app/shared'

// The shape the owner service selects (OWNER_SELECT). Money-free, so no Decimal
// serialisation needed — just Date → ISO string and _count flattening.
interface OwnerRow {
  id: string
  code: string
  fullName: string
  mobile: string
  altMobile: string | null
  email: string | null
  address: string | null
  city: string | null
  pan: string | null
  aadhaar: string | null
  notes: string | null
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
  _count: { properties: number }
}

export function toOwnerDTO(row: OwnerRow): OwnerDTO {
  return {
    id: row.id,
    code: row.code,
    fullName: row.fullName,
    mobile: row.mobile,
    altMobile: row.altMobile,
    email: row.email,
    address: row.address,
    city: row.city,
    pan: row.pan,
    aadhaar: row.aadhaar,
    notes: row.notes,
    propertyCount: row._count.properties,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export function toOwnerListItem(row: OwnerRow): OwnerListItem {
  return {
    id: row.id,
    code: row.code,
    fullName: row.fullName,
    mobile: row.mobile,
    city: row.city,
    propertyCount: row._count.properties,
    createdAt: row.createdAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
  }
}
