import 'server-only'
import { safeProviderUrl, type ProviderReview, type ReviewConfig, type ReviewFeed, type ReviewProvider } from '@/lib/review-integrations'
type Json = Record<string, unknown>
const object = (v: unknown): Json => v && typeof v === 'object' && !Array.isArray(v) ? v as Json : {}
const str = (v: unknown, max = 6000) => typeof v === 'string' ? v.slice(0, max) : ''
const numeric = (v: unknown) => (typeof v === 'number' || typeof v === 'string' && v.trim() !== '') ? Number(v) : NaN
const rating = (v: unknown) => { const n = numeric(v); return Number.isFinite(n) && n >= 0 && n <= 5 ? n : null }
const count = (v: unknown) => { const n = numeric(v); return Number.isSafeInteger(n) && n >= 0 ? n : null }
function imageUrl(v: unknown): string {
  try { const u = new URL(str(v)); return ['http:', 'https:'].includes(u.protocol) && ['www.tripadvisor.com', 'media-cdn.tripadvisor.com'].includes(u.hostname) ? u.href.replace(/^http:/, 'https:') : '' } catch { return '' }
}
async function requestJson(url: string, headers?: HeadersInit): Promise<Json> {
  let response: Response
  try { response = await fetch(url, { headers, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(10000) }) }
  catch { throw Error('Provider could not be reached. Retry or check your server network.') }
  if (!response.ok) throw Error(response.status === 401 || response.status === 403 ? 'Provider rejected access. Check the key, subscription and API restrictions.' : response.status === 429 ? 'Provider rate limit reached. Try again later.' : 'Provider request failed. Check your resource ID and subscription.')
  const reader = response.body?.getReader()
  if (!reader) throw Error('Provider returned an empty response.')
  const chunks: Uint8Array[] = []; let size = 0
  while (true) { const part = await reader.read(); if (part.done) break; size += part.value.length; if (size > 1000000) { await reader.cancel(); throw Error('Provider response exceeded the size limit.') }; chunks.push(part.value) }
  try { return object(JSON.parse(Buffer.concat(chunks).toString('utf8'))) } catch { throw Error('Provider returned invalid JSON.') }
}
export async function fetchReviewProvider(provider: ReviewProvider, config: ReviewConfig, secret: string): Promise<ReviewFeed> {
  const empty: ReviewFeed = { provider, state: 'not_connected', profileUrl: config.profileUrl, reviews: [], average: null, count: null }
  if (provider === 'getyourguide') return { ...empty, state: 'partner_access_required' }
  if (provider === 'trustindex') return { ...empty, state: config.widgetId ? 'widget_configured' : 'not_connected', widgetId: config.widgetId || undefined }
  if (!secret || !config.resourceId) return empty
  if (provider === 'google') {
    const data = await requestJson(`https://places.googleapis.com/v1/places/${encodeURIComponent(config.resourceId)}`, { 'X-Goog-Api-Key': secret, 'X-Goog-FieldMask': 'id,rating,userRatingCount,reviews,googleMapsUri' })
    if (!str(data.id)) throw Error('Provider response did not identify the requested place.')
    const rows = Array.isArray(data.reviews) ? data.reviews : []
    const reviews: ProviderReview[] = rows.slice(0, 5).flatMap((v, index) => {
      const r = object(v), author = object(r.authorAttribution), text = object(r.text), original = object(r.originalText), stars = rating(r.rating)
      if (stars === null || !str(author.displayName)) return []
      return [{ id: str(r.name, 300) || String(index), author: str(author.displayName, 150), authorUrl: safeProviderUrl(author.uri, 'google'), rating: stars, text: str(text.text) || str(original.text), date: str(r.publishTime, 80), url: safeProviderUrl(r.googleMapsUri, 'google') }]
    })
    return { ...empty, state: 'connected', profileUrl: safeProviderUrl(data.googleMapsUri, 'google') || config.profileUrl, reviews, average: rating(data.rating), count: count(data.userRatingCount) }
  }
  const base = `https://api.content.tripadvisor.com/api/v1/location/${encodeURIComponent(config.resourceId)}`
  const query = `?key=${encodeURIComponent(secret)}&language=en`
  const [details, data] = await Promise.all([requestJson(`${base}/details${query}`), requestJson(`${base}/reviews${query}`)])
  if (!str(details.location_id)) throw Error('Provider response did not identify the requested location.')
  const reviews: ProviderReview[] = (Array.isArray(data.data) ? data.data : []).slice(0, 5).flatMap((v, index) => {
    const r = object(v), user = object(r.user), stars = rating(r.rating)
    if (stars === null || !str(user.username)) return []
    return [{ id: str(r.id) || String(index), author: str(user.username, 150), authorUrl: safeProviderUrl(user.profile_url, 'tripadvisor'), rating: stars, text: str(r.text), date: str(r.published_date, 80), url: safeProviderUrl(r.url, 'tripadvisor'), ratingImageUrl: imageUrl(r.rating_image_url) }]
  })
  return { ...empty, state: 'connected', profileUrl: safeProviderUrl(details.web_url, 'tripadvisor') || config.profileUrl, average: rating(details.rating), count: count(details.num_reviews), reviews }
}
