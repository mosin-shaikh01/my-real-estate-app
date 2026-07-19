import { AnimatePresence, motion } from 'motion/react'
import { Menu, X } from 'lucide-react'
import { useState } from 'react'
import { Outlet, useLocation } from 'react-router'
import { Button } from '@/components/ui/Button'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

export function AppShell() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const { pathname } = useLocation()

  // Navigating should close the drawer, or it covers the page you just opened.
  //
  // Adjusted DURING render, not in an effect. An effect would render the new
  // page with the drawer still open, then immediately re-render to close it —
  // a visible flash and a cascading render. This is React's documented pattern
  // for "reset state when a prop changes", and it's what the
  // react-hooks/set-state-in-effect rule is steering toward.
  const [lastPath, setLastPath] = useState(pathname)
  if (pathname !== lastPath) {
    setLastPath(pathname)
    setMobileNavOpen(false)
  }

  return (
    // `fixed inset-0`, not `h-dvh` in normal flow: a normal-flow shell — even
    // h-dvh + overflow-hidden — still lets the DOCUMENT scroll to accommodate the
    // inner `<main>` scroller's tall content (a Chromium quirk), producing a
    // second, phantom scrollbar next to main's. Taking the shell out of flow
    // viewport-locks it, so only `main` ever scrolls. The login page (AuthLayout,
    // a separate route) is unaffected and still scrolls on short screens.
    <div className="fixed inset-0 flex overflow-hidden bg-surface-sunken">
      {/* Desktop: persistent. Mobile: drawer. Same component, no duplication. */}
      <Sidebar className="hidden lg:flex" />

      <AnimatePresence>
        {mobileNavOpen ? (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => setMobileNavOpen(false)}
              className="fixed inset-0 z-40 bg-neutral-950/40 lg:hidden"
              aria-hidden="true"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              // Overlay easing: ease-out in, ease-in out. 240ms for a large
              // moving surface -- long enough to track, short enough to ignore.
              transition={{ duration: 0.24, ease: [0.25, 1, 0.5, 1] }}
              className="fixed inset-y-0 left-0 z-50 lg:hidden"
            >
              <Sidebar />
              <Button
                variant="ghost"
                size="sm"
                aria-label="Close navigation"
                onClick={() => setMobileNavOpen(false)}
                className="absolute top-3 -right-11 text-white hover:bg-white/10 hover:text-white"
              >
                <X aria-hidden="true" />
              </Button>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          onOpenNav={() => setMobileNavOpen(true)}
          navTrigger={
            <Button
              variant="ghost"
              size="sm"
              aria-label="Open navigation"
              className="lg:hidden"
              onClick={() => setMobileNavOpen(true)}
            >
              <Menu aria-hidden="true" />
            </Button>
          }
        />

        {/* Only this scrolls. The page body never scrolls horizontally --
            wide tables scroll inside their own TableWrapper. */}
        <main className="min-w-0 flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border-subtle bg-surface-raised px-6 py-5">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold text-text-primary">{title}</h1>
        {description ? (
          <p className="mt-1 text-base text-text-secondary">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}
