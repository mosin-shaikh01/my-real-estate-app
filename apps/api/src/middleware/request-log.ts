import type { RequestHandler } from 'express'

// Structured JSON, one line per request. requestId is echoed in the error
// envelope, so a user-reported failure maps back to a log line.
//
// This is NOT ActivityLog. That is a product feature with a different audience
// and a different retention policy. Don't conflate them.
export const requestLog: RequestHandler = (req, res, next) => {
  const start = performance.now()
  res.on('finish', () => {
    console.log(
      JSON.stringify({
        level: res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
        requestId: req.requestId,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        ms: Math.round(performance.now() - start),
        actorUserId: req.actor?.userId ?? null,
      }),
    )
  })
  next()
}
