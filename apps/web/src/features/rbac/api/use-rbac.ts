import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { RoleCreateInput, RoleUpdateInput } from '@app/shared'
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

// Editing a role changes what its users can do on their next request. Invalidate
// ['me'] too, so if the admin edited a role they themselves hold, their own gates
// refresh without a reload.
function useRoleInvalidate() {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: ['rbac'] })
    void qc.invalidateQueries({ queryKey: ['me'] })
  }
}

export function useCreateRole() {
  const invalidate = useRoleInvalidate()
  return useMutation({
    mutationFn: (input: RoleCreateInput) => api.post<{ data: { id: string; name: string } }>('/rbac/roles', input),
    onSuccess: invalidate,
  })
}

export function useUpdateRole(id: string) {
  const invalidate = useRoleInvalidate()
  return useMutation({
    mutationFn: (input: RoleUpdateInput) => api.patch<{ data: { id: string; name: string } }>(`/rbac/roles/${id}`, input),
    onSuccess: invalidate,
  })
}

export function useDeleteRole() {
  const invalidate = useRoleInvalidate()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/rbac/roles/${id}`),
    onSuccess: invalidate,
  })
}
