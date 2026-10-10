import type { Tour, Blog } from '@/data/types'
import { COMPANY_ADDRESS, COMPANY_EMAIL, COMPANY_PHONE_E164, COMPANY_MAP_URL } from '@/data/company'

const SITE_NAME = 'STAR PYRAMIDS'
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://starpyramids.com'
const SITE_DESCRIPTION = 'Discover ancient wonders, warm hospitality, and unforgettable journeys across Egypt.'

export interface BreadcrumbItem {
  name: string
  url: string
}

/**
 * Generate Organization (TravelAgency) JSON-LD for homepage
 */
export function generateOrganizationJsonLd(): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'TravelAgency',
    name: SITE_NAME,
    alternateName: 'Star Pyramids Tours',
    url: SITE_URL,
    logo: `${SITE_URL}/logo.png`,
    image: `${SITE_URL}/og-image.jpg`,
    description: SITE_DESCRIPTION,
    telephone: COMPANY_PHONE_E164,
    email: COMPANY_EMAIL,
    address: {
      '@type': 'PostalAddress',
      streetAddress: '7st Farouk Ahmed Khattab',
      addressLocality: 'El-Haram',
      addressRegion: 'Giza',
      addressCountry: 'EG',
      postalCode: '',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: 29.9753,
      longitude: 31.1303,
    },
    sameAs: [
      'https://www.facebook.com/starpyramids',
      'https://www.instagram.com/starpyramids',
      'https://twitter.com/starpyramids',
      'https://www.youtube.com/@starpyramids',
      'https://www.linkedin.com/company/starpyramids',
    ],
    priceRange: '$$',
    currenciesAccepted: 'USD, EUR, EGP',
    paymentAccepted: 'Cash, Credit Card, Bank Transfer',
    areaServed: 'EG',
    hasMap: COMPANY_MAP_URL,
  }
}

/**
 * Generate BreadcrumbList JSON-LD
 */
export function generateBreadcrumbJsonLd(items: BreadcrumbItem[]): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  }
}

/**
 * Generate TouristTrip JSON-LD for tour detail pages
 * Only includes price when available and valid (not invented)
 */
export function generateTouristTripJsonLd(tour: Tour, locale: 'en' | 'es' | 'it' | 'ar' = 'en'): object {
  const tourUrl = `${SITE_URL}/egypt-tours/${tour.slug}`
  const title = locale === 'ar' && tour.titleAr ? tour.titleAr : tour.title
  const description = tour.summary

  // Only include price if it's a valid positive number
  const hasValidPrice = typeof tour.price === 'number' && tour.price > 0

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'TouristTrip',
    '@id': tourUrl,
    name: title,
    description,
    url: tourUrl,
    image: tour.image,
    touristType: ['Cultural tourism', 'Historical tourism', 'Adventure tourism'],
    provider: {
      '@type': 'TravelAgency',
      name: SITE_NAME,
      url: SITE_URL,
      telephone: COMPANY_PHONE_E164,
      email: COMPANY_EMAIL,
    },
    itinerary: {
      '@type': 'ItemList',
      numberOfItems: tour.detail?.itinerary?.length ?? 0,
      itemListElement: tour.detail?.itinerary?.map((day, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: day.title,
        description: day.description,
      })) ?? [],
    },
  }

  // Add price only when available and valid - no invented prices
  if (hasValidPrice) {
    jsonLd.offers = {
      '@type': 'Offer',
      name: `${title} - Starting from`,
      description: `Starting price for ${title}`,
      price: tour.price,
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      validFrom: new Date().toISOString().split('T')[0],
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: tour.price,
        priceCurrency: 'USD',
        referenceQuantity: {
          '@type': 'QuantitativeValue',
          value: 1,
          unitCode: 'C62', // person
        },
      },
    }
  }

  // Add duration
  if (tour.duration) {
    jsonLd.duration = tour.duration
  }

  // Add locations from detail
  if (tour.detail?.locations?.length) {
    const baseItinerary = jsonLd.itinerary as Record<string, unknown>
    jsonLd.itinerary = {
      ...baseItinerary,
      itemListElement: tour.detail.locations.map((loc, index) => {
        const locName = typeof loc === 'string' ? loc : loc.name
        return {
          '@type': 'ListItem',
          position: index + 1,
          name: locName,
          item: {
            '@type': 'Place',
            name: locName,
          },
        }
      }),
    }
  }

  // Add category
  const categoryMap: Record<string, string> = {
    'one-day-tours': 'Day Trip',
    'multi-days-tours': 'Multi-Day Tour',
    'nile-cruises': 'Nile Cruise',
    'shore-excursions': 'Shore Excursion',
  }
  jsonLd.category = categoryMap[tour.category] || 'Tour'

  return jsonLd
}

/**
 * Generate BlogPosting JSON-LD for blog article pages
 */
export function generateBlogPostingJsonLd(blog: Blog, locale: 'en' | 'es' | 'it' | 'ar' = 'en'): object {
  const blogUrl = `${SITE_URL}/blogs/${blog.slug}`
  const title = blog.title
  const description = blog.excerpt
  const image = blog.editorial?.heroImage || blog.image
  const datePublished = blog.date
  const authorName = SITE_NAME

  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    '@id': blogUrl,
    headline: title,
    description,
    image: image ? [image] : [],
    datePublished,
    dateModified: blog.date,
    author: {
      '@type': 'Organization',
      name: authorName,
      url: SITE_URL,
    },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_URL}/logo.png`,
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': blogUrl,
    },
    articleSection: blog.category,
    keywords: ['Egypt travel', 'Egypt tours', 'Nile cruise', blog.category.toLowerCase()],
    inLanguage: locale,
  }
}

/**
 * Helper to safely render JSON-LD script tag
 */
export function renderJsonLd(data: object): React.ReactElement {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}