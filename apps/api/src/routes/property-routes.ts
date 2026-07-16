import { Router } from 'express'
import { z } from 'zod'
import {
  assignAgentSchema,
  propertyCreateSchema,
  propertyListQuerySchema,
  propertyStatusUpdateSchema,
  propertyUpdateSchema,
  type Paginated,
} from '@app/shared'
import { requirePermission } from '../middleware/authenticate.js'
import { uploadMedia } from '../middleware/upload.js'
import { idParamSchema } from '../lib/params.js'
import { saveMedia, type UploadedFile } from '../services/media-service.js'
import {
  getProperty,
  listProperties,
  listPropertyCities,
} from '../services/property-service.js'
import {
  archiveProperty,
  assignPropertyAgent,
  createProperty,
  deleteProperty,
  setPropertyStatus,
  updateProperty,
} from '../services/property-write-service.js'
import { toPropertyDTO, type PropertyDTO } from '../serializers/property-serializer.js'

export const propertyRouter = Router()

// Same three layers as clients, in the same order:
//   requirePermission -> authorization
//   scopeForProperty  -> scoping     (in the service)
//   toPropertyDTO     -> projection  (serializer)

propertyRouter.get('/', requirePermission('property.list'), async (req, res) => {
  const query = propertyListQuerySchema.parse(req.query)
  const actor = req.actor!

  const { rows, total } = await listProperties(actor, query)

  const body: Paginated<PropertyDTO> = {
    data: rows.map((r) => toPropertyDTO(r, actor)),
    meta: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    },
  }
  res.json(body)
})

// Declared BEFORE /:id — Express matches in order, so '/cities' would otherwise
// be swallowed as an id and 404 with a confusing message.
propertyRouter.get('/cities', requirePermission('property.list'), async (req, res) => {
  res.json({ data: await listPropertyCities(req.actor!) })
})

propertyRouter.get('/:id', requirePermission('property.view'), async (req, res) => {
  const actor = req.actor!
  const { id } = idParamSchema.parse(req.params)
  res.json({ data: toPropertyDTO(await getProperty(actor, id), actor) })
})

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------
// Every one is a transaction carrying its own ActivityLog row. Logging is not
// a Phase 6 bolt-on: a log written after the fact lies the moment anything
// fails between the mutation and the write.

propertyRouter.post('/', requirePermission('property.create'), async (req, res) => {
  const input = propertyCreateSchema.parse(req.body)
  const property = await createProperty(req.actor!, input, req)
  res.status(201).json({ data: property })
})

propertyRouter.patch('/:id', requirePermission('property.update'), async (req, res) => {
  const { id } = idParamSchema.parse(req.params)
  const input = propertyUpdateSchema.parse(req.body)
  res.json({ data: await updateProperty(req.actor!, id, input, req) })
})

propertyRouter.post('/:id/status', requirePermission('property.status.update'), async (req, res) => {
  const { id } = idParamSchema.parse(req.params)
  const { status } = propertyStatusUpdateSchema.parse(req.body)
  res.json({ data: await setPropertyStatus(req.actor!, id, status, req) })
})

propertyRouter.post('/:id/assign-agent', requirePermission('property.assignAgent'), async (req, res) => {
  const { id } = idParamSchema.parse(req.params)
  const { agentId } = assignAgentSchema.parse(req.body)
  res.json({ data: await assignPropertyAgent(req.actor!, id, agentId, req) })
})

propertyRouter.post('/:id/archive', requirePermission('property.archive'), async (req, res) => {
  const { id } = idParamSchema.parse(req.params)
  const { archived } = z.object({ archived: z.boolean().default(true) }).parse(req.body ?? {})
  res.json({ data: await archiveProperty(req.actor!, id, archived, req) })
})

propertyRouter.delete('/:id', requirePermission('property.delete'), async (req, res) => {
  const { id } = idParamSchema.parse(req.params)
  await deleteProperty(req.actor!, id, req)
  res.status(204).end()
})

// Upload sits under the property because a file is created in its context.
// uploadMedia (multer) runs AFTER requirePermission — no point buffering a
// 10 MB file for a request we are about to 403.
propertyRouter.post(
  '/:id/media',
  requirePermission('property.media.upload'),
  uploadMedia,
  async (req, res) => {
    const { id } = idParamSchema.parse(req.params)
    const files = (req.files as UploadedFile[] | undefined) ?? []
    if (files.length === 0) {
      res.status(400).json({
        error: { code: 'VALIDATION_FAILED', message: 'No files were uploaded', requestId: req.requestId },
      })
      return
    }
    const markAsFloorPlan = req.body?.type === 'FLOOR_PLAN'
    const created = await saveMedia(req.actor!, id, files, markAsFloorPlan, req)
    res.status(201).json({ data: created })
  },
)
