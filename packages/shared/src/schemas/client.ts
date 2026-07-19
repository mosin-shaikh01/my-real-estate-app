import { z } from 'zod'

export const clientListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  q: z.string().trim().min(1).optional(),
  followUpStatus: z.string().optional(),
  priority: z.string().optional(),
  city: z.string().optional(),
  assignedAgentId: z.string().optional(),
  /** Only hot leads when 'true'. */
  importantLead: z.enum(['true', 'false']).optional(),
  /** `-field` = descending. */
  sort: z.string().optional(),

  // Present in the schema, but the ROUTE strips them unless the actor holds
  // client.budget.view. Shape validation and authorization are different jobs;
  // see sortableClientFields()/filterableClientFields() in the serializer.
  minBudget: z.string().optional(),
  maxBudget: z.string().optional(),
})

export type ClientListQuery = z.infer<typeof clientListQuerySchema>

export function parseSort(
  sort: string | undefined,
  allowed: string[],
): { field: string; dir: 'asc' | 'desc' } | null {
  if (!sort) return null
  const dir = sort.startsWith('-') ? 'desc' : 'asc'
  const field = sort.replace(/^-/, '')
  return allowed.includes(field) ? { field, dir } : null
}
