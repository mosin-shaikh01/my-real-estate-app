import { createHash, randomBytes } from 'node:crypto'
import { hash, verify } from '@node-rs/argon2'
import { SignJWT, jwtVerify } from 'jose'
import { env } from '../lib/env.js'

// @node-rs/argon2 ships prebuilt napi binaries — no node-gyp, which matters
// because this machine has no build tools. `argon2` and `bcrypt` would not
// install here.
export const hashPassword = (plain: string) => hash(plain)

export async function verifyPassword(plain: string, digest: string): Promise<boolean> {
  try {
    return await verify(digest, plain)
  } catch {
    // A malformed digest must read as "wrong password", never as a 500 that
    // tells an attacker they found an interesting account.
    return false
  }
}

const accessSecret = new TextEncoder().encode(env.JWT_ACCESS_SECRET)

export interface AccessClaims {
  sub: string
  sid: string
}

// The token carries ONLY sub + sid. Permissions are loaded per request.
//
// Consequence, stated plainly: this JWT is not stateless, and an opaque random
// token would work identically. That is not an oversight — deactivation and
// live permission changes both require a DB read per request anyway, so
// embedding permissions would buy nothing and cost correctness. Never design
// around statelessness we don't have.
export async function signAccessToken(claims: AccessClaims): Promise<string> {
  return new SignJWT({ sid: claims.sid })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime(env.ACCESS_TOKEN_TTL)
    .sign(accessSecret)
}

export async function verifyAccessToken(token: string): Promise<AccessClaims | null> {
  try {
    const { payload } = await jwtVerify(token, accessSecret)
    if (typeof payload.sub !== 'string' || typeof payload.sid !== 'string') return null
    return { sub: payload.sub, sid: payload.sid }
  } catch {
    return null
  }
}

/**
 * Refresh tokens are opaque random bytes, not JWTs — there is nothing to encode
 * and a JWT would only invite someone to trust its claims without the DB lookup.
 */
export function generateRefreshToken(): string {
  return randomBytes(48).toString('base64url')
}

/** Stored hashed. A refresh token is a password equivalent; never store it raw. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/** "7d" / "15m" / "30s" -> ms. */
export function parseDuration(input: string): number {
  const m = /^(\d+)([smhd])$/.exec(input)
  if (!m) throw new Error(`Invalid duration: ${input}`)
  const n = Number(m[1])
  const unit = m[2] as 's' | 'm' | 'h' | 'd'
  const MS = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 } as const
  return n * MS[unit]
}
