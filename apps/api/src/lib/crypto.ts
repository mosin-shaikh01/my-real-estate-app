import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { env } from './env.js'

// ============================================================================
// Secret-at-rest encryption (AES-256-GCM)
// ============================================================================
// For provider credentials (the SMTP password) stored in the DB. Authenticated
// encryption: tampering fails the auth tag and decryption returns null rather
// than garbage.
//
// The key is derived from APP_ENCRYPTION_KEY, or JWT_REFRESH_SECRET when that's
// unset — so encryption works with zero extra deploy config. Consequence, stated
// plainly: rotating that source invalidates previously-stored secrets, which
// then read as "not set" and must be re-entered in Settings. That is the correct
// failure mode (never a crash, never a leak).
// ============================================================================

const KEY = createHash('sha256')
  .update(env.APP_ENCRYPTION_KEY ?? env.JWT_REFRESH_SECRET)
  .digest() // 32 bytes for AES-256

const PREFIX = 'gcm1'

/** Encrypt a UTF-8 string. Returns `gcm1:<iv>:<tag>:<ciphertext>` (base64). */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', KEY, iv)
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [PREFIX, iv.toString('base64'), tag.toString('base64'), ct.toString('base64')].join(':')
}

/** Decrypt a value produced by encryptSecret. Returns null if absent/tampered. */
export function decryptSecret(value: string | null | undefined): string | null {
  if (!value) return null
  const parts = value.split(':')
  if (parts.length !== 4 || parts[0] !== PREFIX) return null
  try {
    const iv = Buffer.from(parts[1]!, 'base64')
    const tag = Buffer.from(parts[2]!, 'base64')
    const ct = Buffer.from(parts[3]!, 'base64')
    const decipher = createDecipheriv('aes-256-gcm', KEY, iv)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8')
  } catch {
    return null
  }
}
