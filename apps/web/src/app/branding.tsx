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

// Dynamic favicons are stubborn: browsers (Chrome especially) keep the already-
// painted icon after a plain href change. Two things make it reliable:
//   1. Replace the element outright (remove every icon link, append a fresh one).
//   2. Point it at a `data:` URL of the fetched bytes. A data URL is unique,
//      self-contained and un-cacheable, so the browser repaints — and unlike a
//      `blob:` URL it needs no revoke, so React Strict Mode's double-invoke can't
//      leave the <link> pointing at a dead reference (which shows as the browser's
//      generic globe).
// Falls back to the direct URL if the fetch fails.
async function setFavicon(href: string | null): Promise<void> {
  if (!href) {
    replaceIcon('/favicon.svg', 'image/svg+xml')
    return
  }
  try {
    const res = await fetch(href, { cache: 'no-store' })
    if (!res.ok) throw new Error(`favicon ${res.status}`)
    const blob = await res.blob()
    const dataUrl = await blobToDataUrl(blob)
    replaceIcon(dataUrl, blob.type || undefined)
  } catch {
    replaceIcon(href)
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

function replaceIcon(href: string, type?: string): void {
  document.querySelectorAll("link[rel~='icon']").forEach((el) => el.remove())
  const link = document.createElement('link')
  link.rel = 'icon'
  if (type) link.type = type
  link.href = href
  document.head.appendChild(link)
}
