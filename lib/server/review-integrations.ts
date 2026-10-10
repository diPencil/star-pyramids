import 'server-only'
import { db } from './db'
import { openReviewSecret, sealReviewSecret } from './review-credentials'
import { fetchReviewProvider } from './review-providers'
import { REVIEW_PROVIDERS, validateReviewConfig, type ReviewAdmin, type ReviewConfig, type ReviewFeed, type ReviewProvider } from '@/lib/review-integrations'
const prefix = 'reviews.integration.'
type Stored = ReviewConfig & { credential?: string; checkedAt?: string; state?: ReviewAdmin['state']; message?: string; readonly revision?: string | null }
const defaultConfig: ReviewConfig = { enabled: false, resourceId: '', profileUrl: '', widgetId: '' }
function withRevision(value: Stored, revision: string | null): Stored {
  return Object.defineProperty(value, 'revision', { value: revision, enumerable: false })
}
async function read(provider: ReviewProvider): Promise<Stored> {
  const row = await db.siteSetting.findUnique({ where: { key: prefix + provider } })
  if (!row) return withRevision({ ...defaultConfig }, null)
  try { const parsed = JSON.parse(row.value) as Stored; return withRevision({ ...parsed, ...validateReviewConfig({ enabled: parsed.enabled, resourceId: parsed.resourceId, profileUrl: parsed.profileUrl, widgetId: parsed.widgetId }, provider) }, row.value) }
  catch { throw Error('Stored review configuration could not be read. Contact the administrator.') }
}
function admin(provider: ReviewProvider, v: Stored): ReviewAdmin {
  return { provider, enabled: v.enabled, resourceId: v.resourceId, profileUrl: v.profileUrl, widgetId: v.widgetId, secretConfigured: Boolean(v.credential), state: v.state || 'not_connected', checkedAt: v.checkedAt || null, message: v.message || '' }
}
export async function getReviewIntegrations() { return Promise.all(REVIEW_PROVIDERS.map(async p => admin(p, await read(p)))) }
async function write(provider: ReviewProvider, value: Stored, before: Stored) {
  // No review text or provider ratings are persisted. Credentials are authenticated ciphertext.
  const key = prefix + provider
  if (before.revision === null) {
    try { await db.siteSetting.create({ data: { key, value: JSON.stringify(value), description: 'Review integration configuration (encrypted credentials)' } }) }
    catch { throw Error('Configuration changed or could not be saved. Reload settings before retrying.') }
  } else {
    const updated = await db.siteSetting.updateMany({ where: { key, value: before.revision }, data: { value: JSON.stringify(value) } })
    if (updated.count !== 1) throw Error('Configuration changed. Reload settings before retrying.')
  }
}
export async function saveReviewIntegration(provider: ReviewProvider, config: unknown, secret: unknown, clearSecret: unknown) {
  const next = validateReviewConfig(config, provider)
  if (typeof secret !== 'string' || secret.length > 2000 || /[\u0000-\u0020\u007f]/.test(secret)) throw Error('Invalid API key.')
  if (typeof clearSecret !== 'boolean') throw Error('Invalid credential action.')
  if (secret && clearSecret) throw Error('Choose either replace or remove the API key.')
  if (secret && !['google', 'tripadvisor'].includes(provider)) throw Error('This integration does not accept an API key.')
  const old = await read(provider)
  const credential = clearSecret ? undefined : secret ? sealReviewSecret(secret, provider) : old.credential
  const value: Stored = { ...next, credential, state: 'not_connected', message: 'Configuration saved. Test the connection before publishing.' }
  await write(provider, value, old)
  return admin(provider, value)
}
async function status(provider: ReviewProvider, before: Stored, state: ReviewAdmin['state'], message: string) {
  // Compare-and-set prevents a slow test overwriting a newer key/configuration.
  if (before.revision === null) return
  await db.siteSetting.updateMany({ where: { key: prefix + provider, value: before.revision }, data: { value: JSON.stringify({ ...before, state, checkedAt: new Date().toISOString(), message }) } })
}
const pending = new Map<string, Promise<ReviewFeed>>()
const calls = new Map<ReviewProvider, number[]>()
export async function loadReviewFeed(provider: ReviewProvider, test = false): Promise<ReviewFeed> {
  const config = await read(provider)
  const empty: ReviewFeed = { provider, state: 'not_connected', profileUrl: '', reviews: [], average: null, count: null }
  if (!test && !config.enabled) return { ...empty, enabled: false }
  const requestKey = `${provider}:${test ? 'test' : 'public'}:${JSON.stringify(config)}`
  if (pending.has(requestKey)) return pending.get(requestKey)!
  const recent = (calls.get(provider) || []).filter(t => Date.now() - t < 60000)
  if (recent.length >= 30) throw Error('Review request limit reached. Try again in a minute.')
  calls.set(provider, [...recent, Date.now()])
  const task = (async () => {
    let result: ReviewFeed
    try { result = await fetchReviewProvider(provider, config, config.credential ? openReviewSecret(config.credential, provider) : '') }
    catch (error) {
      if (test) await status(provider, config, 'error', error instanceof Error ? error.message : 'Connection failed.')
      throw error
    }
    if (test) await status(provider, config, result.state, result.state === 'connected' ? 'Provider returned a valid live response.' : result.state === 'widget_configured' ? 'Widget ID saved. Verify the published widget visually; configuration is not a verified connection.' : result.state === 'partner_access_required' ? 'GetYourGuide partner approval and account-specific review API documentation are required.' : 'Enter the resource ID and API key first.')
    return { ...result, enabled: config.enabled }
  })()
  pending.set(requestKey, task)
  try { return await task } finally { pending.delete(requestKey) }
}
