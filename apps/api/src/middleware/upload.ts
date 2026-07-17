import multer from 'multer'
import type { RequestHandler } from 'express'
import { AppError } from '../lib/errors.js'
import { isAllowedMime, MAX_FILE_BYTES, MAX_FILES_PER_REQUEST } from '../services/media-service.js'

// memoryStorage, not diskStorage: the service owns the filename (a cuid, never
// the client's), the destination path, and the MIME re-check. Letting multer
// write to disk would mean trusting its filename logic and cleaning up files
// for requests that later fail validation. Buffering ≤10 MB is cheap; control
// is not.
const storage = multer.memoryStorage()

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_BYTES,
    files: MAX_FILES_PER_REQUEST,
  },
  fileFilter: (_req, file, cb) => {
    // First gate. The service re-checks — a fileFilter runs on the declared
    // mimetype, which the client controls, so it is necessary but not
    // sufficient.
    if (!isAllowedMime(file.mimetype)) {
      cb(new AppError('VALIDATION_FAILED', 400, `Unsupported file type: ${file.mimetype}`))
      return
    }
    cb(null, true)
  },
})

/** Translate multer's own errors into our envelope instead of a raw 500. */
export const uploadMedia: RequestHandler = (req, res, next) => {
  upload.array('files', MAX_FILES_PER_REQUEST)(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      const message =
        err.code === 'LIMIT_FILE_SIZE'
          ? 'A file exceeds the 10 MB limit'
          : err.code === 'LIMIT_FILE_COUNT'
            ? `At most ${MAX_FILES_PER_REQUEST} files per upload`
            : err.message
      next(new AppError('VALIDATION_FAILED', 400, message))
      return
    }
    next(err)
  })
}

// A single branding image (logo / favicon). Small cap — these are icons, not
// media. The service re-validates the MIME strictly (SVG is refused: it carries
// script); this filter is the cheap first gate.
export const BRANDING_MAX_BYTES = 2 * 1024 * 1024
const brandingUpload = multer({
  storage,
  limits: { fileSize: BRANDING_MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ok = /^image\/(png|jpeg|webp|x-icon|vnd\.microsoft\.icon)$/.test(file.mimetype)
    if (!ok) {
      cb(new AppError('VALIDATION_FAILED', 400, `Unsupported image type: ${file.mimetype}`))
      return
    }
    cb(null, true)
  },
})

export const uploadBrandingImage: RequestHandler = (req, res, next) => {
  brandingUpload.single('file')(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      const message =
        err.code === 'LIMIT_FILE_SIZE' ? 'The image exceeds the 2 MB limit' : err.message
      next(new AppError('VALIDATION_FAILED', 400, message))
      return
    }
    next(err)
  })
}
