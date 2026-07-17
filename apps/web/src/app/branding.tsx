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
  // returns identical values doesn't re-touch the DOM.
  const crmName = data?.crmName
  const faviconUrl = data?.faviconUrl ?? null
  const primaryColor = data?.primaryColor ?? null

  useEffect(() => {
    if (crmName !== undefined) document.title = crmName
  }, [crmName])

  useEffect(() => {
    applyFavicon(faviconUrl)
  }, [faviconUrl])

  useEffect(() => {
    const root = document.documentElement
    if (primaryColor) root.style.setProperty('--brand-mark', primaryColor)
    else root.style.removeProperty('--brand-mark')
  }, [primaryColor])

  return null
}

const DEFAULT_FAVICON = '/favicon.svg'

// Update the favicon IN PLACE and idempotently. The single most important thing
// here is what it does NOT do: it never removes the <link rel="icon"> element.
// Removing it drops the document to a "no favicon" state (the browser's generic
// globe) — which is exactly why even the bundled default was disappearing. We
// keep the one link from index.html and only change its href when it actually
// differs, so:
//   • no custom favicon  → a no-op; the default stays exactly as the browser
//                          loaded it;
//   • custom favicon     → href becomes the versioned API URL (the ?v= busts the
//                          cache), which the browser fetches and repaints;
//   • removed            → href returns to the default.
// Setting the same href twice is a no-op, so React Strict Mode's double-invoke
// is harmless. No blob/data URLs, so there are no revocable/stale references.
function applyFavicon(customUrl: string | null): void {
  const link = getOrCreateIconLink()

  // Exactly one icon link — collapse any duplicates onto the canonical one.
  document.querySelectorAll("link[rel~='icon']").forEach((el) => {
    if (el !== link) el.remove()
  })

  if (customUrl) {
    // Unknown type — let the browser sniff it from the response Content-Type,
    // rather than mislabel a PNG as the index.html's image/svg+xml.
    if (link.hasAttribute('type')) link.removeAttribute('type')
    if (link.getAttribute('href') !== customUrl) link.setAttribute('href', customUrl)
  } else {
    if (link.getAttribute('type') !== 'image/svg+xml') link.setAttribute('type', 'image/svg+xml')
    if (link.getAttribute('href') !== DEFAULT_FAVICON) link.setAttribute('href', DEFAULT_FAVICON)
  }
}

function getOrCreateIconLink(): HTMLLinkElement {
  const existing = document.querySelector<HTMLLinkElement>("link[rel~='icon']")
  if (existing) return existing
  const link = document.createElement('link')
  link.rel = 'icon'
  document.head.appendChild(link)
  return link
}
