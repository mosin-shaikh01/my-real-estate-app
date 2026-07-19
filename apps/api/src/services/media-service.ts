import { createHash, randomUUID } from 'node:crypto'
import { mkdir, unlink } from 'node:fs/promises'
import path from 'node:path'
import type { Request } from 'express'
import type { DocumentType } from '@app/shared'
import type { Actor } from '../auth/permissions.js'
import { scopeForProperty } from '../auth/scope.js'
import { env } from '../lib/env.js'
import { forbidden, notFound, validationFailed } from '../lib/errors.js'
import { prisma } from '../lib/prisma.js'
import { logActivityTx } from './activity-service.js'

// ============================================================================
// Media
// ============================================================================
// Files are served through GET /api/media/:id, NEVER express.static. There is a
// property.media.download permission and internalNotes-grade confidentiality on
// documents; static hosting would make every uploaded file world-readable to
// anyone with a URL and invalidate the entire RBAC design.
// ============================================================================

type MediaCategory = 'IMAGE' | 'DOCUMENT' | 'VIDEO'

// MIME allowlist. The uploaded file's declared type is not trusted for anything
// but this lookup — an entry missing here is rejected outright. SVG is
// deliberately absent (it carries script). Videos are allowed as a curated set
// of container formats browsers can play natively via <video>.
const ALLOWED_MIME: Record<string, { ext: string; category: MediaCategory }> = {
  'image/jpeg': { ext: '.jpg', category: 'IMAGE' },
  'image/png': { ext: '.png', category: 'IMAGE' },
  'image/webp': { ext: '.webp', category: 'IMAGE' },
  'application/pdf': { ext: '.pdf', category: 'DOCUMENT' },
  'video/mp4': { ext: '.mp4', category: 'VIDEO' },
  'video/webm': { ext: '.webm', category: 'VIDEO' },
  'video/quicktime': { ext: '.mov', category: 'VIDEO' },
}

// Per-CATEGORY size caps. Video is inherently larger, so it gets its own limit
// rather than forcing images up to a video-sized ceiling. multer's global limit
// (upload middleware) must be the LARGEST of these; the service re-checks each
// file against its category cap. Production video needs transcoding + a CDN;
// this is direct upload with range-served playback, sufficient for the demo.
const MAX_BYTES_BY_CATEGORY: Record<MediaCategory, number> = {
  IMAGE: 10 * 1024 * 1024, // 10 MB
  DOCUMENT: 10 * 1024 * 1024, // 10 MB
  VIDEO: 100 * 1024 * 1024, // 100 MB
}

/** The largest cap — what multer's global fileSize limit must allow. */
export const MAX_FILE_BYTES = Math.max(...Object.values(MAX_BYTES_BY_CATEGORY))
export const MAX_FILES_PER_REQUEST = 12

export function isAllowedMime(mime: string): boolean {
  return mime in ALLOWED_MIME
}

/** Absolute root, resolved once. Everything else is validated against it. */
const UPLOAD_ROOT = path.resolve(env.UPLOAD_DIR)

export async function ensureUploadRoot() {
  await mkdir(UPLOAD_ROOT, { recursive: true })
}

/**
 * Resolve a stored relative key to an absolute path, refusing anything that
 * escapes the upload root.
 *
 * We generate every storageKey ourselves (cuid + allow-listed extension), so a
 * traversal sequence should be impossible — but "should be" is not a security
 * control. This check is: even if a `../../etc/passwd` key ever reached the DB,
 * it cannot be read. Defence at the boundary, not trust in the writer.
 */
export function resolveStorageKey(storageKey: string): string {
  const abs = path.resolve(UPLOAD_ROOT, storageKey)
  if (abs !== UPLOAD_ROOT && !abs.startsWith(UPLOAD_ROOT + path.sep)) {
    throw forbidden('Invalid media path')
  }
  return abs
}

export interface UploadedFile {
  originalname: string
  mimetype: string
  size: number
  buffer: Buffer
}

/**
 * Persist uploaded files for a property the actor may write to.
 *
 * Scope is checked first: an agent uploading to a property they cannot see must
 * get the same 404 as a genuine absence, not a permission error that confirms
 * the property exists.
 */
export interface SaveMediaOptions {
  markAsFloorPlan?: boolean
  /** Applied to DOCUMENT-category files only (Sale Deed, 7/12…). */
  documentType?: DocumentType | null
}

export async function saveMedia(
  actor: Actor,
  propertyId: string,
  files: UploadedFile[],
  opts: SaveMediaOptions,
  req: Request,
) {
  const property = await prisma.property.findFirst({
    where: { ...scopeForProperty(actor), id: propertyId },
    select: { id: true, code: true, _count: { select: { media: true } } },
  })
  if (!property) throw notFound('Property not found')

  for (const f of files) {
    const spec = ALLOWED_MIME[f.mimetype]
    if (!spec) {
      throw validationFailed({
        files: [`${f.originalname}: only JPEG, PNG, WebP, PDF and MP4/WebM/MOV video are allowed`],
      })
    }
    const cap = MAX_BYTES_BY_CATEGORY[spec.category]
    if (f.size > cap) {
      throw validationFailed({
        files: [`${f.originalname}: exceeds the ${Math.round(cap / 1024 / 1024)} MB limit for ${spec.category.toLowerCase()}s`],
      })
    }
  }

  const dir = path.join(UPLOAD_ROOT, 'properties', propertyId)
  await mkdir(dir, { recursive: true })

  const { writeFile } = await import('node:fs/promises')
  const created: Array<{ id: string; type: string; originalName: string; isCover: boolean }> = []
  let sortOrder = property._count.media
  const hadNoMedia = property._count.media === 0

  for (const f of files) {
    const spec = ALLOWED_MIME[f.mimetype]!
    // The filename is OURS, never the client's. originalname is stored only as
    // a display label; it is never part of a path.
    const storageKey = path.posix.join('properties', propertyId, `${randomUUID()}${spec.ext}`)
    await writeFile(resolveStorageKey(storageKey), f.buffer)

    const category =
      opts.markAsFloorPlan && spec.category === 'IMAGE' ? 'FLOOR_PLAN' : spec.category

    const media = await prisma.propertyMedia.create({
      data: {
        propertyId,
        type: category,
        // Categorise documents (Sale Deed, 7/12…); ignored for non-documents.
        documentType: category === 'DOCUMENT' ? (opts.documentType ?? null) : null,
        storageKey,
        originalName: f.originalname.slice(0, 255),
        mimeType: f.mimetype,
        sizeBytes: f.size,
        sortOrder: sortOrder++,
        // First image on a previously-media-less property becomes the cover.
        isCover: hadNoMedia && created.length === 0 && spec.category === 'IMAGE',
        uploadedById: actor.userId,
      },
      select: { id: true, type: true, originalName: true, isCover: true },
    })
    created.push(media)
  }

  await logActivityTx(prisma, {
    actorUserId: actor.userId,
    action: 'property.media.uploaded',
    entityType: 'property',
    entityId: propertyId,
    summary: `Uploaded ${created.length} file(s) to ${property.code}`,
    req,
  })

  return created
}

/** For the streaming route: the DB row plus a validated absolute path. */
export async function getMediaForDownload(actor: Actor, mediaId: string) {
  const media = await prisma.propertyMedia.findFirst({
    // The join enforces scope: a media row is reachable only if its property is
    // in the actor's scope. No property, no file.
    where: { id: mediaId, property: scopeForProperty(actor) },
    select: {
      id: true,
      storageKey: true,
      mimeType: true,
      originalName: true,
      sizeBytes: true,
    },
  })
  if (!media) throw notFound('File not found')

  return { ...media, absolutePath: resolveStorageKey(media.storageKey) }
}

export async function deleteMedia(actor: Actor, mediaId: string, req: Request) {
  const media = await prisma.propertyMedia.findFirst({
    where: { id: mediaId, property: scopeForProperty(actor) },
    select: { id: true, storageKey: true, propertyId: true, isCover: true },
  })
  if (!media) throw notFound('File not found')

  await prisma.$transaction(async (tx) => {
    await tx.propertyMedia.delete({ where: { id: mediaId } })

    // If the cover went, promote the next image so the property isn't left
    // coverless.
    if (media.isCover) {
      const next = await tx.propertyMedia.findFirst({
        where: { propertyId: media.propertyId, type: 'IMAGE' },
        orderBy: { sortOrder: 'asc' },
        select: { id: true },
      })
      if (next) await tx.propertyMedia.update({ where: { id: next.id }, data: { isCover: true } })
    }

    await logActivityTx(tx, {
      actorUserId: actor.userId,
      action: 'property.media.deleted',
      entityType: 'property',
      entityId: media.propertyId,
      summary: 'Deleted a file',
      req,
    })
  })

  // Unlink AFTER the row is gone. A file with no row is reclaimable garbage; a
  // row with no file is a broken download. Failure to unlink is logged, not
  // fatal — the reference is already gone.
  await unlink(resolveStorageKey(media.storageKey)).catch((err) => {
    console.error(JSON.stringify({ level: 'warn', msg: 'orphaned upload file', key: media.storageKey, err: String(err) }))
  })
}

export async function setCover(actor: Actor, mediaId: string) {
  const media = await prisma.propertyMedia.findFirst({
    where: { id: mediaId, type: 'IMAGE', property: scopeForProperty(actor) },
    select: { id: true, propertyId: true },
  })
  if (!media) throw notFound('Image not found')

  await prisma.$transaction([
    prisma.propertyMedia.updateMany({ where: { propertyId: media.propertyId }, data: { isCover: false } }),
    prisma.propertyMedia.update({ where: { id: media.id }, data: { isCover: true } }),
  ])
}

/** ETag for cache validation — content-addressed by key + size, not by mtime. */
export function mediaETag(storageKey: string, sizeBytes: number): string {
  return `"${createHash('sha1').update(`${storageKey}:${sizeBytes}`).digest('hex')}"`
}
