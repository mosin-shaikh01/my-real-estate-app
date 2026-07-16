import {
  Building2,
  ClipboardList,
  LayoutDashboard,
  ScrollText,
  Settings2,
  Users,
  UserSquare2,
} from 'lucide-react'
import { useMemo } from 'react'
import { NavLink } from 'react-router'
import type { PermissionKey } from '@app/shared'
import { usePermissions } from '@/features/auth/api/use-auth'
import { cn } from '@/lib/cn'

// ============================================================================
// ONE config-driven nav for every role.
// ============================================================================
// Not two sidebars, not hardcoded role checks. Each item declares the
// permission it needs; the render filters by the logged-in user's effective
// permissions. Adding a role changes what appears for free (a role is just a
// set of permissions), and adding a page is one line in NAV with its
// permission key — no `if (role === 'admin')` anywhere.
//
// The agent role holds property.list + client.list (and no admin permissions),
// so an agent sees exactly Dashboard, Properties, Clients. An admin holds
// everything and sees the whole tree.
//
// This is UX: the route guard (<RequirePermission>) and the API enforce access.
// A hidden link is a convenience, never the security boundary.
// ============================================================================

interface NavItem {
  to: string
  label: string
  icon: typeof LayoutDashboard
  /** Omit for items everyone signed-in may use (e.g. Dashboard). */
  permission?: PermissionKey
}

const NAV: ReadonlyArray<{ heading?: string; items: readonly NavItem[] }> = [
  {
    items: [
      // Search is global, in the top bar — no standalone page.
      { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    heading: 'Manage',
    items: [
      { to: '/properties', label: 'Properties', icon: Building2, permission: 'property.list' },
      { to: '/clients', label: 'Clients', icon: Users, permission: 'client.list' },
      {
        to: '/requirements',
        label: 'Requirements',
        icon: ClipboardList,
        permission: 'client.assignProperty',
      },
      { to: '/agents', label: 'Agents', icon: UserSquare2, permission: 'agent.list' },
    ],
  },
  {
    heading: 'Admin',
    items: [
      { to: '/activity', label: 'Activity log', icon: ScrollText, permission: 'activity.list' },
      { to: '/settings/roles', label: 'Roles & access', icon: Settings2, permission: 'rbac.role.list' },
    ],
  },
]

export function Sidebar({ className }: { className?: string }) {
  // RequireAuth blocks AppShell (and thus this) until /me resolves, so
  // permissions are already loaded by the time the sidebar renders — no flicker.
  const { has } = usePermissions()

  // Filter the declarative config against the user's permissions: keep items
  // with no permission or a held one, then drop any group left with no items
  // (so an empty "Admin" heading never renders for an agent).
  const visibleGroups = useMemo(
    () =>
      NAV.map((group) => ({
        ...group,
        items: group.items.filter((item) => !item.permission || has(item.permission)),
      })).filter((group) => group.items.length > 0),
    [has],
  )

  return (
    <nav
      aria-label="Main"
      className={cn(
        'flex h-full w-56 shrink-0 flex-col border-r border-border-subtle bg-surface-raised',
        className,
      )}
    >
      <div className="flex h-14 items-center gap-2 border-b border-border-subtle px-4">
        <div className="grid size-6 place-items-center rounded bg-brand-600 text-white">
          <Building2 className="size-3.5" aria-hidden="true" />
        </div>
        <span className="text-base font-semibold text-text-primary">Estate</span>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {visibleGroups.map((group, i) => (
          <div key={group.heading ?? i} className={cn(i > 0 && 'mt-5')}>
            {group.heading ? (
              <p className="mb-1.5 px-2 text-2xs font-semibold tracking-wide text-text-muted uppercase">
                {group.heading}
              </p>
            ) : null}
            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-2.5 rounded-md px-2 py-1.5 text-base',
                        'transition-colors duration-[120ms]',
                        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
                        isActive
                          ? 'bg-surface-selected font-medium text-brand-700'
                          : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <item.icon
                          className={cn(
                            'size-4 shrink-0',
                            isActive ? 'text-brand-600' : 'text-text-muted',
                          )}
                          aria-hidden="true"
                        />
                        {item.label}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  )
}
