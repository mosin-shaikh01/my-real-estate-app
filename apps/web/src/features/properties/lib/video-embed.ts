// Turn an external video URL into something renderable: a YouTube/Vimeo embed,
// a directly-playable file, or (fallback) a plain link. Pure and dependency-free
// so it unit-tests trivially and runs during render without side effects.

export type VideoEmbed =
  | { kind: 'youtube'; id: string; embedUrl: string; thumbnailUrl: string; url: string }
  | { kind: 'vimeo'; id: string; embedUrl: string; url: string }
  | { kind: 'file'; url: string }
  | { kind: 'link'; url: string }

const FILE_EXT = /\.(mp4|webm|ogg|ogv|mov|m4v)(\?.*)?$/i

function parseYouTubeId(u: URL): string | null {
  const host = u.hostname.replace(/^www\./, '')
  if (host === 'youtu.be') return u.pathname.slice(1) || null
  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
    if (u.pathname === '/watch') return u.searchParams.get('v')
    const m = u.pathname.match(/^\/(embed|shorts|v)\/([\w-]+)/)
    if (m) return m[2] ?? null
  }
  return null
}

function parseVimeoId(u: URL): string | null {
  const host = u.hostname.replace(/^www\./, '')
  if (host === 'vimeo.com') {
    const m = u.pathname.match(/^\/(\d+)/)
    return m?.[1] ?? null
  }
  if (host === 'player.vimeo.com') {
    const m = u.pathname.match(/^\/video\/(\d+)/)
    return m?.[1] ?? null
  }
  return null
}

export function parseVideoUrl(raw: string): VideoEmbed {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return { kind: 'link', url: raw }
  }

  const yt = parseYouTubeId(u)
  if (yt) {
    return {
      kind: 'youtube',
      id: yt,
      // youtube-nocookie is the privacy-friendlier host; rel=0 keeps related
      // videos to the same channel.
      embedUrl: `https://www.youtube-nocookie.com/embed/${yt}?rel=0`,
      // hqdefault exists for every video (maxres doesn't), so it never 404s.
      thumbnailUrl: `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`,
      url: raw,
    }
  }

  const vimeo = parseVimeoId(u)
  if (vimeo) {
    return { kind: 'vimeo', id: vimeo, embedUrl: `https://player.vimeo.com/video/${vimeo}`, url: raw }
  }

  if (FILE_EXT.test(u.pathname)) return { kind: 'file', url: raw }

  return { kind: 'link', url: raw }
}
