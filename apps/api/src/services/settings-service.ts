import { randomUUID } from 'node:crypto'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { BrandingAsset, SettingsUpdateInput } from '@app/shared'
import type { Request } from 'express'
import type { Actor } from '../auth/permissions.js'
import { validationFailed } from '../lib/errors.js'
import { prisma } from '../lib/prisma.js'
import { logActivityTx } from './activity-service.js'
import { resolveStorageKey } from './media-service.js'

// ============================================================================
// CRM settings — a single row (the AppSetting singleton)
// ============================================================================
// Every write is an upsert on `singleton: true`, so there is exactly one row and
// no way to create duplicates. Reads are public (branding on the login screen);
// writes require settings.update. Logo/favicon live on disk under the upload
// root and stream through /api/settings/logo|favicon — never a static path.
// ============================================================================

const SINGLETON = { singleton: true } as const

/** Read the settings, creating the default row on first access. */
export async function getSettings() {
  return prisma.appSetting.upsert({
    where: SINGLETON,
    create: { singleton: true },
    update: {},
  })
}

// Optional text fields arrive as "" when a form field is cleared. Store NULL so
// "not set" is one value everywhere. crmName is min-length validated upstream and
// never arrives empty, so it is safe to leave untouched.
function normaliseEmptyToNull(input: SettingsUpdateInput): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input)) {
    out[key] = value === '' ? null : value
  }
  return out
}

export async function updateSettings(actor: Actor, input: SettingsUpdateInput, req: Request) {
  const data = normaliseEmptyToNull(input)

  const row = await prisma.$transaction(async (tx) => {
    const updated = await tx.appSetting.upsert({
      where: SINGLETON,
      create: { singleton: true, ...data },
      update: { ...data, updatedById: actor.userId },
    })
    await logActivityTx(tx, {
      actorUserId: actor.userId,
      action: 'settings.updated',
      entityType: 'settings',
      entityId: updated.id,
      summary: 'Updated CRM settings',
      metadata: { changed: Object.keys(input) },
      req,
    })
    return updated
  })

  return row
}

// ---------------------------------------------------------------------------
// Branding assets (logo / favicon)
// ---------------------------------------------------------------------------
// SVG is deliberately refused: it can carry script and these are rendered inline
// across the app, including the pre-auth login screen.
const BRANDING_MIME: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/x-icon': '.ico',
  'image/vnd.microsoft.icon': '.ico',
}
const BRANDING_MAX_BYTES = 2 * 1024 * 1024

export interface UploadedImage {
  originalname: string
  mimetype: string
  size: number
  buffer: Buffer
}

export async function saveBrandingAsset(
  actor: Actor,
  asset: BrandingAsset,
  file: UploadedImage,
  req: Request,
) {
  const ext = BRANDING_MIME[file.mimetype]
  if (!ext) {
    throw validationFailed({ file: ['Only PNG, JPEG, WebP or ICO images are allowed'] })
  }
  if (file.size > BRANDING_MAX_BYTES) {
    throw validationFailed({ file: ['The image exceeds the 2 MB limit'] })
  }

  // Our filename, never the client's. Random so a replacement can't be cached
  // under the same URL.
  const storageKey = path.posix.join('settings', `${asset}-${randomUUID()}${ext}`)
  await mkdir(resolveStorageKey('settings'), { recursive: true })
  await writeFile(resolveStorageKey(storageKey), file.buffer)

  const current = await getSettings()
  const oldKey = asset === 'logo' ? current.logoStorageKey : current.faviconStorageKey

  const data =
    asset === 'logo'
      ? { logoStorageKey: storageKey, logoMimeType: file.mimetype, updatedById: actor.userId }
      : { faviconStorageKey: storageKey, faviconMimeType: file.mimetype, updatedById: actor.userId }

  const row = await prisma.$transaction(async (tx) => {
    const updated = await tx.appSetting.update({ where: SINGLETON, data })
    await logActivityTx(tx, {
      actorUserId: actor.userId,
      action: 'settings.updated',
      entityType: 'settings',
      entityId: updated.id,
      summary: `Updated the ${asset}`,
      req,
    })
    return updated
  })

  // Reclaim the replaced file after the row points elsewhere. A missing old file
  // is harmless; a dangling reference is not — so update first, unlink after.
  if (oldKey && oldKey !== storageKey) {
    await unlink(resolveStorageKey(oldKey)).catch(() => {})
  }
  return row
}

export async function deleteBrandingAsset(actor: Actor, asset: BrandingAsset, req: Request) {
  const current = await getSettings()
  const oldKey = asset === 'logo' ? current.logoStorageKey : current.faviconStorageKey
  if (!oldKey) return current

  const data =
    asset === 'logo'
      ? { logoStorageKey: null, logoMimeType: null, updatedById: actor.userId }
      : { faviconStorageKey: null, faviconMimeType: null, updatedById: actor.userId }

  const row = await prisma.$transaction(async (tx) => {
    const updated = await tx.appSetting.update({ where: SINGLETON, data })
    await logActivityTx(tx, {
      actorUserId: actor.userId,
      action: 'settings.updated',
      entityType: 'settings',
      entityId: updated.id,
      summary: `Removed the ${asset}`,
      req,
    })
    return updated
  })

  await unlink(resolveStorageKey(oldKey)).catch(() => {})
  return row
}

/** For the public streaming routes: the stored key + mime, or null if unset. */
export async function getBrandingAsset(
  asset: BrandingAsset,
): Promise<{ storageKey: string; mimeType: string; absolutePath: string } | null> {
  const row = await getSettings()
  const storageKey = asset === 'logo' ? row.logoStorageKey : row.faviconStorageKey
  const mimeType = asset === 'logo' ? row.logoMimeType : row.faviconMimeType
  if (!storageKey || !mimeType) return null
  return { storageKey, mimeType, absolutePath: resolveStorageKey(storageKey) }
}
