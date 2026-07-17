import { Star, Trash2 } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useState } from 'react'
import { ImageLightbox } from '@/features/properties/components/ImageLightbox'

export interface GalleryImage {
  id: string
  type: string
  isCover: boolean
}

// Responsive image grid that opens a full-screen lightbox on click. Bytes always
// come from the authorized /api/media/:id route (never a client-built path), and
// every thumbnail is lazy-loaded so a 30-image listing doesn't block first paint.
// Management (set-cover / delete) is opt-in: the detail page and the edit form
// both pass handlers; a read-only viewer passes none and sees a clean gallery.
export function ImageGallery({
  images,
  onDelete,
  onSetCover,
}: {
  images: GalleryImage[]
  onDelete?: (id: string) => void
  onSetCover?: (id: string) => void
}) {
  const reduce = useReducedMotion()
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  if (images.length === 0) return null

  return (
    <>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {images.map((m, i) => (
          <motion.li
            key={m.id}
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={reduce ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.24, delay: reduce ? 0 : Math.min(i * 0.03, 0.3), ease: 'easeOut' }}
            className="group relative overflow-hidden rounded-md border border-border-subtle"
          >
            <button
              type="button"
              onClick={() => setLightboxIndex(i)}
              aria-label={`Open image ${i + 1} of ${images.length}`}
              className="block w-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            >
              <img
                src={`/api/media/${m.id}`}
                alt=""
                loading="lazy"
                className="aspect-[4/3] w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
              />
            </button>

            {m.isCover ? (
              <span className="pointer-events-none absolute top-1.5 left-1.5 rounded bg-neutral-950/70 px-1.5 py-0.5 text-2xs font-medium text-white">
                Cover
              </span>
            ) : null}

            {onDelete || onSetCover ? (
              <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1 bg-gradient-to-t from-neutral-950/60 to-transparent p-1.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                {onSetCover && !m.isCover && m.type === 'IMAGE' ? (
                  <button
                    type="button"
                    aria-label="Set as cover"
                    title="Set as cover"
                    // Stop the click from bubbling to the tile button (which would
                    // open the lightbox instead of setting the cover).
                    onClick={(e) => {
                      e.stopPropagation()
                      onSetCover(m.id)
                    }}
                    className="rounded bg-white/90 p-1 text-neutral-800 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500"
                  >
                    <Star className="size-3.5" aria-hidden="true" />
                  </button>
                ) : null}
                {onDelete ? (
                  <button
                    type="button"
                    aria-label="Delete image"
                    title="Delete"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDelete(m.id)
                    }}
                    className="rounded bg-white/90 p-1 text-danger-700 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500"
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                  </button>
                ) : null}
              </div>
            ) : null}
          </motion.li>
        ))}
      </ul>

      {lightboxIndex !== null ? (
        <ImageLightbox
          images={images}
          index={lightboxIndex}
          onIndexChange={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      ) : null}
    </>
  )
}
