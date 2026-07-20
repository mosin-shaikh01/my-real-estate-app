import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { ChevronDown, LogOut, UserCircle2, UserCog } from 'lucide-react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { useToast } from '@/components/ui/use-toast'
import { useLogout, useMe } from '@/features/auth/api/use-auth'
import { GlobalSearch } from '@/features/search/components/GlobalSearch'
import { cn } from '@/lib/cn'

export function Topbar({
  navTrigger,
}: {
  onOpenNav?: () => void
  navTrigger?: ReactNode
}) {
  const { data: me } = useMe()
  const logout = useLogout()
  const navigate = useNavigate()
  const { toast } = useToast()

  const onSignOut = async () => {
    await logout.mutateAsync()
    toast({ variant: 'success', title: 'Signed out' })
    void navigate('/login', { replace: true })
  }

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border-subtle bg-surface-raised px-4 lg:px-6">
      {navTrigger}

      <GlobalSearch />

      <div className="flex-1 sm:hidden" />

      <ThemeToggle />

      <DropdownMenu.Root>
        <DropdownMenu.Trigger
          className={cn(
            'flex items-center gap-2 rounded-md px-2 py-1.5 text-left',
            'transition-colors duration-[120ms] hover:bg-surface-hover',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
          )}
        >
          <UserCircle2 className="size-6 shrink-0 text-text-muted" aria-hidden="true" />
          <span className="hidden min-w-0 sm:block">
            <span className="block truncate text-xs font-medium text-text-primary">
              {me?.user.fullName ?? '—'}
            </span>
            <span className="block truncate text-2xs text-text-muted">
              {me?.roles.map((r) => r.name).join(', ') ?? ''}
            </span>
          </span>
          <ChevronDown className="size-3.5 shrink-0 text-text-muted" aria-hidden="true" />
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={6}
            className={cn(
              'z-50 min-w-44 rounded-md border border-border-subtle bg-surface-raised p-1 shadow-e2',
              // Radix drives these from data-state; no AnimatePresence needed
              // for a menu, and CSS keeps it off the JS main thread.
              'data-[state=open]:animate-in data-[state=closed]:animate-out',
              'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            )}
          >
            <DropdownMenu.Item
              onSelect={() => void navigate('/profile')}
              className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-base text-text-secondary outline-none data-[highlighted]:bg-surface-hover data-[highlighted]:text-text-primary"
            >
              <UserCog className="size-4" aria-hidden="true" />
              Your profile
            </DropdownMenu.Item>
            <DropdownMenu.Separator className="my-1 h-px bg-border-subtle" />
            <DropdownMenu.Item
              onSelect={() => void onSignOut()}
              className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-base text-text-secondary outline-none data-[highlighted]:bg-surface-hover data-[highlighted]:text-text-primary"
            >
              <LogOut className="size-4" aria-hidden="true" />
              Sign out
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </header>
  )
}
