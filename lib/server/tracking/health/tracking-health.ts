import 'server-only'
import { isValidGtmContainerId, normalizeGtmContainerId } from '@/lib/tracking/tracking'
import { normalizeGa4MeasurementId, overallTrackingHealth, type TrackingHealthCheck, type TrackingHealthConfig, type TrackingHealthReport } from '@/lib/tracking/health/tracking-health'
import { googleTrackingApi, GoogleTrackingApiError, type GoogleTrackingApi } from './google-tracking-api'

const check = (status: TrackingHealthCheck['status'], code: string, evidence?: TrackingHealthCheck['evidence']): TrackingHealthCheck => ({ status, code, ...(evidence ? { evidence } : {}) })
function failure(error: unknown): TrackingHealthCheck {
  if (error instanceof GoogleTrackingApiError) return check(['google_permission_denied', 'google_auth_failed', 'google_credentials_invalid'].includes(error.code) ? 'action_required' : 'error', error.code)
  return check('error', 'google_api_error')
}
type Tag = { type?: string; paused?: boolean; firingTriggerId?: string[]; parameter?: { key?: string; type?: string; value?: string }[] }

async function publishedCheck(config: TrackingHealthConfig, api: GoogleTrackingApi): Promise<TrackingHealthCheck> {
  try {
    const container = await api(`https://tagmanager.googleapis.com/tagmanager/v2/accounts/containers:lookup?tagId=${config.containerId}`)
    if (container.publicId !== config.containerId || typeof container.path !== 'string' || !/^accounts\/[0-9]+\/containers\/[0-9]+$/.test(container.path)) return check('not_verified', 'container_lookup_unresolved')
    const live = await api(`https://tagmanager.googleapis.com/tagmanager/v2/${container.path}/versions:live`)
    if (!live.containerVersionId || live.deleted === true) return check('not_verified', 'published_version_missing')
    const tags = live.tag === undefined ? [] : live.tag
    if (!Array.isArray(tags)) throw Error()
    const evidence = { tagCount: tags.length }
    if (!tags.length) return check('action_required', 'published_empty', evidence)
    const googleTags = (tags as Tag[]).filter(t => t && (t.type === 'googtag' || t.type === 'gaawc'))
    const matches = googleTags.filter(t => t.parameter?.some(p => ['tagId', 'measurementId'].includes(p.key ?? '') && p.type === 'template' && p.value === config.measurementId))
    if (matches.some(t => !t.paused && Array.isArray(t.firingTriggerId) && t.firingTriggerId.length)) return check('verified', 'published_destination_matched', { ...evidence, matchingGoogleTags: matches.length })
    if (matches.length) return check('action_required', 'published_tag_inactive', evidence)
    const staticIds = googleTags.flatMap(t => t.parameter?.filter(p => ['tagId', 'measurementId'].includes(p.key ?? '') && normalizeGa4MeasurementId(p.value)).map(p => p.value) ?? [])
    return check(staticIds.length ? 'action_required' : 'not_verified', staticIds.length ? 'published_destination_mismatch' : 'published_destination_unresolved', evidence)
  } catch (error) { return failure(error) }
}

function metric(report: Record<string, unknown>, name: string): number | null {
  const headers = report.metricHeaders as { name?: string }[] | undefined
  if (!Array.isArray(headers)) return null
  const index = headers?.findIndex(h => h.name === name) ?? -1
  if (index < 0 || report.rows !== undefined && !Array.isArray(report.rows) || report.rows === undefined && report.rowCount !== undefined && report.rowCount !== 0) return null
  const rows = (report.rows ?? []) as { metricValues?: { value?: string }[] }[]
  let total = 0
  for (const row of rows) {
    const raw = row.metricValues?.[index]?.value
    if (typeof raw !== 'string' || !/^\d+(?:\.\d+)?$/.test(raw)) return null
    total += Number(raw)
  }
  return Number.isFinite(total) ? total : null
}

async function receptionCheck(config: TrackingHealthConfig, property: string, api: GoogleTrackingApi): Promise<TrackingHealthCheck> {
  if (!/^[1-9][0-9]{0,19}$/.test(property)) return check('not_verified', 'ga4_property_missing')
  try {
    let stream: string | undefined
    let pageToken = ''
    for (let page = 0; page < 5; page++) {
      const streams = await api(`https://analyticsadmin.googleapis.com/v1beta/properties/${property}/dataStreams?pageSize=200${pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : ''}`)
      if (!Array.isArray(streams.dataStreams) && streams.dataStreams !== undefined) throw Error()
      const matched = (streams.dataStreams ?? []) as { name?: string; webStreamData?: { measurementId?: string } }[]
      stream = matched.find(s => s.webStreamData?.measurementId === config.measurementId)?.name
      if (stream) break
      if (typeof streams.nextPageToken !== 'string' || !streams.nextPageToken) break
      pageToken = streams.nextPageToken
      if (page === 4) return check('not_verified', 'ga4_stream_unresolved')
    }
    const streamMatch = stream?.match(new RegExp(`^properties/${property}/dataStreams/([0-9]+)$`))
    if (!streamMatch) return check('action_required', 'ga4_stream_mismatch')
    const filter = { filter: { fieldName: 'streamId', stringFilter: { matchType: 'EXACT', value: streamMatch[1] } } }
    const body = {
      dateRanges: [{ startDate: '7daysAgo', endDate: 'yesterday' }], metrics: [{ name: 'eventCount' }, { name: 'keyEvents' }],
      dimensionFilter: { andGroup: { expressions: [filter, { filter: { fieldName: 'hostName', inListFilter: { values: ['starpyramids.com', 'www.starpyramids.com'] } } }] } },
    }
    const historic = (async () => {
      try { return await api(`https://analyticsdata.googleapis.com/v1beta/properties/${property}:runReport`, body) }
      catch (error) {
        if (!(error instanceof GoogleTrackingApiError) || error.status !== 400) throw error
        return api(`https://analyticsdata.googleapis.com/v1beta/properties/${property}:runReport`, { ...body, metrics: [{ name: 'eventCount' }] })
      }
    })()
    const realtime = api(`https://analyticsdata.googleapis.com/v1beta/properties/${property}:runRealtimeReport`, { metrics: [{ name: 'eventCount' }], dimensionFilter: filter })
    const [history, recent] = await Promise.allSettled([historic, realtime])
    const events = history.status === 'fulfilled' ? metric(history.value, 'eventCount') : null
    const realtimeEvents = recent.status === 'fulfilled' ? metric(recent.value, 'eventCount') : null
    const evidence = { eventsLast7CompleteDays: events, keyEventsLast7CompleteDays: history.status === 'fulfilled' ? metric(history.value, 'keyEvents') : null, streamEventsLast30Minutes: realtimeEvents,
      realtimeStatus: recent.status === 'rejected' ? failure(recent.reason).code : realtimeEvents === null ? 'invalid_response' : 'available' }
    if (events !== null && events > 0) return check('verified', 'ga4_data_received', evidence)
    // Realtime lacks a hostname dimension. Its stream-level count is supporting evidence only.
    if (history.status === 'rejected') return { ...failure(history.reason), evidence }
    if (events === null) return check('error', 'google_api_error', evidence)
    return check('not_verified', realtimeEvents !== null && realtimeEvents > 0 ? 'ga4_reporting_delay' : 'ga4_no_recent_data', evidence)
  } catch (error) { return failure(error) }
}

export async function verifyTrackingHealth(config: TrackingHealthConfig, options: { env?: Record<string, string | undefined>; api?: GoogleTrackingApi } = {}): Promise<TrackingHealthReport> {
  config = { enabled: config.enabled === true, containerId: normalizeGtmContainerId(config.containerId) ?? '', measurementId: normalizeGa4MeasurementId(config.measurementId) ?? '' }
  const env = options.env ?? process.env
  const configuration = { ...(!config.enabled ? check('action_required', 'gtm_disabled') : !isValidGtmContainerId(config.containerId) ? check('action_required', 'gtm_id_invalid') : !normalizeGa4MeasurementId(config.measurementId) ? check('action_required', 'ga4_id_invalid') : check('verified', 'configuration_valid')), evidence: { containerId: config.containerId, measurementId: config.measurementId } }
  const credentials = env.GOOGLE_TRACKING_SERVICE_ACCOUNT_JSON
  const api = options.api ?? (credentials ? googleTrackingApi(credentials) : undefined)
  const published = isValidGtmContainerId(config.containerId) && normalizeGa4MeasurementId(config.measurementId) ? (api ? publishedCheck(config, api) : Promise.resolve(check('not_verified', 'google_credentials_missing'))) : Promise.resolve(check('not_verified', 'configuration_incomplete'))
  const ga4 = normalizeGa4MeasurementId(config.measurementId) ? (api ? receptionCheck(config, env.GOOGLE_TRACKING_GA4_PROPERTY_ID ?? '', api) : Promise.resolve(check('not_verified', 'google_credentials_missing'))) : Promise.resolve(check('not_verified', 'configuration_incomplete'))
  const [publishedResult, ga4Result] = await Promise.all([published, ga4])
  const browser = check('not_verified', 'browser_no_observation')
  return { checkedAt: new Date().toISOString(), configuration, published: publishedResult, browser, ga4: ga4Result, config,
    overall: overallTrackingHealth([configuration, publishedResult, browser, ga4Result]) }
}

// Per-process quota protection, bounded and ephemeral. Multi-instance hosting also needs an edge limit.
const checks = new Map<string, number>()
let windowStart = 0
let windowCount = 0
export function admitTrackingHealthCheck(actor: string, now = Date.now()): boolean {
  for (const [key, at] of checks) if (at + 60000 <= now) checks.delete(key)
  if (now - windowStart >= 60000) { windowStart = now; windowCount = 0 }
  if (checks.has(actor) || checks.size >= 500 || windowCount >= 20) return false
  checks.set(actor, now); windowCount++
  return true
}
