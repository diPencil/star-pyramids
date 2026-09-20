import { siteImages } from './content'
import type { Tour, TourCategory, TourVariant } from './types'

export const tourImages = [
  '/egypt-hero.png',
  'https://images.unsplash.com/photo-1568322445389-f64ac2515020?auto=format&fit=crop&w=900&q=85',
  'https://images.unsplash.com/photo-1539768942893-daf53e448371?auto=format&fit=crop&w=900&q=85',
  'https://images.unsplash.com/photo-1548013146-72479768bada?auto=format&fit=crop&w=900&q=85',
] as const

const oneDay = {
  category: 'one-day-tours',
  summary: 'A privately paced day experience with local guidance and comfortable transport.',
  groupSize: 'Private',
  travelStyle: 'Classic',
} as const

const multiDay = {
  category: 'multi-days-tours',
  summary: 'A private multi-day journey connecting Egypt’s essential places at a comfortable pace.',
  groupSize: 'Private',
  travelStyle: 'Classic',
} as const

const cruise = {
  category: 'nile-cruises',
  summary: 'A Nile journey combining ancient sites, relaxed sailing, and attentive onboard service.',
  groupSize: 'Small group',
  travelStyle: 'Cruise',
} as const

const shore = {
  category: 'shore-excursions',
  summary: 'A port-to-port private excursion planned around the ship schedule.',
  groupSize: 'Private',
  travelStyle: 'Shore excursion',
} as const

const cairoDayTours: Tour[] = [
  { ...oneDay, slug: 'cairo-highlights-day-tour', title: 'Cairo Highlights Day Tour', location: 'Cairo', price: 125.4, duration: 'About 4 Hours', image: tourImages[1] },
  { ...oneDay, slug: 'egyptian-museum-old-cairo', title: 'Egyptian Museum & Old Cairo', location: 'Cairo', price: 189, duration: '6 Hours', image: tourImages[2] },
  { ...oneDay, slug: 'old-cairo-and-khan-el-khalili', title: 'Old Cairo and Khan El Khalili', location: 'Cairo', price: 245, duration: '8 Hours', image: tourImages[3] },
  { ...oneDay, slug: 'cairo-by-night-city-tour', title: 'Cairo by Night City Tour', location: 'Cairo', price: 380, duration: 'Full Day', image: tourImages[0] },
]

const gizaDayTours: Tour[] = [
  { ...oneDay, slug: 'giza-pyramids-sphinx-tour', title: 'Giza Pyramids & Sphinx Tour', location: 'Giza', price: 125.4, duration: '6 Hours', image: tourImages[1] },
  { ...oneDay, slug: 'saqqara-and-memphis-day-trip', title: 'Saqqara and Memphis Day Trip', location: 'Giza', price: 189, duration: '8 Hours', image: tourImages[2] },
  { ...oneDay, slug: 'grand-egyptian-museum-tour', title: 'Grand Egyptian Museum Tour', location: 'Giza', price: 245, duration: 'Full Day', image: tourImages[3] },
  { ...oneDay, slug: 'giza-sound-and-light-evening', title: 'Giza Sound and Light Evening', location: 'Giza', price: 380, duration: '5 Hours', image: tourImages[0] },
]

const alexandriaDayTours: Tour[] = [
  { ...oneDay, slug: 'alexandria-day-trip', title: 'Alexandria Day Trip', location: 'Alexandria', price: 125.4, duration: '8 Hours', image: tourImages[1] },
  { ...oneDay, slug: 'alexandria-mediterranean-day', title: 'Alexandria Mediterranean Day', location: 'Alexandria', price: 189, duration: 'Full Day', image: tourImages[2] },
  { ...oneDay, slug: 'el-alamein-day-tour', title: 'El Alamein Day Tour', location: 'Alexandria', price: 245, duration: '5 Hours', image: tourImages[3] },
  { ...oneDay, slug: 'citadel-catacombs-montaza', title: 'Citadel, Catacombs & Montaza', location: 'Alexandria', price: 380, duration: '7 Hours', image: tourImages[0] },
]

const luxorDayTours: Tour[] = [
  { ...oneDay, slug: 'luxor-east-west-bank', aliases: ['luxor-east-and-west-bank'], title: 'Luxor East & West Bank', location: 'Luxor', price: 125.4, duration: 'Full Day', image: tourImages[1] },
  { ...oneDay, slug: 'valley-of-the-kings-day-tour', title: 'Valley of the Kings Day Tour', location: 'Luxor', price: 189, duration: '5 Hours', image: tourImages[2] },
  { ...oneDay, slug: 'hot-air-balloon-over-luxor', title: 'Hot Air Balloon over Luxor', location: 'Luxor', price: 245, duration: '7 Hours', image: tourImages[3] },
  { ...oneDay, slug: 'dendera-and-abydos-day-trip', title: 'Dendera and Abydos Day Trip', location: 'Luxor', price: 380, duration: 'About 4 Hours', image: tourImages[0] },
]

const aswanDayTours: Tour[] = [
  { ...oneDay, slug: 'aswan-and-the-nubian-village', title: 'Aswan and the Nubian Village', location: 'Aswan', price: 125.4, duration: '5 Hours', image: tourImages[1] },
  { ...oneDay, slug: 'abu-simbel-day-trip', title: 'Abu Simbel Day Trip', location: 'Aswan', price: 189, duration: '7 Hours', image: tourImages[2] },
  { ...oneDay, slug: 'philae-temple-felucca-ride', title: 'Philae Temple & Felucca Ride', location: 'Aswan', price: 245, duration: 'About 4 Hours', image: tourImages[3] },
  { ...oneDay, slug: 'high-dam-obelisk-botanical-garden', title: 'High Dam, Obelisk & Botanical Garden', location: 'Aswan', price: 380, duration: '6 Hours', image: tourImages[0] },
]

const hurghadaDayTours: Tour[] = [
  { ...oneDay, slug: 'hurghada-red-sea-escape', title: 'Hurghada Red Sea Escape', location: 'Hurghada', price: 125.4, duration: '7 Hours', image: tourImages[1] },
  { ...oneDay, slug: 'giftun-island-snorkeling-trip', title: 'Giftun Island Snorkeling Trip', location: 'Hurghada', price: 189, duration: 'About 4 Hours', image: tourImages[2] },
  { ...oneDay, slug: 'hurghada-desert-safari', title: 'Hurghada Desert Safari', location: 'Hurghada', price: 245, duration: '6 Hours', image: tourImages[3] },
  { ...oneDay, slug: 'dolphin-house-boat-trip', title: 'Dolphin House Boat Trip', location: 'Hurghada', price: 380, duration: '8 Hours', image: tourImages[0] },
]

const sharmDayTours: Tour[] = [
  { ...oneDay, slug: 'sharm-el-sheikh-diving-day', aliases: ['sharm-el-sheikh-diving'], title: 'Sharm El Sheikh Diving Day', location: 'Sharm El Sheikh', price: 125.4, duration: 'About 4 Hours', image: tourImages[1] },
  { ...oneDay, slug: 'ras-mohamed-snorkeling-trip', title: 'Ras Mohamed Snorkeling Trip', location: 'Sharm El Sheikh', price: 189, duration: '6 Hours', image: tourImages[2] },
  { ...oneDay, slug: 'st-catherine-mount-sinai', title: 'St. Catherine & Mount Sinai', location: 'Sharm El Sheikh', price: 245, duration: '8 Hours', image: tourImages[3] },
  { ...oneDay, slug: 'tiran-island-boat-trip', title: 'Tiran Island Boat Trip', location: 'Sharm El Sheikh', price: 380, duration: 'Full Day', image: tourImages[0] },
]

const portSaidDayTours: Tour[] = [
  { ...oneDay, slug: 'port-said-highlights-tour', title: 'Port Said Highlights Tour', location: 'Port Said', price: 125.4, duration: '6 Hours', image: tourImages[1] },
  { ...oneDay, slug: 'port-said-port-fuad-day-trip', title: 'Port Said & Port Fuad Day Trip', location: 'Port Said', price: 189, duration: '8 Hours', image: tourImages[2] },
  { ...oneDay, slug: 'suez-canal-experience', title: 'Suez Canal Experience', location: 'Port Said', price: 245, duration: 'Full Day', image: tourImages[3] },
  { ...oneDay, slug: 'museum-lighthouse-corniche', title: 'Museum, Lighthouse & Corniche', location: 'Port Said', price: 380, duration: '5 Hours', image: tourImages[0] },
]

const multiDayTours: Tour[] = [
  { ...multiDay, slug: '4-days-cairo-experience', title: '4 Days Cairo Experience', location: 'Cairo', price: 125.4, duration: '4 Days', image: tourImages[1] },
  { ...multiDay, slug: '5-days-cairo-luxor', title: '5 Days Cairo & Luxor', location: 'Giza', price: 189, duration: '5 Days', image: tourImages[2] },
  { ...multiDay, slug: '7-days-egypt-discovery', title: '7 Days Egypt Discovery', location: 'Luxor', price: 245, duration: '7 Days', image: tourImages[3] },
  { ...multiDay, slug: '8-days-cairo-nile-red-sea', title: '8 Days Cairo, Nile & Red Sea', location: 'Aswan', price: 380, duration: '8 Days', image: tourImages[0] },
  { ...multiDay, slug: '10-days-classic-egypt-journey', title: '10 Days Classic Egypt Journey', location: 'Cairo', price: 125.4, duration: '10 Days', image: tourImages[1] },
  { ...multiDay, slug: 'cairo-luxor-and-aswan-adventure', title: 'Cairo, Luxor and Aswan Adventure', location: 'Giza', price: 189, duration: '10 Days', image: tourImages[2] },
]

const nileCruises: Tour[] = [
  { ...cruise, slug: 'luxury-nile-cruise', title: 'Luxury Nile Cruise', location: 'Cairo', price: 125.4, duration: '3 Nights', image: tourImages[1] },
  { ...cruise, slug: 'aswan-to-luxor-cruise', title: 'Aswan to Luxor Cruise', location: 'Giza', price: 189, duration: '4 Nights', image: tourImages[2] },
  { ...cruise, slug: 'luxor-to-aswan-cruise', title: 'Luxor to Aswan Cruise', location: 'Luxor', price: 245, duration: '5 Nights', image: tourImages[3] },
  { ...cruise, slug: 'premium-dahabiya-experience', title: 'Premium Dahabiya Experience', location: 'Aswan', price: 380, duration: '7 Nights', image: tourImages[0] },
  { ...cruise, slug: 'nile-discovery-cruise', title: 'Nile Discovery Cruise', location: 'Cairo', price: 125.4, duration: '8 Nights', image: tourImages[1] },
  { ...cruise, slug: 'classic-5-day-nile-journey', title: 'Classic 5-Day Nile Journey', location: 'Giza', price: 189, duration: '12 Nights', image: tourImages[2] },
]

const shoreExcursions: Tour[] = [
  { ...shore, slug: 'port-said-highlights', title: 'Port Said Highlights', location: 'Cairo', price: 125.4, duration: '5 Hours', image: tourImages[1] },
  { ...shore, slug: 'alexandria-port-discovery', title: 'Alexandria Port Discovery', location: 'Giza', price: 189, duration: '6 Hours', image: tourImages[2] },
  { ...shore, slug: 'safaga-luxor-excursion', title: 'Safaga Luxor Excursion', location: 'Luxor', price: 245, duration: 'Full Day', image: tourImages[3] },
  { ...shore, slug: 'sokhna-cairo-day-trip', title: 'Sokhna Cairo Day Trip', location: 'Aswan', price: 380, duration: '8 Hours', image: tourImages[0] },
  { ...shore, slug: 'hurghada-shore-adventure', title: 'Hurghada Shore Adventure', location: 'Cairo', price: 125.4, duration: '4 Hours', image: tourImages[1] },
  { ...shore, slug: 'ain-sokhna-pyramids-tour', title: 'Ain Sokhna Pyramids Tour', location: 'Giza', price: 189, duration: '2 Days', image: tourImages[2] },
]

const featuredTours: Tour[] = [
  {
    ...multiDay,
    slug: 'explore-the-wonders-of-egypt-during-the-new-year',
    aliases: ['new-year-egypt-tour'],
    title: 'Explore the wonders of Egypt during the New Year',
    location: 'Cairo, Luxor',
    price: 520,
    duration: '7 Days',
    image: siteImages.pyramids,
    gallery: [siteImages.pyramids, siteImages.cairo, siteImages.temple, siteImages.nile, siteImages.desert, siteImages.redSea],
    summary: 'Experience Cairo and Luxor on a seven-day private journey balancing iconic sights with time to relax.',
    detail: {
      overview: [
        'Experience the very best of Egypt on this carefully designed journey through Cairo and Luxor. From the timeless Pyramids and the treasures of ancient temples to the warmth of modern Egyptian life, every day balances iconic sightseeing with time to relax and explore at your own pace.',
        'With private transfers, expert local guides, comfortable stays, and thoughtful details throughout, this itinerary is ideal for travelers who want to see more while feeling completely looked after.',
      ],
      highlights: [
        { title: 'Giza Pyramids and the Sphinx', items: ['Private visit with Egyptologist', 'Panoramic pyramid viewpoint', 'Sphinx and Valley Temple', 'Free time for photos'] },
        { title: 'Cairo city and local culture', items: ['Citadel of Saladin', 'Coptic Cairo churches', 'Khan El Khalili market', 'Traditional Egyptian lunch'] },
        { title: 'Luxor temples and Valley of the Kings', items: ['Karnak Temple complex', 'Luxor Temple by night', 'Valley of the Kings', 'Hatshepsut Temple'] },
      ],
      itinerary: [
        { day: 'Day 1', title: 'Welcome to Cairo', description: 'Arrive in Cairo, airport pickup, and private transfer to your hotel. Meet your tour leader and enjoy a relaxed evening with a welcome briefing.' },
        { day: 'Day 2', title: 'Giza Pyramids and the Grand Egyptian Museum', description: 'Explore the Pyramids of Giza, the Sphinx, and the panoramic desert plateau before continuing to the Grand Egyptian Museum.' },
        { day: 'Day 3', title: 'Old Cairo and Khan El Khalili', description: 'Discover the Citadel of Saladin, the Mosque of Muhammad Ali, Coptic Cairo, and the colorful lanes of Khan El Khalili bazaar.' },
        { day: 'Day 4', title: 'Nile dinner cruise', description: 'Enjoy a full day at leisure or add an optional city experience, followed by an elegant dinner cruise with live entertainment.' },
        { day: 'Day 5', title: 'Luxor highlights', description: 'Fly or travel to Luxor and visit the temples of Karnak and Luxor with an expert Egyptologist guide.' },
        { day: 'Day 6', title: 'West Bank of Luxor', description: 'Cross the Nile to the Valley of the Kings, Hatshepsut Temple, and the Colossi of Memnon.' },
        { day: 'Day 7', title: 'Departure', description: 'Your private representative will assist with your departure transfer. Leave with unforgettable memories of Egypt.' },
      ],
      included: ['Accommodation in carefully selected hotels', 'Daily breakfast and selected meals', 'Private air-conditioned transportation', 'Professional English-speaking Egyptologist', 'Airport transfers and local assistance', 'All sightseeing tours listed in the itinerary', 'Entrance fees for included visits', 'Bottled water during tours'],
      excluded: ['International flights', 'Egypt entry visa', 'Personal expenses and laundry', 'Optional excursions', 'Tipping for guides and drivers', 'Travel insurance'],
      addOns: [
        { title: 'Nile dinner cruise', price: 53 },
        { title: 'Sound and Light Show at Giza', price: 25 },
        { title: 'Hot air balloon over Luxor', price: 85 },
        { title: 'Private airport lounge service', price: 20 },
        { title: 'Abu Simbel day trip', price: 120 },
        { title: 'Extra hotel night', price: 48 },
      ],
      locations: ['Cairo', 'Giza', 'Luxor'],
      priceRows: [
        { category: 'Adult', price: 520, note: 'Per person sharing' },
        { category: 'Child', price: 390, note: '3 - 11 years' },
        { category: 'Single supplement', price: 160, note: 'Solo traveler' },
        { category: 'Private group', price: 1450, note: 'Up to 10 guests', prefix: 'From ' },
      ],
      reviews: [
        { name: 'Sarah M.', date: 'January 2026', stars: 5, text: 'Perfectly organized from pickup to drop-off. The Nile cruise days were the highlight of our trip.' },
        { name: 'James W.', date: 'December 2025', stars: 5, text: 'Knowledgeable guides and smooth transfers. Luxor at sunrise is something we will never forget.' },
        { name: 'Familie Becker', date: 'November 2025', stars: 4, text: 'Great experience for the whole family. Hotels were comfortable and the itinerary was well paced.' },
      ],
    },
  },
  { ...multiDay, slug: 'riding-in-the-new-year-in-egypt-and-jordan', title: 'Riding in the New Year in Egypt and Jordan', location: 'Giza', price: 189, duration: '2 Days', image: tourImages[2] },
  { ...multiDay, slug: 'a-9-days-cairo-and-nile-cruise', title: 'A 9 Days Cairo and Nile Cruise', location: 'Luxor', price: 245, duration: '9 Days', image: tourImages[3] },
  { ...multiDay, slug: 'enjoy-your-8-days-new-year-trip', title: 'Enjoy your 8 Days New Year trip', location: 'Aswan', price: 380, duration: '8 Days', image: tourImages[0] },
  { ...oneDay, slug: 'cairo-and-giza-pyramids', title: 'Cairo and Giza Pyramids', location: 'Cairo', price: 125.4, duration: 'About 4 Hours', image: tourImages[1] },
  { ...multiDay, slug: 'white-desert-adventure', title: 'White Desert Adventure', location: 'White Desert', price: 189, duration: '2 Days', image: tourImages[2] },
]

const preservedDetailRoutes: Tour[] = [
  { ...oneDay, slug: 'cairo-pyramids-tour', title: 'Cairo and the Pyramids private experience', location: 'Cairo, Giza', price: 380, duration: 'Duration on request', image: siteImages.cairo },
  { ...cruise, slug: 'nile-cruise-luxor-aswan', title: 'Luxury Nile Cruise from Luxor to Aswan', location: 'Luxor, Aswan', price: 890, duration: 'Duration on request', image: siteImages.nile },
  { ...oneDay, slug: 'luxor-day-tour', title: 'Luxor temples and Valley of the Kings', location: 'Luxor', price: 220, duration: 'Full Day', image: siteImages.temple },
]

const listingTours: readonly Tour[] = [
  ...cairoDayTours,
  ...gizaDayTours,
  ...alexandriaDayTours,
  ...luxorDayTours,
  ...aswanDayTours,
  ...hurghadaDayTours,
  ...sharmDayTours,
  ...portSaidDayTours,
  ...multiDayTours,
  ...nileCruises,
  ...shoreExcursions,
]

export const tours: readonly Tour[] = [
  ...listingTours,
  ...featuredTours,
  ...preservedDetailRoutes,
]

export const tourCategories: Record<TourCategory, { title: string; intro: string; variant: TourVariant }> = {
  'one-day-tours': { title: 'One Day Tours', intro: 'Discover Egypt’s greatest treasures in a single unforgettable day.', variant: 'day' },
  'multi-days-tours': { title: 'Multi Days Tours', intro: 'Take your time and experience Egypt beyond the highlights.', variant: 'multi' },
  'nile-cruises': { title: 'Nile Cruises', intro: 'Sail between ancient temples with comfort, service, and unforgettable views.', variant: 'cruise' },
  'shore-excursions': { title: 'Shore Excursions', intro: 'Make the most of every port with expertly planned Egypt shore trips.', variant: 'shore' },
}

export const dayTourRegions = [
  { name: 'Cairo', nameAr: 'القاهرة', slug: 'cairo', copy: 'Museums, mosques and markets in the buzzing heart of Egypt.', tourSlugs: cairoDayTours.map((tour) => tour.slug) },
  { name: 'Giza', nameAr: 'الجيزة', slug: 'giza', copy: 'The Pyramids, the Sphinx and the secrets of the ancient necropolis.', tourSlugs: gizaDayTours.map((tour) => tour.slug) },
  { name: 'Alexandria', nameAr: 'الإسكندرية', slug: 'alexandria', copy: 'Mediterranean breeze, Greco-Roman history and seaside charm.', tourSlugs: alexandriaDayTours.map((tour) => tour.slug) },
  { name: 'Luxor', nameAr: 'الأقصر', slug: 'luxor', copy: 'Temples, tombs and the world’s greatest open-air museum.', tourSlugs: luxorDayTours.map((tour) => tour.slug) },
  { name: 'Aswan', nameAr: 'أسوان', slug: 'aswan', copy: 'Nubian culture, island temples and slow Nile days.', tourSlugs: aswanDayTours.map((tour) => tour.slug) },
  { name: 'Hurghada', nameAr: 'الغردقة', slug: 'hurghada', copy: 'Reefs, islands and desert adventures on the Red Sea.', tourSlugs: hurghadaDayTours.map((tour) => tour.slug) },
  { name: 'Sharm El Sheikh', nameAr: 'شرم الشيخ', slug: 'sharm-el-sheikh', copy: 'World-class diving and Sinai mountain escapes.', tourSlugs: sharmDayTours.map((tour) => tour.slug) },
  { name: 'Port Said', nameAr: 'بورسعيد', slug: 'port-said', copy: 'The Suez Canal, colonial streets and Mediterranean ports.', tourSlugs: portSaidDayTours.map((tour) => tour.slug) },
] as const

const tourByRouteSlug = new Map<string, Tour>()
for (const tour of tours) {
  for (const routeSlug of [tour.slug, ...(tour.aliases ?? [])]) {
    if (tourByRouteSlug.has(routeSlug)) throw new Error(`Duplicate tour route slug: ${routeSlug}`)
    tourByRouteSlug.set(routeSlug, tour)
  }
}

export const findTour = (slug: string) => tourByRouteSlug.get(slug)

export const getToursByCategory = (category: TourCategory) => listingTours.filter((tour) => tour.category === category)

export const getToursBySlugs = (slugs: readonly string[]) => slugs.map((slug) => {
  const tour = findTour(slug)
  if (!tour) throw new Error(`Unknown tour slug in catalog: ${slug}`)
  return tour
})

export const seasonalTours = getToursBySlugs([
  'explore-the-wonders-of-egypt-during-the-new-year',
  'riding-in-the-new-year-in-egypt-and-jordan',
  'a-9-days-cairo-and-nile-cruise',
  'enjoy-your-8-days-new-year-trip',
])

export const popularTours = getToursBySlugs([
  'cairo-and-giza-pyramids',
  'luxor-east-west-bank',
  'aswan-and-the-nubian-village',
  'hurghada-red-sea-escape',
  'alexandria-mediterranean-day',
  'white-desert-adventure',
  'old-cairo-and-khan-el-khalili',
  'sharm-el-sheikh-diving-day',
])

export const tourRouteSlugs = Array.from(tourByRouteSlug.keys())
