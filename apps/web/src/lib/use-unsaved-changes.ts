import { useEffect } from 'react'
import { useBlocker } from 'react-router'

// ============================================================================
// Guard against losing unsaved form edits — two exits, two mechanisms.
// ============================================================================
// In-app navigation (a sidebar link, the browser back button within the SPA) is
// caught by the data router's useBlocker, which lets us show a real confirm.
// A full-page exit (closing the tab, reloading, typing a new URL) can only be
// caught by the native `beforeunload` event, whose prompt the browser controls.
//
// Both are gated on `when` so a pristine or already-saved form never nags. The
// caller flips `when` to false immediately before a programmatic navigate on
// successful save, so the success redirect is never blocked.
// ============================================================================

export function useUnsavedChanges(when: boolean) {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      when && currentLocation.pathname !== nextLocation.pathname,
  )

  // Confirm the in-app navigation the moment the router blocks it. Keeping the
  // prompt here (rather than rendering a modal) matches the browser's own
  // beforeunload affordance and needs no extra UI wiring at every call site.
  useEffect(() => {
    if (blocker.state !== 'blocked') return
    const leave = window.confirm('You have unsaved changes. Leave without saving?')
    if (leave) blocker.proceed()
    else blocker.reset()
  }, [blocker])

  // Native tab-close / reload guard. The returnValue assignment is the modern
  // requirement; the string is legacy and ignored by current browsers.
  useEffect(() => {
    if (!when) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [when])
}
