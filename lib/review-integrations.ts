export const REVIEW_PROVIDERS = ['google', 'tripadvisor', 'trustindex', 'getyourguide'] as const
export type ReviewProvider = (typeof REVIEW_PROVIDERS)[number]
export const REVIEW_LABELS: Record<ReviewProvider, string> = { google: 'Google', tripadvisor: 'Tripadvisor', trustindex: 'Trustindex', getyourguide: 'GetYourGuide' }
export type ReviewConfig = { enabled: boolean; resourceId: string; profileUrl: string; widgetId: string }
export type ReviewState = 'not_connected' | 'connected' | 'error' | 'widget_configured' | 'partner_access_required'
export type ReviewAdmin = ReviewConfig & { provider: ReviewProvider; secretConfigured: boolean; state: ReviewState; checkedAt: string | null; message: string }
export type ProviderReview = { id: string; author: string; authorUrl: string; rating: number; text: string; date: string; url: string; ratingImageUrl?: string }
export type ReviewFeed = { provider: ReviewProvider; enabled?: boolean; state: ReviewState; profileUrl: string; reviews: ProviderReview[]; average: number | null; count: number | null; widgetId?: string }
export function isReviewProvider(value: unknown): value is ReviewProvider { return typeof value === 'string' && REVIEW_PROVIDERS.some(p => p === value) }
export function safeProviderUrl(value: unknown, provider: ReviewProvider): string {
  if (typeof value !== 'string' || !value) return ''
  try {
    const u = new URL(value)
    const hosts: Record<ReviewProvider, string[]> = { google: ['google.com', 'maps.google.com', 'www.google.com', 'maps.app.goo.gl'], tripadvisor: ['tripadvisor.com', 'www.tripadvisor.com'], trustindex: ['trustindex.io', 'www.trustindex.io', 'admin.trustindex.io'], getyourguide: ['getyourguide.com', 'www.getyourguide.com'] }
    return u.protocol === 'https:' && !u.username && !u.password && hosts[provider].includes(u.hostname) && value.length <= 1500 ? u.href : ''
  } catch { return '' }
}
export function validateReviewConfig(value: unknown, provider: ReviewProvider): ReviewConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Invalid configuration.')
  const v = value as Record<string, unknown>
  if (typeof v.enabled !== 'boolean' || typeof v.resourceId !== 'string' || typeof v.profileUrl !== 'string' || typeof v.widgetId !== 'string') throw Error('Invalid configuration.')
  if (Object.keys(v).some(k => !['enabled', 'resourceId', 'profileUrl', 'widgetId'].includes(k))) throw Error('Unknown configuration field.')
  const resourceId = v.resourceId.trim(), widgetId = v.widgetId.trim(), profileUrl = v.profileUrl.trim()
  if (resourceId && !(provider === 'tripadvisor' ? /^\d{1,30}$/ : /^[A-Za-z0-9_-]{1,200}$/).test(resourceId)) throw Error('Invalid resource ID.')
  if (widgetId && !/^[a-zA-Z0-9]{8,100}$/.test(widgetId)) throw Error('Enter only the Trustindex widget ID, not embed HTML.')
  if (profileUrl && !safeProviderUrl(profileUrl, provider)) throw Error('Enter an HTTPS profile URL on the selected provider website.')
  return { enabled: v.enabled, resourceId, profileUrl, widgetId }
}
