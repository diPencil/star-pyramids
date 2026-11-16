import { isSocialProvider, type SocialProviderId } from '@/lib/auth/social-providers'

export const SOCIAL_MEASUREMENT_HEADER = 'x-sp-social-analytics'
export const SOCIAL_MEASUREMENT_PATH = '/api/auth/social-measurement'
export const SOCIAL_MEASUREMENT_COOKIE = '__Host-sp-social-measurement'
export const SOCIAL_MEASUREMENT_TTL = 10 * 60_000

export type SocialMeasurement = { event: 'sp_login' | 'sp_sign_up'; method: SocialProviderId; event_id: string }

export function parseSocialMeasurement(value: unknown): SocialMeasurement | null {
  if (!value || typeof value !== 'object') return null
  const { event, method, event_id } = value as Record<string, unknown>
  if ((event !== 'sp_login' && event !== 'sp_sign_up') || typeof method !== 'string' || !isSocialProvider(method) ||
      typeof event_id !== 'string' || !/^so_[a-f0-9]{32}$/.test(event_id)) return null
  return { event, method, event_id }
}
