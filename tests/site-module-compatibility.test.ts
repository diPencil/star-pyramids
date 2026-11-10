import * as site from '@/components/site'
import { tourImages } from '@/data/tours'
import { describe, expect, it } from 'vitest'

describe('site public entry-point compatibility', () => {
  it('retains the complete existing runtime export surface', () => {
    expect(Object.keys(site).sort()).toEqual(["Breadcrumb","CardGallery","CategoryFilter","FilterField","Header","Heading","HelpCTA","HeroField","HomePage","Logo","MultiDayCategoryPage","MultiDayToursCategories","NavLinks","NotificationDropdown","OneDayDestinationPage","OneDayToursRegions","PageShowcaseHero","RegionTourPage","SiteShell","SupportWidgets","TourCard","TourCardPresentation","TourCategoryHero","TourListing","TripSearchEngine","catMeta","categoryCopy","extra","getEgyptTourNavLinks","getNavConfig","images","useActiveNav"])
  })
  it('preserves the shared image collection identity', () => { expect(site.images).toBe(tourImages) })
  it('forwards components/tours/tour-card.tsx without wrappers', async () => {
    const feature = await import('@/components/tours/tour-card')
    for (const name of ["CardGallery","TourCard","TourCardPresentation"]) expect((site as unknown as Record<string, unknown>)[name]).toBe((feature as unknown as Record<string, unknown>)[name])
  })
  it('forwards components/shared/trip-search-engine.tsx without wrappers', async () => {
    const feature = await import('@/components/shared/trip-search-engine')
    for (const name of ["FilterField","HeroField","TripSearchEngine"]) expect((site as unknown as Record<string, unknown>)[name]).toBe((feature as unknown as Record<string, unknown>)[name])
  })
  it('forwards components/layout/site-header.tsx without wrappers', async () => {
    const feature = await import('@/components/layout/site-header')
    for (const name of ["Logo","NotificationDropdown","useActiveNav","getNavConfig","getEgyptTourNavLinks","NavLinks","Header"]) expect((site as unknown as Record<string, unknown>)[name]).toBe((feature as unknown as Record<string, unknown>)[name])
  })
})
