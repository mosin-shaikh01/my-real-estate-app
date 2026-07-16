import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface RoleWithPermissions {
  id: string
  name: string
  slug: string
  description: string | null
  isSystem: boolean
  userCount: number
  permissionKeys: string[]
}

export interface PermissionGroup {
  resource: string
  permissions: Array<{
    key: string
    resource: string
    action: string
    field: string | null
    description: string
  }>
}

export function useRoles() {
  return useQuery({
    queryKey: ['rbac', 'roles'],
    queryFn: ({ signal }) => api.get<{ data: RoleWithPermissions[] }>('/rbac/roles', signal),
    select: (r) => r.data,
  })
}

export function usePermissionCatalog() {
  return useQuery({
    queryKey: ['rbac', 'permissions'],
    queryFn: ({ signal }) => api.get<{ data: PermissionGroup[] }>('/rbac/permissions', signal),
    select: (r) => r.data,
  })
}
