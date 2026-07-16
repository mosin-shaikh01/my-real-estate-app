import { createReadStream } from 'node:fs'
import { Router } from 'express'
import type { BrandingAsset } from '@app/shared'
import { settingsUpdateSchema } from '@app/shared'
import { authenticate, requirePermission } from '../middleware/authenticate.js'
import { publicRoute } from '../middleware/route-registry.js'
import { uploadBrandingImage } from '../middleware/upload.js'
import { validationFailed } from '../lib/errors.js'
import { toSettingsDTO } from '../serializers/settings-serializer.js'
import {
  deleteBrandingAsset,
  getBrandingAsset,
  getSettings,
  saveBrandingAsset,
  updateSettings,
} from '../services/settings-service.js'

// Mixed public/protected, like the auth router: reading branding is PUBLIC (the
// login screen and favicon need it before anyone signs in), while every write is
// authenticated and gated by settings.update. So this mount does NOT apply
// authenticate globally — protected routes declare it themselves.
export const settingsRouter = Router()

// -- Public reads -----------------------------------------------------------

settingsRouter.get(
  '/',
  publicRoute('Branding and company info are shown app-wide, including pre-auth'),
  async (_req, res) => {
    res.json({ data: toSettingsDTO(await getSettings()) })
  },
)

async function streamAsset(asset: BrandingAsset, res: import('express').Response) {
  const file = await getBrandingAsset(asset)
  if (!file) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not set' } })
    return
  }
  res.setHeader('Content-Type', file.mimeType)
  // Public and immutable-per-version: the URL carries a ?v= cache-buster, so a
  // long cache is safe and a replacement gets a fresh URL.
  res.setHeader('Cache-Control', 'public, max-age=86400')
  createReadStream(file.absolutePath)
    .on('error', () => {
      if (!res.headersSent) res.status(404).end()
    })
    .pipe(res)
}

settingsRouter.get('/logo', publicRoute('The CRM logo is shown app-wide'), (_req, res) =>
  streamAsset('logo', res),
)
settingsRouter.get('/favicon', publicRoute('The favicon is a browser-level asset'), (_req, res) =>
  streamAsset('favicon', res),
)

// -- Protected writes (settings.update) -------------------------------------

settingsRouter.patch(
  '/',
  authenticate,
  requirePermission('settings.update'),
  async (req, res) => {
    const input = settingsUpdateSchema.parse(req.body)
    res.json({ data: toSettingsDTO(await updateSettings(req.actor!, input, req)) })
  },
)

for (const asset of ['logo', 'favicon'] as const) {
  settingsRouter.post(
    `/${asset}`,
    authenticate,
    requirePermission('settings.update'),
    uploadBrandingImage,
    async (req, res) => {
      if (!req.file) throw validationFailed({ file: ['No image was uploaded'] })
      const row = await saveBrandingAsset(req.actor!, asset, req.file, req)
      res.json({ data: toSettingsDTO(row) })
    },
  )

  settingsRouter.delete(
    `/${asset}`,
    authenticate,
    requirePermission('settings.update'),
    async (req, res) => {
      res.json({ data: toSettingsDTO(await deleteBrandingAsset(req.actor!, asset, req)) })
    },
  )
}
