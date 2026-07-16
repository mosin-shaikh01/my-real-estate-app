// ============================================================================
// PERMISSION CATALOG — the single source of truth
// ============================================================================
// The catalog is CODE. The assignment is DATA.
//
// Read that twice, because it's the one thing people get wrong. A permission
// only does something because a line of code checks it. An admin screen that
// "creates permissions" inserts rows nothing reads — theatre. So:
//
//   * This file owns the canonical list. The seed upserts it into the DB on
//     boot. Add a key here, restart, and an admin can assign it immediately.
//   * Roles, role→permission mappings, and per-user overrides are pure data.
//     An admin can invent "Senior Agent", tick 12 boxes, and never need a
//     deploy. That is the actual requirement, and it is fully met.
//   * PermissionKey is a literal union, so can('client.phone.veiw') is a
//     COMPILE ERROR. A DB-only catalog can never give you that.
//
// SHAPE: resource-level -> "<resource>.<action>"
//        field-level    -> "<resource>.<field>.<action>"
//
// Field-level permissions are CURATED, not generic. Ten of them, mapped to
// real columns by the redactor. A generic "any field is permissionable" engine
// destroys static DTO types to buy capability nobody uses.
// ============================================================================

export const PERMISSIONS = [
  // --- Property ------------------------------------------------------------
  { key: 'property.list', resource: 'property', action: 'list', description: 'List properties' },
  {
    key: 'property.list.all',
    resource: 'property',
    action: 'list.all',
    description: 'See ALL properties, not only assigned ones (scope-widening)',
  },
  { key: 'property.view', resource: 'property', action: 'view', description: 'View a property' },
  { key: 'property.create', resource: 'property', action: 'create', description: 'Create a property' },
  { key: 'property.update', resource: 'property', action: 'update', description: 'Edit a property' },
  { key: 'property.delete', resource: 'property', action: 'delete', description: 'Delete a property' },
  { key: 'property.archive', resource: 'property', action: 'archive', description: 'Archive a property' },
  {
    key: 'property.status.update',
    resource: 'property',
    action: 'status.update',
    description: 'Change property status (mark sold / rented)',
  },
  {
    key: 'property.assignAgent',
    resource: 'property',
    action: 'assignAgent',
    description: 'Assign an agent to a property',
  },
  // Field-level: "View Property Price"
  {
    key: 'property.price.view',
    resource: 'property',
    action: 'view',
    field: 'price',
    description: 'View property pricing (sale / rent / deposit)',
  },
  // Field-level: "View Internal Notes"
  {
    key: 'property.internalNotes.view',
    resource: 'property',
    action: 'view',
    field: 'internalNotes',
    description: 'View internal notes on a property',
  },
  // "Upload Documents" / "Download Files"
  {
    key: 'property.media.upload',
    resource: 'property',
    action: 'media.upload',
    description: 'Upload images, floor plans and documents',
  },
  {
    key: 'property.media.download',
    resource: 'property',
    action: 'media.download',
    description: 'Download property files',
  },

  // --- Client --------------------------------------------------------------
  { key: 'client.list', resource: 'client', action: 'list', description: 'List clients' },
  {
    key: 'client.list.all',
    resource: 'client',
    action: 'list.all',
    description: 'See ALL clients, not only assigned ones (scope-widening)',
  },
  { key: 'client.view', resource: 'client', action: 'view', description: 'View a client' },
  { key: 'client.create', resource: 'client', action: 'create', description: 'Create a client' },
  { key: 'client.update', resource: 'client', action: 'update', description: 'Edit a client' },
  { key: 'client.delete', resource: 'client', action: 'delete', description: 'Delete a client' },
  {
    key: 'client.assignProperty',
    resource: 'client',
    action: 'assignProperty',
    description: 'Assign properties to a client',
  },
  {
    key: 'client.assignAgent',
    resource: 'client',
    action: 'assignAgent',
    description: 'Assign an agent to a client',
  },
  // Field-level: "View Client Phone"
  {
    key: 'client.phone.view',
    resource: 'client',
    action: 'view',
    field: 'phone',
    description: 'View client phone / WhatsApp numbers',
  },
  // Field-level: "View Client Email"
  {
    key: 'client.email.view',
    resource: 'client',
    action: 'view',
    field: 'email',
    description: 'View client email address',
  },
  // Field-level: "View Budget"
  {
    key: 'client.budget.view',
    resource: 'client',
    action: 'view',
    field: 'budget',
    description: 'View client budget range',
  },
  // Field-level: "View Internal Notes"
  {
    key: 'client.internalNotes.view',
    resource: 'client',
    action: 'view',
    field: 'internalNotes',
    description: 'View internal notes on a client',
  },
  // "Edit Follow-up"
  {
    key: 'client.followUp.edit',
    resource: 'client',
    action: 'followUp.edit',
    description: 'Update follow-up status and next follow-up date',
  },
  {
    key: 'client.interaction.create',
    resource: 'client',
    action: 'interaction.create',
    description: 'Add notes, log calls, schedule meetings',
  },

  // --- Agent ---------------------------------------------------------------
  { key: 'agent.list', resource: 'agent', action: 'list', description: 'List agents' },
  { key: 'agent.view', resource: 'agent', action: 'view', description: 'View an agent' },
  { key: 'agent.create', resource: 'agent', action: 'create', description: 'Create an agent' },
  { key: 'agent.update', resource: 'agent', action: 'update', description: 'Edit an agent' },
  {
    key: 'agent.status.update',
    resource: 'agent',
    action: 'status.update',
    description: 'Activate / deactivate an agent',
  },
  {
    key: 'agent.permissions.update',
    resource: 'agent',
    action: 'permissions.update',
    description: 'Change what an agent can access',
  },
  // Field-level: "View Commission"
  {
    key: 'agent.commission.view',
    resource: 'agent',
    action: 'view',
    field: 'commission',
    description: 'View agent commission rates',
  },

  // --- RBAC ----------------------------------------------------------------
  { key: 'rbac.role.list', resource: 'rbac', action: 'role.list', description: 'View roles' },
  { key: 'rbac.role.create', resource: 'rbac', action: 'role.create', description: 'Create roles' },
  { key: 'rbac.role.update', resource: 'rbac', action: 'role.update', description: 'Edit roles and their permissions' },
  {
    key: 'rbac.permission.list',
    resource: 'rbac',
    action: 'permission.list',
    description: 'View the permission catalog',
  },

  // --- Settings ------------------------------------------------------------
  { key: 'settings.view', resource: 'settings', action: 'view', description: 'View CRM settings' },
  {
    key: 'settings.update',
    resource: 'settings',
    action: 'update',
    description: 'Manage CRM branding, company info and configuration',
  },

  // --- Activity / Reports / Deals ------------------------------------------
  { key: 'activity.list', resource: 'activity', action: 'list', description: 'View the activity log' },
  { key: 'report.view', resource: 'report', action: 'view', description: 'View reports' },
  // "Export Data"
  { key: 'report.export', resource: 'report', action: 'export', description: 'Export data to CSV' },
  { key: 'deal.list', resource: 'deal', action: 'list', description: 'View closed deals' },
  { key: 'deal.create', resource: 'deal', action: 'create', description: 'Record a closed deal' },
] as const satisfies readonly PermissionDefinition[]

interface PermissionDefinition {
  readonly key: string
  readonly resource: string
  readonly action: string
  readonly field?: string
  readonly description: string
}

/** Every valid permission. Typos here are compile errors, not silent no-ops. */
export type PermissionKey = (typeof PERMISSIONS)[number]['key']

export const PERMISSION_KEYS = PERMISSIONS.map((p) => p.key) as readonly PermissionKey[]

/** Resource groupings — what the admin permission matrix renders from. */
export type PermissionResource = (typeof PERMISSIONS)[number]['resource']

export function isPermissionKey(value: string): value is PermissionKey {
  return (PERMISSION_KEYS as readonly string[]).includes(value)
}

// ============================================================================
// ROLES
// ============================================================================
// Seeded defaults only. Admins can create more roles and re-tick any of these
// boxes at runtime without a deploy — that is the whole point of the split.

export const ROLE_SLUGS = {
  SUPER_ADMIN: 'super_admin',
  AGENT: 'agent',
  /** Not used in v1. Seeded so the future public listing site authenticates as
   *  actor=null -> this role, reusing the same middleware, scope resolver and
   *  serializer with zero new authorization code. */
  PUBLIC: 'public',
} as const

export type RoleSlug = (typeof ROLE_SLUGS)[keyof typeof ROLE_SLUGS]

/** Super admin holds every permission, by definition. */
export const SUPER_ADMIN_PERMISSIONS: readonly PermissionKey[] = PERMISSION_KEYS

/**
 * The default agent. Deliberately NOT given:
 *   - *.list.all        -> scoped to assigned rows only
 *   - *.delete          -> cannot delete anything
 *   - agent.*           -> cannot see or manage other agents
 *   - client.budget.view / agent.commission.view / *.internalNotes.view
 *   - report.export     -> cannot bulk-exfiltrate
 *   - rbac.*            -> cannot modify permissions
 */
export const AGENT_PERMISSIONS: readonly PermissionKey[] = [
  'property.list',
  'property.view',
  'property.price.view',
  'property.media.download',
  'client.list',
  'client.view',
  'client.phone.view',
  'client.email.view',
  'client.followUp.edit',
  'client.interaction.create',
]

/** Anonymous public site: published listings only, no PII, no internal notes. */
export const PUBLIC_PERMISSIONS: readonly PermissionKey[] = [
  'property.list',
  'property.view',
  'property.price.view',
]
