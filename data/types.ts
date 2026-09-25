export type TourCategory = 'one-day-tours' | 'multi-days-tours' | 'nile-cruises' | 'shore-excursions'
export type TourVariant = 'multi' | 'day' | 'cruise' | 'shore'
export type CruiseTypeSlug = 'standard-nile-cruises' | 'deluxe-nile-cruise' | 'superior-nile-cruise' | 'luxury-nile-cruise'

export type TourItineraryDay = {
  day: string
  title: string
  description: string
  meals?: string
  image?: string
}

export type TourHighlightGroup = {
  title: string
  items: readonly string[]
}

export type TourAddOn = {
  title: string
  price?: number
}

export type TourPriceTier = {
  label: string
  price: number
  suffix?: string
}

export type TourPriceRow = {
  category: string
  price: number
  note: string
  startDate?: string
  endDate?: string
  prefix?: string
  tiers?: readonly TourPriceTier[]
}

export type ReviewPlatform = 'google' | 'tripadvisor' | 'trustindex' | 'getyourguide' | 'direct'

export type TourVideoPlatform = 'youtube' | 'instagram' | 'tiktok' | 'facebook' | 'vimeo' | 'direct'

export type TourJourneyVideo = {
  id: string
  url: string
  platform?: TourVideoPlatform
  title: string
  titleAr?: string
  publishedAt: string
  thumbnail?: string
}

export type TourTravelerPrice = {
  travelers: number
  adultPrice?: number
  childPrice?: number
  infantPrice?: number
  /** Legacy adult rate kept while existing saved browser data is migrated. */
  price?: number
}

export type TourReview = {
  name: string
  date: string
  stars: number
  text: string
  platform?: ReviewPlatform
}

export type TourLocation = string | {
  id: string
  name: string
  nameAr?: string
  latitude: number
  longitude: number
}

export type TourDetail = {
  overview: readonly string[]
  highlightImage?: string
  highlights: readonly TourHighlightGroup[]
  itinerary: readonly TourItineraryDay[]
  itineraryImages?: readonly string[]
  itineraryNote?: string
  included?: readonly string[]
  excluded?: readonly string[]
  addOns?: readonly TourAddOn[]
  locations: readonly TourLocation[]
  priceRows?: readonly TourPriceRow[]
  travelerPrices?: readonly TourTravelerPrice[]
  reviews?: readonly TourReview[]
}

export type DayTourDetail = {
  overview: readonly string[]
  highlightImage?: string
  itineraryNote?: string
  stops?: readonly { title: string; description: string; meals?: string; image?: string }[]
  highlights?: readonly string[]
  gallery?: readonly { src: string; alt: string }[]
  included?: readonly string[]
  excluded?: readonly string[]
  addOns?: readonly TourAddOn[]
  locations?: readonly TourLocation[]
  priceRows?: readonly TourPriceRow[]
  travelerPrices?: readonly TourTravelerPrice[]
}

export type TourDeal = {
  percent: number
  endsAt: string
}

export type DealFeedItem = {
  slug: string
  percent: number
  endsAt: string
}

export type TourOfferView = {
  badge?: string
  deadline: string
  originalPrice?: number
  rating?: number
}

export type Tour = {
  slug: string
  aliases?: readonly string[]
  title: string
  titleAr?: string
  category: TourCategory
  cruiseType?: CruiseTypeSlug
  departurePort?: string
  location: string
  price: number
  duration: string
  image: string
  gallery?: readonly string[]
  galleryCaptions?: readonly { en: string; ar: string }[]
  journeyVideos?: readonly TourJourneyVideo[]
  photoCredits?: readonly { label: string; url: string }[]
  summary: string
  groupSize?: string
  travelStyle?: string
  deal?: TourDeal
  detail?: TourDetail
  dayDetail?: DayTourDetail
}

export type Destination = {
  title: string
  slug: string
  image: string
  copy: string
  detail: {
    heroImage: string
    heroAlt: string
    eyebrow: string
    intro: string
    facts: readonly { label: string; value: string }[]
    bestFor: readonly string[]
    experiences: readonly { title: string; copy: string; image: string; alt: string }[]
    rhythm: readonly { label: string; title: string; copy: string }[]
    practical: readonly { title: string; copy: string }[]
    tourSlugs: readonly string[]
  }
}

export type Car = {
  title: string
  slug: string
  image: string
  seats: string
  transmission: string
  dailyPrice: number
  copy: string
  credit?: {
    label: string
    url: string
  }
}

export type BlogGuideTip = {
  icon: string
  title: string
  copy: string
}

export type BlogGuideSection = {
  id: string
  number: string
  eyebrow: string
  heading: string
  lede?: string
  copy?: readonly string[]
  list?: readonly string[]
  image?: { src: string; alt: string; caption?: string }
  reverse?: boolean
}

export type Blog = {
  title: string
  slug: string
  image: string
  category: string
  date: string
  excerpt: string
  editorial?: {
    heroImage?: string
    heroAlt?: string
    readTime?: string
    heroDescription?: string
    facts?: readonly { icon: string; label: string; value: string }[]
    sidebarLinks?: readonly { href: string; label: string }[]
    sidebarAction?: { label: string; heading: string; tourSlug: string }
    sections?: readonly BlogGuideSection[]
    tips?: readonly BlogGuideTip[]
    quote?: string
    checklist?: readonly { title: string; detail: string }[]
    wideImage?: { src: string; alt: string; caption?: string }
    cta?: { eyebrow: string; heading: string; copy: string; tourSlug?: string; tourLabel?: string; customLabel?: string }
  }
}

export type EventProgramDay = {
  day: string
  title: string
  description: string
}

export type Event = {
  title: string
  slug: string
  image: string
  date: string
  location: string
  copy: string
  category?: string
  intro?: string
  highlights?: readonly { title: string; description: string }[]
  program?: readonly EventProgramDay[]
  included?: readonly string[]
  excluded?: readonly string[]
  addOns?: readonly TourAddOn[]
}

export type Offer = {
  title: string
  slug: string
  image: string
  gallery?: readonly string[]
  photoCredits?: readonly { label: string; url: string }[]
  badge: string
  copy: string
  highlights?: readonly string[]
  duration?: string
  rating?: number
  price?: number
  originalPrice?: number
  deadline?: string
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
