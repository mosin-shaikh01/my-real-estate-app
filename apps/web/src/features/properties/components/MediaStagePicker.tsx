import { FileText, Upload, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'

// Staged media for the CREATE form: a new property has no id yet, so files are
// held locally with object-URL previews and uploaded once the property exists.
// Mirrors the accept list and caps the server enforces, so a bad file is caught
// before the round trip (the server re-validates regardless).

const ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf,video/mp4,video/webm,video/quicktime'
const IMAGE_MAX = 10 * 1024 * 1024
const VIDEO_MAX = 100 * 1024 * 1024

function validate(file: File): string | null {
  const type = file.type
  const allowed = ACCEPT.split(',')
  if (!allowed.includes(type)) return `${file.name}: unsupported type`
  const cap = type.startsWith('video/') ? VIDEO_MAX : IMAGE_MAX
  if (file.size > cap) {
    return `${file.name}: exceeds ${Math.round(cap / 1024 / 1024)} MB`
  }
  return null
}

export function MediaStagePicker({
  files,
  onChange,
}: {
  files: File[]
  onChange: (files: File[]) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)

  // Object URLs for previews — revoked on change/unmount so we don't leak them.
  const previews = useMemo(
    () => files.map((f) => ({ file: f, url: URL.createObjectURL(f) })),
    [files],
  )
  useEffect(() => () => previews.forEach((p) => URL.revokeObjectURL(p.url)), [previews])

  const add = (list: FileList | null) => {
    if (!list?.length) return
    setError(null)
    const incoming = Array.from(list)
    for (const f of incoming) {
      const err = validate(f)
      if (err) {
        setError(err)
        return
      }
    }
    onChange([...files, ...incoming])
    if (inputRef.current) inputRef.current.value = ''
  }

  const removeAt = (i: number) => onChange(files.filter((_, idx) => idx !== i))

  return (
    <div className="flex flex-col gap-3">
      <div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="sr-only"
          onChange={(e) => add(e.target.files)}
        />
        <Button variant="secondary" size="sm" onClick={() => inputRef.current?.click()}>
          <Upload aria-hidden="true" />
          Add images or video
        </Button>
      </div>

      {error ? (
        <p role="alert" className="text-xs text-danger-700">
          {error}
        </p>
      ) : null}

      {previews.length > 0 ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {previews.map((p, i) => (
            <li key={p.url} className="group relative overflow-hidden rounded-md border border-border-subtle">
              {p.file.type.startsWith('image/') ? (
                <img src={p.url} alt="" className="aspect-[4/3] w-full object-cover" />
              ) : p.file.type.startsWith('video/') ? (
                <video src={p.url} className="aspect-[4/3] w-full bg-neutral-950 object-cover" muted />
              ) : (
                <div className="flex aspect-[4/3] w-full items-center justify-center bg-surface-sunken">
                  <FileText className="size-6 text-text-muted" aria-hidden="true" />
                </div>
              )}
              <button
                type="button"
                aria-label={`Remove ${p.file.name}`}
                onClick={() => removeAt(i)}
                className="absolute top-1.5 right-1.5 rounded bg-white/90 p-1 text-danger-700 hover:bg-white"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
              <span className="block truncate bg-surface-raised px-1.5 py-1 text-2xs text-text-muted">
                {p.file.name}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-text-muted">
          No media staged. Images/PDF up to 10 MB, video up to 100 MB. Uploaded when you create the
          property.
        </p>
      )}
    </div>
  )
}
