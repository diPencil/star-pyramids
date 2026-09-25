export const COMPANY_PHONE_DISPLAY = '01288222962'
export const COMPANY_PHONE_E164 = '+201288222962'
export const COMPANY_PHONE_HREF = `tel:${COMPANY_PHONE_E164}`

export const COMPANY_WHATSAPP_NUMBER = '201288222962'
export const COMPANY_WHATSAPP_HREF = `https://wa.me/${COMPANY_WHATSAPP_NUMBER}`

export const COMPANY_ADDRESS = '7st Farouk Ahmed Khattab, El-Haram, Giza.'
export const COMPANY_EMAIL = 'info@starpyramids.com'
export const COMPANY_MAP_URL = 'https://maps.google.com/?q=7st+Farouk+Ahmed+Khattab,+El-Haram,+Giza'

export function normalizeEgyptContactNumber(value: string) {
  const digits = value.replace(/^https?:\/\/(?:wa\.me\/|api\.whatsapp\.com\/send\?phone=)/i, '').replace(/\D/g, '')
  if (digits.startsWith('00')) return digits.slice(2)
  if (digits.startsWith('0')) return `20${digits.slice(1)}`
  return digits
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
