import type { Locale } from './locale-config'

export const MARKETING_READ_TYPE = 'marketing_offer_read'
export const MARKETING_CHANGE_EVENT = 'sp-marketing-offers-changed'
export type MarketingNotification = {
  id: string
  type: 'offer_available' | 'tour_offer_available'
  title: string
  message: string
  href: string
  createdAt: string
  readAt: string | null
  expiresAt: string | null
  localized: Partial<Record<'es' | 'it', { title: string; message: string }>>
}
export function isMarketingNotification(id: string) { return /^marketing:(offer|tour):[a-f0-9]{32}$/.test(id) }
export function currentNotification<T extends { expiresAt?: string | null }>(item: T, now = Date.now()) {
  return !item.expiresAt || Date.parse(item.expiresAt) >= now
}
export function localizedNotification<T extends { title: string; message: string; localized?: MarketingNotification['localized'] }>(item: T, locale: Locale): T {
  const text = locale === 'es' || locale === 'it' ? item.localized?.[locale] : undefined
  return text ? { ...item, ...text } : item
}
