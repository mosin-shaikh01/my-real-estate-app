import { Router } from 'express'
import { requireAnyPermission } from '../middleware/authenticate.js'
import { listAmenities } from '../services/amenity-service.js'

export const amenityRouter = Router()

// The catalog that powers the amenity picker in the property create/edit form.
// Gated to the people who edit properties — an agent (view-only) already gets a
// property's amenities in its DTO and has no picker to fill.
amenityRouter.get(
  '/',
  requireAnyPermission('property.create', 'property.update'),
  async (_req, res) => {
    res.json({ data: await listAmenities() })
  },
)
