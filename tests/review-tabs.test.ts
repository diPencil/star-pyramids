import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, expect, it, vi } from 'vitest'
import { pickLocaleText, type Locale } from '@/lib/locale-config'
import { reviewText } from '@/lib/review-copy'

const state = vi.hoisted(() => ({ selected: 'all', locale: 'en' as Locale }))
vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react')
  return { ...actual, useState: (initial: unknown) => actual.useState(initial === 'all' ? state.selected : initial) }
})
vi.mock('@/components/locale', () => ({ useLocale: () => ({ locale: state.locale }), tx: (locale: Locale, value: { en: string }) => pickLocaleText(locale, value) }))
vi.mock('@/components/website-reviews', () => ({ WebsiteReviews: ({ scope }: { scope: string }) => createElement('div', { 'data-local-reviews-scope': scope }) }))
import { ProviderReviewsSection } from '@/components/provider-reviews'
import { StarsRow } from '@/components/reviews'

afterEach(() => { state.selected = 'all'; state.locale = 'en' })
it.each(['all', 'website', 'trips'])('routes selected %s tab into the matching local API feed scope', selected => {
  state.selected = selected
  const html = renderToStaticMarkup(createElement(ProviderReviewsSection))
  expect(html).toContain(`data-local-reviews-scope="${selected}"`)
  expect((html.match(/aria-pressed="true"/g) ?? []).length).toBe(1)
  expect(html).toContain('All reviews'); expect(html).toContain('Website reviews'); expect(html).toContain('Trip reviews')
  expect(html).not.toContain('5.0 / 5')
})
it.each([['es', 'Todas las reseñas', 'Reseñas de viajes'], ['it', 'Tutte le recensioni', 'Recensioni dei viaggi']])('localizes homepage tabs in %s without enabling Arabic', (locale, all, trips) => {
  state.locale = locale as Locale
  const html = renderToStaticMarkup(createElement(ProviderReviewsSection))
  expect(html).toContain(all); expect(html).toContain(trips)
  expect(html).toContain('data-local-reviews-scope="all"')
})
it.each([['en', '4 out of 5 stars'], ['es', '4 de 5 estrellas'], ['it', '4 su 5 stelle']])('provides an accessible localized real rating in %s', (locale, label) => {
  state.locale = locale as Locale
  expect(renderToStaticMarkup(createElement(StarsRow, { stars: 4 }))).toContain(`aria-label="${label}"`)
})
it('localizes admin review statuses and falls back safely for disabled Arabic', () => {
  expect(reviewText('Pending', 'es')).toBe('Pendientes')
  expect(reviewText('Rejected', 'it')).toBe('Rifiutate')
  expect(reviewText('Published', 'ar')).toBe('Published')
})
