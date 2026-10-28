import { describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(), usePathname: () => '/egypt-tours/nile-cruises', useRouter: () => ({ replace: vi.fn() }) }))
vi.mock('@/lib/tours-client', () => ({ useDbTours: () => [] }))
vi.mock('@/lib/catalogue-client', () => ({ useDbDestinations: () => [], useDbCategories: () => [] }))
import { OneDayToursRegions, MultiDayToursCategories, TourListing } from '@/components/site'
import { InitialLocaleProvider, LocaleProvider } from '@/components/locale'

describe('empty client database category pages', () => {
  for (const [name, component] of [
    ['one day', createElement(OneDayToursRegions)],
    ['multi day', createElement(MultiDayToursCategories)],
    ['nile', createElement(TourListing, { slug: 'nile-cruises' })],
    ['shore', createElement(TourListing, { slug: 'shore-excursions' })],
  ] as const) {
    it(`${name} renders its hero without accessing a nonexistent featured tour`, () => {
      const html = renderToStaticMarkup(createElement(InitialLocaleProvider, { locale: 'en', preview: true, children: createElement(LocaleProvider, { children: component }) }))
      expect(html).toContain('events-page-hero-copy')
      expect(html).not.toContain('events-next-event')
      expect(html).not.toContain('/egypt-tours/undefined')
      expect(html).not.toContain('data-msg="Switched to client rendering')
    })
  }
})
