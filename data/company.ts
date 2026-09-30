import { toInternational, whatsappDigits } from '@/lib/phone'

export const COMPANY_PHONE_DISPLAY = '01288222962'
export const COMPANY_PHONE_E164 = '+201288222962'
export const COMPANY_PHONE_HREF = `tel:${COMPANY_PHONE_E164}`

export const COMPANY_WHATSAPP_NUMBER = '201288222962'
export const COMPANY_WHATSAPP_HREF = `https://wa.me/${COMPANY_WHATSAPP_NUMBER}`

export const COMPANY_ADDRESS = '7st Farouk Ahmed Khattab, El-Haram, Giza.'
export const COMPANY_EMAIL = 'info@starpyramids.com'
export const COMPANY_MAP_URL = 'https://maps.google.com/?q=7st+Farouk+Ahmed+Khattab,+El-Haram,+Giza'

/**
 * Egypt-scoped normalizer kept for corporate numbers, which are Egyptian by
 * definition. User-entered numbers must use the international-safe helpers
 * in `@/lib/phone` instead.
 */
export function normalizeEgyptContactNumber(value: string) {
  const digits = toInternational('EG', value).replace(/\D/g, '')
  return digits || value.replace(/^https?:\/\/(?:wa\.me\/|api\.whatsapp\.com\/send\?phone=)/i, '').replace(/\D/g, '')
}

export function phoneHref(value: string) {
  const number = normalizeEgyptContactNumber(value)
  return number ? `tel:+${number}` : COMPANY_PHONE_HREF
}

export function whatsappNumber(value: string) {
  return normalizeEgyptContactNumber(value) || COMPANY_WHATSAPP_NUMBER
}

export function whatsappHref(value: string) {
  return `https://wa.me/${whatsappNumber(value)}`
}
