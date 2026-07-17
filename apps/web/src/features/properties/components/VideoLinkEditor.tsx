import { Play, Plus, Video as VideoIcon, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { parseVideoUrl } from '@/features/properties/lib/video-embed'

// Controlled editor for a property's external video links (YouTube / Vimeo /
// direct URLs). Value is a string[] owned by the parent form, mirroring how the
// AmenityPicker owns amenity ids — add, edit in place, remove, with a live
// preview so the admin sees what they pasted before saving. Empty rows are the
// caller's to trim on submit.
export function VideoLinkEditor({
  value,
  onChange,
}: {
  value: string[]
  onChange: (urls: string[]) => void
}) {
  const setAt = (i: number, url: string) => onChange(value.map((v, idx) => (idx === i ? url : v)))
  const removeAt = (i: number) => onChange(value.filter((_, idx) => idx !== i))
  const add = () => onChange([...value, ''])

  const isInvalid = (url: string) => {
    const t = url.trim()
    if (!t) return false
    try {
      new URL(t)
      return false
    } catch {
      return true
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {value.map((url, i) => {
        const trimmed = url.trim()
        const invalid = isInvalid(url)
        const parsed = trimmed && !invalid ? parseVideoUrl(trimmed) : null
        return (
          <div key={i} className="flex items-start gap-2">
            {/* Preview: YouTube poster, otherwise a kind-appropriate icon. */}
            <div className="mt-0.5 grid size-12 shrink-0 place-items-center overflow-hidden rounded border border-border-subtle bg-surface-sunken">
              {parsed?.kind === 'youtube' ? (
                <div className="relative size-full">
                  <img src={parsed.thumbnailUrl} alt="" className="size-full object-cover" />
                  <span className="absolute inset-0 grid place-items-center">
                    <Play className="size-4 fill-white text-white drop-shadow" aria-hidden="true" />
                  </span>
                </div>
              ) : (
                <VideoIcon className="size-5 text-text-muted" aria-hidden="true" />
              )}
            </div>

            <div className="flex-1">
              <Input
                value={url}
                onChange={(e) => setAt(i, e.target.value)}
                inputMode="url"
                aria-label={`Video link ${i + 1}`}
                aria-invalid={invalid || undefined}
                placeholder="https://youtube.com/watch?v=…"
              />
              {invalid ? (
                <p className="mt-1 text-xs text-text-danger">Enter a valid URL, e.g. https://…</p>
              ) : parsed ? (
                <p className="mt-1 text-2xs text-text-muted">
                  {parsed.kind === 'youtube'
                    ? 'YouTube video'
                    : parsed.kind === 'vimeo'
                      ? 'Vimeo video'
                      : parsed.kind === 'file'
                        ? 'Direct video file'
                        : 'External link'}
                </p>
              ) : null}
            </div>

            <button
              type="button"
              aria-label={`Remove video link ${i + 1}`}
              onClick={() => removeAt(i)}
              className="mt-1.5 rounded p-1.5 text-text-muted hover:bg-surface-hover hover:text-text-danger focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        )
      })}

      <div>
        <Button type="button" variant="secondary" size="sm" onClick={add}>
          <Plus aria-hidden="true" />
          Add video link
        </Button>
      </div>
    </div>
  )
}
