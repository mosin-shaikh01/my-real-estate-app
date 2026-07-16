import * as DialogPrimitive from '@radix-ui/react-dialog'
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useCallback, useEffect, useState } from 'react'

// Full-screen image viewer.
//
// Radix Dialog carries the accessibility load — focus trap, scroll lock, Esc,
// and the role/aria wiring — so we never hand-roll a modal. Framer Motion owns
// the entrance/exit and the slide between images (overlays are exactly where the
// design system says motion belongs). Arrow-key navigation and click-to-zoom are
// layered on top.

interface Props {
  images: Array<{ id: string }>
  index: number
  onIndexChange: (i: number) => void
  onClose: () => void
}

export function ImageLightbox({ images, index, onIndexChange, onClose }: Props) {
  const reduce = useReducedMotion()
  const [zoomed, setZoomed] = useState(false)
  const count = images.length

  const go = useCallback(
    (delta: number) => {
      setZoomed(false)
      onIndexChange((index + delta + count) % count)
    },
    [index, count, onIndexChange],
  )

  // Esc is handled by Radix; the arrows are ours. Re-bound whenever `go`
  // changes so it always closes over the current index.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(1)
      else if (e.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go])

  const current = images[index]
  if (!current) return null

  const fade = reduce ? {} : { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }

  return (
    <DialogPrimitive.Root open onOpenChange={(o) => !o && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay asChild>
          <motion.div {...fade} transition={{ duration: 0.18 }} className="fixed inset-0 z-[60] bg-neutral-950/90 backdrop-blur-sm" />
        </DialogPrimitive.Overlay>

        <DialogPrimitive.Content
          aria-label={`Image ${index + 1} of ${count}`}
          className="fixed inset-0 z-[60] flex flex-col outline-none"
          // Radix would otherwise move focus to the first child (a nav button);
          // keep focus on the container so arrow keys work immediately.
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogPrimitive.Title className="sr-only">Property image viewer</DialogPrimitive.Title>

          {/* Top bar: counter + zoom + close */}
          <div className="flex items-center justify-between gap-3 p-4 text-white">
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium tabular-nums">
              {index + 1} / {count}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label={zoomed ? 'Zoom out' : 'Zoom in'}
                onClick={() => setZoomed((z) => !z)}
                className="rounded-full p-2 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                {zoomed ? <ZoomOut className="size-5" aria-hidden="true" /> : <ZoomIn className="size-5" aria-hidden="true" />}
              </button>
              <DialogPrimitive.Close
                aria-label="Close"
                className="rounded-full p-2 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                <X className="size-5" aria-hidden="true" />
              </DialogPrimitive.Close>
            </div>
          </div>

          {/* Stage */}
          <div className="relative flex flex-1 items-center justify-center overflow-hidden px-2 pb-4 sm:px-14">
            {count > 1 ? (
              <button
                type="button"
                aria-label="Previous image"
                onClick={() => go(-1)}
                className="absolute left-2 z-10 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:left-4"
              >
                <ChevronLeft className="size-6" aria-hidden="true" />
              </button>
            ) : null}

            <AnimatePresence mode="popLayout" initial={false}>
              <motion.img
                key={current.id}
                src={`/api/media/${current.id}`}
                alt=""
                initial={reduce ? undefined : { opacity: 0, scale: 0.98 }}
                animate={reduce ? undefined : { opacity: 1, scale: 1 }}
                exit={reduce ? undefined : { opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                onClick={() => setZoomed((z) => !z)}
                className={`max-h-full max-w-full rounded-md object-contain select-none ${
                  zoomed ? 'scale-150 cursor-zoom-out' : 'cursor-zoom-in'
                } transition-transform duration-200`}
                draggable={false}
              />
            </AnimatePresence>

            {count > 1 ? (
              <button
                type="button"
                aria-label="Next image"
                onClick={() => go(1)}
                className="absolute right-2 z-10 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:right-4"
              >
                <ChevronRight className="size-6" aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
