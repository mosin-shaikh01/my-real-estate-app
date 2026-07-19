import { useEffect } from 'react'
import { useSettings } from '@/features/settings/api/use-settings'

// Applies the CRM's configured branding to the document, app-wide and live: the
// browser-tab title, the favicon, and BOTH brand colours (exposed as the
// `--brand-primary` / `--brand-secondary` CSS variables the token layer maps to
// `--color-brand-primary` / `--color-brand-secondary`). Renders nothing — it is a
// set of effects that run wherever it's mounted (inside the query provider).
//
// This is the single seam the spec's "reuse globally" list hangs off: page
// titles, favicon and BOTH colours today; email/PDF/print templates read the same
// settings query later. Setting a CSS var on <html> overrides the :root default;
// clearing it falls back to the default — so an unset colour reverts, live.
export function BrandingEffects() {
  const { data } = useSettings()
  // Depend on the primitives, not the whole object, so a background refetch that
  // returns identical values doesn't re-touch the DOM.
  const crmName = data?.crmName
  const faviconUrl = data?.faviconUrl ?? null
  const primaryColor = data?.primaryColor ?? null
  const secondaryColor = data?.secondaryColor ?? null

  useEffect(() => {
    if (crmName !== undefined) document.title = crmName
  }, [crmName])

  useEffect(() => {
    applyFavicon(faviconUrl)
  }, [faviconUrl])

  useEffect(() => {
    applyBrandColor('--brand-primary', primaryColor)
  }, [primaryColor])

  useEffect(() => {
    applyBrandColor('--brand-secondary', secondaryColor)
  }, [secondaryColor])

  return null
}

// Set a brand CSS var on <html> (overriding the token default), or clear it so
// the default takes over again. Both colours use the exact same mechanism.
function applyBrandColor(varName: string, value: string | null): void {
  const root = document.documentElement
  if (value) root.style.setProperty(varName, value)
  else root.style.removeProperty(varName)
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
