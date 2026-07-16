import { z } from 'zod'

// Express 5 types req.params values as `string | string[] | undefined` — a
// repeated param genuinely can arrive as an array. Parsing rather than casting
// means a malformed URL becomes a 400 instead of a confusing 500 deeper in.
export const idParamSchema = z.object({
  id: z.string().min(1, 'Missing id'),
})
