import { z } from 'zod'

// ---------------------------------------------------------------------------
// Per-user UI preferences
// ---------------------------------------------------------------------------
// Self-service: a user owns their own display choices. The DB is the source of
// truth (see UserPreference); the client caches the theme in localStorage only
// to paint instantly before /me resolves.
//
// Built to grow: add `language`, `timezone`, `dateFormat`, `currency`,
// `sidebarCollapsed`, etc. as more optional keys here and columns on the table —
// the PATCH endpoint and DTO carry them through without new plumbing.

// Same lowercase strings the client state and the CSS `.dark`/color-scheme use,
// so nothing has to case-map between the wire and the DOM.
export const themeSchema = z.enum(['light', 'dark'])
export type Theme = z.infer<typeof themeSchema>

/** PATCH body — every field optional so a caller updates just what changed. */
export const userPreferencesUpdateSchema = z.object({
  theme: themeSchema.optional(),
})
export type UserPreferencesUpdate = z.infer<typeof userPreferencesUpdateSchema>

/** What the API returns (in /me and after a PATCH). null = never chosen. */
export interface UserPreferencesDTO {
  theme: Theme | null
}
