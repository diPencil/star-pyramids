export type TourCategory = 'one-day-tours' | 'multi-days-tours' | 'nile-cruises' | 'shore-excursions'
export type TourVariant = 'multi' | 'day' | 'cruise' | 'shore'

export type TourItineraryDay = {
  day: string
  title: string
  description: string
}

export type TourHighlightGroup = {
  title: string
  items: readonly string[]
}

export type TourAddOn = {
  title: string
  price: number
}

export type TourPriceRow = {
  category: string
  price: number
  note: string
  prefix?: string
}

export type TourReview = {
  name: string
  date: string
  stars: number
  text: string
}

export type TourDetail = {
  overview: readonly string[]
  highlights: readonly TourHighlightGroup[]
  itinerary: readonly TourItineraryDay[]
  included: readonly string[]
  excluded: readonly string[]
  addOns: readonly TourAddOn[]
  locations: readonly string[]
  priceRows: readonly TourPriceRow[]
  reviews: readonly TourReview[]
}

export type Tour = {
  slug: string
  aliases?: readonly string[]
  title: string
  category: TourCategory
  location: string
  price: number
  duration: string
  image: string
  gallery?: readonly string[]
  summary: string
  groupSize?: string
  travelStyle?: string
  detail?: TourDetail
}

export type Destination = {
  title: string
  slug: string
  image: string
  copy: string
}

export type Car = {
  title: string
  slug: string
  image: string
  seats: string
  transmission: string
  dailyPrice: number
  copy: string
}

export type Blog = {
  title: string
  slug: string
  image: string
  category: string
  date: string
  excerpt: string
}

export type Event = {
  title: string
  slug: string
  image: string
  date: string
  location: string
  copy: string
}

export type Offer = {
  title: string
  slug: string
  image: string
  badge: string
  copy: string
}

export type SearchItem = {
  title: string
  slug: string
  image: string
  copy: string
  type: 'Blog' | 'Event' | 'Offer' | 'Destination'
}

export type EnquiryDraft = {
  fullName: string
  email: string
  phone: string
  message?: string
}

export type BookingIntent = {
  tourSlug: string
  guests: number
  travelDate?: string
}
