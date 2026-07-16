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
