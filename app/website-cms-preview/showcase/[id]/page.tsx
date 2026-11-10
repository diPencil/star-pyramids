import { notFound, redirect } from 'next/navigation'
import { requireStaff } from '@/lib/server/auth/guards'
import { hasPermission } from '@/lib/server/auth/auth'
import { readShowcaseState } from '@/lib/server/cms/heroes/showcase-heroes'
import { isShowcaseHeroId, originalShowcaseHero } from '@/lib/cms/heroes/showcase-heroes'
import { ShowcaseHeroPreview } from '@/components/cms/heroes/showcase-hero-preview'
import { AboutPage, ContactPage, BlogsPage, EventsPage, CarsPage, OffersPage } from '@/components/extended-pages'
import { OneDayToursRegions, TourListing } from '@/components/site'
import { getPublishedDbBlogs } from '@/lib/server/editorial/blogs'
import { sanitizeLocale } from '@/lib/i18n/locale-config'
import { Suspense } from 'react'
import { TripsPage } from '@/components/tours/trips-page'
import { RegionTourPage } from '@/components/site'
import { isCruiseHeroId } from '@/lib/cms/heroes/compact-hero-defaults'
import { getCruiseTypeBySlug } from '@/data/tours'
import { getToursByCategory } from '@/lib/server/catalogue/tours'
export const metadata = { robots: { index: false, follow: false, nocache: true } }
export default async function Preview({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ locale?: string }> }) {
  const user = await requireStaff()
  if (!hasPermission(user, 'settings.view')) redirect('/admin')
  const { id } = await params
  if (!isShowcaseHeroId(id)) notFound()
  const state = await readShowcaseState(id)
  const { locale } = await searchParams
  if (isCruiseHeroId(id)) {
    const source = getCruiseTypeBySlug(id)!
    const tours = (await getToursByCategory('nile-cruises')).filter((tour) => tour.cruiseType === id)
    return <ShowcaseHeroPreview id={id} initialLocale={sanitizeLocale(locale)} initialContent={state.draft ?? state.published ?? originalShowcaseHero(id)}><Suspense><RegionTourPage region={{ slug: id, name: source.titleEn, nameAr: source.titleAr, copy: source.descEn, copyAr: source.descAr, tourSlugs: tours.map((tour) => tour.slug) }} tours={tours} page={1} category="nile-cruises" /></Suspense></ShowcaseHeroPreview>
  }
  if (id === 'trips') return <ShowcaseHeroPreview id={id} initialLocale={sanitizeLocale(locale)} initialContent={state.draft ?? state.published ?? originalShowcaseHero(id)}><TripsPage /></ShowcaseHeroPreview>
  const content = id === 'about' ? <AboutPage /> : id === 'contact' ? <ContactPage /> : id === 'blogs' ? <BlogsPage initialBlogs={await getPublishedDbBlogs()} /> : id === 'events' ? <EventsPage /> : id === 'cars' ? <CarsPage /> : id === 'offers' ? <OffersPage /> : id === 'one-day' ? <OneDayToursRegions /> : <TourListing slug={id === 'multi-day' ? 'multi-days-tours' : id === 'nile' ? 'nile-cruises' : 'shore-excursions'} />
  return <ShowcaseHeroPreview id={id} initialLocale={sanitizeLocale(locale)} initialContent={state.draft ?? state.published ?? originalShowcaseHero(id)}>{content}</ShowcaseHeroPreview>
}
