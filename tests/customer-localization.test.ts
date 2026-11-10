import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'
import { describe, expect, it, vi } from 'vitest'
import { customerErrorCopy, customerErrorText } from '@/lib/account/customer-error-copy'
import { ENABLED_LOCALES, pickLocaleText, sanitizeLocale, type Locale } from '@/lib/i18n/locale-config'

const state = vi.hoisted(() => ({ locale: 'en' as Locale }))
vi.mock('@/components/locale', () => ({
  useLocale: () => ({ locale: state.locale }),
  tx: (locale: Locale, copy: Parameters<typeof pickLocaleText>[1]) => pickLocaleText(locale, copy),
}))
import { LanguageToggle } from '@/components/shared/language-selector'

describe('customer localization release checks', () => {
  it('requires non-empty EN/ES/IT error copy without mismatched placeholders', () => {
    const placeholders = (value: string) => [...value.matchAll(/\{\{?([\w]+)\}?\}/g)].map((match) => match[1]).sort()
    for (const [message, copy] of Object.entries(customerErrorCopy)) {
      for (const locale of ENABLED_LOCALES) {
        expect(copy[locale].trim(), `${message}: ${locale}`).not.toBe('')
        expect(placeholders(copy[locale])).toEqual(placeholders(copy.en))
        // API error keys may intentionally map to clearer visitor-facing copy.
        expect(customerErrorText(locale, message)).toBe(copy[locale])
      }
      expect(copy.es).not.toBe(copy.en)
      expect(copy.it).not.toBe(copy.en)
    }
  })

  it('covers literal errors returned by login, registration and password APIs', () => {
    for (const route of ['login', 'register', 'forgot-password', 'reset-password', 'change-password']) {
      const path = `app/api/auth/${route}/route.ts`
      const ast = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true)
      const visit = (node: ts.Node) => {
        if (ts.isPropertyAssignment(node) && node.name.getText(ast) === 'error' && ts.isStringLiteral(node.initializer)) {
          expect(Object.hasOwn(customerErrorCopy, node.initializer.text), `${route}: ${node.initializer.text}`).toBe(true)
        }
        ts.forEachChild(node, visit)
      }
      visit(ast)
    }
  })

  it('uses translated safe fallbacks for unknown responses, never server details in ES/IT', () => {
    for (const message of [null, {}, '', 'Unexpected internal service detail', '__proto__']) {
      expect(customerErrorText('es', message, 'Inténtalo de nuevo.')).toBe('Inténtalo de nuevo.')
      expect(customerErrorText('it', message, 'Riprova.')).toBe('Riprova.')
    }
    expect(customerErrorText('en', 'Original error', 'Fallback')).toBe('Original error')
    expect(customerErrorText('ar', 'رسالة حالية', 'Fallback')).toBe('رسالة حالية')
  })

  it('resolves errors again when the selected language changes', () => {
    const message = 'Your current password is incorrect.'
    expect(customerErrorText('en', message, '')).toBe(message)
    expect(customerErrorText('es', message, '')).toBe('Tu contraseña actual no es correcta.')
    expect(customerErrorText('it', message, '')).toBe('La password attuale non è corretta.')
  })

  it.each([
    'Each item needs 1-50 adults.',
    'Each item allows at most 60 travelers.',
    'Notes must be 1,000 characters or fewer.',
    'Enter the payment reference from your bank or receipt (3-128 characters).',
    'Too many proof submissions. Try again later.',
    'This booking can no longer be cancelled.',
    'This request can no longer be cancelled.',
    'Booking not found.',
    'Payment not found.',
    'Car request not found.',
    'Event request not found.',
    'Could not load messages.',
  ])('localizes booking/payment/account failure without changing its English meaning: %s', (message) => {
    expect(customerErrorText('en', message)).toBe(message)
    for (const locale of ['es', 'it'] as const) {
      const translated = customerErrorText(locale, message)
      expect(translated).toBe(customerErrorCopy[message as keyof typeof customerErrorCopy][locale])
      expect(translated).not.toBe(message)
      expect(translated.match(/\d+/g)).toEqual(message.match(/\d+/g))
    }
  })

  it('keeps raw auth responses until rendering so existing errors follow the selected locale', () => {
    const source = readFileSync('components/auth-pages.tsx', 'utf8')
    expect(source).toContain('customerErrorText(locale, error, genericError)')
    expect(source).toContain('setNotice({ apiError: data.error })')
    expect(source).toContain('customerErrorText(locale, notice.apiError, createFailed)')
    expect(source).not.toContain('setError(customerErrorText(')
    expect(source).not.toContain('setNotice(customerErrorText(')
  })

  // Checkout's response -> throw -> localized catch is exercised by the real
  // form interaction tests in checkout-flow-safety.test.ts, not a source spelling.
  it('localizes offline proof and account failure presentation boundaries', () => {
    expect(readFileSync('components/booking/booking-payment.tsx', 'utf8')).toContain('customerErrorText(locale, data.error, tx(locale,')
    const account = ["components/account/account-portal.tsx","components/account/shared/account-shell.tsx","components/account/shared/account-hooks.tsx","components/account/shared/account-ui.tsx","components/account/shared/account-notifications.tsx","components/account/bookings/booking-sections.tsx","components/account/cars/car-request-sections.tsx","components/account/favorites/favorites-section.tsx","components/account/overview/overview-section.tsx","components/account/payments/payment-sections.tsx","components/account/support/messages-section.tsx","components/account/profile/profile-settings.tsx"].map(path => readFileSync(path, 'utf8')).join('\n')
    expect(account).toContain('customerErrorText(locale, thread.loadError)')
    expect(account).toContain('customerErrorText(locale, sendError)')
    expect(account).toContain("code === 'BOOKING_FINANCIAL_REVIEW'")
    expect(account).toContain('? financialReviewMessage(locale)')
  })

  it('maps the existing price-confirmation API key to the intended current copy', () => {
    const key = 'Invalid price confirmation. Review your cart and try again.'
    expect(customerErrorText('en', key)).toBe('Your price confirmation could not be verified. Review your cart and try again.')
    expect(customerErrorText('es', key)).toBe('No se pudo verificar la confirmación del precio. Revisa el carrito y vuelve a intentarlo.')
    expect(customerErrorText('it', key)).toBe('Impossibile verificare la conferma del prezzo. Controlla il carrello e riprova.')
  })

  it.each([
    ['en', 'Open language and currency'],
    ['es', 'Abrir idioma y moneda'],
    ['it', 'Apri lingua e valuta'],
  ] as const)('renders a localized language control for %s', (locale, label) => {
    state.locale = locale
    const markup = renderToStaticMarkup(createElement(LanguageToggle, { label: `${locale.toUpperCase()} - USD`, onOpen: () => {} }))
    expect(markup).toContain(`aria-label="${label}"`)
    expect(markup).toContain('USD')
  })

  it('keeps Arabic disabled and optional editorial fallback explicit', () => {
    expect(ENABLED_LOCALES).toEqual(['en', 'es', 'it'])
    expect(sanitizeLocale('ar')).toBe('en')
    expect(sanitizeLocale('unknown')).toBe('en')
    expect(pickLocaleText('es', { en: 'Author-provided content' })).toBe('Author-provided content')
  })
})
