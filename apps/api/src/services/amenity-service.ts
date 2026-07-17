import { prisma } from '../lib/prisma.js'

// Reference data — the fixed catalog seeded in prisma/seed.ts. Read-only in v1:
// properties reference these by id, they aren't created ad hoc (that is what
// keeps "Swimming Pool"/"swimming pool" from fragmenting the match filter).

export async function listAmenities() {
  return prisma.amenity.findMany({
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true, slug: true, category: true },
  })
}
