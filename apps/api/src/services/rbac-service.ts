import type { RoleCreateInput, RoleUpdateInput } from '@app/shared'
import type { Request } from 'express'
import { conflict, notFound } from '../lib/errors.js'
import { prisma } from '../lib/prisma.js'
import { logActivityTx } from './activity-service.js'

// The permission CATALOG is code (packages/shared); a ROLE is data — a name plus
// a set of catalog keys. Custom roles are fully editable here; SYSTEM roles
// (super_admin/agent/public) are immutable, so an admin can never edit or delete
// their way into locking everyone out. Permissions resolve per-request from the
// DB, so a role change takes effect on the affected users' very next request.

const orNull = (v: string | null | undefined) => (v == null || v === '' ? null : v)

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'role'
  )
}

/** A slug unique across roles — appends -2, -3… on collision. */
async function uniqueSlug(base: string): Promise<string> {
  let slug = base
  let n = 1
  while (await prisma.role.findUnique({ where: { slug }, select: { id: true } })) {
    n += 1
    slug = `${base}-${n}`.slice(0, 64)
  }
  return slug
}

/** Resolve catalog keys → permission ids. Zod already guaranteed each key is in
 *  the catalog, so a missing row would be a seed drift — surface it, don't skip. */
async function permissionIdsFor(keys: string[]): Promise<string[]> {
  if (!keys.length) return []
  const perms = await prisma.permission.findMany({ where: { key: { in: keys } }, select: { id: true } })
  return perms.map((p) => p.id)
}

export async function createRole(actorId: string, input: RoleCreateInput, req: Request) {
  const nameClash = await prisma.role.findUnique({ where: { name: input.name }, select: { id: true } })
  if (nameClash) throw conflict('A role with that name already exists')

  const permissionIds = await permissionIdsFor(input.permissionKeys)
  const slug = await uniqueSlug(slugify(input.name))

  return prisma.$transaction(async (tx) => {
    const role = await tx.role.create({
      data: { name: input.name, slug, description: orNull(input.description), isSystem: false },
      select: { id: true, name: true },
    })
    if (permissionIds.length) {
      await tx.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({ roleId: role.id, permissionId })),
        skipDuplicates: true,
      })
    }
    await logActivityTx(tx, {
      actorUserId: actorId,
      action: 'rbac.role.created',
      entityType: 'role',
      entityId: role.id,
      summary: `Created role ${role.name} with ${input.permissionKeys.length} permissions`,
      metadata: { permissionCount: input.permissionKeys.length },
      req,
    })
    return role
  })
}

export async function updateRole(actorId: string, id: string, input: RoleUpdateInput, req: Request) {
  const role = await prisma.role.findUnique({ where: { id }, select: { id: true, name: true, isSystem: true } })
  if (!role) throw notFound('Role not found')
  // The one hard guard: never let a system role be edited into a lockout.
  if (role.isSystem) throw conflict('System roles cannot be edited')

  if (input.name && input.name !== role.name) {
    const clash = await prisma.role.findUnique({ where: { name: input.name }, select: { id: true } })
    if (clash) throw conflict('A role with that name already exists')
  }

  // Undefined = leave the grants untouched; an empty array = clear them.
  const permissionIds = input.permissionKeys ? await permissionIdsFor(input.permissionKeys) : undefined

  return prisma.$transaction(async (tx) => {
    const updated = await tx.role.update({
      where: { id },
      data: {
        ...(input.name && { name: input.name }),
        ...('description' in input && { description: orNull(input.description) }),
      },
      select: { id: true, name: true },
    })
    if (permissionIds) {
      // Replace wholesale — clearer than diffing at this size, and the join
      // cascades cleanly.
      await tx.rolePermission.deleteMany({ where: { roleId: id } })
      if (permissionIds.length) {
        await tx.rolePermission.createMany({
          data: permissionIds.map((permissionId) => ({ roleId: id, permissionId })),
          skipDuplicates: true,
        })
      }
    }
    await logActivityTx(tx, {
      actorUserId: actorId,
      action: 'rbac.role.updated',
      entityType: 'role',
      entityId: id,
      summary: `Updated role ${updated.name}`,
      metadata: input.permissionKeys ? { permissionCount: input.permissionKeys.length } : undefined,
      req,
    })
    return updated
  })
}

export async function deleteRole(actorId: string, id: string, req: Request) {
  const role = await prisma.role.findUnique({
    where: { id },
    select: { id: true, name: true, isSystem: true, _count: { select: { users: true } } },
  })
  if (!role) throw notFound('Role not found')
  if (role.isSystem) throw conflict('System roles cannot be deleted')
  if (role._count.users > 0) {
    throw conflict(
      `${role.name} is assigned to ${role._count.users} user${role._count.users === 1 ? '' : 's'}. Reassign them first.`,
    )
  }

  await prisma.$transaction(async (tx) => {
    // Cascade clears role_permissions; user_roles is already empty (0 users).
    await tx.role.delete({ where: { id } })
    await logActivityTx(tx, {
      actorUserId: actorId,
      action: 'rbac.role.deleted',
      entityType: 'role',
      entityId: id,
      summary: `Deleted role ${role.name}`,
      req,
    })
  })
}

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
