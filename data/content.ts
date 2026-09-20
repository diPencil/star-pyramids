import type { Blog, Car, Destination, Event, Offer, SearchItem } from './types'

export const siteImages = {
  cairo: '/egypt-hero.png',
  pyramids: 'https://images.unsplash.com/photo-1568322445389-f64ac2515020?auto=format&fit=crop&w=1200&q=85',
  nile: 'https://images.unsplash.com/photo-1539768942893-daf53e448371?auto=format&fit=crop&w=1200&q=85',
  temple: 'https://images.unsplash.com/photo-1548013146-72479768bada?auto=format&fit=crop&w=1200&q=85',
  desert: 'https://images.unsplash.com/photo-1503177119275-0aa32b3a9368?auto=format&fit=crop&w=1200&q=85',
  redSea: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1200&q=85',
}

export const destinations: Destination[] = [
  { title: 'Cairo & Giza', slug: 'cairo-giza', image: siteImages.pyramids, copy: 'Ancient wonders, lively streets, and the heart of modern Egypt.' },
  { title: 'Luxor', slug: 'luxor', image: siteImages.temple, copy: 'Walk through the world’s greatest open-air museum.' },
  { title: 'Aswan', slug: 'aswan', image: siteImages.nile, copy: 'Slow Nile days, Nubian culture, and timeless landscapes.' },
  { title: 'Hurghada', slug: 'hurghada', image: siteImages.redSea, copy: 'Warm water, colorful reefs, and effortless Red Sea escapes.' },
  { title: 'White Desert', slug: 'white-desert', image: siteImages.desert, copy: 'A surreal landscape carved by wind and time.' },
  { title: 'Sharm El Sheikh', slug: 'sharm-el-sheikh', image: siteImages.redSea, copy: 'A bright coastal retreat with desert adventures nearby.' },
]

export const cars: Car[] = [
  { title: 'Toyota Corolla', slug: 'toyota-corolla', image: siteImages.cairo, seats: '4 seats', transmission: 'Automatic', dailyPrice: 45, copy: 'Reliable comfort for city transfers and day trips.' },
  { title: 'Hyundai H1 Van', slug: 'hyundai-h1-van', image: siteImages.pyramids, seats: '8 seats', transmission: 'Automatic', dailyPrice: 75, copy: 'Spacious private transport for families and groups.' },
  { title: 'Mercedes E-Class', slug: 'mercedes-e-class', image: siteImages.nile, seats: '3 seats', transmission: 'Automatic', dailyPrice: 110, copy: 'Quiet, polished travel for executive transfers.' },
  { title: 'Toyota Hiace', slug: 'toyota-hiace', image: siteImages.temple, seats: '14 seats', transmission: 'Manual', dailyPrice: 95, copy: 'A practical choice for larger groups and excursions.' },
]

export const blogs: Blog[] = [
  { title: 'The ultimate guide to visiting the Pyramids', slug: 'ultimate-guide-pyramids', image: siteImages.pyramids, category: 'Travel Guide', date: 'May 18, 2026', excerpt: 'Everything you need for a smooth and memorable visit to Giza.' },
  { title: 'What to pack for a Nile cruise', slug: 'what-to-pack-nile-cruise', image: siteImages.nile, category: 'Travel Tips', date: 'April 26, 2026', excerpt: 'A thoughtful packing list for sunny days and elegant evenings.' },
  { title: 'A local’s guide to Old Cairo', slug: 'locals-guide-old-cairo', image: siteImages.cairo, category: 'Culture', date: 'March 09, 2026', excerpt: 'Mosques, markets, coffee, and the small details worth slowing down for.' },
  { title: 'The best time to visit Egypt', slug: 'best-time-visit-egypt', image: siteImages.desert, category: 'Travel Guide', date: 'February 20, 2026', excerpt: 'Season-by-season planning for the trip you imagine.' },
  { title: 'Five Egyptian dishes you must try', slug: 'five-egyptian-dishes', image: siteImages.redSea, category: 'Food', date: 'January 14, 2026', excerpt: 'From koshary to fresh seafood, taste the places you visit.' },
  { title: 'Sunrise over Luxor’s West Bank', slug: 'sunrise-luxor-west-bank', image: siteImages.temple, category: 'Stories', date: 'December 05, 2025', excerpt: 'One perfect morning among tombs, valleys, and ancient silhouettes.' },
]

export const events: Event[] = [
  { title: 'Eid Holidays in Egypt', slug: 'eid-holidays-egypt', image: siteImages.cairo, date: 'March 20–30, 2027', location: 'Cairo, Luxor & Aswan', copy: 'Celebrate Egypt’s warmth, food, and living traditions across three iconic cities.' },
  { title: 'New Year on the Nile', slug: 'new-year-nile', image: siteImages.nile, date: 'December 28, 2026 – January 04, 2027', location: 'Luxor to Aswan', copy: 'Welcome the new year with temple lights, calm river days, and golden sunsets.' },
  { title: 'Cairo Jazz Festival Escape', slug: 'cairo-jazz-festival', image: siteImages.pyramids, date: 'October 15–18, 2026', location: 'Cairo', copy: 'Pair the city’s best music weekend with a curated Cairo cultural escape.' },
]

export const offers: Offer[] = [
  { title: 'Stay longer, discover more', slug: 'stay-longer-discover-more', image: siteImages.nile, badge: 'Save 15%', copy: 'Add two nights to any multi-day itinerary and receive a special upgrade.' },
  { title: 'Private family Egypt escape', slug: 'private-family-escape', image: siteImages.pyramids, badge: 'Family', copy: 'Complimentary airport transfer and a child-friendly Cairo experience.' },
  { title: 'Nile & Red Sea combination', slug: 'nile-red-sea-combination', image: siteImages.redSea, badge: 'Limited', copy: 'Combine an iconic Nile cruise with a relaxed beach stay.' },
]

export const faqs = [
  ['When is the best time to visit Egypt?', 'October through April offers comfortable sightseeing weather, while summer can be ideal for Red Sea stays and better value.'],
  ['Do you offer private tours?', 'Yes. Every itinerary can be arranged as a private journey with a dedicated guide, vehicle, and flexible pacing.'],
  ['Can I customize my itinerary?', 'Absolutely. Use Make Your Trip and tell us your dates, interests, and preferred rhythm. Our team will shape the route with you.'],
  ['What is included in your packages?', 'Inclusions vary by itinerary, but commonly include accommodation, transfers, guided visits, selected meals, and local support.'],
  ['How do I book a tour?', 'Choose a tour, send an enquiry, or contact our travel team. We will confirm availability and guide you through the next steps.'],
  ['Is Egypt safe for tourists?', 'Yes. Tourist areas are generally safe and welcoming, with visible security around major sites. Follow local guidance and travel with reputable operators.'],
  ['Is Egypt safe for female tourists?', 'Yes. Many women travel Egypt comfortably every year. Dress modestly, use registered transport, and consider a private guide for extra ease.'],
  ['Do I need a visa to travel to Egypt?', 'Most nationalities need a visa, available on arrival for many passports or online as an e-Visa before you travel.'],
  ['Can I obtain a visa upon arrival in Egypt?', 'Yes, eligible nationalities can get a 30-day visa on arrival at major airports. Check your eligibility before you fly.'],
  ['What currency is used in Egypt?', 'The Egyptian Pound (EGP). Cards are accepted in hotels and larger shops, but carry cash for markets, taxis, and smaller towns.'],
  ['What language is spoken in Egypt?', 'Arabic is the official language. English is widely spoken in tourist areas, hotels, and guided tours.'],
  ['Is tipping common in Egypt?', 'Yes, tipping (baksheesh) is customary for guides, drivers, porters, and restaurant staff. Small amounts are appreciated.'],
  ['What is the best time to visit Egypt?', 'October through April offers the most comfortable weather for sightseeing, while summer suits Red Sea beach stays.'],
  ['Can I drink the tap water in Egypt?', 'No, stick to sealed bottled water, which is cheap and widely available everywhere.'],
  ['What should I wear when I travel to Egypt?', 'Light, modest clothing works best. Cover shoulders and knees for religious sites, and bring sun protection.'],
  ['What electrical plugs are used in Egypt?', 'Egypt uses European-style two-pin plugs (Type C/F) at 220V. Bring a universal adapter.'],
  ['How many days do you need to visit Egypt?', 'Seven to ten days covers Cairo, Luxor, and Aswan comfortably. Add days for the Red Sea or desert oases.'],
  ['Can I take pictures everywhere?', 'Photography is allowed at most outdoor sites, but some museums and tombs restrict cameras or charge a fee. Always ask first.'],
  ['Can I bring a drone to Egypt?', 'Drones are heavily restricted and require prior permits. Do not bring one without official approval.'],
  ['What food is Egypt famous for?', 'Try koshary, ful, falafel (taameya), grilled meats, and fresh seafood, plus mango and guava juices in season.'],
]

export const policies = {
  privacy: [{ h: 'Information we collect', p: 'We collect the details needed to plan, confirm, and support your journey, including contact information, travel preferences, and booking details.' }, { h: 'How we use information', p: 'Your information is used to communicate with you, provide travel services, process requests, and improve the experience on our website.' }, { h: 'Your choices', p: 'You can contact us to update your details, request a copy of your information, or ask us to stop marketing communications.' }],
  terms: [{ h: 'Bookings and payments', p: 'A booking becomes confirmed when availability, itinerary details, and required payment terms have been agreed in writing.' }, { h: 'Changes and cancellations', p: 'Our team will share the applicable change and cancellation terms with your final itinerary before confirmation.' }, { h: 'Travel responsibilities', p: 'Guests are responsible for valid travel documents, following local guidance, and sharing accurate information with our team.' }],
}

export function slugify(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') }

export const allSearchItems: SearchItem[] = [
  ...destinations.map((item) => ({ ...item, type: 'Destination' as const })),
  ...blogs.map((item) => ({ title: item.title, slug: item.slug, image: item.image, copy: item.excerpt, type: 'Blog' as const })),
  ...events.map((item) => ({ title: item.title, slug: item.slug, image: item.image, copy: item.copy, type: 'Event' as const })),
  ...offers.map((item) => ({ title: item.title, slug: item.slug, image: item.image, copy: item.copy, type: 'Offer' as const })),
]

export const findBlog = (slug: string) => blogs.find((item) => item.slug === slug)
export const findEvent = (slug: string) => events.find((item) => item.slug === slug)
export const findOffer = (slug: string) => offers.find((item) => item.slug === slug)
export const findCar = (slug: string) => cars.find((item) => item.slug === slug)
export const findDestination = (slug: string) => destinations.find((item) => item.slug === slug)
