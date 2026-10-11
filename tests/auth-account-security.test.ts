// Customer account security regressions: avatar allowlist, 6-64
// passwords (old hashes keep working), generic login failures,
// rolling session renewal without resurrecting revoked sessions.
// DB/cookie boundaries are mocked — no production data touched.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  isValidAvatarUrl,
  validatePasswordStrength,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
} from '@/lib/core/validation'
import { hashPassword, verifyPassword } from '@/lib/core/password'

const shared = vi.hoisted(() => {
  const mockedDb: Record<string, any> = { user: {}, session: {} }
  const mockedJar: { get: any; set: any } = { get: (..._args: any[]) => undefined, set: (..._args: any[]) => undefined }
  return { mockedDb, mockedJar }
})
const { mockedDb } = shared

vi.mock('@/lib/server/db', () => ({ db: shared.mockedDb }))
vi.mock('next/headers', () => ({ cookies: () => shared.mockedJar }))

import { updateCustomerIdentity, updateAdminProfile } from '@/lib/server/users'
import { getSession, SESSION_COOKIE_NAME, SESSION_TTL_MS } from '@/lib/server/session'

const mockedJar = shared.mockedJar

beforeEach(() => {
  vi.clearAllMocks()
  mockedDb.user = {}
  mockedDb.session = {}
  mockedJar.get = vi.fn()
  mockedJar.set = vi.fn()
})

describe('avatar URL allowlist (server-side)', () => {
  it('accepts empty (clearing), https URLs, stored media paths, legacy data images', () => {
    expect(isValidAvatarUrl('')).toBe(true)
    expect(isValidAvatarUrl('https://example.com/photo.jpg')).toBe(true)
    expect(isValidAvatarUrl('http://example.com/photo.png')).toBe(true)
    expect(
      isValidAvatarUrl('/media/2026/10/abcdef0123456789abcdef0123456789.jpg'),
    ).toBe(true)
    expect(isValidAvatarUrl('data:image/png;base64,iVBORw0KGgo=')).toBe(true)
  })

  it('rejects unsafe schemes, bare paths, and oversized values', () => {
    expect(isValidAvatarUrl('javascript:alert(1)')).toBe(false)
    expect(isValidAvatarUrl('JaVaScRiPt:alert(1)')).toBe(false)
    expect(isValidAvatarUrl('data:text/html,<script>alert(1)</script>')).toBe(false)
    expect(isValidAvatarUrl('ftp://example.com/a.png')).toBe(false)
    expect(isValidAvatarUrl('/etc/passwd')).toBe(false)
    expect(isValidAvatarUrl('photo.jpg')).toBe(false)
    expect(isValidAvatarUrl(`https://example.com/${'a'.repeat(2000)}`)).toBe(false)
  })

  it('refuses unsafe avatars in updateCustomerIdentity without touching the DB', async () => {
    mockedDb.user.update = vi.fn()
    await expect(
      updateCustomerIdentity('u1', {
        firstName: 'A',
        lastName: 'B',
        username: 'ab.cd',
        countryCode: 'EG',
        phone: '+201000000000',
        avatar: 'javascript:alert(1)',
      }),
    ).rejects.toThrow('Enter a valid avatar URL')
    expect(mockedDb.user.update).not.toHaveBeenCalled()
  })

  it('persists legitimate avatars in both customer and admin profile paths', async () => {
    mockedDb.user.update = vi.fn().mockImplementation(async (args: any) => ({ ...args.data, id: 'u1', roles: [] }))
    const base = {
      firstName: 'A',
      lastName: 'B',
      username: 'ab.cd',
      countryCode: 'EG',
      phone: '+201000000000',
      avatar: 'https://example.com/photo.jpg',
    }
    await updateCustomerIdentity('u1', base)
    expect(mockedDb.user.update).toHaveBeenCalledTimes(1)
    await updateAdminProfile('u1', { ...base, email: 'a@b.com' })
    expect(mockedDb.user.update).toHaveBeenCalledTimes(2)
    expect(mockedDb.user.update.mock.calls[1][0].data.avatar).toBe('https://example.com/photo.jpg')
  })
})

describe('password policy 6-64', () => {
  it('exposes the widened bounds', () => {
    expect(MIN_PASSWORD_LENGTH).toBe(6)
    expect(MAX_PASSWORD_LENGTH).toBe(64)
  })

  it('accepts 6 through 64 characters and rejects outside', () => {
    expect(validatePasswordStrength('12345')).not.toBeNull()
    expect(validatePasswordStrength('123456')).toBeNull()
    expect(validatePasswordStrength('12345678')).toBeNull()
    expect(validatePasswordStrength('s3cure!Passw0rd-with-plenty-of-entropy-0123456789')).toBeNull()
    expect(validatePasswordStrength('a'.repeat(64))).toBeNull()
    expect(validatePasswordStrength('a'.repeat(65))).not.toBeNull()
  })

  it('hashes long passwords and still verifies legacy short hashes', async () => {
    const longPassword = 'correct-horse-battery-staple-entropy-99!'
    const longHash = await hashPassword(longPassword)
    expect(await verifyPassword(longPassword, longHash)).toBe(true)
    expect(await verifyPassword(longPassword + 'x', longHash)).toBe(false)
    const legacyHash = await hashPassword('old8ch!')
    expect(await verifyPassword('old8ch!', legacyHash)).toBe(true)
  })
})

describe('login route failures are generic', () => {
  function postLogin(body: unknown) {
    return new Request('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'http://localhost:3000',
        'x-forwarded-host': 'localhost:3000',
      },
      body: JSON.stringify(body),
    })
  }

  it.each([['invalid-credentials'], ['suspended'], ['pending']])(
    'returns the same 401 body for failure %s',
    async (failure) => {
      vi.resetModules()
      vi.doMock('@/lib/server/auth', () => ({
        validateCredentials: vi.fn(async () => ({ failure })),
        authorizedPostLoginPath: () => '/account',
      }))
      vi.doMock('@/lib/server/rate-limit', () => ({
        checkLoginRateLimit: vi.fn(async () => ({ allowed: true, retryAfterSeconds: 0 })),
        recordLoginAttempt: vi.fn(async () => undefined),
        clearLoginAttempts: vi.fn(async () => undefined),
      }))
      vi.doMock('@/lib/server/session', () => ({ createSession: vi.fn() }))
      const { POST } = await import('@/app/api/auth/login/route')
      const res = await POST(postLogin({ identifier: 'someone@example.com', password: 'whatever' }))
      expect(res.status).toBe(401)
      expect(await res.json()).toEqual({ error: 'Invalid email, username or password.' })
    },
  )
})

describe('rolling session renewal', () => {
  const TOKEN = 'opaque-token-value'

  function jarWithToken() {
    mockedJar.get.mockImplementation((name: string) =>
      name === SESSION_COOKIE_NAME ? { value: TOKEN } : undefined,
    )
  }

  it('extends the DB row and the cookie together on a valid read', async () => {
    jarWithToken()
    mockedDb.session.findUnique = vi.fn(async () => ({
      id: 's1',
      userId: 'u1',
      expiresAt: new Date(Date.now() + 60_000),
    }))
    mockedDb.session.update = vi.fn(async () => ({}))
    const before = Date.now()

    const session = await getSession()

    expect(session).not.toBeNull()
    expect(mockedDb.session.update).toHaveBeenCalledTimes(1)
    const data = mockedDb.session.update.mock.calls[0][0].data
    expect(data.expiresAt.getTime()).toBeGreaterThan(before + SESSION_TTL_MS - 5_000)
    expect(mockedJar.set).toHaveBeenCalledWith(
      SESSION_COOKIE_NAME,
      TOKEN,
      expect.objectContaining({ httpOnly: true, maxAge: Math.floor(SESSION_TTL_MS / 1000) }),
    )
  })

  it('deletes expired rows and never renews the cookie', async () => {
    jarWithToken()
    mockedDb.session.findUnique = vi.fn(async () => ({
      id: 's1',
      userId: 'u1',
      expiresAt: new Date(Date.now() - 1_000),
    }))
    mockedDb.session.delete = vi.fn(async () => ({}))
    mockedDb.session.update = vi.fn()

    expect(await getSession()).toBeNull()
    expect(mockedDb.session.delete).toHaveBeenCalledTimes(1)
    expect(mockedDb.session.update).not.toHaveBeenCalled()
    expect(mockedJar.set).not.toHaveBeenCalled()
  })

  it('leaves revoked (missing) sessions invalid with no writes', async () => {
    jarWithToken()
    mockedDb.session.findUnique = vi.fn(async () => null)
    mockedDb.session.update = vi.fn()
    mockedDb.session.delete = vi.fn()

    expect(await getSession()).toBeNull()
    expect(mockedDb.session.update).not.toHaveBeenCalled()
    expect(mockedDb.session.delete).not.toHaveBeenCalled()
    expect(mockedJar.set).not.toHaveBeenCalled()
  })
})
