export const DEFAULT_GTM_CONTAINER_ID = 'GTM-KQ8GR36H'
export const TRACKING_CONSENT_STORAGE_KEY = 'sp-consent'
export const TRACKING_ELIGIBLE_HEADER = 'x-sp-tracking-eligible'
export const DOCUMENT_LOCATION_CHANGE_EVENT = 'sp:location-change'
export type TrackingGrants = { analytics?: string; marketing?: string }
export const isTrackingGrant = (value: unknown): value is string =>
  typeof value === 'string' && value.length === 36 && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value)

const GTM_CONTAINER_ID_PATTERN = /^GTM-[A-Z0-9]{4,12}$/
const PRODUCTION_HOSTS = new Set(['starpyramids.com', 'www.starpyramids.com'])
const PUBLIC_PAGES = new Set([
  '/', '/about', '/accessible-travel', '/egypt-travel-guide', '/faq', '/privacy',
  '/rent-car', '/rent-car/request', '/contact', '/terms', '/trips', '/make-your-trip', '/cart', '/checkout', '/booking-confirmation',
])
const CATALOGUE_PATH = /^\/(?:blogs|destinations|egypt-tours|events|special-offers)(?:\/[a-z0-9]{1,32}(?:-[a-z0-9]{1,32})*){0,3}$/
// Literal section links already rendered by the public site. Unknown fragments
// may contain credentials; never treat a well-formed fragment as safe by itself.
const PUBLIC_ANCHORS: Readonly<Record<string, readonly string[]>> = {
  '/about': ['#our-story', '#travel-styles'],
  '/contact': ['#contact-enquiry'],
  '/rent-car': ['#fleet'],
  '/destinations': ['#destinations-catalogue'],
  '/blogs': ['#blog-stories'],
  '/special-offers': ['#current-offers'],
  '/egypt-tours/one-day-tours': ['#one-day-regions'],
  '/egypt-tours/multi-days-tours': ['#multi-day-categories'],
  '/egypt-tours/nile-cruises': ['#cruise-types'],
  '/egypt-tours/shore-excursions': ['#tour-listing'],
}
const EVENT_DETAIL = /^\/events\/[a-z0-9]{1,32}(?:-[a-z0-9]{1,32})*$/
const DESTINATION_DETAIL = /^\/destinations\/[a-z0-9]{1,32}(?:-[a-z0-9]{1,32})*$/
const REVIEWED_PUBLIC_PLACES = 'Alexandria|Aswan|Cairo|Giza|Hurghada|Luxor|Nile Valley|Port Said|Red Sea|Sharm El Sheikh|White Desert'
const PUBLIC_DESTINATION_FILTER = new RegExp(`^(?:${REVIEWED_PUBLIC_PLACES})(?:(?:, | & )(?:${REVIEWED_PUBLIC_PLACES})){0,5}$`)
const CLICK_ID = /^[A-Za-z0-9_-]{1,256}$/
// Campaign labels are bounded words or slugs. Exclude URLs, email addresses,
// phone-only strings and control characters after URL decoding.
const CAMPAIGN_LABEL = /^(?=[A-Za-z0-9 _-]{1,100}$)(?=[A-Za-z0-9 _-]*[A-Za-z])[A-Za-z0-9]+(?:[ _-][A-Za-z0-9]+)*$/
const CAMPAIGN_NAME = new RegExp(`${CAMPAIGN_LABEL.source}|^[0-9]{1,20}$`)
const CAMPAIGN_ID = /^(?:[0-9]{1,20}|(?=[A-Za-z0-9_-]{1,64}$)(?=[A-Za-z0-9_-]*[A-Za-z])[A-Za-z0-9]+(?:[_-][A-Za-z0-9]+)*)$/
export const TAG_ASSISTANT_DEBUG_VALUE = /^(?:x|[1-9][0-9]{12})$/
const PUBLIC_QUERY_VALUES: ReadonlyMap<string, RegExp> = new Map([
  // Tag Assistant adds a debug flag or millisecond timestamp to the landing URL.
  // This permits preview eligibility only; consent and URL payload stripping still apply.
  ['gtm_debug', TAG_ASSISTANT_DEBUG_VALUE],
  ['page', /^[1-9][0-9]{0,5}$/],
  ['gclid', CLICK_ID],
  ['dclid', CLICK_ID],
  ['gbraid', CLICK_ID],
  ['wbraid', CLICK_ID],
  ['gclsrc', /^(?:aw\.ds|ds)$/],
  ['gad_source', /^[0-9]{1,8}$/],
  ['gad_campaignid', /^[0-9]{1,20}$/],
  ['utm_id', CAMPAIGN_ID],
  ['utm_source', CAMPAIGN_LABEL],
  ['utm_medium', CAMPAIGN_LABEL],
  ['utm_campaign', CAMPAIGN_NAME],
  ['utm_source_platform', CAMPAIGN_LABEL],
  ['utm_term', CAMPAIGN_LABEL],
  ['utm_content', CAMPAIGN_NAME],
  ['utm_creative_format', CAMPAIGN_LABEL],
  ['utm_marketing_tactic', CAMPAIGN_LABEL],
])
const CATALOGUE_FILTER_VALUES: ReadonlyMap<string, RegExp> = new Map([
  ['category', /^(?:one-day-tours|multi-days-tours|nile-cruises|shore-excursions)$/],
  // Public dropdown values, not arbitrary location or duration text. New CMS
  // place names require review; unrecognized values continue to fail closed.
  ['destination', PUBLIC_DESTINATION_FILTER],
  ['duration', /^(?:day|short|long|Full Day|Duration on request|(?:About )?[1-9][0-9]? (?:Hours?|Days?|Nights?))$/],
  ['price', /^(?:under-200|200-400|over-400)$/],
  ['sort', /^(?:Recommended|Price: low to high|Price: high to low)$/],
])
// Public planner entry parameters only. Edit references, contact details,
// free text and arbitrary query keys must never enter a GTM document.
const PLANNER_QUERY_VALUES: ReadonlyMap<string, RegExp> = new Map([
  ['from', /^20\d{2}-\d{2}-\d{2}$/], ['to', /^20\d{2}-\d{2}-\d{2}$/], ['date', /^20\d{2}-\d{2}-\d{2}$/],
  ['tour', /^[a-z0-9]{1,32}(?:-[a-z0-9]{1,32}){0,5}$/],
  ['destination', /^[a-z0-9]{1,32}(?:-[a-z0-9]{1,32}){0,3}$/],
  ['guests', /^(?:[1-9]|[1-4][0-9]|50)$/],
  ['adults', /^(?:[0-9]|[1-4][0-9]|50)$/], ['children', /^(?:[0-9]|[1-4][0-9]|50)$/], ['infants', /^(?:[0-9]|[1-4][0-9]|50)$/],
  ['step', /^[12]$/], ['addons', /^(?:0|[1-9][0-9]?)(?:,(?:0|[1-9][0-9]?)){0,19}$/],
  ['src', /^blog_vip_trip$/], ['blog', /^[a-z0-9]{1,32}(?:-[a-z0-9]{1,32}){0,3}$/],
])
const CAR_QUERY_VALUES: ReadonlyMap<string, RegExp> = new Map([
  ['vehicle', /^[a-z0-9]{1,32}(?:-[a-z0-9]{1,32}){0,3}$/],
  ['type', /^(?:One Way|Round Trip)$/], ['date', /^20\d{2}-\d{2}-\d{2}$/],
])

export interface TrackingSettings {
  enabled: boolean
  containerId: string
}

export function normalizeGtmContainerId(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const id = value.trim()
  return GTM_CONTAINER_ID_PATTERN.test(id) ? id : null
}

export function isValidGtmContainerId(value: unknown): value is string {
  return normalizeGtmContainerId(value) !== null
}

export function resolveTrackingSettings(input: { enabled?: unknown; containerId?: unknown }): TrackingSettings {
  const rawEnabled = typeof input.enabled === 'string' ? input.enabled.trim().toLowerCase() : ''
  const rawContainerId = typeof input.containerId === 'string' ? input.containerId.trim() : ''
  const configured = rawContainerId ? normalizeGtmContainerId(rawContainerId) : null
  const containerId = rawContainerId ? configured ?? '' : DEFAULT_GTM_CONTAINER_ID
  return {
    enabled: containerId !== '' && (rawEnabled === '' || rawEnabled === 'true'),
    containerId,
  }
}

export function isProductionTrackingHost(environment: string | undefined, host: string): boolean {
  return environment === 'production' && PRODUCTION_HOSTS.has(host.toLowerCase())
}

/** Allow only public catalogue URLs and typed parameters. A tag can read the
 * actual URL, so dropping a parameter from a payload alone is insufficient. */
export function isSafeTrackingUrl(url: URL): boolean {
  if (url.username || url.password) return false
  const path = url.pathname.replace(/\/$/, '') || '/'
  if (!PUBLIC_PAGES.has(path) && !CATALOGUE_PATH.test(path)) return false
  if (url.hash && !PUBLIC_ANCHORS[path]?.includes(url.hash) &&
      !(EVENT_DETAIL.test(path) && ['#event-book', '#event-program'].includes(url.hash)) &&
      !(DESTINATION_DETAIL.test(path) && url.hash === '#destination-experiences')) return false
  const isTourListing = path === '/trips' || path.startsWith('/egypt-tours/')
  const seen = new Set<string>()
  for (const [key, value] of url.searchParams) {
    const pattern = (path === '/booking-confirmation' && key === 'flow' ? /^[a-f0-9]{32}$/ : undefined) ??
      (path === '/make-your-trip' ? PLANNER_QUERY_VALUES.get(key) : undefined) ??
      (path === '/rent-car/request' ? CAR_QUERY_VALUES.get(key) : undefined) ??
      PUBLIC_QUERY_VALUES.get(key) ?? (isTourListing ? CATALOGUE_FILTER_VALUES.get(key) : undefined)
    if (seen.has(key) || value !== value.trim() || !pattern?.test(value)) return false
    if ((path === '/make-your-trip' && ['from', 'to', 'date'].includes(key)) || (path === '/rent-car/request' && key === 'date')) {
      const parsed = new Date(value + 'T00:00:00.000Z')
      if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) return false
    }
    seen.add(key)
  }
  return true
}

export function canMeasureLocation(url: URL, environment: string | undefined): boolean {
  return url.protocol === 'https:' && isProductionTrackingHost(environment, url.host) && isSafeTrackingUrl(url)
}

export function sanitizeMeasurementUrl(value: string, environment: string | undefined): string | null {
  try {
    const url = new URL(value)
    return canMeasureLocation(url, environment) ? url.origin + url.pathname : null
  } catch {
    return null
  }
}
