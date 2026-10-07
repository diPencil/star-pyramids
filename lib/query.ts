import { destinations } from '@/data/content'
import { dayTourTerms, findTour } from '@/data/tours'
import type { Tour } from '@/data/types'
import { TRIP_SOURCE_BLOG_VIP, type TripSourceInput } from '@/lib/trip-request'

type QueryReader = {
  get(name: string): string | null
}

const readText = (params: QueryReader, name: string, maxLength: number) => {
  const value = params.get(name)?.trim()
  return value ? value.slice(0, maxLength) : ''
}

const readIsoDate = (params: QueryReader, name: string) => {
  const value = readText(params, name, 10)
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return ''
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? value : ''
}

const readPositiveInt = (params: QueryReader, name: string, fallback: number, max: number) => {
  const value = Number(params.get(name))
  return Number.isInteger(value) && value > 0 && value <= max ? value : fallback
}

export type SearchQuery = {
  q: string
}

export const parseSearchQuery = (params: QueryReader): SearchQuery => ({
  q: readText(params, 'q', 120),
})

export type MakeTripQuery = {
  step: 1 | 2
  from: string
  to: string
  destination: string
  guests: number
  adults: number
  children: number
  infants: number
  tour?: Tour
  addOns: string[]
  /** Lead-source context. Null unless the URL carries an allowlisted source. */
  source: TripSourceInput | null
}

export const parseMakeTripQuery = (params: QueryReader): MakeTripQuery => {
  const from = readIsoDate(params, 'from') || readIsoDate(params, 'date')
  const requestedTo = readIsoDate(params, 'to')
  const to = requestedTo && (!from || requestedTo >= from) ? requestedTo : ''
  const destinationSlug = readText(params, 'destination', 80)
  const explicitDestination = destinations.some((item) => item.slug === destinationSlug) ? destinationSlug : ''
  const tourSlug = readText(params, 'tour', 120)
  const tour = tourSlug ? findTour(tourSlug) : undefined
  // Explicit `destination` wins. Otherwise the linked tour's own configured
  // destination applies when it matches a real destination option exactly.
  // Anything else stays empty for the customer — never guessed or inferred.
  const tourDestination = tour?.destinationSlug ?? ''
  const destination = explicitDestination !== '' ? explicitDestination : (tourDestination !== '' && destinations.some((item) => item.slug === tourDestination) ? tourDestination : '')
  const availableAddOns = tour?.category === 'one-day-tours' ? tour.dayDetail?.addOns ?? dayTourTerms.addOns : tour?.detail?.addOns ?? []
  const addOns = [...new Set(readText(params, 'addons', 80).split(',').filter((value) => /^(0|[1-9]\d*)$/.test(value)).map(Number))]
    .filter((index) => index < availableAddOns.length)
    .map((index) => availableAddOns[index].title)
  const step = params.get('step') === '2' && from !== '' && to !== '' ? 2 : 1
  // Strict allowlist: only `blog_vip_trip` + a well-formed blog slug
  // produces source context. Anything else stays a direct request.
  const src = readText(params, 'src', 32)
  const blogParam = readText(params, 'blog', 80)
  const source: TripSourceInput | null =
    src === TRIP_SOURCE_BLOG_VIP && /^[a-z0-9-]{1,80}$/.test(blogParam)
      ? { type: TRIP_SOURCE_BLOG_VIP, blogSlug: blogParam }
      : null

  return {
    step,
    from,
    to,
    destination,
    guests: readPositiveInt(params, 'guests', 1, 50),
    adults: readPositiveInt(params, 'adults', 0, 50),
    children: readPositiveInt(params, 'children', 0, 50),
    infants: readPositiveInt(params, 'infants', 0, 50),
    tour,
    addOns,
    source,
  }
}

export type CarRequestQuery = {
  vehicleSlug: string
  pickup: string
  dropoff: string
  tripType?: 'One Way' | 'Round Trip'
  date: string
}

export const parseCarRequestQuery = (params: QueryReader): CarRequestQuery => {
  const vehicleSlug = readText(params, 'vehicle', 80)
  const rawTripType = readText(params, 'type', 20)

  return {
    // Slug identity only — resolved against the DB fleet by the caller.
    vehicleSlug: /^[a-z0-9-]{1,80}$/.test(vehicleSlug) ? vehicleSlug : '',
    pickup: readText(params, 'pickup', 160),
    dropoff: readText(params, 'dropoff', 160),
    tripType: rawTripType === 'One Way' || rawTripType === 'Round Trip' ? rawTripType : undefined,
    date: readIsoDate(params, 'date'),
  }
}

export const tourListingSorts = ['Recommended', 'Price: low to high', 'Price: high to low'] as const

export type TourListingSort = (typeof tourListingSorts)[number]

export const tourPriceBands = [
  { id: '', label: 'Any price' },
  { id: 'under-200', label: 'Under $200' },
  { id: '200-400', label: '$200 - $400' },
  { id: 'over-400', label: 'Over $400' },
] as const

export type TourPriceBandId = (typeof tourPriceBands)[number]['id']

export const matchPriceBand = (price: number, band: string) =>
  band === 'under-200' ? price < 200 : band === '200-400' ? price >= 200 && price <= 400 : band === 'over-400' ? price > 400 : true

export type TourListingQuery = {
  destination: string
  duration: string
  price: string
  sort: TourListingSort
  page: number
}

export const parseTourListingQuery = (
  params: QueryReader,
  validDestinations: readonly string[],
  validDurations: readonly string[],
): TourListingQuery => {
  const destination = readText(params, 'destination', 80)
  const duration = readText(params, 'duration', 40)
  const price = readText(params, 'price', 20)
  const rawSort = readText(params, 'sort', 30)

  return {
    destination: validDestinations.includes(destination) ? destination : '',
    duration: validDurations.includes(duration) ? duration : '',
    price: tourPriceBands.some((band) => band.id === price) ? price : '',
    sort: (tourListingSorts as readonly string[]).includes(rawSort) ? (rawSort as TourListingSort) : 'Recommended',
    page: readPositiveInt(params, 'page', 1, 999),
  }
}
