import { countries, countryByCode, countryByDialCode, defaultCountry } from '@/data/countries'

/**
 * International-safe phone normalization core.
 *
 * Rules:
 * - Explicit international input (`+…` or `00…`) is trusted as international
 *   and never rewritten with country assumptions.
 * - With explicit country context, a value already starting with that
 *   country's dial digits is used as-is (no duplicated prefix).
 * - A single leading trunk zero is stripped ONLY for countries known to use
 *   one (e.g. EG `010…` → national `10…`). Countries are never guessed.
 * - Without country context, ambiguous local input is returned digits-only
 *   and untouched: we prefer an obviously incomplete value over inventing
 *   a wrong country prefix.
 */

const TRUNK_ZERO_COUNTRIES = new Set([
  'EG', 'SA', 'AE', 'KW', 'QA', 'BH', 'OM', 'YE', 'JO', 'LB', 'SY', 'IQ', 'PS',
  'LY', 'TN', 'DZ', 'MA', 'SD', 'MR', 'GB', 'DE', 'FR', 'ES', 'PT', 'NL', 'BE',
  'AT', 'CH', 'SE', 'NO', 'DK', 'FI', 'GR', 'TR', 'PK', 'BD', 'LK', 'ZA', 'NG',
  'KE', 'GH', 'UG', 'TZ', 'ET', 'BR', 'MX', 'AR', 'CL', 'CO', 'PE', 'VE', 'MY',
  'ID', 'TH', 'PH', 'SG', 'NG',
])

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '')
}

function dialDigits(dialCode: string): string {
  return dialCode.replace(/\D/g, '')
}

/** Strip one trunk zero for trunk-zero countries only. Never guesses. */
export function stripTrunkZero(countryCode: string, local: string): string {
  const text = local.trim().replace(/[\s()-]/g, '')
  if (/^0\d/.test(text) && TRUNK_ZERO_COUNTRIES.has(countryCode.toUpperCase())) {
    return text.slice(1)
  }
  return text
}

/**
 * Compose the canonical international form (`+20 1288…`) for a known
 * country. Handles already-prefixed, `00`-prefixed, trunk-zero and bare
 * local input without ever duplicating the dial prefix.
 */
export function toInternational(countryCode: string, phone: string): string {
  const country = countryByCode(countryCode) ?? defaultCountry
  const dial = dialDigits(country.dialCode)
  const text = (phone ?? '').trim()
  if (text.startsWith('+')) {
    const rest = digitsOnly(text.slice(1))
    if (!rest) return ''
    // Repair an already-duplicated prefix (`+20 01288…` → `+20 1288…`).
    if (dial && rest.startsWith(dial)) {
      const after = rest.slice(dial.length)
      if (after.startsWith('0') && TRUNK_ZERO_COUNTRIES.has(country.code)) {
        return `+${dial}${after.slice(1)}`
      }
    }
    return `+${rest}`
  }
  let digits = digitsOnly(text)
  if (!digits) return ''
  if (digits.startsWith('00')) digits = digits.slice(2)
  if (digits.startsWith(dial)) return `+${digits}`
  if (TRUNK_ZERO_COUNTRIES.has(country.code) && digits.startsWith('0')) {
    digits = digits.slice(1)
  }
  return `+${dial}${digits}`
}

/** Split a combined value into dial + local using longest-prefix match. */
export function splitInternational(value: string): { dialCode: string; local: string } {
  const text = (value ?? '').trim()
  const plusForm = text.startsWith('+') ? digitsOnly(text.slice(1)) : text.startsWith('00') ? digitsOnly(text.slice(2)) : null
  if (plusForm) {
    const dial = Array.from(new Set(countries.map((country) => dialDigits(country.dialCode))))
      .sort((a, b) => b.length - a.length)
      .find((entry) => entry && plusForm.startsWith(entry))
    if (dial) {
      const country = countries.find((entry) => dialDigits(entry.dialCode) === dial)
      return { dialCode: country ? country.dialCode : `+${dial}`, local: plusForm.slice(dial.length).trimStart() }
    }
    return { dialCode: '', local: text }
  }
  return { dialCode: '', local: text }
}

/** Digits-only international form for `wa.me/<digits>` links. */
export function whatsappDigits(countryCode: string | undefined, phone: string): string {
  if (countryCode) return digitsOnly(toInternational(countryCode, phone))
  const text = (phone ?? '').trim()
  if (text.startsWith('+')) return digitsOnly(text.slice(1))
  if (digitsOnly(text).startsWith('00')) return digitsOnly(text).slice(2)
  return digitsOnly(text)
}

/** `https://wa.me/<digits>` or '' when nothing usable remains. */
export function whatsappLink(countryCode: string | undefined, phone: string): string {
  const digits = whatsappDigits(countryCode, phone)
  return digits ? `https://wa.me/${digits}` : ''
}

/** `tel:+<digits>` or '' when nothing usable remains. */
export function telLink(countryCode: string | undefined, phone: string): string {
  if (countryCode) {
    const composed = toInternational(countryCode, phone)
    return composed ? `tel:${composed.replace(/\s/g, '')}` : ''
  }
  const text = (phone ?? '').trim()
  if (text.startsWith('+')) {
    const digits = digitsOnly(text.slice(1))
    return digits ? `tel:+${digits}` : ''
  }
  const digits = digitsOnly(text)
  if (digits.startsWith('00')) return `tel:+${digits.slice(2)}`
  return digits ? `tel:${digits}` : ''
}

/**
 * Read-only display for a stored snapshot phone: the full normalized
 * international number (`+20 100 123 4567`) derived from the snapshot dial
 * code plus the stored phone value. Never mutates the snapshot.
 *
 * - Empty input renders as ''.
 * - Already-international values are normalized (never `+20 +20 …`).
 * - Bare local values gain the snapshot dial prefix with trunk-zero repair
 *   (never `+20 010…`).
 * - Legacy combined values (`+20 100…` stored with the same dial) stay safe.
 * - Without a dial code, a `+…` value is digit-normalized, anything else is
 *   returned trimmed and untouched rather than inventing a prefix.
 */
export function displayInternationalPhone(dialCode: string | undefined, phone: string | undefined): string {
  const text = (phone ?? '').trim()
  if (!text) return ''
  const dial = (dialCode ?? '').trim()
  if (dial) {
    const country = countryByDialCode(dial)
    return toInternational(country.code, text)
  }
  if (text.startsWith('+')) {
    const rest = digitsOnly(text.slice(1))
    return rest ? `+${rest}` : ''
  }
  if (digitsOnly(text).startsWith('00')) return `+${digitsOnly(text).slice(2)}`
  return text
}
