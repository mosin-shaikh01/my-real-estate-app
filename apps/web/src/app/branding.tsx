import { useEffect } from 'react'
import { useSettings } from '@/features/settings/api/use-settings'

// Applies the CRM's configured branding to the document, app-wide and live: the
// browser-tab title, the favicon, and the primary brand colour (exposed as the
// `--brand-mark` CSS variable that the logo mark uses). Renders nothing — it is
// a set of effects that run wherever it's mounted (inside the query provider).
//
// This is the single seam the spec's "reuse globally" list hangs off: page
// titles, favicon and colour today; email/PDF/print templates can read the same
// settings query later.
export function BrandingEffects() {
  const { data } = useSettings()
  // Depend on the primitives, not the whole object, so a background refetch that
  // returns identical values doesn't needlessly re-swap the favicon.
  const crmName = data?.crmName
  const faviconUrl = data?.faviconUrl ?? null
  const primaryColor = data?.primaryColor ?? null

  useEffect(() => {
    if (crmName === undefined) return // settings not loaded yet
    document.title = crmName
  }, [crmName])

  useEffect(() => {
    if (crmName === undefined) return // wait until settings resolve
    setFavicon(faviconUrl)
  }, [crmName, faviconUrl])

  useEffect(() => {
    const root = document.documentElement
    if (primaryColor) root.style.setProperty('--brand-mark', primaryColor)
    else root.style.removeProperty('--brand-mark')
  }, [primaryColor])

  return null
}

// Dynamic favicons are unreliable when you mutate an existing <link>: Chrome
// (and others) frequently keep the already-loaded icon. The robust fix is to
// REMOVE every icon link and append a fresh element — the browser then re-reads
// it. The href carries a ?v= version, so a replacement is a new URL and can't be
// served from cache.
function setFavicon(href: string | null): void {
  document.querySelectorAll("link[rel~='icon']").forEach((el) => el.remove())

  const link = document.createElement('link')
  link.rel = 'icon'
  if (href) {
    // The uploaded file's type is decided by its bytes; leave `type` unset so an
    // SVG-typed tag can't mislabel a PNG.
    link.href = href
  } else {
    // No custom favicon — restore the bundled default.
    link.type = 'image/svg+xml'
    link.href = '/favicon.svg'
  }
  document.head.appendChild(link)
}
