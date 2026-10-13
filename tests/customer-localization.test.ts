import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'
import { describe, expect, it, vi } from 'vitest'
import { customerErrorCopy, customerErrorText } from '@/lib/customer-error-copy'
import { ENABLED_LOCALES, pickLocaleText, sanitizeLocale, type Locale } from '@/lib/locale-config'

const state = vi.hoisted(() => ({ locale: 'en' as Locale }))
vi.mock('@/components/locale', () => ({
  useLocale: () => ({ locale: state.locale }),
  tx: (locale: Locale, copy: Parameters<typeof pickLocaleText>[1]) => pickLocaleText(locale, copy),
}))
import { LanguageToggle } from '@/components/language-selector'

describe('customer localization release checks', () => {
  it('requires non-empty EN/ES/IT error copy without mismatched placeholders', () => {
    const placeholders = (value: string) => [...value.matchAll(/\{\{?([\w]+)\}?\}/g)].map((match) => match[1]).sort()
    for (const [message, copy] of Object.entries(customerErrorCopy)) {
      expect(copy.en).toBe(message)
      for (const locale of ENABLED_LOCALES) {
        expect(copy[locale].trim(), `${message}: ${locale}`).not.toBe('')
        expect(placeholders(copy[locale])).toEqual(placeholders(copy.en))
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

  it('localizes API failures at checkout and offline proof presentation boundaries', () => {
    expect(readFileSync('components/checkout-page.tsx', 'utf8')).toContain('customerErrorText(locale, data.error, sendFailed)')
    expect(readFileSync('components/booking-payment.tsx', 'utf8')).toContain('customerErrorText(locale, data.error, tx(locale,')
    const account = readFileSync('components/account-portal.tsx', 'utf8')
    expect(account).toContain('customerErrorText(locale, thread.loadError)')
    expect(account).toContain('customerErrorText(locale, sendError)')
    expect(account).toContain("code === 'BOOKING_FINANCIAL_REVIEW'")
    expect(account).toContain('? financialReviewMessage(locale)')
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
