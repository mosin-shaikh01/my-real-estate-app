import { Download, Eye, FileText, Loader2, Trash2, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { DOCUMENT_TYPE_LABELS, type DocumentType } from '@app/shared'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Select } from '@/components/ui/Select'
import { cn } from '@/lib/cn'
import {
  useDeleteMedia,
  useUploadDocument,
} from '@/features/properties/api/use-property-documents'

interface PropertyDocument {
  id: string
  documentType: string | null
  originalName: string
  mimeType: string
  sizeBytes: number
  createdAt: string
}

const TYPE_OPTIONS = Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => ({ value, label }))

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

// Documents manager for a property: categorised upload + list with preview,
// download and delete. Viewing needs property.media.download; managing needs
// property.media.upload (`canManage`).
export function PropertyDocuments({
  propertyId,
  documents,
  canManage,
}: {
  propertyId: string
  documents: PropertyDocument[]
  canManage: boolean
}) {
  const upload = useUploadDocument(propertyId)
  const del = useDeleteMedia(propertyId)
  const fileRef = useRef<HTMLInputElement>(null)
  const [docType, setDocType] = useState<DocumentType>('SALE_DEED')
  const [error, setError] = useState<string | null>(null)

  async function onFile(file: File | undefined) {
    if (!file) return
    setError(null)
    try {
      await upload.mutateAsync({ file, documentType: docType })
      if (fileRef.current) fileRef.current.value = ''
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    }
  }

  return (
    <Card>
      <Card.Header>
        <Card.Title className="flex items-center gap-1.5">
          <FileText className="size-4 text-text-muted" aria-hidden="true" />
          Documents
        </Card.Title>
        <Card.Description>Sale deed, 7/12 extract, NA order, layout plan, receipts…</Card.Description>
      </Card.Header>
      <Card.Body className="flex flex-col gap-4">
        {canManage ? (
          <div className="flex flex-col gap-2 rounded-md border border-border-subtle bg-surface p-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="mb-1 block text-2xs font-medium text-text-secondary">Document type</label>
              <Select
                options={TYPE_OPTIONS}
                value={docType}
                onChange={(e) => setDocType(e.target.value as DocumentType)}
              />
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(e) => onFile(e.target.files?.[0])}
            />
            <Button
              variant="secondary"
              onClick={() => fileRef.current?.click()}
              disabled={upload.isPending}
            >
              {upload.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Upload aria-hidden="true" />}
              Upload
            </Button>
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="rounded-md border border-border-danger-soft bg-surface-danger-soft/40 px-3 py-2 text-xs text-text-danger">
            {error}
          </p>
        ) : null}

        {documents.length === 0 ? (
          <p className="py-6 text-center text-xs text-text-muted">No documents uploaded yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border-subtle">
            {documents.map((d) => (
              <li key={d.id} className="flex items-center gap-3 py-2.5">
                <FileText className="size-4 shrink-0 text-text-muted" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text-primary">{d.originalName}</p>
                  <p className="text-2xs text-text-muted">
                    <span className="rounded-full bg-surface-hover px-1.5 py-0.5 font-medium text-text-secondary">
                      {d.documentType ? DOCUMENT_TYPE_LABELS[d.documentType as DocumentType] : 'Document'}
                    </span>
                    <span className="ml-2">{humanSize(d.sizeBytes)}</span>
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <a
                    href={`/api/media/${d.id}?disposition=inline`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-text-secondary hover:bg-surface-hover hover:text-text-primary"
                    title="Preview"
                  >
                    <Eye className="size-3.5" aria-hidden="true" />
                    <span className="hidden sm:inline">Preview</span>
                  </a>
                  <a
                    href={`/api/media/${d.id}`}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-text-secondary hover:bg-surface-hover hover:text-text-primary"
                    title="Download"
                  >
                    <Download className="size-3.5" aria-hidden="true" />
                    <span className="hidden sm:inline">Download</span>
                  </a>
                  {canManage ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Delete "${d.originalName}"?`)) void del.mutate(d.id)
                      }}
                      disabled={del.isPending}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs',
                        'text-text-secondary hover:bg-surface-danger-soft/40 hover:text-text-danger',
                      )}
                      title="Delete"
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card.Body>
    </Card>
  )
}
