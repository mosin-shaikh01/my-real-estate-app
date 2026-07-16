import { z } from 'zod'

export const activityQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
  action: z.string().trim().optional(),
  entityType: z.string().trim().optional(),
  actorUserId: z.string().trim().optional(),
})
export type ActivityQuery = z.infer<typeof activityQuerySchema>

export const searchQuerySchema = z.object({
  q: z.string().trim().min(2, 'Type at least two characters'),
})

export interface SearchResult {
  properties: Array<{ id: string; code: string; title: string; city: string; status: string }>
  clients: Array<{ id: string; code: string; fullName: string; followUpStatus: string }>
}
