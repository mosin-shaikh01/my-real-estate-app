import { ExternalLink, Play, Trash2, Video as VideoIcon } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useState } from 'react'
import { parseVideoUrl } from '@/features/properties/lib/video-embed'

export interface GalleryVideo {
  id: string
  type: string
}

// The Property Videos section. Shows two kinds of video side by side:
//   1. Uploaded files  — served through the authorized /api/media/:id route.
//   2. External links   — YouTube / Vimeo / direct URLs stored on the property.
//
// YouTube uses a thumbnail + play FACADE: the heavy iframe is only mounted after
// the user clicks, so a listing with several embeds stays fast. The whole
// section renders nothing when there is neither an uploaded video nor a link —
// no empty placeholder, per the spec.
export function VideoGallery({
  uploaded,
  links,
  onDeleteUploaded,
}: {
  uploaded: GalleryVideo[]
  links: string[]
  onDeleteUploaded?: (id: string) => void
}) {
  const reduce = useReducedMotion()
  // Which YouTube facades have been clicked (→ swap the poster for the iframe).
  const [activated, setActivated] = useState<Set<string>>(new Set())
  const activate = (key: string) => setActivated((s) => new Set(s).add(key))

  if (uploaded.length === 0 && links.length === 0) return null

  const item = (key: string, i: number, child: React.ReactNode) => (
    <motion.li
      key={key}
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={reduce ? undefined : { opacity: 1, y: 0 }}
      transition={{ duration: 0.24, delay: reduce ? 0 : Math.min(i * 0.04, 0.3), ease: 'easeOut' }}
      className="relative overflow-hidden rounded-md border border-border-subtle bg-neutral-950"
    >
      {child}
    </motion.li>
  )

  let idx = 0

  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {/* Uploaded video files */}
      {uploaded.map((m) =>
        item(
          m.id,
          idx++,
          <>
            {/* Range-served by the media route, so the element can seek.
                preload=metadata keeps the list light until played. */}
            <video
              src={`/api/media/${m.id}`}
              controls
              preload="metadata"
              className="aspect-video w-full bg-neutral-950"
            />
            {onDeleteUploaded ? (
              <button
                type="button"
                aria-label="Delete video"
                title="Delete video"
                onClick={() => onDeleteUploaded(m.id)}
                className="absolute top-1.5 right-1.5 rounded bg-white/90 p-1 text-danger-700 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500"
              >
                <Trash2 className="size-3.5" aria-hidden="true" />
              </button>
            ) : null}
          </>,
        ),
      )}

      {/* External links */}
      {links.map((url) => {
        const v = parseVideoUrl(url)
        const key = `link:${url}`
        const isActive = activated.has(key)

        if (v.kind === 'youtube') {
          return item(
            key,
            idx++,
            isActive ? (
              <iframe
                src={`${v.embedUrl}&autoplay=1`}
                title="Property video"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="aspect-video w-full"
              />
            ) : (
              <button
                type="button"
                onClick={() => activate(key)}
                aria-label="Play video"
                className="group relative block aspect-video w-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
              >
                <img
                  src={v.thumbnailUrl}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover opacity-90 transition-opacity group-hover:opacity-100"
                />
                <span className="absolute inset-0 grid place-items-center">
                  <span className="grid size-14 place-items-center rounded-full bg-neutral-950/60 text-white transition-transform group-hover:scale-110">
                    <Play className="size-6 translate-x-0.5 fill-current" aria-hidden="true" />
                  </span>
                </span>
              </button>
            ),
          )
        }

        if (v.kind === 'vimeo') {
          return item(
            key,
            idx++,
            <iframe
              src={v.embedUrl}
              title="Property video"
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
              className="aspect-video w-full"
            />,
          )
        }

        if (v.kind === 'file') {
          return item(
            key,
            idx++,
            <video src={v.url} controls preload="metadata" className="aspect-video w-full bg-neutral-950" />,
          )
        }

        // Unknown host — link out rather than embed something we can't play.
        return item(
          key,
          idx++,
          <a
            href={v.url}
            target="_blank"
            rel="noreferrer"
            className="flex aspect-video w-full flex-col items-center justify-center gap-2 bg-surface-sunken text-sm text-text-secondary hover:text-text-primary"
          >
            <VideoIcon className="size-6 text-text-muted" aria-hidden="true" />
            <span className="inline-flex items-center gap-1">
              Open video <ExternalLink className="size-3.5" aria-hidden="true" />
            </span>
          </a>,
        )
      })}
    </ul>
  )
}
