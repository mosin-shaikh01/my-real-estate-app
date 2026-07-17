import { ImageIcon, Loader2, Trash2, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import type { BrandingAsset } from '@app/shared'
import { Button } from '@/components/ui/Button'
import { useDeleteBrandingAsset, useUploadBrandingAsset } from '@/features/settings/api/use-settings'

const ACCEPT = 'image/png,image/jpeg,image/webp,image/x-icon'
const MAX_BYTES = 2 * 1024 * 1024

// Logo / favicon uploader with live preview, replace and remove. The server
// re-validates type and size; this is the fast client-side gate. Bytes come from
// the versioned /api/settings/{asset} URL, so a replacement busts the cache.
export function AssetUpload({
  asset,
  currentUrl,
  label,
  hint,
}: {
  asset: BrandingAsset
  currentUrl: string | null
  label: string
  hint?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const upload = useUploadBrandingAsset(asset)
  const remove = useDeleteBrandingAsset(asset)

  const onFile = async (file: File | undefined) => {
    if (!file) return
    setError(null)
    if (!ACCEPT.split(',').includes(file.type)) {
      setError('Use a PNG, JPEG, WebP or ICO image.')
      return
    }
    if (file.size > MAX_BYTES) {
      setError('The image exceeds the 2 MB limit.')
      return
    }
    try {
      await upload.mutateAsync(file)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const busy = upload.isPending || remove.isPending

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-text-secondary">{label}</span>
      <div className="flex items-center gap-3">
        <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-md border border-border-subtle bg-surface-sunken">
          {currentUrl ? (
            <img src={currentUrl} alt={`${label} preview`} className="size-full object-contain p-1" />
          ) : (
            <ImageIcon className="size-5 text-text-muted" aria-hidden="true" />
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              className="sr-only"
              onChange={(e) => void onFile(e.target.files?.[0])}
            />
            <Button variant="secondary" size="sm" disabled={busy} onClick={() => inputRef.current?.click()}>
              {upload.isPending ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden="true" />
                  Uploading…
                </>
              ) : (
                <>
                  <Upload aria-hidden="true" />
                  {currentUrl ? 'Replace' : 'Upload'}
                </>
              )}
            </Button>
            {currentUrl ? (
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => void remove.mutateAsync().catch(() => setError('Could not remove'))}
              >
                <Trash2 aria-hidden="true" />
                Remove
              </Button>
            ) : null}
          </div>
          {hint ? <p className="text-2xs text-text-muted">{hint}</p> : null}
        </div>
      </div>
      {error ? (
        <p role="alert" className="text-xs text-text-danger">
          {error}
        </p>
      ) : null}
    </div>
  )
}
