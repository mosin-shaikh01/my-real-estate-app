import { describe, expect, it } from 'vitest'
import { parseVideoUrl } from '@/features/properties/lib/video-embed'

// The Video Gallery lives or dies on this parser: a mis-parsed YouTube id is a
// broken embed. Pure function, so it's cheap to pin every URL shape we accept.

describe('parseVideoUrl — YouTube', () => {
  const id = 'dQw4w9WgXcQ'
  it.each([
    `https://www.youtube.com/watch?v=${id}`,
    `https://youtube.com/watch?v=${id}&t=30s`,
    `https://youtu.be/${id}`,
    `https://www.youtube.com/embed/${id}`,
    `https://www.youtube.com/shorts/${id}`,
    `https://m.youtube.com/watch?v=${id}`,
  ])('parses %s', (url) => {
    const v = parseVideoUrl(url)
    expect(v.kind).toBe('youtube')
    if (v.kind === 'youtube') {
      expect(v.id).toBe(id)
      expect(v.embedUrl).toContain(`/embed/${id}`)
      expect(v.thumbnailUrl).toContain(id)
    }
  })
})

describe('parseVideoUrl — Vimeo', () => {
  it.each([
    ['https://vimeo.com/76979871', '76979871'],
    ['https://player.vimeo.com/video/76979871', '76979871'],
  ])('parses %s', (url, expected) => {
    const v = parseVideoUrl(url)
    expect(v.kind).toBe('vimeo')
    if (v.kind === 'vimeo') expect(v.id).toBe(expected)
  })
})

describe('parseVideoUrl — direct files and fallbacks', () => {
  it('treats a media file URL as a playable file', () => {
    expect(parseVideoUrl('https://cdn.example.com/tour.mp4').kind).toBe('file')
    expect(parseVideoUrl('https://cdn.example.com/tour.webm?token=x').kind).toBe('file')
  })

  it('falls back to a plain link for unknown hosts', () => {
    expect(parseVideoUrl('https://example.com/watch/123').kind).toBe('link')
  })

  it('does not throw on a non-URL string', () => {
    expect(parseVideoUrl('not a url').kind).toBe('link')
  })
})
