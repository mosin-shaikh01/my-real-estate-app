import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { isAllowedMime, resolveStorageKey } from '../src/services/media-service.js'
import { AppError } from '../src/lib/errors.js'

// ============================================================================
// Media security — the pure functions behind the authorized route
// ============================================================================
// The scope check and the streaming live in the route (integration territory),
// but the two controls that a bug would turn into a file-disclosure are pure and
// belong here: the MIME allowlist and the path-traversal guard.
// ============================================================================

describe('MIME allowlist', () => {
  it('permits exactly images and PDF', () => {
    for (const ok of ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']) {
      expect(isAllowedMime(ok), ok).toBe(true)
    }
  })

  it('rejects everything else — the file type is attacker-controlled', () => {
    for (const bad of [
      'text/html',
      'image/svg+xml', // SVG carries script; deliberately NOT allowed
      'application/x-msdownload',
      'application/octet-stream',
      'text/javascript',
      '',
    ]) {
      expect(isAllowedMime(bad), bad).toBe(false)
    }
  })
})

describe('path-traversal guard', () => {
  it('resolves a legitimate generated key', () => {
    const key = 'properties/abc123/de305d54-75b4-431b-adb2-eb6b9e546013.jpg'
    const abs = resolveStorageKey(key)
    expect(abs).toContain('uploads')
    expect(path.isAbsolute(abs)).toBe(true)
  })

  it('refuses to escape the upload root, however the escape is spelled', () => {
    // We generate every key ourselves, so none of these should reach the DB —
    // but "should" is not a control. Even if one did, it cannot be read.
    const escapes = [
      '../../../etc/passwd',
      '..\\..\\..\\windows\\system32\\config\\sam',
      'properties/../../secret.env',
      '/etc/shadow',
      'properties/../../../../../../etc/hosts',
    ]
    for (const key of escapes) {
      expect(() => resolveStorageKey(key), key).toThrow(AppError)
    }
  })

  it('the thrown error is a 403, not a 500', () => {
    // A traversal attempt is a forbidden action, not a server fault — the
    // status code should say so.
    try {
      resolveStorageKey('../../../../etc/passwd')
      expect.unreachable('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(AppError)
      expect((err as AppError).status).toBe(403)
    }
  })
})
