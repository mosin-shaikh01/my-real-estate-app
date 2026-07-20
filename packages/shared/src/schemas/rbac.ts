import { z } from 'zod'
import { PERMISSION_KEYS, type PermissionKey } from '../permissions.js'

// Role editing. The permission CATALOG is code (packages/shared); a role is
// DATA — a name plus a set of catalog keys. These schemas validate that set at
// the boundary; the server additionally refuses to touch system roles.

const permissionKey = z.enum(PERMISSION_KEYS as unknown as [PermissionKey, ...PermissionKey[]])
const roleName = z.string().trim().min(2, 'Enter a role name').max(64)
const description = z.string().trim().max(500).nullish().or(z.literal(''))

export const roleCreateSchema = z.object({
  name: roleName,
  description,
  // Every key must be in the catalog — an unknown permission is a 400, never a
  // silently-dropped grant.
  permissionKeys: z.array(permissionKey).default([]),
})
export type RoleCreateInput = z.infer<typeof roleCreateSchema>

export const roleUpdateSchema = z.object({
  name: roleName.optional(),
  description,
  permissionKeys: z.array(permissionKey).optional(),
})
export type RoleUpdateInput = z.infer<typeof roleUpdateSchema>
