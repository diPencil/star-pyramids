import * as pages from '@/components/extended-pages'
import { AboutPage } from '@/components/content/about-page'
import { SearchPage } from '@/components/content/public-search-page'
import { describe, expect, it } from 'vitest'

describe('extended-pages public entry-point compatibility', () => {
  it('retains the complete original runtime export surface', () => { expect(Object.keys(pages).sort()).toEqual(["AboutPage","AccessiblePage","AccountPage","BlogDetailPage","BlogEditorialPage","BlogsPage","CarCard","CarRequestForm","CarRequestPage","CarsPage","ContactForm","ContactPage","ContentCard","DestinationDetailPage","DestinationDetailView","DestinationsPage","DetailNotFound","EditorialHero","EventCard","EventDetailPage","EventsPage","FAQPage","ForgotPasswordPage","GuidePage","OfferDetailPage","OffersPage","PolicyPage","ResetPasswordPage","SearchPage"]) })
  it('preserves the existing AboutPage re-export identity', () => { expect(pages.AboutPage).toBe(AboutPage) })
  it('preserves the existing SearchPage re-export identity', () => { expect(pages.SearchPage).toBe(SearchPage) })
  it('forwards components/cars/car-pages.tsx without wrappers', async () => {
    const feature = await import('@/components/cars/car-pages')
    for (const name of ["CarsPage","CarCard","CarRequestForm","CarRequestPage"]) expect((pages as unknown as Record<string, unknown>)[name]).toBe((feature as unknown as Record<string, unknown>)[name])
  })
  it('forwards components/enquiries/contact-page.tsx without wrappers', async () => {
    const feature = await import('@/components/enquiries/contact-page')
    for (const name of ["ContactPage","ContactForm"]) expect((pages as unknown as Record<string, unknown>)[name]).toBe((feature as unknown as Record<string, unknown>)[name])
  })
  it('forwards components/account/password-recovery-pages.tsx without wrappers', async () => {
    const feature = await import('@/components/account/password-recovery-pages')
    for (const name of ["ForgotPasswordPage","ResetPasswordPage"]) expect((pages as unknown as Record<string, unknown>)[name]).toBe((feature as unknown as Record<string, unknown>)[name])
  })
  it('forwards components/content/public-content-pages.tsx without wrappers', async () => {
    const feature = await import('@/components/content/public-content-pages')
    for (const name of ["EditorialHero","DetailNotFound","ContentCard","GuidePage","AccessiblePage","FAQPage","PolicyPage"]) expect((pages as unknown as Record<string, unknown>)[name]).toBe((feature as unknown as Record<string, unknown>)[name])
  })
  it('forwards components/events/event-pages.tsx without wrappers', async () => {
    const feature = await import('@/components/events/event-pages')
    for (const name of ["EventCard","EventsPage","EventDetailPage"]) expect((pages as unknown as Record<string, unknown>)[name]).toBe((feature as unknown as Record<string, unknown>)[name])
  })
  it('forwards components/content/blog-pages.tsx without wrappers', async () => {
    const feature = await import('@/components/content/blog-pages')
    for (const name of ["BlogsPage","BlogEditorialPage","BlogDetailPage"]) expect((pages as unknown as Record<string, unknown>)[name]).toBe((feature as unknown as Record<string, unknown>)[name])
  })
  it('forwards components/content/destination-pages.tsx without wrappers', async () => {
    const feature = await import('@/components/content/destination-pages')
    for (const name of ["DestinationsPage","DestinationDetailPage","DestinationDetailView"]) expect((pages as unknown as Record<string, unknown>)[name]).toBe((feature as unknown as Record<string, unknown>)[name])
  })
  it('forwards components/offers/offer-pages.tsx without wrappers', async () => {
    const feature = await import('@/components/offers/offer-pages')
    for (const name of ["OffersPage","OfferDetailPage"]) expect((pages as unknown as Record<string, unknown>)[name]).toBe((feature as unknown as Record<string, unknown>)[name])
  })
  it('forwards components/account/legacy-account-page.tsx without wrappers', async () => {
    const feature = await import('@/components/account/legacy-account-page')
    for (const name of ["AccountPage"]) expect((pages as unknown as Record<string, unknown>)[name]).toBe((feature as unknown as Record<string, unknown>)[name])
  })
})
