import { FileText, ImageOff, Loader2, Star, Trash2, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { Can } from '@/components/auth/Can'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import {
  useDeleteMedia,
  useSetCover,
  useUploadMedia,
} from '@/features/properties/api/use-property-mutations'
import { cn } from '@/lib/cn'

interface MediaItem {
  id: string
  type: string
  isCover: boolean
}

// Every image src points at /api/media/:id — the authorized route. There is no
// path here to tamper with, and an agent without property.media.download gets a
// broken image rather than a leaked file (the server 404s).
export function PropertyGallery({
  propertyId,
  media,
  canDownload,
}: {
  propertyId: string
  media: MediaItem[]
  canDownload: boolean
}) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const upload = useUploadMedia(propertyId)
  const remove = useDeleteMedia(propertyId)
  const setCover = useSetCover(propertyId)

  const images = media.filter((m) => m.type === 'IMAGE' || m.type === 'FLOOR_PLAN')
  const videos = media.filter((m) => m.type === 'VIDEO')
  const docs = media.filter((m) => m.type === 'DOCUMENT')
  const isEmpty = images.length === 0 && videos.length === 0 && docs.length === 0

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return
    setError(null)
    try {
      await upload.mutateAsync(files)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  return (
    <Card>
      <Card.Header
        action={
          <Can permission="property.media.upload">
            <>
              <input
                ref={fileInput}
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf,video/mp4,video/webm,video/quicktime"
                multiple
                className="sr-only"
                onChange={(e) => void onFiles(e.target.files)}
              />
              <Button
                variant="secondary"
                size="sm"
                disabled={upload.isPending}
                onClick={() => fileInput.current?.click()}
              >
                {upload.isPending ? (
                  <>
                    <Loader2 className="animate-spin" aria-hidden="true" />
                    Uploading…
                  </>
                ) : (
                  <>
                    <Upload aria-hidden="true" />
                    Upload
                  </>
                )}
              </Button>
            </>
          </Can>
        }
      >
        <Card.Title>Media</Card.Title>
        <Card.Description>
          Images (JPEG/PNG/WebP) & PDF up to 10 MB · video (MP4/WebM/MOV) up to 100 MB.
        </Card.Description>
      </Card.Header>
      <Card.Body className="flex flex-col gap-4">
        {error ? (
          <p role="alert" className="text-xs text-danger-700">
            {error}
          </p>
        ) : null}

        {!canDownload ? (
          // The permission that gates viewing the bytes. Honest about why the
          // grid is empty rather than showing broken images.
          <p className="text-sm text-text-muted">
            You do not have permission to view files on this property.
          </p>
        ) : isEmpty ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <ImageOff className="size-6 text-text-muted" aria-hidden="true" />
            <p className="text-sm text-text-secondary">No media yet</p>
          </div>
        ) : (
          <>
            {images.length > 0 ? (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {images.map((m) => (
                  <li key={m.id} className="group relative overflow-hidden rounded-md border border-border-subtle">
                    <img
                      src={`/api/media/${m.id}`}
                      alt=""
                      loading="lazy"
                      className="aspect-[4/3] w-full object-cover"
                    />
                    {m.isCover ? (
                      <span className="absolute top-1.5 left-1.5 rounded bg-neutral-950/70 px-1.5 py-0.5 text-2xs font-medium text-white">
                        Cover
                      </span>
                    ) : null}
                    <Can permission="property.media.upload">
                      <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1 bg-gradient-to-t from-neutral-950/60 to-transparent p-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                        {!m.isCover && m.type === 'IMAGE' ? (
                          <button
                            type="button"
                            aria-label="Set as cover"
                            title="Set as cover"
                            onClick={() => setCover.mutate(m.id)}
                            className="rounded bg-white/90 p-1 text-neutral-800 hover:bg-white"
                          >
                            <Star className="size-3.5" aria-hidden="true" />
                          </button>
                        ) : null}
                        <button
                          type="button"
                          aria-label="Delete"
                          title="Delete"
                          onClick={() => remove.mutate(m.id)}
                          className="rounded bg-white/90 p-1 text-danger-700 hover:bg-white"
                        >
                          <Trash2 className="size-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </Can>
                  </li>
                ))}
              </ul>
            ) : null}

            {videos.length > 0 ? (
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {videos.map((m) => (
                  <li key={m.id} className="relative overflow-hidden rounded-md border border-border-subtle">
                    {/* Served through the authorized range-capable route, so the
                        <video> element can seek. preload=metadata keeps the list
                        light until played. */}
                    <video
                      src={`/api/media/${m.id}`}
                      controls
                      preload="metadata"
                      className="aspect-video w-full bg-neutral-950"
                    />
                    <Can permission="property.media.upload">
                      <button
                        type="button"
                        aria-label="Delete video"
                        title="Delete video"
                        onClick={() => remove.mutate(m.id)}
                        className="absolute top-1.5 right-1.5 rounded bg-white/90 p-1 text-danger-700 hover:bg-white"
                      >
                        <Trash2 className="size-3.5" aria-hidden="true" />
                      </button>
                    </Can>
                  </li>
                ))}
              </ul>
            ) : null}

            {docs.length > 0 ? (
              <ul className="flex flex-col gap-1.5">
                {docs.map((m) => (
                  <li key={m.id} className="flex items-center gap-2">
                    <a
                      href={`/api/media/${m.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className={cn(
                        'flex flex-1 items-center gap-2 rounded-md border border-border-subtle px-3 py-2',
                        'text-sm text-text-secondary hover:bg-surface-hover hover:text-text-primary',
                      )}
                    >
                      <FileText className="size-4 shrink-0 text-text-muted" aria-hidden="true" />
                      Document
                    </a>
                    <Can permission="property.media.upload">
                      <Button variant="ghost" size="sm" aria-label="Delete document" onClick={() => remove.mutate(m.id)}>
                        <Trash2 aria-hidden="true" />
                      </Button>
                    </Can>
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        )}
      </Card.Body>
    </Card>
  )
}
