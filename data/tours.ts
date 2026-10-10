import { destinations, findDestination, siteImages } from './content'
import type { DealFeedItem, Destination, MultiDayCategory, Tour, TourCategory, TourOfferView, TourPriceRow, TourVariant } from './types'

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
  summary: 'A private multi-day journey connecting Egypt\'s essential places at a comfortable pace.',
  groupSize: 'Private',
  travelStyle: 'Classic',
} as const

export const dayTourTerms = {
  included: ['Private day-tour format', 'Visit planning for the confirmed tour and duration'],
  excluded: ['Travel to Egypt and accommodation', 'Personal purchases, tips, and travel insurance', 'Entrance fees, transfers, and meals unless listed in your confirmed quote'],
  addOns: [{ title: 'Extend the visit time' }, { title: 'Add another stop where timing allows' }],
} as const

const proposedPackage = {
  itineraryNote: 'Suggested day-by-day route. Hotels, transport, visits, inclusions, and final timings are confirmed with our team before you commit.',
} as const

const cairoPackageImage = siteImages.pyramids
const cairoStreetsImage = 'https://images.unsplash.com/photo-1707172889437-dc6f210ea44a?auto=format&fit=crop&w=1400&q=86'
const luxorPackageImage = findDestination('luxor')!.detail.heroImage
const aswanPackageImage = findDestination('aswan')!.detail.heroImage
const redSeaPackageImage = siteImages.redSea

const cruise = {
  category: 'nile-cruises',
  summary: 'A Nile journey combining ancient sites, relaxed sailing, and attentive onboard service.',
  groupSize: 'On request',
  travelStyle: 'Cruise',
} as const

const shore = {
  category: 'shore-excursions',
  summary: 'A port-to-port private excursion planned around the ship schedule.',
  groupSize: 'Private',
  travelStyle: 'Shore excursion',
} as const

const cairoDayTours: Tour[] = [
  {
    ...oneDay, slug: 'cairo-highlights-day-tour', title: 'Cairo Highlights Day Tour', location: 'Cairo', price: 125.4, duration: 'About 4 Hours', image: cairoStreetsImage,
    summary: 'A short, privately paced introduction to the streets, stories, and landmarks of Cairo.',
    dayDetail: {
      overview: [
        'See Cairo through a route shaped around your interests rather than a fixed checklist. With roughly four hours available, our team can focus the visit on one or two nearby areas so there is time to explore properly.',
        'The stops below are possibilities for a tailored visit, not a confirmed itinerary. The exact route, meeting point, start time, guide, transport, and entrance fees are confirmed with your quote.',
      ],
      stops: [
        { title: 'Choose your starting point', description: 'Tell us where you are staying and what you would most like to see; the route begins where it makes sense for your day.' },
        { title: 'Explore a Cairo highlight', description: 'Choose a museum, historic quarter, or landmark area as the focus of your visit. Specific sites are agreed before booking.' },
        { title: 'Leave room for the city', description: 'Depending on your chosen route, allow time for local streets, architecture, or a market walk rather than rushing between distant stops.' },
      ],
      highlights: ['Private pace built around your interests', 'A focused route suited to a short visit', 'Space for Cairo streets and local context'],
      included: ['Private day-tour format', 'A visit plan tailored to the agreed route and available time'],
      excluded: ['International travel and accommodation', 'Personal purchases, tips, and travel insurance', 'Any visits or services not confirmed in your quote'],
      addOns: [{ title: 'Extend the sightseeing time' }, { title: 'Add a Cairo museum visit' }],
      gallery: [
        { src: cairoStreetsImage, alt: 'Historic market street in Cairo' },
        { src: siteImages.pyramids, alt: 'Pyramids and Sphinx in nearby Giza' },
      ],
    },
  },
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
  {
    ...multiDay, slug: '4-days-cairo-experience', categorySlugs: ['cairo-city-breaks', 'pyramids-tours', 'culture-tours'], title: '4 Days Cairo Experience', location: 'Cairo, Giza', price: 125.4, duration: '4 Days', image: cairoPackageImage,
    gallery: [cairoPackageImage, cairoStreetsImage],
    summary: 'Four days to discover Giza and the many layers of Cairo at a comfortable private pace.',
    detail: { ...proposedPackage,
      itineraryImages: [cairoStreetsImage, cairoPackageImage, cairoStreetsImage, cairoStreetsImage],
      overview: ['A city break with enough room for both the ancient monuments of Giza and the living neighborhoods of Cairo.', 'The route below is a starting point for a private journey; our team will tailor the order and pace around your dates.'],
      highlights: [
        { title: 'Giza and its ancient landmarks', items: ['Pyramids plateau', 'Great Sphinx', 'Time for viewpoints and photography'] },
        { title: 'The many sides of Cairo', items: ['Historic streets and architecture', 'Egyptian collections and museums', 'Local markets and food culture'] },
      ],
      itinerary: [
        { day: 'Day 1', title: 'Arrive in Cairo', description: 'Settle in and keep the first evening free to adjust to the city and your travel schedule.' },
        { day: 'Day 2', title: 'Giza and the pyramids', description: 'Spend the day around the pyramids plateau, the Sphinx, and the wider Giza landscape.' },
        { day: 'Day 3', title: 'Historic Cairo', description: 'Explore the city\'s historic quarters, cultural sites, and market streets at an unhurried pace.' },
        { day: 'Day 4', title: 'A final Cairo morning', description: 'Use the remaining time for a museum, a neighborhood walk, or a relaxed departure.' },
      ],
      included: ['Private four-day Cairo and Giza itinerary planning', 'Sightseeing visits agreed in your final itinerary', 'Local coordination for the confirmed route'],
      excluded: ['International flights and Egypt entry visa', 'Personal expenses, tips, and travel insurance', 'Hotel nights, meals, transport, guiding, and entrance fees unless listed in your confirmed quote'],
      addOns: [{ title: 'Nile dinner cruise' }, { title: 'Giza Sound and Light Show' }, { title: 'Additional Cairo museum visit' }],
      locations: ['Cairo', 'Giza'],
    },
  },
  {
    ...multiDay, slug: '5-days-cairo-luxor', categorySlugs: ['pyramids-tours', 'egypt-classic-tours', 'culture-tours'], title: '5 Days Cairo & Luxor', location: 'Cairo, Giza, Luxor', price: 189, duration: '5 Days', image: cairoPackageImage,
    gallery: [cairoPackageImage, luxorPackageImage, siteImages.nile],
    summary: 'Connect the pyramids and the capital with the great temples and tombs of Luxor.',
    detail: { ...proposedPackage,
      itineraryImages: [cairoStreetsImage, cairoPackageImage, cairoStreetsImage, luxorPackageImage, luxorPackageImage],
      overview: ['This five-day route links the icons of Cairo and Giza with Luxor\'s extraordinary archaeology on both banks of the Nile.', 'It is designed as a flexible framework so the journey between cities and the sightseeing pace can be confirmed around your plans.'],
      highlights: [
        { title: 'Cairo and Giza', items: ['Pyramids and Sphinx', 'Cairo\'s historic districts', 'Museum time according to your interests'] },
        { title: 'Luxor on both banks', items: ['Karnak and Luxor Temple', 'Valley of the Kings', 'West Bank monuments'] },
      ],
      itinerary: [
        { day: 'Day 1', title: 'Welcome to Cairo', description: 'Arrive and take time to settle in before the sightseeing begins.' },
        { day: 'Day 2', title: 'The Giza Plateau', description: 'Explore the pyramids, the Sphinx, and the surrounding ancient landscape.' },
        { day: 'Day 3', title: 'Cairo to Luxor', description: 'Discover a final Cairo highlight before continuing to Luxor; the transfer method is arranged when the itinerary is confirmed.' },
        { day: 'Day 4', title: 'Luxor\'s East Bank', description: 'Give Karnak and Luxor Temple the time they deserve, with room to enjoy the Nile-side city.' },
        { day: 'Day 5', title: 'West Bank and onward travel', description: 'Visit the royal tombs and key West Bank monuments before your onward journey.' },
      ],
      locations: ['Cairo', 'Giza', 'Luxor'],
    },
  },
  {
    ...multiDay, slug: '7-days-egypt-discovery', categorySlugs: ['egypt-classic-tours', 'culture-tours'], title: '7 Days Egypt Discovery', location: 'Cairo, Luxor, Aswan', price: 245, duration: '7 Days', image: luxorPackageImage,
    gallery: [luxorPackageImage, cairoPackageImage, aswanPackageImage, siteImages.nile],
    summary: 'A week-long introduction to Egypt, from the capital to Upper Egypt.',
    detail: { ...proposedPackage,
      itineraryImages: [cairoStreetsImage, cairoPackageImage, cairoStreetsImage, luxorPackageImage, luxorPackageImage, aswanPackageImage, aswanPackageImage],
      overview: ['A broad first encounter with Egypt: begin with Cairo and Giza, then follow the Nile south through the monumental sites of Luxor toward Aswan.', 'Seven days can cover a lot of ground, so the final route and travel time should be balanced around your preferred pace.'],
      highlights: [
        { title: 'Ancient icons', items: ['Giza Pyramids and Sphinx', 'Luxor\'s temples and tombs', 'Aswan\'s Nile-side setting'] },
        { title: 'A changing sense of place', items: ['Capital neighborhoods', 'Upper Egypt heritage', 'Time on or beside the Nile'] },
      ],
      itinerary: [
        { day: 'Day 1', title: 'Arrive in Cairo', description: 'Ease into the city and prepare for the week ahead.' },
        { day: 'Day 2', title: 'Pyramids and Giza', description: 'Explore the pyramids plateau and the Sphinx with time for its panoramic viewpoints.' },
        { day: 'Day 3', title: 'Cairo\'s cultural layers', description: 'Choose a mix of museums, historic neighborhoods, and market streets.' },
        { day: 'Day 4', title: 'Continue to Luxor', description: 'Travel south and begin exploring Luxor\'s East Bank after arrival, time permitting.' },
        { day: 'Day 5', title: 'Luxor\'s West Bank', description: 'Spend the day among royal tombs, temples, and the landscapes across the Nile.' },
        { day: 'Day 6', title: 'Continue toward Aswan', description: 'Follow the Nile south and enjoy Aswan\'s slower rhythm on arrival.' },
        { day: 'Day 7', title: 'Aswan and departure', description: 'Make space for a final Aswan experience before your onward travel.' },
      ],
      locations: ['Cairo', 'Giza', 'Luxor', 'Aswan'],
    },
  },
  {
    ...multiDay, slug: '8-days-cairo-nile-red-sea', categorySlugs: ['egypt-classic-tours', 'culture-tours'], title: '8 Days Cairo, Nile & Red Sea', location: 'Cairo, Nile Valley, Red Sea', price: 380, duration: '8 Days', image: redSeaPackageImage,
    gallery: [redSeaPackageImage, cairoPackageImage, luxorPackageImage, siteImages.nile],
    summary: 'Combine the pyramids, Nile heritage, and time to unwind beside the Red Sea.',
    detail: { ...proposedPackage,
      itineraryImages: [cairoStreetsImage, cairoPackageImage, luxorPackageImage, luxorPackageImage, luxorPackageImage, redSeaPackageImage, redSeaPackageImage, redSeaPackageImage],
      overview: ['This journey changes pace as it goes: Cairo\'s headline sights, the history-rich Nile Valley, and a restorative finish at the Red Sea.', 'The exact Nile and coast stops are selected with our team according to your travel dates and preferred balance between discovery and downtime.'],
      highlights: [
        { title: 'The cultural journey', items: ['Giza Pyramids and Sphinx', 'Nile Valley temples', 'A mix of guided visits and free time'] },
        { title: 'A Red Sea finish', items: ['Beach time', 'Optional water activities', 'Space to slow down before departure'] },
      ],
      itinerary: [
        { day: 'Day 1', title: 'Arrive in Cairo', description: 'Settle in and enjoy a gentle start to the trip.' },
        { day: 'Day 2', title: 'Giza and Cairo', description: 'Explore the pyramids and the Sphinx, leaving space for another Cairo experience.' },
        { day: 'Day 3', title: 'Journey to the Nile Valley', description: 'Continue south to begin the Upper Egypt portion of the route.' },
        { day: 'Day 4', title: 'Ancient sites beside the Nile', description: 'Spend a full day with the temples, tombs, or riverside places selected for your final route.' },
        { day: 'Day 5', title: 'A slower Nile day', description: 'Balance another heritage visit with time to take in the river and local life.' },
        { day: 'Day 6', title: 'Continue to the Red Sea', description: 'Travel toward the coast and shift into a more relaxed rhythm.' },
        { day: 'Day 7', title: 'Red Sea at your pace', description: 'Enjoy the beach or ask our team about suitable snorkeling and boat options.' },
        { day: 'Day 8', title: 'Departure', description: 'Finish with a calm morning before the onward journey.' },
      ],
      locations: ['Cairo', 'Giza', 'Nile Valley', 'Red Sea'],
    },
  },
  {
    ...multiDay, slug: '10-days-classic-egypt-journey', categorySlugs: ['egypt-classic-tours', 'culture-tours'], title: '10 Days Classic Egypt Journey', location: 'Cairo, Luxor, Aswan', price: 125.4, duration: '10 Days', image: cairoPackageImage,
    gallery: [cairoPackageImage, luxorPackageImage, aswanPackageImage, siteImages.nile],
    summary: 'A longer classic route through Cairo, the temples of Luxor, and the easy rhythm of Aswan.',
    detail: { ...proposedPackage,
      itineraryImages: [cairoStreetsImage, cairoPackageImage, cairoStreetsImage, cairoStreetsImage, luxorPackageImage, luxorPackageImage, luxorPackageImage, aswanPackageImage, aswanPackageImage, aswanPackageImage],
      overview: ['Ten days give the classic Egypt circuit more breathing room, connecting Cairo and Giza with the temples and Nile landscapes of Luxor and Aswan.', 'This suggested sequence leaves space for deeper visits and rest; exact transport, stays, and sightseeing are planned with you.'],
      highlights: [
        { title: 'Cairo and Giza', items: ['Pyramids and Sphinx', 'Museums and historic neighborhoods', 'Time for local culture'] },
        { title: 'The Nile Valley', items: ['Luxor\'s East and West Banks', 'A slower journey south', 'Aswan\'s islands and temples'] },
      ],
      itinerary: [
        { day: 'Day 1', title: 'Arrive in Cairo', description: 'Settle in and enjoy a free evening.' },
        { day: 'Day 2', title: 'Explore Giza', description: 'Spend a full day with the pyramids plateau and the Great Sphinx.' },
        { day: 'Day 3', title: 'Historic Cairo', description: 'Discover the capital\'s layered architecture, markets, and local culture.' },
        { day: 'Day 4', title: 'A deeper Cairo day', description: 'Choose a museum or another district according to your interests.' },
        { day: 'Day 5', title: 'Travel to Luxor', description: 'Continue to Upper Egypt and enjoy the Nile-side city on arrival.' },
        { day: 'Day 6', title: 'Karnak and Luxor Temple', description: 'Explore the great temple complexes on Luxor\'s East Bank.' },
        { day: 'Day 7', title: 'Luxor West Bank', description: 'Visit royal tombs and monumental sites across the Nile.' },
        { day: 'Day 8', title: 'Onward to Aswan', description: 'Travel south and settle into Aswan\'s gentler pace.' },
        { day: 'Day 9', title: 'Discover Aswan', description: 'Explore an island temple, river life, or Nubian culture according to your interests.' },
        { day: 'Day 10', title: 'Departure', description: 'Enjoy a final morning before your onward journey.' },
      ],
      locations: ['Cairo', 'Giza', 'Luxor', 'Aswan'],
    },
  },
  {
    ...multiDay, slug: 'cairo-luxor-and-aswan-adventure', categorySlugs: ['egypt-classic-tours', 'culture-tours', 'adventure-tours'], title: 'Cairo, Luxor and Aswan Adventure', location: 'Cairo, Luxor, Aswan', price: 189, duration: '10 Days', image: aswanPackageImage,
    gallery: [aswanPackageImage, cairoPackageImage, luxorPackageImage, siteImages.nile],
    summary: 'An active, privately paced journey through three of Egypt\'s most compelling regions.',
    detail: { ...proposedPackage,
      itineraryImages: [cairoStreetsImage, cairoPackageImage, cairoStreetsImage, cairoStreetsImage, luxorPackageImage, luxorPackageImage, luxorPackageImage, aswanPackageImage, aswanPackageImage, aswanPackageImage],
      overview: ['Move from the energy of Cairo to Luxor\'s ancient monuments and Aswan\'s river landscapes, with a little more room to explore beyond each headline sight.', 'The proposed route can be adjusted for interests, travel pace, and the best transport connections for your dates.'],
      highlights: [
        { title: 'City and ancient landscape', items: ['Cairo neighborhoods', 'Giza Pyramids and Sphinx', 'Luxor\'s great temple complexes'] },
        { title: 'Upper Egypt at a gentler pace', items: ['West Bank monuments', 'Nile-side experiences', 'Aswan\'s islands and Nubian culture'] },
      ],
      itinerary: [
        { day: 'Day 1', title: 'Arrive in Cairo', description: 'Arrive and take time to settle in.' },
        { day: 'Day 2', title: 'Giza\'s ancient landmarks', description: 'Explore the pyramids, the Sphinx, and the wider plateau.' },
        { day: 'Day 3', title: 'Cairo beyond Giza', description: 'Follow your interests through museums, historic quarters, and city streets.' },
        { day: 'Day 4', title: 'A flexible Cairo day', description: 'Keep room for a deeper city visit or a more relaxed pace before traveling south.' },
        { day: 'Day 5', title: 'Continue to Luxor', description: 'Travel to Luxor and begin discovering the East Bank.' },
        { day: 'Day 6', title: 'Luxor\'s temples', description: 'Spend time at Karnak and Luxor Temple without rushing between sites.' },
        { day: 'Day 7', title: 'The West Bank', description: 'Cross the Nile for royal tombs and ancient monuments.' },
        { day: 'Day 8', title: 'Toward Aswan', description: 'Continue south, watching the character of the Nile Valley change.' },
        { day: 'Day 9', title: 'Aswan and the Nile', description: 'Explore Aswan\'s island scenery and cultural heritage at your pace.' },
        { day: 'Day 10', title: 'Departure', description: 'Leave time for a final view of the river before onward travel.' },
      ],
      locations: ['Cairo', 'Giza', 'Luxor', 'Aswan'],
    },
  },
]

const nileCruises: Tour[] = [
  {
    ...cruise, slug: 'luxury-nile-cruise', title: 'Luxury Nile Cruise', titleAr: 'رحلة نيلية فاخرة', location: 'Luxor, Aswan', price: 935, duration: '4 Nights', image: luxorPackageImage, cruiseType: 'luxury-nile-cruise',
    gallery: [luxorPackageImage, aswanPackageImage],
    summary: 'A premium Nile journey combining five-star service, private balcony cabins, and curated temple visits between Luxor and Aswan.',
    detail: {
      overview: [
        'Sail the Nile in refined comfort aboard a luxury vessel designed for travelers who appreciate space, quiet, and attentive service.',
        'This four-night cruise connects the temples of Luxor and Aswan with guided visits, relaxed sailing days, and evenings on deck watching the riverbank landscape unfold.',
        'Your cabin features a private balcony, king-sized bed, and en-suite bathroom. The ship offers a sun deck, pool, spa, and two restaurants serving Egyptian and international cuisine.',
      ],
      highlights: [
        { title: 'Luxor Temple by Night', items: ['Guided evening visit', 'Illuminated colonnades', 'Sacred lake walkthrough'] },
        { title: 'Valley of the Kings', items: ['Three tomb entries included', 'Tomb of Tutankhamun optional', 'Expert Egyptologist guide'] },
        { title: 'Aswan High Dam & Philae', items: ['Panoramic dam views', 'Temple of Isis boat transfer', 'Nubian village option'] },
      ],
      itinerary: [
        { day: 'Day 1', title: 'Embarkation in Luxor', description: 'Board your cruise ship in Luxor. After a welcome lunch, visit the magnificent Karnak Temple complex, exploring the Great Hall of Columns and the Sacred Lake. Return for dinner on board as the ship moors overnight in Luxor.' },
        { day: 'Day 2', title: 'Luxor West Bank & Edfu', description: 'Early morning crossing to the West Bank. Explore the Valley of the Kings with entries to three tombs, followed by the Temple of Hatshepsut at Deir el-Bahari. After lunch on board, sail towards Edfu through the afternoon.' },
        { day: 'Day 3', title: 'Edfu & Kom Ombo', description: 'Morning visit to the Temple of Horus at Edfu, one of the best-preserved temples in Egypt. Continue sailing to Kom Ombo for a sunset visit to the dual temple dedicated to Sobek and Horus. Evening entertainment on the sundeck.' },
        { day: 'Day 4', title: 'Aswan Exploration', description: 'Arrive in Aswan and visit the Aswan High Dam and the unfinished obelisk. Take a felucca ride around Elephantine Island and visit the Temple of Philae by motorboat. Farewell dinner with Nubian music performance.' },
        { day: 'Day 5', title: 'Disembarkation', description: 'Breakfast on board. Disembark in Aswan. Optional extension to Abu Simbel available.' },
      ],
      itineraryImages: [luxorPackageImage, luxorPackageImage, luxorPackageImage, aswanPackageImage, aswanPackageImage],
      included: ['4 nights full-board accommodation', 'All meals (breakfast, lunch, dinner)', 'Guided tours at all listed sites', 'Entrance fees to specified temples', 'Transfers in Luxor and Aswan', 'Wi-Fi on board'],
      excluded: ['International flights', 'Egypt visa', 'Tips for crew and guides', 'Optional Abu Simbel excursion', 'Personal expenses'],
      addOns: [{ title: 'Upgrade to Royal Suite', price: 350 }, { title: 'Abu Simbel day trip', price: 180 }, { title: 'Private felucca sunset cruise', price: 60 }],
      locations: ['Luxor', 'Edfu', 'Kom Ombo', 'Aswan'],
      priceRows: [
        { category: '(1-10) Jan', price: 2250, note: 'Peak season', tiers: [{ label: 'Solo', price: 2250 }, { label: '2-2 PAX', price: 1485 }, { label: '3-100 PAX', price: 1415 }] },
        { category: '(11-31) Jan', price: 1495, note: 'Standard season', tiers: [{ label: 'Solo', price: 1495 }, { label: '2-2 PAX', price: 999 }, { label: '3-100 PAX', price: 935 }] },
        { category: '(1-30) Apr', price: 2250, note: 'Peak season', tiers: [{ label: 'Solo', price: 2250 }, { label: '2-2 PAX', price: 1485 }, { label: '3-100 PAX', price: 1415 }] },
        { category: '(1-18) Dec', price: 1495, note: 'Standard season', tiers: [{ label: 'Solo', price: 1495 }, { label: '2-2 PAX', price: 999 }, { label: '3-100 PAX', price: 935 }] },
        { category: '(19-31) Dec', price: 2250, note: 'Holiday peak', tiers: [{ label: 'Solo', price: 2250 }, { label: '2-2 PAX', price: 1485 }, { label: '3-100 PAX', price: 1415 }] },
      ],
    },
  },
  {
    ...cruise, slug: 'aswan-to-luxor-cruise', title: 'Aswan to Luxor Cruise', titleAr: 'رحلة نيلية من أسوان إلى الأقصر', location: 'Aswan, Luxor', price: 561, duration: '3 Nights', image: aswanPackageImage, cruiseType: 'standard-nile-cruises',
    gallery: [aswanPackageImage, luxorPackageImage],
    summary: 'A comfortable south-to-nile cruise from Aswan to Luxor visiting Philae, Kom Ombo, Edfu, and the West Bank temples.',
    detail: {
      overview: [
        'This three-night cruise takes you from Aswan to Luxor, following the classic Nile route through ancient temple sites.',
        'Onboard accommodation includes full-board meals, guided shore excursions, and evening entertainment. The ship features a sun deck, restaurant, and bar.',
        'Ideal for travelers who want to experience the Nile highlights in a shorter timeframe without sacrificing comfort.',
      ],
      highlights: [
        { title: 'Philae Temple', items: ['Island temple by boat', 'Stunning Ptolemaic architecture', 'Sound and light show option'] },
        { title: 'Kom Ombo Temple', items: ['Unique dual temple', 'Crocodile mummies museum', 'Nile-side sunset views'] },
        { title: 'Temple of Horus at Edfu', items: ['Best-preserved temple in Egypt', 'Horse carriage transfer', 'Detailed hieroglyphic walls'] },
      ],
      itinerary: [
        { day: 'Day 1', title: 'Aswan Embarkation & Philae', description: 'Board in Aswan. Visit the Temple of Philae by motorboat. Afternoon felucca sailing around the islands. Welcome dinner on board.' },
        { day: 'Day 2', title: 'Kom Ombo & Edfu', description: 'Morning sailing to Kom Ombo. Visit the dual temple of Sobek and Horus. Continue to Edfu. Afternoon visit to the Temple of Horus.' },
        { day: 'Day 3', title: 'Luxor Temples', description: 'Arrive in Luxor. Visit the East Bank temples including Karnak and Luxor Temple. Evening free to explore Luxor souk.' },
        { day: 'Day 4', title: 'West Bank & Disembarkation', description: 'Optional early morning hot air balloon ride. Visit Valley of the Kings and Hatshepsut Temple. Disembark after lunch.' },
      ],
      included: ['3 nights full-board', 'All meals', 'Guided tours', 'Entrance fees', 'Port transfers'],
      excluded: ['Flights', 'Visa', 'Tips', 'Optional balloon ride', 'Personal expenses'],
      locations: ['Aswan', 'Kom Ombo', 'Edfu', 'Luxor'],
      priceRows: [
        { category: '(1-10) Jan', price: 1350, note: 'Peak season', tiers: [{ label: 'Solo', price: 1350 }, { label: '2-2 PAX', price: 891 }, { label: '3-100 PAX', price: 851 }] },
        { category: '(11-31) Jan', price: 890, note: 'Standard', tiers: [{ label: 'Solo', price: 890 }, { label: '2-2 PAX', price: 587 }, { label: '3-100 PAX', price: 561 }] },
        { category: '(1-30) Apr', price: 1350, note: 'Peak season', tiers: [{ label: 'Solo', price: 1350 }, { label: '2-2 PAX', price: 891 }, { label: '3-100 PAX', price: 851 }] },
        { category: '(1-18) Dec', price: 890, note: 'Standard', tiers: [{ label: 'Solo', price: 890 }, { label: '2-2 PAX', price: 587 }, { label: '3-100 PAX', price: 561 }] },
        { category: '(19-31) Dec', price: 1350, note: 'Holiday', tiers: [{ label: 'Solo', price: 1350 }, { label: '2-2 PAX', price: 891 }, { label: '3-100 PAX', price: 851 }] },
      ],
    },
  },
  {
    ...cruise, slug: 'luxor-to-aswan-cruise', title: 'Luxor to Aswan Cruise', titleAr: 'رحلة نيلية من الأقصر إلى أسوان', location: 'Luxor, Aswan', price: 498, duration: '4 Nights', image: luxorPackageImage, cruiseType: 'standard-nile-cruises',
    gallery: [luxorPackageImage, aswanPackageImage],
    summary: 'Sail from Luxor to Aswan visiting the Valley of the Kings, Edfu Temple, and the stunning Philae Temple complex.',
    detail: {
      overview: [
        'Begin your journey in Luxor and sail south to Aswan over four relaxing nights aboard a comfortable Nile cruise ship.',
        'Each day brings a new temple visit, from the royal tombs of the West Bank to the island temples of Aswan.',
        'Full-board accommodation with breakfast, lunch, and dinner served daily. Sun deck, pool, and evening entertainment included.',
      ],
      highlights: [
        { title: 'Valley of the Kings', items: ['Three tomb entries', 'Expert guide', 'Morning visit'] },
        { title: 'Edfu Temple of Horus', items: ['Preserved ptolemaic temple', 'Horse carriage ride', 'Detailed carvings'] },
        { title: 'Aswan Islands', items: ['Felucca sailing', 'Botanical garden', 'Elephantine Island'] },
      ],
      itinerary: [
        { day: 'Day 1', title: 'Luxor Embarkation', description: 'Board in Luxor. After lunch, visit Karnak Temple complex. Dinner on board.' },
        { day: 'Day 2', title: 'Luxor West Bank', description: 'Morning visit to Valley of the Kings, Hatshepsut Temple, and Colossi of Memnon. Afternoon sailing to Edfu.' },
        { day: 'Day 3', title: 'Edfu & Kom Ombo', description: 'Visit Temple of Horus at Edfu. Sail to Kom Ombo. Visit dual temple at sunset.' },
        { day: 'Day 4', title: 'Aswan Sightseeing', description: 'Visit Aswan High Dam and Philae Temple. Felucca sailing. Nubian dinner experience.' },
        { day: 'Day 5', title: 'Disembarkation', description: 'Breakfast on board. Disembark in Aswan.' },
      ],
      included: ['4 nights full-board', 'All meals', 'Guided tours', 'Entrance fees', 'Transfers'],
      excluded: ['Flights', 'Visa', 'Tips', 'Personal expenses'],
      locations: ['Luxor', 'Edfu', 'Kom Ombo', 'Aswan'],
      priceRows: [
        { category: '(1-10) Jan', price: 1250, note: 'Peak', tiers: [{ label: 'Solo', price: 1250 }, { label: '2-2 PAX', price: 825 }, { label: '3-100 PAX', price: 788 }] },
        { category: '(11-31) Jan', price: 790, note: 'Standard', tiers: [{ label: 'Solo', price: 790 }, { label: '2-2 PAX', price: 521 }, { label: '3-100 PAX', price: 498 }] },
        { category: '(1-30) Apr', price: 1250, note: 'Peak', tiers: [{ label: 'Solo', price: 1250 }, { label: '2-2 PAX', price: 825 }, { label: '3-100 PAX', price: 788 }] },
        { category: '(19-31) Dec', price: 1250, note: 'Holiday', tiers: [{ label: 'Solo', price: 1250 }, { label: '2-2 PAX', price: 825 }, { label: '3-100 PAX', price: 788 }] },
      ],
    },
  },
  {
    ...cruise, slug: 'premium-dahabiya-experience', title: 'Premium Dahabiya Experience', titleAr: 'تجربة دهبية نيلية مميزة', location: 'Aswan, Luxor', price: 1450, duration: '7 Nights', image: aswanPackageImage, cruiseType: 'luxury-nile-cruise',
    gallery: [aswanPackageImage, luxorPackageImage],
    summary: 'An intimate dahabiya sailing experience with private crew, gourmet dining, and access to remote Nile temples.',
    detail: {
      overview: [
        'Experience the Nile the traditional way aboard a private dahabiya, a classic Egyptian sailing vessel with a small, dedicated crew.',
        'With only a handful of guests, this seven-night journey offers an intimate and unhurried exploration of the Nile between Aswan and Luxor.',
        'Your private chef prepares fresh Egyptian cuisine daily. Shore excursions include both major temples and lesser-known sites inaccessible to larger ships.',
      ],
      highlights: [
        { title: 'Private Sailing Vessel', items: ['Crew of 6', 'Max 10 guests', 'Traditional Egyptian design'] },
        { title: 'Remote Temple Access', items: ['Nubian villages', 'Rural Nile banks', 'Undiscovered archaeological sites'] },
        { title: 'Gourmet Nile Dining', items: ['Private chef', 'Fresh Egyptian cuisine', 'Al fresco deck dining'] },
      ],
      itinerary: [
        { day: 'Day 1', title: 'Aswan Embarkation', description: 'Board your dahabiya in Aswan. Welcome drinks and orientation. Sail to a quiet mooring near a Nubian village. Dinner under the stars.' },
        { day: 'Day 2', title: 'Elephantine Island', description: 'Morning visit to Elephantine Island and the Temple of Khnum. Afternoon sailing with stops for swimming. Evening tea on deck.' },
        { day: 'Day 3', title: 'Kom Ombo & Beyond', description: 'Visit Kom Ombo Temple. Continue sailing to a remote village. Walk through local homes and visit a village school.' },
        { day: 'Day 4', title: 'Edfu by Carriage', description: 'Horse-drawn carriage to Temple of Horus. Afternoon sailing through the Nile Valley. Cooking class with the chef.' },
        { day: 'Day 5', title: 'Rural Nile Life', description: 'Mooring at a farming village. Walk through palm groves and sugar cane fields. Visit a local family for tea.' },
        { day: 'Day 6', title: 'Temple of Hathor', description: 'Visit Dendera Temple complex. Afternoon return to the dahabiya. Sunset cocktails on deck.' },
        { day: 'Day 7', title: 'Luxor Temples', description: 'Arrive in Luxor. Visit Karnak Temple and Luxor Temple. Farewell dinner on the Nile.' },
        { day: 'Day 8', title: 'Disembarkation', description: 'Breakfast and disembarkation in Luxor.' },
      ],
      included: ['7 nights on board', 'All meals and soft drinks', 'Private crew', 'Guided excursions', 'Entrance fees', 'Arrival and departure transfers'],
      excluded: ['Flights', 'Visa', 'Alcoholic beverages', 'Tips', 'Personal expenses'],
      locations: ['Aswan', 'Kom Ombo', 'Edfu', { id: 'dendera', name: 'Dendera', nameAr: 'دندرة', latitude: 26.1419, longitude: 32.6702 }, 'Luxor'],
      priceRows: [
        { category: 'Solo cabin', price: 2250, note: 'Per person, single occupancy' },
        { category: 'Double cabin', price: 1450, note: 'Per person, double occupancy' },
        { category: 'Group (3-6)', price: 1350, note: 'Per person' },
        { category: 'Full boat (7-10)', price: 1200, note: 'Per person, exclusive charter' },
      ],
    },
  },
  {
    ...cruise, slug: 'nile-discovery-cruise', title: 'Nile Discovery Cruise', titleAr: 'رحلة استكشاف النيل', location: 'Cairo, Luxor', price: 650, duration: '5 Nights', image: cairoPackageImage, cruiseType: 'deluxe-nile-cruise',
    gallery: [cairoPackageImage, luxorPackageImage, aswanPackageImage],
    summary: 'A five-night itinerary combining Cairo sights with a Nile journey from Luxor to Aswan.',
    detail: {
      overview: [
        'This five-night cruise combines the best of Cairo with a Nile journey through the temple heartland of Egypt.',
        'Begin with guided visits to the Pyramids and Egyptian Museum, then fly to Luxor to board your cruise ship for the Nile portion.',
        'Full-board accommodation on the ship with guided shore excursions at every port of call.',
      ],
      highlights: [
        { title: 'Pyramids & Sphinx', items: ['Giza Plateau visit', 'Photo opportunities', 'Camel ride option'] },
        { title: 'Luxor Temple Complex', items: ['Karnak Temple', 'Luxor Temple by night', 'Sacred Lake'] },
        { title: 'Aswan Philae', items: ['Island temple', 'Motorboat approach', 'Stunning architecture'] },
      ],
      itinerary: [
        { day: 'Day 1', title: 'Cairo Arrival', description: 'Airport pickup and hotel transfer. Welcome dinner.' },
        { day: 'Day 2', title: 'Cairo Sightseeing', description: 'Visit Pyramids of Giza, Sphinx, and Egyptian Museum. Evening flight to Luxor. Board cruise ship.' },
        { day: 'Day 3', title: 'Luxor East Bank', description: 'Guided tour of Karnak and Luxor Temples. Afternoon at leisure on board.' },
        { day: 'Day 4', title: 'Luxor West Bank & Edfu', description: 'Valley of the Kings, Hatshepsut Temple. Sail to Edfu.' },
        { day: 'Day 5', title: 'Edfu & Kom Ombo', description: 'Temple of Horus at Edfu. Kom Ombo dual temple. Sail to Aswan.' },
        { day: 'Day 6', title: 'Aswan & Departure', description: 'Aswan High Dam and Philae Temple. Disembark and transfer to airport.' },
      ],
      included: ['2 nights Cairo hotel', '3 nights full-board cruise', 'Cairo guided tours', 'Domestic flight Cairo-Luxor', 'All cruise meals and tours', 'Airport transfers'],
      excluded: ['International flights', 'Visa', 'Tips', 'Optional activities', 'Personal expenses'],
      locations: ['Cairo', 'Giza', 'Luxor', 'Edfu', 'Kom Ombo', 'Aswan'],
      priceRows: [
        { category: 'Standard cabin', price: 650, note: 'Per person, double' },
        { category: 'Superior cabin', price: 850, note: 'Per person, double' },
        { category: 'Single cabin', price: 950, note: 'Per person' },
      ],
    },
  },
  {
    ...cruise, slug: 'classic-5-day-nile-journey', title: 'Classic 5-Day Nile Journey', titleAr: 'رحلة نيلية كلاسيكية لخمس أيام', location: 'Luxor, Aswan', price: 480, duration: '5 Days', image: luxorPackageImage, cruiseType: 'superior-nile-cruise',
    gallery: [luxorPackageImage, aswanPackageImage],
    summary: 'A classic five-day Nile cruise visiting the most iconic temples between Luxor and Aswan with full-board accommodation.',
    detail: {
      overview: [
        'Experience the essential Nile on this five-day cruise covering the highlights from Luxor to Aswan.',
        'Visit the Valley of the Kings, Karnak Temple, Edfu, Kom Ombo, and Philae with expert guides at every stop.',
        'Full-board accommodation with breakfast, lunch, and dinner daily. Sun deck, pool, and evening entertainment.',
      ],
      highlights: [
        { title: 'Karnak Temple', items: ['Great Hypostyle Hall', 'Sacred Avenue of Sphinxes', 'Obelisks of Hatshepsut'] },
        { title: 'Valley of the Kings', items: ['Royal tomb visits', 'Colorful hieroglyphs', 'Guide narration'] },
        { title: 'Philae Temple', items: ['Island setting', 'Ptolemaic architecture', 'Boat transfer'] },
      ],
      itinerary: [
        { day: 'Day 1', title: 'Luxor Embarkation', description: 'Board in Luxor. Afternoon visit to Luxor Temple. Welcome dinner.' },
        { day: 'Day 2', title: 'Luxor West Bank', description: 'Valley of the Kings, Hatshepsut Temple, Colossi of Memnon. Sail to Edfu.' },
        { day: 'Day 3', title: 'Edfu & Kom Ombo', description: 'Temple of Horus. Kom Ombo dual temple. Evening sailing to Aswan.' },
        { day: 'Day 4', title: 'Aswan', description: 'Aswan High Dam, Philae Temple. Felucca sailing. Nubian show.' },
        { day: 'Day 5', title: 'Disembarkation', description: 'Breakfast. Disembark in Aswan.' },
      ],
      included: ['4 nights full-board', 'All meals', 'Guided tours', 'Entrance fees', 'Transfers'],
      excluded: ['Flights', 'Visa', 'Tips', 'Personal expenses'],
      locations: ['Luxor', 'Edfu', 'Kom Ombo', 'Aswan'],
      priceRows: [
        { category: 'Standard cabin', price: 480, note: 'Per person, double' },
        { category: 'Superior cabin', price: 620, note: 'Per person, double' },
        { category: 'Single supplement', price: 320, note: 'Additional charge' },
      ],
    },
  },
]

const shoreItineraryNote = 'Suggested route only. The meeting point, visits, road time, and return buffer are planned around your ship call and confirmed in writing before booking.'
const portSaidImage = 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Port_Said%2C_Egypt%2C_Suez_Canal_opening.jpg/1280px-Port_Said%2C_Egypt%2C_Suez_Canal_opening.jpg'
const portSaidBeachImage = 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/Port_said_Beach.jpg/960px-Port_said_Beach.jpg'
const alexandriaImage = 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/77/QaitbeyCitadel2.jpg/1280px-QaitbeyCitadel2.jpg'
const alexandriaCornicheImage = 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/71/Egypt%2C_Alexandria%2C_The_Corniche_of_Alexandria.jpg/1280px-Egypt%2C_Alexandria%2C_The_Corniche_of_Alexandria.jpg'
const cairoSkylineImage = 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/54/Cairo_skyline%2C_Nile_River%2C_Egypt.jpg/960px-Cairo_skyline%2C_Nile_River%2C_Egypt.jpg'
const hurghadaCoastImage = 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/da/Red_Sea_in_Hurghada.jpg/960px-Red_Sea_in_Hurghada.jpg'

const shoreExcursions: Tour[] = [
  {
    ...shore, slug: 'port-said-highlights', title: 'Port Said Highlights', titleAr: 'أبرز معالم بورسعيد', departurePort: 'Port Said', location: 'Port Said', price: 125.4, duration: '5 Hours', image: portSaidImage,
    gallery: [portSaidImage, portSaidBeachImage], photoCredits: [
      { label: 'Port Said canal photo: Vyacheslav Argenberg (CC BY 4.0)', url: 'https://commons.wikimedia.org/wiki/File:Port_Said,_Egypt,_Suez_Canal_opening.jpg' },
      { label: 'Port Said beach photo: Myousry6666 (CC BY-SA 4.0)', url: 'https://commons.wikimedia.org/wiki/File:Port_said_Beach.jpg' },
    ],
    galleryCaptions: [{ en: 'Port Said and the Suez Canal', ar: 'بورسعيد وقناة السويس' }, { en: 'Port Said waterfront at sunset', ar: 'شاطئ بورسعيد عند الغروب' }],
    summary: 'A flexible introduction to Port Said and the Suez Canal waterfront, shaped around your ship call.',
    detail: {
      overview: ['Use your time ashore to discover Port Said and its canal-side setting without committing to a rushed fixed route.', 'Your exact meeting point, local stops, transport, and return time will be agreed against the ship schedule before booking.'],
      highlights: [{ title: 'Port Said by the water', items: ['Suez Canal outlook', 'City waterfront', 'A route matched to your port time'] }],
      itinerary: [
        { day: 'Stage 1', title: 'Meet at the port', description: 'Meet the local team at the confirmed port exit or meeting point once your ship has cleared disembarkation.' },
        { day: 'Stage 2', title: 'Explore Port Said', description: 'Follow the agreed city and waterfront route, with stops selected for the time actually available ashore.' },
        { day: 'Stage 3', title: 'Return to the ship', description: 'Leave time for the transfer and port procedures before the ship departure. The return plan is confirmed with your quote.' },
      ],
      itineraryNote: shoreItineraryNote, included: [], excluded: [], addOns: [], locations: ['Port Said'],
    },
  },
  {
    ...shore, slug: 'alexandria-port-discovery', title: 'Alexandria Port Discovery', titleAr: 'استكشاف الإسكندرية من الميناء', departurePort: 'Alexandria', location: 'Alexandria', price: 189, duration: '6 Hours', image: alexandriaImage,
    gallery: [alexandriaImage, alexandriaCornicheImage], photoCredits: [
      { label: 'Qaitbay Citadel photo: ASaber91 (CC BY-SA 4.0)', url: 'https://commons.wikimedia.org/wiki/File:QaitbeyCitadel2.jpg' },
      { label: 'Alexandria Corniche photo: Vyacheslav Argenberg (CC BY 4.0)', url: 'https://commons.wikimedia.org/wiki/File:Egypt,_Alexandria,_The_Corniche_of_Alexandria.jpg' },
    ],
    galleryCaptions: [{ en: 'Qaitbay Citadel, Alexandria', ar: 'قلعة قايتباي بالإسكندرية' }, { en: 'Alexandria Corniche', ar: 'كورنيش الإسكندرية' }],
    summary: 'A privately paced Alexandria visit from the port, with the Mediterranean waterfront at the heart of the day.',
    detail: {
      overview: ['Alexandria combines a working port with a Mediterranean city of waterfront views and layered history.', 'Choose the sites that matter most to you; the final route and return buffer depend on your ship schedule and are confirmed before booking.'],
      highlights: [{ title: 'Mediterranean Alexandria', items: ['Corniche views', 'Qaitbay Citadel area as a possible stop', 'Flexible city pacing'] }],
      itinerary: [
        { day: 'Stage 1', title: 'Meet at Alexandria Port', description: 'Start from the meeting point confirmed for your ship and terminal.' },
        { day: 'Stage 2', title: 'Discover Alexandria', description: 'Explore an agreed selection of waterfront and city highlights; Qaitbay Citadel may be included if the available time permits.' },
        { day: 'Stage 3', title: 'Return to the port', description: 'Allow time for the return transfer and boarding requirements set by your cruise line.' },
      ],
      itineraryNote: shoreItineraryNote, included: [], excluded: [], addOns: [], locations: ['Alexandria'],
    },
  },
  {
    ...shore, slug: 'safaga-luxor-excursion', title: 'Safaga Luxor Excursion', titleAr: 'رحلة الأقصر من ميناء سفاجا', departurePort: 'Safaga', location: 'Luxor', price: 245, duration: 'Full Day', image: luxorPackageImage,
    gallery: [luxorPackageImage, '/egypt-hero.png'], summary: 'A proposed Luxor sightseeing day from Safaga, planned only when the ship call allows enough road and visiting time.',
    galleryCaptions: [{ en: 'Ancient Luxor', ar: 'آثار الأقصر' }, { en: 'Luxor temples', ar: 'معابد الأقصر' }],
    detail: {
      overview: ['Travel inland from Safaga toward Luxor for a focused look at ancient Egypt, with the route chosen to suit the time ashore.', 'This is a long-distance shore journey. The exact sights, transfer time, and safe return margin must be checked against your ship call before the trip is confirmed.'],
      highlights: [{ title: 'Luxor within a ship call', items: ['Choose a focused temple or West Bank route', 'Private pacing where available', 'Return planning before departure'] }],
      itinerary: [
        { day: 'Stage 1', title: 'Meet at Safaga Port', description: 'Meet at the confirmed port exit and begin the road transfer after disembarkation.' },
        { day: 'Stage 2', title: 'Visit Luxor', description: 'Follow a selected East Bank or West Bank plan rather than promising every site in one limited call.' },
        { day: 'Stage 3', title: 'Travel back to Safaga', description: 'The return departure time is set with a buffer for the road and ship boarding procedures.' },
      ],
      itineraryNote: shoreItineraryNote, included: [], excluded: [], addOns: [], locations: ['Safaga', 'Luxor'],
    },
  },
  {
    ...shore, slug: 'sokhna-cairo-day-trip', title: 'Sokhna Cairo Day Trip', titleAr: 'جولة القاهرة من ميناء السخنة', departurePort: 'Ain Sokhna', location: 'Cairo', price: 380, duration: '8 Hours', image: cairoStreetsImage,
    gallery: [cairoStreetsImage, cairoSkylineImage],
    galleryCaptions: [{ en: 'Historic Cairo streets', ar: 'شوارع القاهرة التاريخية' }, { en: 'Cairo and the Nile', ar: 'القاهرة والنيل' }],
    photoCredits: [{ label: 'Cairo skyline photo: Vyacheslav Argenberg (CC BY 4.0)', url: 'https://commons.wikimedia.org/wiki/File:Cairo_skyline,_Nile_River,_Egypt.jpg' }],
    summary: 'A Cairo-focused shore visit from Ain Sokhna, tailored to your available port hours.',
    detail: {
      overview: ['Leave the coast for a carefully scoped Cairo experience that fits your ship call.', 'Your preferred city highlights, travel time, meeting point, and return plan are reviewed before we confirm the itinerary.'],
      highlights: [{ title: 'A Cairo day with purpose', items: ['City history and local streets', 'One focused route rather than a rushed checklist', 'Port-to-port timing review'] }],
      itinerary: [
        { day: 'Stage 1', title: 'Meet at Ain Sokhna', description: 'Meet at the port location confirmed for your ship and start the road journey.' },
        { day: 'Stage 2', title: 'Explore Cairo', description: 'Visit the agreed Cairo area or sites according to your interests and the hours available.' },
        { day: 'Stage 3', title: 'Return to the coast', description: 'Travel back with a boarding buffer appropriate to the ship schedule.' },
      ],
      itineraryNote: shoreItineraryNote, included: [], excluded: [], addOns: [], locations: ['Ain Sokhna', 'Cairo'],
    },
  },
  {
    ...shore, slug: 'hurghada-shore-adventure', title: 'Hurghada Shore Adventure', titleAr: 'مغامرة الغردقة من الميناء', departurePort: 'Hurghada', location: 'Hurghada', price: 125.4, duration: '4 Hours', image: redSeaPackageImage,
    gallery: [redSeaPackageImage, hurghadaCoastImage],
    galleryCaptions: [{ en: 'Red Sea reef life', ar: 'الشعاب المرجانية في البحر الأحمر' }, { en: 'The Red Sea at Hurghada', ar: 'البحر الأحمر في الغردقة' }],
    photoCredits: [{ label: 'Hurghada Red Sea photo: Iwelldone (CC BY-SA 4.0)', url: 'https://commons.wikimedia.org/wiki/File:Red_Sea_in_Hurghada.jpg' }],
    summary: 'A Red Sea shore experience shaped around your interests, comfort, and ship time in Hurghada.',
    detail: {
      overview: ['Use a short Hurghada port call for a relaxed Red Sea experience rather than committing to an unsuitable full-day plan.', 'Tell us whether you prefer the coast, a city stop, or a water activity; the final activity depends on sea conditions and ship timing.'],
      highlights: [{ title: 'A flexible Red Sea stop', items: ['Coastal atmosphere', 'Activity level chosen with you', 'Ship-aware return plan'] }],
      itinerary: [
        { day: 'Stage 1', title: 'Meet at Hurghada Port', description: 'Meet the local team at the port point confirmed with your ship.' },
        { day: 'Stage 2', title: 'Enjoy the selected experience', description: 'Follow the agreed shore or water-based plan, subject to conditions and the time available.' },
        { day: 'Stage 3', title: 'Return for boarding', description: 'Finish in time for transfer and the cruise line boarding procedure.' },
      ],
      itineraryNote: shoreItineraryNote, included: [], excluded: [], addOns: [], locations: ['Hurghada'],
    },
  },
  {
    ...shore, slug: 'ain-sokhna-pyramids-tour', title: 'Ain Sokhna Pyramids Tour', titleAr: 'جولة الأهرامات من ميناء السخنة', departurePort: 'Ain Sokhna', location: 'Giza', price: 189, duration: 'Duration on request', image: cairoPackageImage,
    gallery: [cairoPackageImage, 'https://images.unsplash.com/photo-1636020833630-89d4a5a75807?auto=format&fit=crop&w=1400&q=86'],
    galleryCaptions: [{ en: 'The Giza Pyramids', ar: 'أهرامات الجيزة' }, { en: 'The Giza Plateau', ar: 'هضبة الجيزة' }],
    summary: 'A proposed Giza Pyramids visit from Ain Sokhna, subject to the ship call and road-time check.',
    detail: {
      overview: ['Plan a focused visit to the Giza Plateau from the Ain Sokhna port call.', 'Because this is a road journey, our team checks the available hours before confirming which pyramid-area stops can fit and when you must leave for the ship.'],
      highlights: [{ title: 'The Giza Plateau', items: ['Pyramids landscape', 'Sphinx area if time permits', 'Return buffer built into the proposal'] }],
      itinerary: [
        { day: 'Stage 1', title: 'Meet at Ain Sokhna Port', description: 'Start at the meeting point agreed for your ship and terminal.' },
        { day: 'Stage 2', title: 'Explore Giza', description: 'Visit the agreed pyramid-area locations; exact entry tickets and stops are listed in the final quote.' },
        { day: 'Stage 3', title: 'Return to the ship', description: 'Leave the Giza area at the confirmed time to allow for the journey and port boarding.' },
      ],
      itineraryNote: shoreItineraryNote, included: [], excluded: [], addOns: [], locations: ['Ain Sokhna', 'Giza'],
    },
  },
]

const featuredTours: Tour[] = [
  {
    ...multiDay,
    slug: 'explore-the-wonders-of-egypt-during-the-new-year',
    categorySlugs: ['christmas-new-year-offers', 'egypt-classic-tours', 'culture-tours'],
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
    },
  },
  { ...multiDay, slug: 'riding-in-the-new-year-in-egypt-and-jordan', categorySlugs: ['christmas-new-year-offers', 'pyramids-tours', 'cairo-city-breaks'], title: 'Riding in the New Year in Egypt and Jordan', location: 'Giza', price: 189, duration: '2 Days', image: tourImages[2],
    detail: { ...proposedPackage,
      overview: ['Ring in the New Year between the Pyramids of Giza and the Nile. This two-day private escape pairs Cairo\'s headline sights with a festive New Year\'s Eve dinner cruise.', 'The program below is especially suited to travelers spending the New Year holiday in Cairo and Giza; extensions to Jordan are planned separately with our team.'],
      highlights: [
        { title: 'Giza and its ancient landmarks', items: ['Pyramids plateau', 'Great Sphinx', 'Grand Egyptian Museum'] },
        { title: 'New Year in Cairo', items: ['Nile dinner cruise on New Year\'s Eve', 'Khan El Khalili market', 'Historic Cairo by night'] },
      ],
      itinerary: [
        { day: 'Day 1', title: 'Pyramids and the Grand Egyptian Museum', description: 'Explore the Giza Plateau with the Pyramids and the Sphinx, then continue to the Grand Egyptian Museum for its headline collections.' },
        { day: 'Day 2', title: 'Historic Cairo and New Year\'s Eve', description: 'Discover Islamic and Coptic Cairo with time at Khan El Khalili bazaar. In the evening, board a Nile dinner cruise to welcome the New Year on the river.' },
      ],
      included: ['Private two-day Cairo and Giza itinerary planning', 'Sightseeing visits agreed in your final itinerary', 'New Year\'s Eve dinner cruise seating'],
      excluded: ['International flights and Egypt entry visa', 'Personal expenses, tips, and travel insurance', 'Hotel nights, meals, transport, guiding, and entrance fees unless listed in your confirmed quote'],
      addOns: [{ title: 'Giza Sound and Light Show' }, { title: 'Extra Cairo night' }],
      locations: ['Cairo', 'Giza'],
    },
  },
  { ...multiDay, slug: 'a-9-days-cairo-and-nile-cruise', categorySlugs: ['egypt-classic-tours', 'culture-tours'], title: 'A 9 Days Cairo and Nile Cruise', location: 'Luxor', price: 245, duration: '9 Days', image: tourImages[3],
    detail: { ...proposedPackage,
      overview: ['Nine days combining the icons of Cairo and Giza with a full-board Nile cruise between Luxor and Aswan.', 'Begin with the pyramids and the capital\'s cultural layers, then sail south through Edfu and Kom Ombo toward Aswan at an unhurried cruise pace.'],
      highlights: [
        { title: 'Cairo and Giza', items: ['Pyramids and Sphinx', 'Grand Egyptian Museum', 'Historic Cairo and Khan El Khalili'] },
        { title: 'The Nile cruise', items: ['Karnak and Luxor Temple', 'Valley of the Kings', 'Edfu and Kom Ombo temples', 'Philae Temple in Aswan'] },
      ],
      itinerary: [
        { day: 'Day 1', title: 'Arrive in Cairo', description: 'Airport pickup and private transfer to the hotel. Evening free to settle in.' },
        { day: 'Day 2', title: 'Giza Plateau', description: 'Full exploration of the pyramids, the Sphinx, and the panoramic desert viewpoints.' },
        { day: 'Day 3', title: 'Historic Cairo', description: 'Museums, historic quarters, and market streets according to your interests.' },
        { day: 'Day 4', title: 'Cairo to Luxor', description: 'Travel to Luxor and board the Nile cruise ship. Afternoon visit to Luxor Temple.' },
        { day: 'Day 5', title: 'Luxor East and West', description: 'Karnak Temple complex followed by the Valley of the Kings and Hatshepsut Temple.' },
        { day: 'Day 6', title: 'Edfu and Kom Ombo', description: 'Morning visit to the Temple of Horus at Edfu, then sail to the dual temple of Kom Ombo.' },
        { day: 'Day 7', title: 'Aswan', description: 'Aswan High Dam, the unfinished obelisk, and the island Temple of Philae.' },
        { day: 'Day 8', title: 'Aswan at leisure', description: 'Optional Abu Simbel extension or a relaxed day with felucca sailing and Nubian culture.' },
        { day: 'Day 9', title: 'Disembarkation and departure', description: 'Breakfast on board, disembarkation, and transfer for your onward journey.' },
      ],
      included: ['Private nine-day itinerary planning', 'Sightseeing visits agreed in your final itinerary', 'Full-board Nile cruise segment with guided shore visits'],
      excluded: ['International flights and Egypt entry visa', 'Personal expenses, tips, and travel insurance', 'Hotel nights, domestic transport, guiding, and entrance fees unless listed in your confirmed quote'],
      addOns: [{ title: 'Abu Simbel day trip' }, { title: 'Hot air balloon over Luxor' }, { title: 'Nile dinner cruise in Cairo' }],
      locations: ['Cairo', 'Giza', 'Luxor', 'Edfu', 'Kom Ombo', 'Aswan'],
    },
  },
  { ...multiDay, slug: 'enjoy-your-8-days-new-year-trip', categorySlugs: ['christmas-new-year-offers', 'egypt-classic-tours', 'culture-tours'], title: 'Enjoy your 8 Days New Year trip', location: 'Aswan', price: 380, duration: '8 Days', image: tourImages[0],
    detail: { ...proposedPackage,
      overview: ['Celebrate the New Year across Egypt: the pyramids and living neighborhoods of Cairo, the temple heartland of Luxor, and the slow Nile rhythm of Aswan.', 'The route balances guided sightseeing with free time, ending in Aswan for a relaxed start to the new year.'],
      highlights: [
        { title: 'Cairo and Giza', items: ['Pyramids and Sphinx', 'Grand Egyptian Museum', 'Khan El Khalili and local food'] },
        { title: 'Upper Egypt', items: ['Karnak and Luxor Temple', 'Valley of the Kings', 'Philae Temple and felucca sailing'] },
      ],
      itinerary: [
        { day: 'Day 1', title: 'Arrive in Cairo', description: 'Airport pickup, hotel transfer, and a relaxed first evening.' },
        { day: 'Day 2', title: 'Giza and the pyramids', description: 'Pyramids plateau, the Sphinx, and the Grand Egyptian Museum.' },
        { day: 'Day 3', title: 'Historic Cairo', description: 'Citadel, mosques, churches, and market streets with a traditional lunch.' },
        { day: 'Day 4', title: 'Nile dinner cruise', description: 'Day at leisure with optional visits, followed by an evening dinner cruise with live entertainment.' },
        { day: 'Day 5', title: 'Luxor highlights', description: 'Travel to Luxor and visit Karnak and Luxor Temple with an Egyptologist guide.' },
        { day: 'Day 6', title: 'West Bank of Luxor', description: 'Valley of the Kings, Hatshepsut Temple, and the Colossi of Memnon.' },
        { day: 'Day 7', title: 'Aswan and the Nile', description: 'Continue to Aswan for Philae Temple, island scenery, and Nubian culture.' },
        { day: 'Day 8', title: 'Departure', description: 'Final morning in Aswan before the departure transfer.' },
      ],
      included: ['Private eight-day itinerary planning', 'Sightseeing visits agreed in your final itinerary', 'Nile dinner cruise seating'],
      excluded: ['International flights and Egypt entry visa', 'Personal expenses, tips, and travel insurance', 'Hotel nights, domestic transport, guiding, and entrance fees unless listed in your confirmed quote'],
      addOns: [{ title: 'Abu Simbel day trip' }, { title: 'Hot air balloon over Luxor' }, { title: 'Extra hotel night' }],
      locations: ['Cairo', 'Giza', 'Luxor', 'Aswan'],
    },
  },
  { ...oneDay, slug: 'cairo-and-giza-pyramids', destinationSlug: 'cairo', title: 'Cairo and Giza Pyramids', location: 'Cairo', price: 125.4, duration: 'About 4 Hours', image: tourImages[1] },
  { ...multiDay, slug: 'white-desert-adventure', categorySlugs: ['desert-tours', 'adventure-tours'], title: 'White Desert Adventure', location: 'White Desert', price: 189, duration: '2 Days', image: tourImages[2],
    detail: { ...proposedPackage,
      overview: ['A two-day escape from Cairo to the surreal chalk landscapes of the White Desert, with a night camping under the desert sky.', 'Travel by private 4x4 with a desert driver, walk among wind-carved formations, and enjoy freshly cooked meals at camp.'],
      highlights: [
        { title: 'White Desert formations', items: ['Mushroom and chicken rock shapes', 'Sunset over the chalk plains', 'Night sky far from city lights'] },
        { title: 'Desert route', items: ['Bahariya Oasis palm groves', 'Crystal Mountain stop', 'Private 4x4 with desert driver'] },
      ],
      itinerary: [
        { day: 'Day 1', title: 'Cairo to the White Desert', description: 'Morning drive to Bahariya Oasis, then continue by 4x4 through the Black Desert to the White Desert. Sunset walk among the formations followed by dinner and camping overnight.' },
        { day: 'Day 2', title: 'Sunrise and return to Cairo', description: 'Sunrise over the chalk landscape, breakfast at camp, and stops at Crystal Mountain and Bahariya Oasis before the afternoon drive back to Cairo.' },
      ],
      included: ['Private two-day desert itinerary planning', 'Private 4x4 transport with desert driver', 'One night desert camping with meals and camping gear'],
      excluded: ['International flights and Egypt entry visa', 'Personal expenses, tips, and travel insurance', 'Cairo hotel nights and services not listed in your confirmed quote'],
      addOns: [{ title: 'Private tent upgrade' }, { title: 'Extra desert night' }],
      locations: ['Cairo', 'Bahariya Oasis', 'White Desert'],
    },
  },
]

const preservedDetailRoutes: Tour[] = [
  { ...oneDay, slug: 'cairo-pyramids-tour', title: 'Cairo and the Pyramids private experience', location: 'Cairo, Giza', price: 380, duration: 'Duration on request', image: siteImages.cairo },
  { ...cruise, slug: 'nile-cruise-luxor-aswan', title: 'Luxury Nile Cruise from Luxor to Aswan', location: 'Luxor, Aswan', price: 890, duration: 'Duration on request', image: siteImages.nile },
  { ...oneDay, slug: 'luxor-day-tour', title: 'Luxor temples and Valley of the Kings', location: 'Luxor', price: 220, duration: 'Full Day', image: siteImages.temple },
]

/**
 * Catalogue ownership: a one-day tour belongs to exactly one discovery
 * destination via `Tour.destinationSlug` (assigned where the listing is
 * composed, so new tours in a city array cannot forget it). Admin tour
 * overrides carry the field; older stored overrides fall back to canonical
 * through the resolvers below. `Destination.detail.tourSlugs` remains a
 * hand-curated related-links list for editorial destination pages only.
 */
const withOneDayDestination = (destinationSlug: string, list: Tour[]): Tour[] =>
  list.map((tour) => ({ ...tour, destinationSlug: tour.destinationSlug ?? destinationSlug }))

const listingTours: readonly Tour[] = [
  ...withOneDayDestination('cairo', cairoDayTours),
  ...withOneDayDestination('giza', gizaDayTours),
  ...withOneDayDestination('alexandria', alexandriaDayTours),
  ...withOneDayDestination('luxor', luxorDayTours),
  ...withOneDayDestination('aswan', aswanDayTours),
  ...withOneDayDestination('hurghada', hurghadaDayTours),
  ...withOneDayDestination('sharm-el-sheikh', sharmDayTours),
  ...withOneDayDestination('port-said', portSaidDayTours),
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
  'one-day-tours': { title: 'One Day Tours', intro: 'Discover Egypt\'s greatest treasures in a single unforgettable day.', variant: 'day' },
  'multi-days-tours': { title: 'Multi Days Tours', intro: 'Take your time and experience Egypt beyond the highlights.', variant: 'multi' },
  'nile-cruises': { title: 'Nile Cruises', intro: 'Sail between ancient temples with comfort, service, and unforgettable views.', variant: 'cruise' },
  'shore-excursions': { title: 'Shore Excursions', intro: 'Make the most of every port with expertly planned Egypt shore trips.', variant: 'shore' },
}

/** Resolved one-day destination slug. Explicit `null` clears a canonical assignment; missing fields backfill canonical (legacy overrides). Malformed values resolve to undefined. */
export const getTourDestinationSlug = (tour: Tour, canonical: Tour | undefined = findTour(tour.slug)): string | undefined => {
  const raw: unknown = tour.destinationSlug
  if (raw === null) return undefined
  if (typeof raw === 'string') return raw
  const fallback: unknown = canonical?.destinationSlug
  return typeof fallback === 'string' ? fallback : undefined
}

/** Resolved multi-day category slugs. Explicit arrays (even empty) win; missing fields backfill canonical. Malformed entries are dropped. */
export const getTourCategorySlugs = (tour: Tour, canonical: Tour | undefined = findTour(tour.slug)): readonly string[] => {
  const clean = (value: unknown): readonly string[] =>
    Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []
  const raw = clean(tour.categorySlugs)
  if (tour.categorySlugs !== undefined) return raw
  return clean(canonical?.categorySlugs)
}

/** ONE authoritative one-day selector: destination → one-day tours. Pass live tours for admin-synced views. */
export const getOneDayToursForDestination = (list: readonly Tour[], destinationSlug: string): Tour[] =>
  list.filter((tour) => tour.category === 'one-day-tours' && getTourDestinationSlug(tour) === destinationSlug)

/** ONE authoritative multi-day selector: category → multi-day tours. Pass live tours for admin-synced views. */
export const getMultiDayToursForCategory = (list: readonly Tour[], categorySlug: string): Tour[] =>
  list.filter((tour) => tour.category === 'multi-days-tours' && getTourCategorySlugs(tour).includes(categorySlug))

const byDisplayOrder = (aOrder: number | undefined, bOrder: number | undefined, aTitle: string, bTitle: string) =>
  (aOrder ?? 999) - (bOrder ?? 999) || (aTitle < bTitle ? -1 : aTitle > bTitle ? 1 : 0)

/** Published one-day discovery destinations in admin-controlled order. Callers drop empty ones for landing sections. */
export const getPublishedOneDayDestinations = (list: readonly Destination[]): Destination[] =>
  list
    .filter((item) => item.showInOneDayTours === true && item.isPublished !== false)
    .sort((a, b) => byDisplayOrder(a.displayOrder, b.displayOrder, a.title, b.title))

/** Published (active) multi-day categories in admin-controlled order. Callers drop empty ones for landing sections. */
export const getPublishedMultiDayCategories = (list: readonly MultiDayCategory[]): MultiDayCategory[] =>
  [...list]
    .filter((category) => category.active)
    .sort((a, b) => byDisplayOrder(a.order, b.order, a.name, b.name))

// Backend integration point: these categories map 1:1 to a future
// `multi_day_categories` table (slug PK, EN/AR names, EN/AR copy, image, display
// order, active flag) with a `tour_multi_day_category` join table backing
// Tour.categorySlugs (many-to-many). No API calls yet; the selectors below keep
// category lookup and category → tours resolution centralized.
export const multiDayCategories: readonly MultiDayCategory[] = [
  { slug: 'desert-tours', name: 'Desert Tours', nameAr: 'رحلات الصحراء', copy: 'White Desert camps, oasis routes, and nights under desert skies.', copyAr: 'مخيمات الصحراء البيضاء وطرق الواحات وليالٍ تحت سماء الصحراء.', image: siteImages.desert, order: 1, active: true },
  { slug: 'pyramids-tours', name: 'Pyramids Tours', nameAr: 'رحلات الأهرامات', copy: 'Multi-day journeys built around Giza, Saqqara, and ancient Memphis.', copyAr: 'رحلات لعدة أيام تدور حول الجيزة وسقارة وممفيس القديمة.', image: siteImages.pyramids, order: 2, active: true },
  { slug: 'easter-tours', name: 'Easter Tours', nameAr: 'رحلات عيد القيامة', copy: 'Spring-time journeys through Egypt timed for the Easter holiday.', copyAr: 'رحلات ربيعية في مصر مصممة لعطلة عيد القيامة.', image: siteImages.temple, order: 3, active: true },
  { slug: 'luxor-city-breaks', name: 'Luxor City Breaks', nameAr: 'عطلات الأقصر القصيرة', copy: 'Short Luxor escapes: temples, tombs, and the Nile in a few days.', copyAr: 'عطلات قصيرة في الأقصر: معابد ومقابر والنيل في أيام قليلة.', image: luxorPackageImage, order: 4, active: true },
  { slug: 'luxury-packages', name: 'Luxury Packages', nameAr: 'الباقات الفاخرة', copy: 'Premium stays, private guides, and Egypt at its most comfortable.', copyAr: 'إقامات راقية ومرشدون خصوصيون ومصر بأقصى درجات الراحة.', image: siteImages.nile, order: 5, active: true },
  { slug: 'wheelchair-accessible', name: 'Wheelchair Accessible', nameAr: 'رحلات مناسبة لمستخدمي الكراسي المتحركة', copy: 'Step-free friendly routes with accessible transport and pacing.', copyAr: 'مسارات مناسبة للكراسي المتحركة مع نقل وإيقاع مريح.', image: siteImages.cairo, order: 6, active: true },
  { slug: 'honeymoon', name: 'Honeymoon', nameAr: 'شهر العسل', copy: 'Romantic Egypt journeys for newlyweds: Nile sunsets and quiet seas.', copyAr: 'رحلات رومانسية في مصر للعرسان: غروب النيل وهدوء البحر.', image: siteImages.redSea, order: 7, active: true },
  { slug: 'egypt-spiritual-tours', name: 'Egypt Spiritual Tours', nameAr: 'الرحلات الروحانية في مصر', copy: 'Temples, monasteries, and silent desert places for inner journeys.', copyAr: 'معابد وأديرة وأماكن صحراوية هادئة لرحلات داخلية.', image: siteImages.whiteDesert, order: 8, active: true },
  { slug: 'egypt-small-group-tours', name: 'Egypt Small Group Tours', nameAr: 'رحلات المجموعات الصغيرة في مصر', copy: 'Share the journey with a few fellow travelers and a local guide.', copyAr: 'شارك الرحلة مع عدد قليل من المسافرين ومرشد محلي.', image: cairoStreetsImage, order: 9, active: true },
  { slug: 'egypt-classic-tours', name: 'Egypt Classic Tours', nameAr: 'رحلات مصر الكلاسيكية', copy: 'The essential Egypt circuit: Cairo, Luxor, Aswan, and the Nile.', copyAr: 'مسار مصر الأساسي: القاهرة والأقصر وأسوان والنيل.', image: cairoPackageImage, order: 10, active: true },
  { slug: 'christmas-new-year-offers', name: 'Christmas & New Year Offers', nameAr: 'عروض الكريسماس ورأس السنة', copy: 'Celebrate the festive season among pyramids, temples, and the Nile.', copyAr: 'احتفل بموسم الأعياد بين الأهرامات والمعابد والنيل.', image: siteImages.pyramids, order: 11, active: true },
  { slug: 'cairo-city-breaks', name: 'Cairo City Breaks', nameAr: 'عطلات القاهرة القصيرة', copy: 'Short Cairo escapes: Giza, museums, old streets, and Nile evenings.', copyAr: 'عطلات قصيرة في القاهرة: الجيزة والمتاحف والشوارع القديمة وأمسيات النيل.', image: tourImages[3], order: 12, active: true },
  { slug: 'culture-tours', name: 'Culture Tours', nameAr: 'الرحلات الثقافية', copy: 'Museums, temples, crafts, and living traditions across Egypt.', copyAr: 'متاحف ومعابد وحرف وتقاليد حية في جميع أنحاء مصر.', image: aswanPackageImage, order: 13, active: true },
  { slug: 'adventure-tours', name: 'Adventure Tours', nameAr: 'رحلات المغامرات', copy: 'Active journeys: deserts, treks, sails, and off-track Egypt.', copyAr: 'رحلات نشطة: صحارى ودروب وإبحار ومصر خارج المسارات.', image: siteImages.whiteDesertMushroom, order: 14, active: true },
]

export const getMultiDayCategoryBySlug = (slug: string): MultiDayCategory | undefined =>
  multiDayCategories.find((category) => category.slug === slug)

export const getMultiDayToursByCategorySlug = (slug: string): Tour[] =>
  getMultiDayToursForCategory(getToursByCategory('multi-days-tours'), slug)

export const getPopulatedMultiDayCategories = (): { category: MultiDayCategory; tours: Tour[] }[] =>
  getPublishedMultiDayCategories(multiDayCategories)
    .map((category) => ({ category, tours: getMultiDayToursByCategorySlug(category.slug) }))
    .filter((entry) => entry.tours.length > 0)

export const multiDayCategoryRouteSlugs = multiDayCategories.map((category) => category.slug)

const tourByRouteSlug = new Map<string, Tour>()
for (const tour of tours) {
  for (const routeSlug of [tour.slug, ...(tour.aliases ?? [])]) {
    if (tourByRouteSlug.has(routeSlug)) throw new Error(`Duplicate tour route slug: ${routeSlug}`)
    tourByRouteSlug.set(routeSlug, tour)
  }
}

const multiDayCategorySlugSet = new Set(multiDayCategories.map((category) => category.slug))
const destinationSlugSet = new Set(destinations.map((item) => item.slug))
for (const tour of tours) {
  for (const categorySlug of tour.categorySlugs ?? []) {
    if (!multiDayCategorySlugSet.has(categorySlug)) throw new Error(`Unknown multi-day category slug "${categorySlug}" on tour "${tour.slug}"`)
  }
  if (tour.destinationSlug !== undefined && tour.destinationSlug !== null && !destinationSlugSet.has(tour.destinationSlug)) throw new Error(`Unknown destination slug "${tour.destinationSlug}" on tour "${tour.slug}"`)
}

export const findTour = (slug: string) => tourByRouteSlug.get(slug)

export const getDealOriginalPrice = (tour: Tour, now?: Date | number | string): number | undefined => {
  // `tour.price` (and every tier rate) is the ORIGINAL list price. The
  // strikethrough original is therefore the list price itself — never
  // `price / (1 - p)`, which inflated a fake "was" price above list.
  return getActiveDealPercent(tour, now) > 0 ? tour.price : undefined
}

/**
 * Discount eligibility (single source of truth for every surface).
 *
 * A deal is a percentage off the ORIGINAL list prices (`tour.price` and
 * the traveler-tier rates). It is active only when the percent is sane
 * (0 < p < 100) and the end date — when present — has not passed. A
 * date-only `endsAt` (YYYY-MM-DD, as produced by the admin date input)
 * stays valid through the end of that day (UTC).
 */
export function getActiveDealPercent(tour: Tour, now?: Date | number | string): number {
  const percent = tour.deal?.percent
  if (typeof percent !== 'number' || !Number.isFinite(percent) || !(percent > 0) || !(percent < 100)) return 0
  const endsAt = tour.deal?.endsAt
  if (endsAt === undefined || endsAt === null || endsAt === '') return percent
  if (typeof endsAt !== 'string') return 0
  let deadline: number
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(endsAt.trim())
  if (dateOnly) {
    deadline = Date.UTC(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3])) + 86400000 - 1
    if (Number.isNaN(deadline)) return 0
  } else {
    deadline = new Date(endsAt).getTime()
    if (Number.isNaN(deadline)) return 0
  }
  const at = now === undefined ? Date.now() : new Date(now).getTime()
  if (Number.isNaN(at)) return 0
  return deadline >= at ? percent : 0
}

/** Round a USD amount to integer cents and back (kills float drift). */
function roundUsd(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  return Math.round(value * 100) / 100
}

/** Apply an active deal percent to one ORIGINAL list amount. Identity when 0. */
export function applyDealPercent(value: number, percent: number): number {
  if (!(percent > 0) || !(percent < 100)) return value
  return roundUsd((value * (100 - percent)) / 100)
}

/** Effective selling price: list price minus the active deal, if any. */
export const getDealPrice = (tour: Tour, now?: Date | number | string): number =>
  applyDealPercent(tour.price, getActiveDealPercent(tour, now))

export const getDealDeadline = (tour: Tour): string | undefined => {
  const endsAt = tour.deal?.endsAt
  return endsAt && !Number.isNaN(new Date(endsAt).getTime()) ? endsAt : undefined
}

const getLegacyAdultUnitPrice = (tour: Tour, headcount: number): number => {
  const travelerPrices = tour.detail?.travelerPrices ?? tour.dayDetail?.travelerPrices ?? []
  if (travelerPrices.length) {
    const sorted = [...travelerPrices]
      .filter((tier) => tier.travelers > 0 && Number.isFinite(tier.adultPrice ?? tier.price))
      .sort((a, b) => a.travelers - b.travelers)
    const exact = sorted.find((tier) => tier.travelers === headcount)
    if (exact) return exact.adultPrice ?? exact.price ?? tour.price
    const nearest = [...sorted].reverse().find((tier) => tier.travelers <= headcount) ?? sorted[0]
    if (nearest) return nearest.adultPrice ?? nearest.price ?? tour.price
  }
  return tour.price
}

const getLegacyChildUnitPrice = (tour: Tour, adultPrice: number): number => {
  const childPrices = (tour.detail?.priceRows ?? tour.dayDetail?.priceRows ?? [])
    .filter((row) => !row.tiers?.length && /child|طفل/i.test(row.category))
    .map((row) => row.price)
  return childPrices.length ? Math.min(...childPrices) : adultPrice
}

export type TravelerUnitPrices = { adult: number; child: number; infant: number }

// Each traveler-count tier owns independent adult, child, and infant rates.
// Older browser-saved tours with a single `price` continue to work.
export const getTravelerUnitPrices = (tour: Tour, headcount: number): TravelerUnitPrices => {
  const travelerPrices = tour.detail?.travelerPrices ?? tour.dayDetail?.travelerPrices ?? []
  const findRate = (type: 'adultPrice' | 'childPrice' | 'infantPrice', fallback: number) => {
    const sorted = [...travelerPrices]
      .filter((tier) => tier.travelers > 0 && Number.isFinite(type === 'adultPrice' ? tier.adultPrice ?? tier.price : tier[type]))
      .sort((a, b) => a.travelers - b.travelers)
    const tier = sorted.find((item) => item.travelers === headcount)
      ?? [...sorted].reverse().find((item) => item.travelers <= headcount)
      ?? sorted[0]
    if (!tier) return fallback
    return type === 'adultPrice' ? tier.adultPrice ?? tier.price ?? fallback : tier[type] ?? fallback
  }
  const adult = findRate('adultPrice', getLegacyAdultUnitPrice(tour, headcount))
  const child = findRate('childPrice', getLegacyChildUnitPrice(tour, adult))
  const infant = findRate('infantPrice', 0)
  return { adult, child, infant }
}

export const getTierUnitPrice = (tour: Tour, headcount: number): number => getTravelerUnitPrices(tour, headcount).adult

export const getChildUnitPrice = (tour: Tour, adultPrice: number): number => getLegacyChildUnitPrice(tour, adultPrice)

export type BookingPrices = TravelerUnitPrices & {
  total: number
  /** Original (pre-discount) traveler total in USD. Equals `total` when no deal is active. */
  originalTotal: number
  /** Savings from the active deal in USD (traveler units only; add-ons are never discounted). */
  discount: number
}

export const getBookingTotal = (tour: Tour, adults: number, children: number, infants = 0, now?: Date | number | string): BookingPrices => {
  const prices = getTravelerUnitPrices(tour, Math.max(1, adults + children + infants))
  const percent = getActiveDealPercent(tour, now)
  // The deal is a single percent off every traveler unit (tiers included).
  // Add-ons are third-party costs and are never discounted; the booking
  // service adds them after this total.
  const adult = applyDealPercent(prices.adult, percent)
  const child = applyDealPercent(prices.child, percent)
  const infant = applyDealPercent(prices.infant, percent)
  const originalTotal = roundUsd(adults * prices.adult + children * prices.child + infants * prices.infant)
  const total = roundUsd(adults * adult + children * child + infants * infant)
  return { adult, child, infant, total, originalTotal, discount: roundUsd(originalTotal - total) }
}

export const normalizeTourPricePeriods = (rows: readonly TourPriceRow[] | undefined, fallbackLabel: string): TourPriceRow[] => {
  if (!rows?.length) return []
  if (rows.some((row) => row.startDate || row.endDate || row.tiers?.length)) return [...rows]
  return [{
    category: fallbackLabel,
    price: rows[0]?.price ?? 0,
    note: '',
    tiers: rows.map((row) => ({ label: row.category, price: row.price, suffix: row.note || undefined })),
  }]
}

export const getTourOffer = (tour: Tour, fallbackDeadline: string, now?: Date | number | string): TourOfferView => {
  // The badge is eligibility-gated: expired or malformed deals show
  // nothing instead of advertising a discount that no longer applies.
  const percent = getActiveDealPercent(tour, now)
  return {
    badge: percent > 0 ? `SAVE ${tour.deal?.percent}%` : undefined,
    deadline: getDealDeadline(tour) ?? fallbackDeadline,
    originalPrice: getDealOriginalPrice(tour, now),
  }
}

// Backend integration point: the future deals endpoint returns DealFeedItem[]
// (GET /api/deals -> [{ slug, percent, endsAt }]). Pass that feed through
// mergeDealFeed before rendering; no UI changes needed.
export const mergeDealFeed = (tours: readonly Tour[], feed: readonly DealFeedItem[]): Tour[] =>
  tours.map((tour) => {
    const item = feed.find((entry) => entry.slug === tour.slug)
    if (!item || !(item.percent > 0 && item.percent < 100) || Number.isNaN(new Date(item.endsAt).getTime())) return tour
    return { ...tour, deal: { percent: item.percent, endsAt: item.endsAt } }
  })

export const getToursByCategory = (category: TourCategory) => {
  const listed = listingTours.filter((tour) => tour.category === category)
  if (category !== 'multi-days-tours') return listed

  const listedSlugs = new Set(listed.map((tour) => tour.slug))
  return [...featuredTours.filter((tour) => tour.category === category && !listedSlugs.has(tour.slug)), ...listed]
}

export const getRelatedTours = (tour: Tour, limit = 4): Tour[] => {
  const destinations = new Set(tour.location.split(',').map((place) => place.trim().toLowerCase()))
  const candidates = getToursByCategory(tour.category)
    .filter((item) => item.slug !== tour.slug && Boolean(item.detail || item.dayDetail))

  return candidates
    .map((item, index) => ({
      item,
      index,
      relevance: (tour.departurePort && item.departurePort === tour.departurePort ? 4 : 0)
        + item.location.split(',').filter((place) => destinations.has(place.trim().toLowerCase())).length * 2,
    }))
    .sort((a, b) => b.relevance - a.relevance || a.index - b.index)
    .slice(0, limit)
    .map(({ item }) => item)
}

/** Every assignable one-day tour: listed + featured (excludes legacy preserved detail-only routes). Single base for public discovery and admin assignment. */
export const assignableOneDayTours: readonly Tour[] = [
  ...getToursByCategory('one-day-tours'),
  ...featuredTours.filter((tour) => tour.category === 'one-day-tours'),
]

export const catalogTours: readonly Tour[] = (
  Object.keys(tourCategories) as TourCategory[]
).flatMap(getToursByCategory)

export const getToursBySlugs = (slugs: readonly string[]) => {
  const seen = new Set<string>()
  const resolved: Tour[] = []
  for (const slug of slugs) {
    const tour = findTour(slug)
    if (!tour || seen.has(tour.slug)) continue
    seen.add(tour.slug)
    resolved.push(tour)
  }
  return resolved
}

export const seasonalOfferDeadline = '2026-12-31T23:59:59'

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

export type CruiseType = {
  slug: string
  titleEn: string
  titleAr: string
  descEn: string
  descAr: string
  image: string
  icon: string
  featuresEn: readonly string[]
  featuresAr: readonly string[]
}

export const cruiseTypes: readonly CruiseType[] = [
  { slug: 'standard-nile-cruises', titleEn: 'Standard Nile Cruises', titleAr: 'رحلات نيلية عادية', descEn: 'Classic routes between Aswan and Luxor with guided temple visits.', descAr: 'مسارات كلاسيكية بين أسوان والأقصر مع زيارات للمعابد بصحبة مرشد.', image: aswanPackageImage, icon: 'anchor', featuresEn: ['3-4 nights', 'Temple visits', 'Full board'], featuresAr: ['٣-٤ ليالٍ', 'زيارات المعابد', 'إقامة شاملة'] },
  { slug: 'deluxe-nile-cruise', titleEn: 'Deluxe Nile Cruise', titleAr: 'رحلة نيلية ديلوكس', descEn: 'A five-night Cairo and Nile itinerary with hotel and cruise stays.', descAr: 'برنامج لخمس ليالٍ يجمع القاهرة مع الإقامة في فندق ورحلة نيلية.', image: cairoPackageImage, icon: 'star', featuresEn: ['5-night itinerary', 'Cairo and the Nile', 'Guided visits'], featuresAr: ['برنامج ٥ ليالٍ', 'القاهرة والنيل', 'زيارات بصحبة مرشد'] },
  { slug: 'superior-nile-cruise', titleEn: 'Superior Nile Cruise', titleAr: 'رحلة نيلية سوبريور', descEn: 'A five-day journey from Luxor to Aswan through the Nile\'s temple towns.', descAr: 'رحلة لخمسة أيام من الأقصر إلى أسوان عبر مدن المعابد على النيل.', image: luxorPackageImage, icon: 'waves', featuresEn: ['5 days', 'Luxor to Aswan', 'Temple visits'], featuresAr: ['٥ أيام', 'الأقصر إلى أسوان', 'زيارات المعابد'] },
  { slug: 'luxury-nile-cruise', titleEn: 'Luxury Nile Cruises', titleAr: 'رحلات نيلية فاخرة', descEn: 'Explore a four-night cruise and a seven-night dahabiya sailing.', descAr: 'اختر بين رحلة نيلية لأربع ليالٍ أو رحلة دهبية لسبع ليالٍ.', image: aswanPackageImage, icon: 'ship', featuresEn: ['4 or 7 nights', 'Luxor and Aswan', 'Two sailing styles'], featuresAr: ['٤ أو ٧ ليالٍ', 'الأقصر وأسوان', 'طريقتان للإبحار'] },
] as const

export const getCruiseTypeBySlug = (slug: string) => cruiseTypes.find((ct) => ct.slug === slug)

export const getCruisesByType = (cruiseTypeSlug: string) =>
  getToursByCategory('nile-cruises').filter((tour) => tour.cruiseType === cruiseTypeSlug)
