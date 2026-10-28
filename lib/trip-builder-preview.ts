import type { CruiseTypeSlug, Tour, TourCategory, TourLocation, TourVideoPlatform } from '@/data/types'
import type { Translatable, TourTranslations } from '@/lib/tour-translations'
import { getBookingTotal, getActiveDealPercent } from '@/data/tours'
import { sanitizeLocale, type EnabledLocale } from '@/lib/locale-config'

export type BasicForm = Translatable & {
  title: string
  titleAr: string
  category: TourCategory
  destinationSlug: string
  cruiseType: CruiseTypeSlug | ''
  departurePort: string
  location: string
  duration: string
  price: string
  deal: string
  dealEndsAt: string
  groupSize: string
  travelStyle: string
  summary: string
  overview: string
  itineraryNote: string
  included: string
  excluded: string
}

export type AddOnRow = Translatable & { id: string; title: string; price: string }
export type HighlightRow = Translatable & { id: string; title: string; items: string }
export type ItineraryRow = Translatable & { id: string; day: string; title: string; description: string; meals: string; image: string }
export type PassengerRateRow = { id: string; travelers: string; price: string }
export type TravelerPriceRows = { adult: PassengerRateRow[]; child: PassengerRateRow[]; infant: PassengerRateRow[] }
export type PriceTierRow = Translatable & { id: string; label: string; price: string; suffix: string }
export type PriceMatrixRow = Translatable & { id: string; category: string; startDate: string; endDate: string; price: string; note: string; prefix: string; tiers: PriceTierRow[] }
export type LocationRow = Translatable & { id: string; name: string; nameAr: string; latitude: string; longitude: string }
export type GalleryRow = Translatable & { id: string; src: string; altAr?: string; alt: string; creditLabel: string; creditUrl: string; source: 'link' | 'upload' }
export type VideoRow = Translatable & { id: string; url: string; platform: TourVideoPlatform; title: string; titleAr: string; publishedAt: string; thumbnail: string }


export type TripBuilderDraft = {
  routeSlug?: string;
  form: BasicForm; catSlugs: string[]; addOns: AddOnRow[]; highlightImage: string;
  highlights: HighlightRow[]; itinerary: ItineraryRow[]; travelerPrices: TravelerPriceRows;
  priceRows: PriceMatrixRow[]; locations: LocationRow[]; gallery: GalleryRow[]; videos: VideoRow[];
}
export const previewTextKey = (row: object, key: string, locale: string) => `${'id' in row ? String(row.id) : 'form'}|${locale}|${key}`
export function previewText(row: Translatable & object, key: string, locale: EnabledLocale, cleared: ReadonlySet<string> = new Set()) {
  if (cleared.has(previewTextKey(row, key, locale))) return ''
  const translated = row.translations?.[locale]
  if (locale !== 'en' && translated && Object.prototype.hasOwnProperty.call(translated, key)) return translated[key]
  const value = (row as Record<string, unknown>)[key]
  return typeof value === 'string' ? value : ''
}
const lines = (text: string) => text.split('\n').map(line => line.trim()).filter(Boolean)
export function previewAmount(value: string): number | null {
  if (!value.trim()) return null
  const amount = Number(value)
  return Number.isFinite(amount) && amount >= 0 && amount <= 99999999.99 ? amount : null
}
export function cleanTravelerPriceRows(values: TravelerPriceRows) {
  const valid = (type: keyof TravelerPriceRows) => values[type].filter(row => Number.isInteger(Number(row.travelers)) && Number(row.travelers) > 0 && previewAmount(row.price) !== null)
  const adult = valid('adult'), child = valid('child'), infant = valid('infant')
  const counts = [...new Set([...adult, ...child, ...infant].map(row => Number(row.travelers)))].sort((a,b) => a-b)
  return counts.map(travelers => ({
    travelers,
    adultPrice: adult.find(row => Number(row.travelers) === travelers) ? Number(adult.find(row => Number(row.travelers) === travelers)!.price) : undefined,
    childPrice: child.find(row => Number(row.travelers) === travelers) ? Number(child.find(row => Number(row.travelers) === travelers)!.price) : undefined,
    infantPrice: infant.find(row => Number(row.travelers) === travelers) ? Number(infant.find(row => Number(row.travelers) === travelers)!.price) : undefined,
  }))
}
export function buildTripPreview(source: Tour, draft: TripBuilderDraft, requestedLocale: EnabledLocale, cleared: ReadonlySet<string> = new Set()) {
  const locale = sanitizeLocale(requestedLocale), form = draft.form
  const text = (row: Translatable & object, key: string) => previewText(row, key, locale, cleared)
  const amount = previewAmount(form.price)
  const manualDeal = previewAmount(form.deal) !== null && Number(form.deal) > 0 && form.dealEndsAt ? { percent: Number(form.deal), endsAt: form.dealEndsAt } : undefined
  const linked = 'pricingDealSource' in source && source.pricingDealSource === 'linked-offer' && getActiveDealPercent(source) > 0
  const galleryRows = draft.gallery.filter(row => row.src.trim())
  const gallery = galleryRows.map(row => row.src)
  const itinerary = draft.itinerary.map(row => ({ day: text(row,'day'), title: text(row,'title'), description: text(row,'description'), meals: text(row,'meals'), image: row.image }))
  const highlights = draft.highlights.map(row => ({ title: text(row,'title'), items: lines(text(row,'items')) }))
  const locations: TourLocation[] = draft.locations.map(row => row.latitude.trim() && row.longitude.trim() && Number.isFinite(Number(row.latitude)) && Number.isFinite(Number(row.longitude)) ? { id: row.id, name: text(row,'name'), latitude: Number(row.latitude), longitude: Number(row.longitude) } : text(row,'name'))
  const priceRows = draft.priceRows.map(row => ({
    category: text(row,'category'), startDate: row.startDate, endDate: row.endDate, price: previewAmount(row.price) ?? NaN,
    note: text(row,'note'), prefix: text(row,'prefix'),
    tiers: row.tiers.map(tier => ({ label: text(tier,'label'), price: previewAmount(tier.price) ?? NaN, suffix: text(tier,'suffix') })),
  }))
  const content = {
    overview: lines(text(form,'overview')), highlightImage: draft.highlightImage,
    itineraryNote: text(form,'itineraryNote'), included: lines(text(form,'included')), excluded: lines(text(form,'excluded')),
    addOns: draft.addOns.map(row => ({ title: text(row,'title'), price: previewAmount(row.price) ?? undefined })),
    locations, priceRows, travelerPrices: cleanTravelerPriceRows(draft.travelerPrices),
  }
  const tour: Tour = {
    ...source,
    slug: draft.routeSlug ?? source.slug,
    title: text(form,'title'), titleAr: undefined, category: form.category,
    location: text(form,'location'), duration: text(form,'duration'), summary: text(form,'summary'),
    price: amount ?? NaN, groupSize: text(form,'groupSize'), travelStyle: text(form,'travelStyle'),
    cruiseType: form.category === 'nile-cruises' ? form.cruiseType || undefined : undefined,
    departurePort: form.category === 'shore-excursions' ? text(form,'departurePort') : undefined,
    destinationSlug: form.category === 'one-day-tours' ? form.destinationSlug || null : null,
    categorySlugs: form.category === 'multi-days-tours' ? [...draft.catSlugs] : [],
    image: gallery[0] ?? '', gallery,
    galleryCaptions: galleryRows.map(row => ({ en: text(row,'alt'), ar: '' })),
    photoCredits: galleryRows.filter(row => row.creditLabel && row.creditUrl).map(row => ({ label: row.creditLabel, url: row.creditUrl })),
    journeyVideos: draft.videos.map(row => ({ id: row.id, url: row.url, platform: row.platform, title: text(row,'title'), publishedAt: row.publishedAt, thumbnail: row.thumbnail })),
    deal: linked ? source.deal : manualDeal, manualDeal,
    detail: form.category === 'one-day-tours' ? undefined : { ...source.detail, ...content, itineraryImages: [], highlights, itinerary },
    dayDetail: form.category === 'one-day-tours' ? { ...source.dayDetail, ...content, highlightGroups: highlights, highlights: highlights.flatMap(row => row.items), stops: itinerary, gallery: galleryRows.map(row => ({ src: row.src, alt: text(row,'alt') })) } : undefined,
  }
  return { tour, draft, locale, linkedOffer: linked, basePriceValid: amount !== null }
}
export type TripPreview = ReturnType<typeof buildTripPreview>
export type PreviewTravelers = { adult: number; child: number; infant: number }
export function previewCount(value: string, minimum: number) {
  const count = Number(value)
  return Number.isFinite(count) ? Math.min(50, Math.max(minimum, Math.floor(count))) : minimum
}
export function quoteTripPreview(preview: TripPreview, counts: PreviewTravelers, now?: Date | number | string) {
  const headcount = counts.adult + counts.child + counts.infant
  if (![counts.adult,counts.child,counts.infant].every(Number.isInteger) || counts.adult < 1 || counts.adult > 50 || counts.child < 0 || counts.child > 50 || counts.infant < 0 || counts.infant > 50 || headcount > 60) return { kind: 'invalid-count' as const }
  const incomplete = (Object.keys(counts) as (keyof PreviewTravelers)[]).some(type => preview.draft.travelerPrices[type].length === 0 || preview.draft.travelerPrices[type].some(row => previewAmount(row.price) === null || !Number.isInteger(Number(row.travelers)) || Number(row.travelers) < 1 || preview.draft.travelerPrices[type].filter(other => Number(other.travelers) === Number(row.travelers)).length > 1))
  if (!preview.basePriceValid || incomplete) return { kind: 'incomplete' as const }
  const quote = getBookingTotal(preview.tour, counts.adult, counts.child, counts.infant, now)
  if (![quote.adult,quote.child,quote.infant].every(value => Number.isFinite(value) && value >= 0)) return { kind: 'incomplete' as const }
  // Same unit-to-cents, then integer summation as server/bookings.ts.
  const adult = Math.round(quote.adult * 100), child = Math.round(quote.child * 100), infant = Math.round(quote.infant * 100)
  const total = counts.adult * adult + counts.child * child + counts.infant * infant
  if (!Number.isSafeInteger(total)) return { kind: 'incomplete' as const }
  return { kind: 'quote' as const, headcount, currency: 'USD' as const, adult: adult/100, child: child/100, infant: infant/100, total: total/100 }
}
