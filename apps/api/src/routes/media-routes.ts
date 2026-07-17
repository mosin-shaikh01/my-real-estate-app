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
//
// Supports HTTP range requests (206 Partial Content) — a <video> element needs
// them to seek and, in some browsers, to play at all. Images and PDFs just get
// the whole body.
mediaRouter.get('/:id', requirePermission('property.media.download'), async (req, res) => {
  const { id } = idParamSchema.parse(req.params)
  const media = await getMediaForDownload(req.actor!, id)

  const etag = mediaETag(media.storageKey, media.sizeBytes)
  // Private: a shared cache must never hand one user's document to another.
  res.setHeader('Cache-Control', 'private, max-age=3600')
  res.setHeader('ETag', etag)
  res.setHeader('Accept-Ranges', 'bytes')
  if (req.headers['if-none-match'] === etag) {
    res.status(304).end()
    return
  }

  res.setHeader('Content-Type', media.mimeType)
  const isImage = media.mimeType.startsWith('image/')
  const isVideo = media.mimeType.startsWith('video/')
  // inline for playable/viewable media, attachment for documents — a PDF
  // shouldn't hijack the tab. The filename is sanitised to a header-safe form.
  const safeName = media.originalName.replace(/[^\w.\- ]/g, '_')
  res.setHeader(
    'Content-Disposition',
    `${isImage || isVideo ? 'inline' : 'attachment'}; filename="${safeName}"`,
  )

  const total = media.sizeBytes
  const range = req.headers.range

  // Honour a Range request: parse "bytes=start-end", clamp, and 206 the slice.
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range)
    if (!match) {
      res.status(416).setHeader('Content-Range', `bytes */${total}`).end()
      return
    }
    const start = match[1] ? Number(match[1]) : 0
    const end = match[2] ? Number(match[2]) : total - 1
    if (start > end || end >= total) {
      res.status(416).setHeader('Content-Range', `bytes */${total}`).end()
      return
    }
    res.status(206)
    res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`)
    res.setHeader('Content-Length', String(end - start + 1))
    const stream = createReadStream(media.absolutePath, { start, end })
    stream.on('error', () => {
      if (!res.headersSent) res.status(404).end()
      else res.destroy()
    })
    stream.pipe(res)
    return
  }

  res.setHeader('Content-Length', String(total))
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
