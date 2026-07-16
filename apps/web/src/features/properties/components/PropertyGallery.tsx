import { FileText, ImageOff, Loader2, Trash2, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { Can } from '@/components/auth/Can'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { usePermissions } from '@/features/auth/api/use-auth'
import { ImageGallery } from '@/features/properties/components/ImageGallery'
import { VideoGallery } from '@/features/properties/components/VideoGallery'
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

// The property media hub, used by BOTH the detail page and the edit form. It
// owns upload/delete/set-cover (through the authorized mutations) and now
// composes two distinct galleries:
//   • Images  — a responsive grid that opens a full-screen lightbox.
//   • Videos  — uploaded files + external links (YouTube/Vimeo), hidden entirely
//               when there are none.
// Every image/video src points at /api/media/:id — the authorized route. There
// is no path to tamper with, and an actor without property.media.download gets
// the honest "no permission" message rather than a wall of broken thumbnails.
export function PropertyGallery({
  propertyId,
  media,
  canDownload,
  videoLinks = [],
}: {
  propertyId: string
  media: MediaItem[]
  canDownload: boolean
  /** External video URLs stored on the property. Shown in the Video section on
   *  the detail page; the edit form manages them separately, so it passes []. */
  videoLinks?: string[]
}) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const { has } = usePermissions()
  const canManage = has('property.media.upload')

  const upload = useUploadMedia(propertyId)
  const remove = useDeleteMedia(propertyId)
  const setCover = useSetCover(propertyId)

  const images = media.filter((m) => m.type === 'IMAGE' || m.type === 'FLOOR_PLAN')
  const videos = media.filter((m) => m.type === 'VIDEO')
  const docs = media.filter((m) => m.type === 'DOCUMENT')
  const hasVideoSection = videos.length > 0 || videoLinks.length > 0
  const isEmpty = images.length === 0 && !hasVideoSection && docs.length === 0

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
      <Card.Body className="flex flex-col gap-6">
        {error ? (
          <p role="alert" className="text-xs text-danger-700">
            {error}
          </p>
        ) : null}

        {!canDownload ? (
          // Gated: this actor cannot fetch uploaded bytes. External links live on
          // the property record they can already read, so still show those.
          <>
            {videoLinks.length > 0 ? (
              <Section title="Property videos">
                <VideoGallery uploaded={[]} links={videoLinks} />
              </Section>
            ) : null}
            <p className="text-sm text-text-muted">
              You do not have permission to view files on this property.
            </p>
          </>
        ) : isEmpty ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <ImageOff className="size-6 text-text-muted" aria-hidden="true" />
            <p className="text-sm text-text-secondary">No media yet</p>
          </div>
        ) : (
          <>
            {images.length > 0 ? (
              <Section title="Images" count={images.length}>
                <ImageGallery
                  images={images}
                  onDelete={canManage ? (id) => remove.mutate(id) : undefined}
                  onSetCover={canManage ? (id) => setCover.mutate(id) : undefined}
                />
              </Section>
            ) : null}

            {hasVideoSection ? (
              <Section title="Property videos" count={videos.length + videoLinks.length}>
                <VideoGallery
                  uploaded={videos}
                  links={videoLinks}
                  onDeleteUploaded={canManage ? (id) => remove.mutate(id) : undefined}
                />
              </Section>
            ) : null}

            {docs.length > 0 ? (
              <Section title="Documents">
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
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label="Delete document"
                          onClick={() => remove.mutate(m.id)}
                        >
                          <Trash2 aria-hidden="true" />
                        </Button>
                      </Can>
                    </li>
                  ))}
                </ul>
              </Section>
            ) : null}
          </>
        )}
      </Card.Body>
    </Card>
  )
}

function Section({
  title,
  count,
  children,
}: {
  title: string
  count?: number
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-2.5">
      <h3 className="text-2xs font-semibold tracking-wide text-text-muted uppercase">
        {title}
        {count != null ? <span className="ml-1.5 text-text-muted/70">({count})</span> : null}
      </h3>
      {children}
    </section>
  )
}
