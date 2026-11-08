import { expect, it, vi } from 'vitest'
import { generateKeyPairSync } from 'node:crypto'
import { verifyTrackingHealth, admitTrackingHealthCheck } from '@/lib/server/tracking-health'
import { googleTrackingApi, GoogleTrackingApiError, type GoogleTrackingApi } from '@/lib/server/google-tracking-api'
import { browserTrackingHealth, normalizeGa4MeasurementId, overallTrackingHealth } from '@/lib/tracking-health'

const config = { enabled: true, containerId: 'GTM-KQ8GR36H', measurementId: 'G-ABC1234567' }
const env = { GOOGLE_TRACKING_GA4_PROPERTY_ID: '123' }
const tag = { type: 'googtag', firingTriggerId: ['42'], parameter: [{ key: 'tagId', type: 'template', value: config.measurementId }] }
function fixture(overrides: { tags?: object[]; historical?: number; recent?: number; stream?: string; fail?: string; keyUnavailable?: boolean } = {}) {
  return vi.fn<GoogleTrackingApi>(async (url, body) => {
    if (overrides.fail && url.includes(overrides.fail)) throw new GoogleTrackingApiError('google_permission_denied', 403)
    if (url.includes('containers:lookup')) return { publicId: config.containerId, path: 'accounts/12/containers/34' }
    if (url.endsWith('versions:live')) return { containerVersionId: '1', tag: overrides.tags ?? [tag] }
    if (url.includes('dataStreams')) return { dataStreams: [{ name: 'properties/123/dataStreams/456', webStreamData: { measurementId: overrides.stream ?? config.measurementId } }] }
    if (url.endsWith('runRealtimeReport')) return { metricHeaders: [{ name: 'eventCount' }], rows: [{ metricValues: [{ value: String(overrides.recent ?? 1) }] }] }
    if (overrides.keyUnavailable && JSON.stringify(body).includes('keyEvents')) throw new GoogleTrackingApiError('google_api_error', 400)
    return { metricHeaders: [{ name: 'eventCount' }, ...(!overrides.keyUnavailable ? [{ name: 'keyEvents' }] : [])], rows: [{ metricValues: [{ value: String(overrides.historical ?? 10) }, { value: '2' }] }] }
  })
}

it.each(['G-ABC1234567', ' g-abc1234567 '])('normalizes a valid GA4 Measurement ID: %s', value => expect(normalizeGa4MeasurementId(value)).toBe(config.measurementId))
it.each(['', 'G-', 'G-abc@123456', 'G-ABC 12345', 'GTM-ABC123', 'AW-123456789', '<script>', 'G-' + 'A'.repeat(21)])('rejects invalid GA4 IDs: %s', value => expect(normalizeGa4MeasurementId(value)).toBeNull())

it('does not claim a connection from saved IDs or missing Google credentials', async () => {
  const result = await verifyTrackingHealth(config, { env: {} })
  expect(result.configuration.status).toBe('verified')
  expect(result.published).toMatchObject({ status: 'not_verified', code: 'google_credentials_missing' })
  expect(result.ga4.status).toBe('not_verified')
  expect(result.overall).toBe('not_verified')
  expect(overallTrackingHealth([result.configuration])).toBe('not_verified')
})

it.each([
  [{ ...config, enabled: false }, 'gtm_disabled'],
  [{ ...config, containerId: 'bad' }, 'gtm_id_invalid'],
  [{ ...config, measurementId: '' }, 'ga4_id_invalid'],
] as const)('flags invalid or disabled configuration without pretending it is connected', async (input, code) => {
  expect((await verifyTrackingHealth(input, { env: {} })).configuration).toMatchObject({ status: 'action_required', code })
})

it('verifies only the live API version and the exact stream, with aggregate hostname filters', async () => {
  const api = fixture()
  const result = await verifyTrackingHealth(config, { env, api })
  expect(result.published).toMatchObject({ status: 'verified', code: 'published_destination_matched' })
  expect(result.ga4).toMatchObject({ status: 'verified', evidence: { eventsLast7CompleteDays: 10, keyEventsLast7CompleteDays: 2 } })
  expect(result.overall).toBe('not_verified')
  expect(JSON.stringify(api.mock.calls)).toContain('versions:live')
  expect(JSON.stringify(api.mock.calls)).not.toContain('/workspaces/')
  const report = api.mock.calls.find(([url]) => url.endsWith(':runReport'))![1]
  expect(report).toMatchObject({ dateRanges: [{ startDate: '7daysAgo', endDate: 'yesterday' }] })
  expect(JSON.stringify(report)).toContain('starpyramids.com')
  expect(JSON.stringify(report)).toContain('456')
})

it.each([
  [[], 'published_empty', 'action_required'],
  [[{ ...tag, paused: true }], 'published_tag_inactive', 'action_required'],
  [[{ ...tag, parameter: [{ key: 'tagId', type: 'template', value: 'G-OTHER12345' }] }], 'published_destination_mismatch', 'action_required'],
  [[{ ...tag, parameter: [{ key: 'tagId', type: 'template', value: '{{GA4 ID}}' }] }], 'published_destination_unresolved', 'not_verified'],
] as const)('distinguishes empty, inactive, mismatched and unresolved published tags', async (tags, code, status) => {
  const result = await verifyTrackingHealth(config, { env, api: fixture({ tags: [...tags] }) })
  expect(result.published).toMatchObject({ code, status })
})

it('does not attribute reception from the wrong GA4 stream', async () => {
  const api = fixture({ stream: 'G-OTHER12345' })
  expect((await verifyTrackingHealth(config, { env, api })).ga4.code).toBe('ga4_stream_mismatch')
  expect(api.mock.calls.some(([url]) => url.endsWith('runReport'))).toBe(false)
})

it.each([[0, 'ga4_no_recent_data'], [3, 'ga4_reporting_delay']] as const)('does not infer failure or success from zero completed-day data', async (recent, code) => {
  const result = await verifyTrackingHealth(config, { env, api: fixture({ historical: 0, recent }) })
  expect(result.ga4).toMatchObject({ status: 'not_verified', code })
})

it('keeps reception and published permissions independent and hides upstream details', async () => {
  const result = await verifyTrackingHealth(config, { env, api: fixture({ fail: 'tagmanager.googleapis.com' }) })
  expect(result.published).toMatchObject({ status: 'action_required', code: 'google_permission_denied' })
  expect(result.ga4.status).toBe('verified')
  const analyticsDenied = await verifyTrackingHealth(config, { env, api: fixture({ fail: 'analyticsadmin' }) })
  expect(analyticsDenied.ga4.code).toBe('google_permission_denied')
  expect(analyticsDenied.published.status).toBe('verified')
})

it('supports aggregate event counts when key-event metrics are unavailable', async () => {
  const result = await verifyTrackingHealth(config, { env, api: fixture({ keyUnavailable: true }) })
  expect(result.ga4).toMatchObject({ status: 'verified', evidence: { keyEventsLast7CompleteDays: null, eventsLast7CompleteDays: 10 } })
})

it.each(['google_timeout', 'google_api_error'] as const)('safely reports Google check failure: %s', async code => {
  const result = await verifyTrackingHealth(config, { env, api: async () => { throw new GoogleTrackingApiError(code) } })
  expect(result.published).toMatchObject({ status: 'error', code })
  expect(result.ga4).toMatchObject({ status: 'error', code })
})

it('bounds per-admin checks without writing to the database', () => {
  const now = Date.now()
  expect(admitTrackingHealthCheck('fixture-admin', now)).toBe(true)
  expect(admitTrackingHealthCheck('fixture-admin', now + 1)).toBe(false)
  expect(admitTrackingHealthCheck('fixture-admin', now + 60001)).toBe(true)
})

it('classifies only fresh consent-aware browser evidence and never counts denied defaults as a fault', () => {
  const snapshot = { observedAt: new Date().toISOString(), containerId: config.containerId, eligible: true, analytics: false, marketing: false, script: 'not_loaded' }
  expect(browserTrackingHealth(snapshot, config.containerId).code).toBe('browser_consent_denied')
  expect(browserTrackingHealth({ ...snapshot, analytics: true, script: 'loaded' }, config.containerId).status).toBe('verified')
  expect(browserTrackingHealth({ ...snapshot, analytics: true, script: 'failed' }, config.containerId).status).toBe('error')
  expect(browserTrackingHealth({ ...snapshot, eligible: false }, config.containerId).status).toBe('not_verified')
  expect(browserTrackingHealth({ ...snapshot, observedAt: '2000-01-01' }, config.containerId).status).toBe('not_verified')
})

it('pins credential exchange and API destinations, requests only read-only scopes and never follows credential URLs', async () => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  const credential = JSON.stringify({ type: 'service_account', client_email: 'fixture@fixture.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }), token_uri: 'https://attacker.invalid' })
  const request = vi.fn<typeof fetch>().mockImplementation(async url => String(url).includes('oauth2') ? Response.json({ access_token: 'fixture-test-token' }) : Response.json({ publicId: config.containerId }))
  const api = googleTrackingApi(credential, request)
  await api('https://tagmanager.googleapis.com/tagmanager/v2/accounts/containers:lookup?tagId=GTM-KQ8GR36H')
  expect(request.mock.calls[0][0]).toBe('https://oauth2.googleapis.com/token')
  const assertion = new URLSearchParams(request.mock.calls[0][1]!.body as string).get('assertion')!
  const claims = JSON.parse(Buffer.from(assertion.split('.')[1], 'base64url').toString())
  expect(claims.scope.split(' ')).toEqual(['https://www.googleapis.com/auth/tagmanager.readonly', 'https://www.googleapis.com/auth/analytics.readonly'])
  expect(request.mock.calls[1][1]).toMatchObject({ method: 'GET', redirect: 'error', cache: 'no-store' })
  await expect(api('https://attacker.invalid')).rejects.toMatchObject({ code: 'google_api_error' })
  expect(request).toHaveBeenCalledTimes(2)
})

it('does not leak malformed credentials or token endpoint errors', async () => {
  const request = vi.fn<typeof fetch>()
  await expect(googleTrackingApi('{"private_key":"secret"}', request)('https://tagmanager.googleapis.com/tagmanager/v2/accounts/containers:lookup?tagId=GTM-KQ8GR36H')).rejects.toMatchObject({ message: 'google_credentials_invalid' })
  expect(request).not.toHaveBeenCalled()
})
