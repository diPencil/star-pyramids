import type { SocialProviderId } from './social-providers'
import { SOCIAL_MEASUREMENT_HEADER } from '@/lib/tracking/auth/social-measurement'
import { readTrackingGrants } from '@/lib/tracking/tracking-browser'
import { isProductionTrackingHost } from '@/lib/tracking/tracking'

export async function startSocialSignIn(provider: SocialProviderId, mode: 'login' | 'register' | 'test') {
  const eligible = mode !== 'test' && window.location.protocol === 'https:' && isProductionTrackingHost(process.env.NODE_ENV, window.location.host)
  const grant = eligible ? readTrackingGrants(window).analytics : undefined
  const response = await fetch(`/api/auth/social/${provider}?mode=${mode}`, { method: 'POST', credentials: 'same-origin',
    headers: { 'X-SP-Social-Start': '1', ...(grant ? { [SOCIAL_MEASUREMENT_HEADER]: grant } : {}) }, cache: 'no-store' })
  if (!response.ok) throw new Error('Social sign-in unavailable.')
  const data = await response.json() as { authorizationUrl?: string }
  const url = new URL(data.authorizationUrl ?? '')
  if (url.origin !== (provider === 'google' ? 'https://accounts.google.com' : 'https://www.facebook.com') || url.username || url.password) throw new Error('Invalid provider URL.')
  window.location.assign(url.href)
}
