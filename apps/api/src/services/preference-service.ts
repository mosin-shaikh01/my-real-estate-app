import type { UserPreferencesDTO, UserPreferencesUpdate } from '@app/shared'
import { themeSchema } from '@app/shared'
import { prisma } from '../lib/prisma.js'

// Per-user UI preferences. Everything here is keyed by the CALLER's own userId —
// there is no path that takes someone else's id, so a user can only ever read or
// write their own, and an admin cannot reach into another user's display choices.

/** Read a user's preferences. Returns defaults (nulls) when no row exists yet. */
export async function getUserPreferences(userId: string): Promise<UserPreferencesDTO> {
  const row = await prisma.userPreference.findUnique({
    where: { userId },
    select: { theme: true },
  })
  return { theme: normaliseTheme(row?.theme) }
}

/** Create-or-update the caller's preferences. Only the keys present are touched,
 *  so a future multi-field form can PATCH one setting without clobbering others. */
export async function updateUserPreferences(
  userId: string,
  input: UserPreferencesUpdate,
): Promise<UserPreferencesDTO> {
  const data: { theme?: string } = {}
  if (input.theme !== undefined) data.theme = input.theme

  const row = await prisma.userPreference.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
    select: { theme: true },
  })
  return { theme: normaliseTheme(row.theme) }
}

// The column is a free VARCHAR; guard the read so a hand-edited or legacy value
// can never send an invalid theme to the client.
function normaliseTheme(value: string | null | undefined): UserPreferencesDTO['theme'] {
  const parsed = themeSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}
