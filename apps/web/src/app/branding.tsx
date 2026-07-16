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

  useEffect(() => {
    if (!data) return

    document.title = data.crmName

    setFavicon(data.faviconUrl)

    const root = document.documentElement
    if (data.primaryColor) root.style.setProperty('--brand-mark', data.primaryColor)
    else root.style.removeProperty('--brand-mark')
  }, [data])

  return null
}

function setFavicon(href: string | null): void {
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
  if (!link) {
    link = document.createElement('link')
    link.rel = 'icon'
    document.head.appendChild(link)
  }
  if (href) {
    // The uploaded file's type is decided by its bytes; drop the static
    // type hint so an SVG-typed tag doesn't mislabel a PNG.
    link.removeAttribute('type')
    link.href = href
  } else {
    // Fall back to the bundled default.
    link.type = 'image/svg+xml'
    link.href = '/favicon.svg'
  }
}
