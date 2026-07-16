import { createReadStream } from 'node:fs'
import { Router } from 'express'
import { requirePermission } from '../middleware/authenticate.js'
import { idParamSchema } from '../lib/params.js'
import {
  deleteMedia,
  getMediaForDownload,
  mediaETag,
  setCover,
} from '../services/media-service.js'

// Top-level /api/media. Upload lives under /properties/:id/media (a media file
// is created in the context of a property); download, delete and set-cover
// address a file directly by its own id.
export const mediaRouter = Router()

// The authorized stream. Permission + scope, then the bytes. This route is the
// entire reason files are NOT served by express.static.
mediaRouter.get('/:id', requirePermission('property.media.download'), async (req, res) => {
  const { id } = idParamSchema.parse(req.params)
  const media = await getMediaForDownload(req.actor!, id)

  const etag = mediaETag(media.storageKey, media.sizeBytes)
  // Private: a shared cache must never hand one user's document to another.
  res.setHeader('Cache-Control', 'private, max-age=3600')
  res.setHeader('ETag', etag)
  if (req.headers['if-none-match'] === etag) {
    res.status(304).end()
    return
  }

  res.setHeader('Content-Type', media.mimeType)
  res.setHeader('Content-Length', String(media.sizeBytes))
  // inline for images, attachment for documents — a PDF shouldn't hijack the
  // tab, and the filename is sanitised to a header-safe form.
  const safeName = media.originalName.replace(/[^\w.\- ]/g, '_')
  const disposition = media.mimeType.startsWith('image/') ? 'inline' : 'attachment'
  res.setHeader('Content-Disposition', `${disposition}; filename="${safeName}"`)

  const stream = createReadStream(media.absolutePath)
  stream.on('error', () => {
    if (!res.headersSent) res.status(404).end()
    else res.destroy()
  })
  stream.pipe(res)
})

mediaRouter.delete('/:id', requirePermission('property.media.upload'), async (req, res) => {
  const { id } = idParamSchema.parse(req.params)
  await deleteMedia(req.actor!, id, req)
  res.status(204).end()
})

mediaRouter.post('/:id/cover', requirePermission('property.media.upload'), async (req, res) => {
  const { id } = idParamSchema.parse(req.params)
  await setCover(req.actor!, id)
  res.status(204).end()
})
