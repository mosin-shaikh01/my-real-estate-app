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
    void setFavicon(faviconUrl)
  }, [crmName, faviconUrl])

  useEffect(() => {
    const root = document.documentElement
    if (primaryColor) root.style.setProperty('--brand-mark', primaryColor)
    else root.style.removeProperty('--brand-mark')
  }, [primaryColor])

  return null
}

// The object URL currently in use, kept so it can be revoked on the next swap.
let currentObjectUrl: string | null = null

// Dynamic favicons are stubborn: browsers (Chrome especially) often keep the
// already-painted icon even after you swap the <link href>. Two things make it
// reliable here:
//   1. Replace the element outright (remove every icon link, append a fresh one).
//   2. Point it at a `blob:` URL of the fetched bytes, not the http URL. A blob
//      URL is unique and un-cacheable, so the browser treats it as brand-new
//      content and repaints the tab.
// If the fetch fails (e.g. offline), we fall back to the direct URL.
async function setFavicon(href: string | null): Promise<void> {
  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl)
    currentObjectUrl = null
  }

  if (!href) {
    replaceIcon('/favicon.svg', 'image/svg+xml')
    return
  }

  try {
    const res = await fetch(href, { cache: 'no-store' })
    if (!res.ok) throw new Error(`favicon ${res.status}`)
    const blob = await res.blob()
    currentObjectUrl = URL.createObjectURL(blob)
    replaceIcon(currentObjectUrl, blob.type || undefined)
  } catch {
    replaceIcon(href)
  }
}

function replaceIcon(href: string, type?: string): void {
  document.querySelectorAll("link[rel~='icon']").forEach((el) => el.remove())
  const link = document.createElement('link')
  link.rel = 'icon'
  if (type) link.type = type
  link.href = href
  document.head.appendChild(link)
}
