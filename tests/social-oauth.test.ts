import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHmac } from 'node:crypto'

const fixture = vi.hoisted(() => ({ settings: new Map<string, string>(), cookies: new Map<string, string>(),
  current: vi.fn(), permission: vi.fn(), find: vi.fn(), session: vi.fn(), markLoggedIn: vi.fn(), validate: vi.fn(), attach: vi.fn(), register: vi.fn(), transaction: vi.fn(), deleteIdentities: vi.fn(), writeGate: vi.fn(), readGate: vi.fn(), pruneGates: vi.fn(), deleteGate: vi.fn() }))
vi.mock('next/headers', () => ({ cookies: async () => ({
  get: (key: string) => fixture.cookies.has(key) ? { value: fixture.cookies.get(key) } : undefined,
  set: (key: string, value: string, options: { maxAge: number }) => options.maxAge ? fixture.cookies.set(key, value) : fixture.cookies.delete(key),
}) }))
vi.mock('@/lib/server/db', () => ({ db: {
  siteSetting: { findMany: async ({ where }: { where: { key: { in: string[] } } }) => where.key.in.flatMap(key => fixture.settings.has(key) ? [{ key, value: fixture.settings.get(key) }] : []) },
  socialIdentity: { findUnique: fixture.find, upsert: fixture.attach, deleteMany: fixture.deleteIdentities }, $transaction: fixture.transaction,
  facebookLoginRevocation: { deleteMany: fixture.pruneGates },
} }))
vi.mock('@/lib/server/auth/auth', () => ({ getCurrentUser: fixture.current, hasPermission: fixture.permission, validateCredentials: fixture.validate, isStaff: () => false }))
vi.mock('@/lib/server/auth/session', () => ({ createSession: fixture.session }))
vi.mock('@/lib/server/auth/users', () => ({ markLoggedIn: fixture.markLoggedIn, createCustomerUser: fixture.register, toClientUser: (user: unknown) => user }))
vi.mock('@/lib/server/rate-limit', () => ({ checkLoginRateLimit: async () => ({ allowed: true }), recordLoginAttempt: vi.fn(), clearLoginAttempts: vi.fn(), checkRegistrationRateLimit: async () => ({ allowed: true }), recordRegistrationAttempt: vi.fn() }))
vi.mock('@/lib/server/email/email', () => ({ sendCustomerEmailSafe: vi.fn() }))

import { POST as start, GET as status } from '@/app/api/auth/social/[provider]/route'
import { GET as callback } from '@/app/api/auth/callback/[provider]/route'
import { POST as passwordLogin } from '@/app/api/auth/login/route'
import { POST as register } from '@/app/api/auth/register/route'
import { POST as deleteFacebook, GET as deletionStatus } from '@/app/api/auth/facebook/data-deletion/route'
import { activePendingSocial, readSocialCookie } from '@/lib/server/auth/social-flow'
import { attachSocialIdentity, isActiveSocialCustomer } from '@/lib/server/auth/social-account'
import { openSocialValue, sealSocialValue, socialSecretPurpose } from '@/lib/server/auth/social-seal'
import { socialNamespace } from '@/lib/server/auth/social-provider'
import { POST as claimMeasurement } from '@/app/api/auth/social-measurement/route'
import { SOCIAL_MEASUREMENT_COOKIE, SOCIAL_MEASUREMENT_HEADER } from '@/lib/tracking/auth/social-measurement'

const origin = 'https://starpyramids.com'
const context = (provider = 'google') => ({ params: Promise.resolve({ provider }) })
const request = (path: string, init?: RequestInit) => new Request(origin + path, init)
const startRequest = (mode = 'login', provider = 'google', headers: Record<string, string> = { origin, 'x-sp-social-start': '1' }) => request(`/api/auth/social/${provider}?mode=${mode}`, { method: 'POST', headers })
const googlePurpose = socialSecretPurpose('auth.google.clientSecret', 'fixture.apps.googleusercontent.com')
const facebookPurpose = socialSecretPurpose('auth.facebook.appSecret', '123456')
const analyticsGrant = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const otherGrant = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
const claim = (grant = analyticsGrant, from = origin) => claimMeasurement(request('/api/auth/social-measurement', {
  method: 'POST', headers: { origin: from, [SOCIAL_MEASUREMENT_HEADER]: grant },
}))

async function authorize(mode = 'login', provider = 'google', grant?: string) {
  const headers = { origin, 'x-sp-social-start': '1', ...(grant ? { [SOCIAL_MEASUREMENT_HEADER]: grant } : {}) }
  const result = await start(startRequest(mode, provider, headers), context(provider))
  expect(result.status).toBe(200)
  const { authorizationUrl } = await result.json()
  return new URL(authorizationUrl)
}

function complete(url: URL, provider = 'google', state = url.searchParams.get('state')!) {
  return callback(request(`/api/auth/callback/${provider}?${new URLSearchParams({ state, code: 'fixture-code' })}`), context(provider))
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', origin)
  vi.stubEnv('SOCIAL_AUTH_ENCRYPTION_KEY', 'ab'.repeat(32))
  fixture.settings.clear()
  fixture.cookies.clear()
  fixture.settings.set('auth.google.clientId', 'fixture.apps.googleusercontent.com')
  fixture.settings.set('auth.google.clientSecret', sealSocialValue('fixture-google-secret', googlePurpose))
  fixture.settings.set('auth.google.enabled', 'true')
  fixture.settings.set('auth.facebook.appId', '123456')
  fixture.settings.set('auth.facebook.appSecret', sealSocialValue('fixture-facebook-secret', facebookPurpose))
  fixture.settings.set('auth.facebook.enabled', 'true')
  fixture.find.mockResolvedValue(null)
  fixture.transaction.mockImplementation(work => work({
    $executeRaw: fixture.writeGate, $queryRaw: fixture.readGate,
    socialIdentity: { upsert: fixture.attach, deleteMany: fixture.deleteIdentities },
    facebookLoginRevocation: { delete: fixture.deleteGate },
  }))
  fixture.readGate.mockResolvedValue([{ revokedThrough: null }])
  fixture.pruneGates.mockResolvedValue({ count: 0 })
  vi.stubGlobal('fetch', vi.fn(async (url: URL) => Response.json(url.pathname.endsWith('token') ? { access_token: 'fixture-token' } : { sub: 'google-subject', id: '987654' })))
})
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })

describe('OAuth provider handoff', () => {
  it('rejects blocked providers, foreign origins, missing browser proof and mismatched state', async () => {
    expect((await start(startRequest('login', 'unknown'), context('unknown'))).status).toBe(403)
    expect((await start(startRequest('login', 'google', { origin: 'https://other.test', 'x-sp-social-start': '1', 'sec-fetch-site': 'same-origin' }), context())).status).toBe(403)
    expect((await start(startRequest('login', 'google', { origin }), context())).status).toBe(403)
    const url = await authorize()
    expect(url.origin).toBe('https://accounts.google.com')
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
    expect(url.searchParams.has('client_secret')).toBe(false)
    expect((await complete(url, 'google', 'x'.repeat(43))).headers.get('location')).toContain('social=failed')
    expect((await complete(url, 'facebook')).headers.get('location')).toContain('social=failed')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('handles a same-origin POST from a no-referrer page and rejects unencrypted legacy secrets', async () => {
    const headers = { origin: 'null', 'sec-fetch-site': 'same-origin', 'x-sp-social-start': '1' }
    expect((await start(startRequest('login', 'google', headers), context())).status).toBe(200)
    fixture.settings.set('auth.google.clientSecret', 'unencrypted-secret')
    expect((await start(startRequest('login', 'google', headers), context())).status).toBe(503)
  })

  it.each(['google', 'facebook'])('uses %s identity without exposing it before local verification and refuses callback replay', async provider => {
    const url = await authorize('register', provider)
    const result = await complete(url, provider)
    expect(result.headers.get('location')).toBe(origin + '/register?social=link')
    expect(fixture.session).not.toHaveBeenCalled()
    const attempt = (await readSocialCookie('pending'))!.attempt
    expect(await activePendingSocial(attempt)).toMatchObject({ provider, namespace: expect.stringMatching(/^[a-f0-9]{64}$/) })
    expect([...fixture.cookies.values()].join('')).not.toMatch(/google-subject|987654|fixture-token|fixture-code/)
    expect((await complete(url, provider)).headers.get('location')).toContain('social=failed')
    expect(fetch).toHaveBeenCalledTimes(2)
    fixture.settings.set(`auth.${provider}.enabled`, 'false')
    expect(await activePendingSocial(attempt)).toBeNull()
  })

  it('creates only a customer-scoped session for a previously linked active customer', async () => {
    fixture.find.mockResolvedValue({ user: { id: 'customer', status: 'ACTIVE', roles: [{ role: { key: 'CUSTOMER' } }] } })
    expect((await complete(await authorize())).headers.get('location')).toBe(origin + '/account')
    expect(fixture.session).toHaveBeenCalledExactlyOnceWith('customer', expect.objectContaining({ customerOnly: true }))
    fixture.find.mockResolvedValue({ user: { id: 'staff', status: 'ACTIVE', roles: [{ role: { key: 'CUSTOMER' } }, { role: { key: 'ADMIN' } }] } })
    expect((await complete(await authorize())).headers.get('location')).toContain('social=failed')
    expect(fixture.session).toHaveBeenCalledTimes(1)
    expect(isActiveSocialCustomer({ status: 'SUSPENDED', roles: ['CUSTOMER'] })).toBe(false)
  })

  it.each(['google', 'facebook'])('issues a privacy-safe login event once after successful %s authentication', async provider => {
    vi.stubEnv('NODE_ENV', 'production')
    fixture.find.mockResolvedValue({ user: { id: 'private-customer', status: 'ACTIVE', roles: [{ role: { key: 'CUSTOMER' } }] } })
    const url = await authorize('login', provider, analyticsGrant)
    expect(url.href).not.toContain(analyticsGrant)
    expect(fixture.cookies.has(SOCIAL_MEASUREMENT_COOKIE)).toBe(false)
    expect((await complete(url, provider)).headers.get('location')).toBe(origin + '/account')
    expect((await claim(analyticsGrant, 'https://other.test')).status).toBe(403)
    const { events } = await (await claim()).json()
    expect(events).toEqual([{ event: 'sp_login', method: provider, event_id: expect.stringMatching(/^so_[a-f0-9]{32}$/) }])
    expect(await (await claim()).json()).toEqual({ events: [] })
  })

  it('drops the measurement for a replaced grant and never backfills a login started without consent', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    fixture.find.mockResolvedValue({ user: { id: 'customer', status: 'ACTIVE', roles: [{ role: { key: 'CUSTOMER' } }] } })
    await complete(await authorize('login', 'google', analyticsGrant))
    expect(await (await claim(otherGrant)).json()).toEqual({ events: [] })
    expect(await (await claim()).json()).toEqual({ events: [] })
    await complete(await authorize())
    expect(fixture.cookies.has(SOCIAL_MEASUREMENT_COOKIE)).toBe(false)
  })

  it('requires the local password before creating a link on a private no-referrer page', async () => {
    await complete(await authorize())
    const attempt = (await readSocialCookie('pending'))!.attempt
    const logIn = (origin = 'null') => passwordLogin(request('/api/auth/login', { method: 'POST',
      headers: { origin, 'sec-fetch-site': 'same-origin', 'x-sp-social-link': '1', 'content-type': 'application/json' },
      body: JSON.stringify({ identifier: 'customer', password: 'fixture', linkSocial: attempt }),
    }))
    expect((await logIn('https://another.test')).status).toBe(403)
    fixture.validate.mockResolvedValue({ failure: 'invalid-credentials' })
    expect((await logIn()).status).toBe(401)
    expect(fixture.attach).not.toHaveBeenCalled()
    fixture.validate.mockResolvedValue({ user: { id: 'owner', status: 'ACTIVE', roles: ['CUSTOMER'] } })
    fixture.attach.mockResolvedValue({ userId: 'owner' })
    expect(await (await logIn()).json()).toMatchObject({ socialLinked: true, redirectTo: '/account' })
    expect(fixture.attach).toHaveBeenCalledOnce()
    expect(await readSocialCookie('pending')).toBeNull()
  })

  it('cannot link a different identity when a second tab replaces the original attempt', async () => {
    await complete(await authorize())
    const stale = (await readSocialCookie('pending'))!.attempt
    await complete(await authorize('login', 'facebook'), 'facebook')
    const current = (await readSocialCookie('pending'))!.attempt
    fixture.validate.mockResolvedValue({ user: { id: 'owner', status: 'ACTIVE', roles: ['CUSTOMER'] } })
    const result = await passwordLogin(request('/api/auth/login', { method: 'POST',
      headers: { origin, host: new URL(origin).host, 'content-type': 'application/json' },
      body: JSON.stringify({ identifier: 'customer', password: 'fixture', linkSocial: stale }),
    }))
    expect(await result.json()).toMatchObject({ socialLinked: false, redirectTo: '/account' })
    expect(fixture.attach).not.toHaveBeenCalled()
    expect((await activePendingSocial(current))?.provider).toBe('facebook')
  })

  it('requires registration terms and opens a local session only after the identity is linked', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    await complete(await authorize('register', 'google', analyticsGrant))
    let attempt = (await readSocialCookie('pending'))!.attempt
    const registerCustomer = (acceptedTerms: boolean) => register(request('/api/auth/register', { method: 'POST',
      headers: { origin, host: new URL(origin).host, 'content-type': 'application/json' }, body: JSON.stringify({
        firstName: 'Test', lastName: 'Customer', username: 'test.customer', email: 'fixture@example.test',
        password: 'test-password', confirmPassword: 'test-password', phone: '+201000000000', countryCode: 'EG', acceptedTerms, linkSocial: attempt,
      }),
    }))
    expect((await registerCustomer(false)).status).toBe(400)
    expect(fixture.transaction).not.toHaveBeenCalled()
    const tx = { socialIdentity: { upsert: fixture.attach } }
    fixture.transaction.mockImplementation(work => work(tx))
    fixture.register.mockResolvedValue({ id: 'new-customer', roles: ['CUSTOMER'] })
    fixture.attach.mockResolvedValue({ userId: 'other-owner' })
    expect((await registerCustomer(true)).status).toBe(409)
    expect(fixture.register).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ email: 'fixture@example.test' }), tx)
    expect(fixture.session).not.toHaveBeenCalled()
    expect(fixture.cookies.has(SOCIAL_MEASUREMENT_COOKIE)).toBe(false)
    await complete(await authorize('register', 'google', analyticsGrant))
    attempt = (await readSocialCookie('pending'))!.attempt
    fixture.attach.mockResolvedValue({ userId: 'new-customer' })
    expect((await registerCustomer(true)).status).toBe(201)
    expect(fixture.session).toHaveBeenCalledOnce()
    expect(await readSocialCookie('pending')).toBeNull()
    expect(await (await claim()).json()).toEqual({ events: [{ event: 'sp_sign_up', method: 'google', event_id: expect.stringMatching(/^so_[a-f0-9]{32}$/) }] })
  })

  it('runs the admin test while public sign-in is disabled and does not create a customer session', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    fixture.settings.set('auth.google.enabled', 'false')
    expect((await start(startRequest('test'), context())).status).toBe(403)
    fixture.current.mockResolvedValue({ id: 'admin' })
    fixture.permission.mockReturnValue(true)
    const result = await complete(await authorize('test', 'google', analyticsGrant))
    expect(result.headers.get('location')).toBe(origin + '/admin/settings?socialTest=google')
    expect(await (await status(request('/api/auth/social/google'), context())).json()).toMatchObject({ configured: true, test: true })
    expect(fixture.session).not.toHaveBeenCalled()
    expect(fixture.find).not.toHaveBeenCalled()
    expect(fixture.cookies.has(SOCIAL_MEASUREMENT_COOKIE)).toBe(false)
    fixture.settings.set('auth.google.clientSecret', sealSocialValue('replacement', googlePurpose))
    expect(await (await status(request('/api/auth/social/google'), context())).json()).toMatchObject({ configured: true, test: null })
  })
})

it('binds encrypted credentials to their setting key and never transfers a linked provider identity', async () => {
  const sealed = sealSocialValue('entry', googlePurpose)
  expect(sealed).not.toContain('entry')
  expect(openSocialValue(sealed, googlePurpose)).toBe('entry')
  expect(openSocialValue(sealed, facebookPurpose)).toBeNull()
  expect(openSocialValue(sealed, socialSecretPurpose('auth.google.clientSecret', 'another.apps.googleusercontent.com'))).toBeNull()
  const upsert = vi.fn().mockResolvedValue({ userId: 'existing-owner' })
  const client = { socialIdentity: { upsert } } as unknown as Parameters<typeof attachSocialIdentity>[0]
  await expect(attachSocialIdentity(client, 'different-customer', { provider: 'google', namespace: 'client-namespace', subject: 'subject' })).rejects.toThrow('already linked')
  expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ update: {} }))
})

describe('Facebook data deletion callback', () => {
  const path = '/api/auth/facebook/data-deletion'
  const sign = (override: Record<string, unknown> = {}, secret = 'fixture-facebook-secret') => {
    const payload = Buffer.from(JSON.stringify({ user_id: '987654', algorithm: 'HMAC-SHA256', issued_at: Math.floor(Date.now() / 1000), ...override })).toString('base64url')
    return `${createHmac('sha256', secret).update(payload).digest('base64url')}.${payload}`
  }
  const submit = (signed: string, url = origin + path) => deleteFacebook(new Request(url, { method: 'POST', body: new URLSearchParams({ signed_request: signed }) }))

  it('deletes only the matching Facebook identity and returns an opaque, readable receipt with sign-in disabled', async () => {
    fixture.settings.set('auth.facebook.enabled', 'false')
    const signed = sign()
    expect(await (await status(request('/api/auth/social/facebook'), context('facebook'))).json()).not.toHaveProperty('deletionUrl')
    fixture.current.mockResolvedValue({ id: 'administrator' })
    fixture.permission.mockReturnValue(true)
    expect(await (await status(request('/api/auth/social/facebook'), context('facebook'))).json()).toHaveProperty('deletionUrl', origin + path)
    const response = await submit(signed)
    expect(response.status).toBe(200)
    const receipt = await response.json()
    expect(receipt).toMatchObject({ url: expect.stringMatching(/data-deletion\?receipt=/), confirmation_code: expect.stringMatching(/^[a-f0-9]{32}$/) })
    expect(receipt.url).not.toContain(signed)
    expect(fixture.deleteIdentities).toHaveBeenCalledExactlyOnceWith({ where: {
      provider: 'facebook', namespace: socialNamespace('123456'), subject: '987654', authorizedAt: { lte: expect.any(Date) },
    } })
    const [, digest] = fixture.writeGate.mock.calls[0]
    expect(digest).toMatch(/^[a-f0-9]{64}$/)
    expect(fixture.writeGate.mock.invocationCallOrder[0]).toBeLessThan(fixture.deleteIdentities.mock.invocationCallOrder[0])
    const page = deletionStatus(new Request(receipt.url))
    expect(page.status).toBe(200)
    expect(await page.text()).toContain(receipt.confirmation_code)
    expect(deletionStatus(request(path + '?receipt=forged')).status).toBe(404)
    expect(fixture.session).not.toHaveBeenCalled()
  })

  it('rejects forged, oversized, expired and wrong-host requests before deletion', async () => {
    expect((await submit(sign({}, 'wrong-secret'))).status).toBe(403)
    expect((await submit(sign({ issued_at: 5 }))).status).toBe(403)
    expect((await submit(sign({ expires: 5 }))).status).toBe(403)
    expect((await submit('x'.repeat(4096))).status).toBe(400)
    expect((await submit(sign(), 'https://other.test' + path)).status).toBe(404)
    expect(fixture.deleteIdentities).not.toHaveBeenCalled()
  })

  it('does not issue a success receipt if the deletion fails', async () => {
    fixture.deleteIdentities.mockRejectedValue(new Error('private database failure'))
    const result = await submit(sign())
    expect(result.status).toBe(503)
    expect(await result.json()).toEqual({ error: 'Unable to process the Facebook data deletion request.' })
  })

  it('does not let the old secret authorize deletion in a replacement app namespace', async () => {
    fixture.settings.set('auth.facebook.appId', '654321')
    expect((await submit(sign())).status).toBe(503)
    expect(fixture.deleteIdentities).not.toHaveBeenCalled()
  })

  it('rejects a Facebook link started before deletion and accepts new authorization afterward', async () => {
    const through = new Date(Date.now())
    const identity = { provider: 'facebook', namespace: socialNamespace('123456'), subject: '987654' } as const
    const client = { $executeRaw: fixture.writeGate, $queryRaw: fixture.readGate,
      socialIdentity: { upsert: fixture.attach } } as unknown as Parameters<typeof attachSocialIdentity>[0]
    fixture.readGate.mockResolvedValue([{ revokedThrough: through }])
    await expect(attachSocialIdentity(client, 'owner', identity, through.getTime())).rejects.toThrow('authorization must be restarted')
    expect(fixture.attach).not.toHaveBeenCalled()
    fixture.attach.mockResolvedValue({ userId: 'owner' })
    await expect(attachSocialIdentity(client, 'owner', identity, through.getTime() + 1000)).resolves.toBeUndefined()
    expect(fixture.attach).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ create: expect.objectContaining({ authorizedAt: new Date(through.getTime() + 1000) }) }))
    fixture.readGate.mockResolvedValue([{ revokedThrough: null }])
    await expect(attachSocialIdentity(client, 'owner', identity, through.getTime() - 22 * 60_000)).rejects.toThrow('authorization must be restarted')
    expect(fixture.attach).toHaveBeenCalledOnce()
  })
})
