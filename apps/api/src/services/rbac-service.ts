import { prisma } from '../lib/prisma.js'

// Read-only for v1. The permission MATRIX (roles × ~43 permissions) is a genuinely
// fiddly editing surface; the schema and resolver support per-role and per-user
// grants already, so making it editable later is UI work, not a rewrite. See
// docs/REQUIREMENTS.md.

export async function listRolesWithPermissions() {
  const roles = await prisma.role.findMany({
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      isSystem: true,
      permissions: { select: { permission: { select: { key: true } } } },
      _count: { select: { users: true } },
    },
  })

  return roles.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    description: r.description,
    isSystem: r.isSystem,
    userCount: r._count.users,
    permissionKeys: r.permissions.map((p) => p.permission.key),
  }))
}

export async function listPermissionCatalog() {
  const permissions = await prisma.permission.findMany({
    orderBy: [{ resource: 'asc' }, { action: 'asc' }],
    select: { key: true, resource: true, action: true, field: true, description: true },
  })

  // Group by resource so the matrix renders sections rather than a flat 43-row
  // wall — the structured columns earning their place over a bare string key.
  const byResource = new Map<string, typeof permissions>()
  for (const p of permissions) {
    const list = byResource.get(p.resource) ?? []
    list.push(p)
    byResource.set(p.resource, list)
  }

  return [...byResource.entries()].map(([resource, perms]) => ({ resource, permissions: perms }))
}
