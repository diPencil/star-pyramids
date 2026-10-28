/** Currency codes shared by browser and server. No exchange-rate assumptions. */
export const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'EGP'] as const
export type Currency = (typeof SUPPORTED_CURRENCIES)[number]
export type SupportedCurrency = Currency
export const TOUR_BOOKING_CURRENCY = 'USD' as const

export function isCurrency(value: unknown): value is Currency {
  return typeof value === 'string' && (SUPPORTED_CURRENCIES as readonly string[]).includes(value)
}
/** Normalize user input, never silently substitute another denomination. */
export function normalizeCurrency(value: unknown): Currency | null {
  if (typeof value !== 'string') return null
  const code = value.trim().toUpperCase()
  return isCurrency(code) ? code : null
}
export const CURRENCY_OPTIONS = SUPPORTED_CURRENCIES.map(value => ({ value, label: value }))
const names = {
  USD: { en: 'US Dollar', es: 'Dólar estadounidense', it: 'Dollaro statunitense' },
  EUR: { en: 'Euro', es: 'Euro', it: 'Euro' },
  EGP: { en: 'Egyptian Pound', es: 'Libra egipcia', it: 'Sterlina egiziana' },
}
const symbols: Record<Currency, string> = { USD: '$', EUR: '€', EGP: 'E£' }
export function currencyChoices(locale: string = 'en') {
  const language = locale === 'es' || locale === 'it' ? locale : 'en'
  return SUPPORTED_CURRENCIES.map(value => [names[value][language], `${symbols[value]} ${value}`, value] as const)
}
export function currencyIntlLocale(locale: string): string {
  return locale === 'es' ? 'es-ES' : locale === 'it' ? 'it-IT' : 'en-US'
}
/** Formats an already-denominated amount; DOES NOT convert. Unknown historical codes stay explicit. */
export function formatCurrency(amount: number, currency: string | null | undefined, locale: string = 'en', options: Intl.NumberFormatOptions = {}): string {
  if (!currency || !isCurrency(currency)) return `${new Intl.NumberFormat(currencyIntlLocale(locale), { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)}${currency ? ` ${currency}` : ''}`
  return new Intl.NumberFormat(currencyIntlLocale(locale), { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2, ...options }).format(amount)
}
