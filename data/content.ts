import type { Blog, Car, Destination, Event, Offer, SearchItem } from './types'

export const siteImages = {
  cairo: '/egypt-hero.png',
  pyramids: 'https://images.unsplash.com/photo-1568322445389-f64ac2515020?auto=format&fit=crop&w=1200&q=85',
  nile: 'https://images.unsplash.com/photo-1539768942893-daf53e448371?auto=format&fit=crop&w=1200&q=85',
  temple: 'https://images.unsplash.com/photo-1548013146-72479768bada?auto=format&fit=crop&w=1200&q=85',
  desert: 'https://images.unsplash.com/photo-1503177119275-0aa32b3a9368?auto=format&fit=crop&w=1200&q=85',
  redSea: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1200&q=85',
  whiteDesert: 'https://upload.wikimedia.org/wikipedia/commons/3/34/WhiteDesertEgypt%40FarafraOasis2007jan6-05_byDanielCsorfoly.JPG',
  whiteDesertMushroom: 'https://upload.wikimedia.org/wikipedia/commons/9/9f/Weisse_W%C3%BCste.jpg',
}

export const destinations: Destination[] = [
  {
    title: 'Cairo & Giza', slug: 'cairo-giza', image: siteImages.pyramids, copy: 'Ancient wonders, lively streets, and the heart of modern Egypt.',
    detail: {
      heroImage: siteImages.pyramids, heroAlt: 'The Great Sphinx and the Pyramids of Giza', eyebrow: 'Capital energy, ancient scale',
      intro: 'Cairo and Giza hold Egypt\'s biggest contrasts in one place: monumental archaeology, layered neighborhoods, river light, and streets that move at their own irresistible pace.',
      facts: [{ label: 'Suggested stay', value: '2-3 days' }, { label: 'Best rhythm', value: 'Early starts' }, { label: 'Travel style', value: 'Culture + city' }, { label: 'Pair it with', value: 'Saqqara' }],
      bestFor: ['First-time Egypt trips', 'History lovers', 'Food and street life', 'Private guided days'],
      experiences: [
        { title: 'Read the Giza Plateau slowly', copy: 'Move beyond the postcard viewpoint and experience the pyramids, Sphinx, and desert horizon as one connected landscape.', image: siteImages.pyramids, alt: 'The Great Sphinx and pyramids at Giza' },
        { title: 'Follow the lanes of historic Cairo', copy: 'Stone gateways, mosques, workshops, and lantern-lit market alleys reveal the city at a more human scale.', image: 'https://images.unsplash.com/photo-1707172889437-dc6f210ea44a?auto=format&fit=crop&w=1400&q=86', alt: 'A historic market street in Cairo' },
        { title: 'Meet the modern capital', copy: 'Balance the ancient sites with Nile views, contemporary neighborhoods, and an evening shaped around local flavor.', image: '/egypt-hero.png', alt: 'Egyptian architecture in warm desert light' },
      ],
      rhythm: [{ label: 'Morning', title: 'Begin with the monuments', copy: 'Use the cooler, quieter hours for Giza or Saqqara and leave room to walk between viewpoints.' }, { label: 'Afternoon', title: 'Cross into the city story', copy: 'Choose one museum or historic district rather than racing through a long checklist.' }, { label: 'Evening', title: 'Let Cairo change pace', copy: 'End with a Nile-side dinner, a market walk, or city lights from a calm viewpoint.' }],
      practical: [{ title: 'Build around traffic', copy: 'Group nearby sights together and avoid planning cross-city transfers between every stop.' }, { title: 'Dress for the day', copy: 'Comfortable shoes, sun protection, and modest layers make long sightseeing days easier.' }, { title: 'Use local context', copy: 'A private guide turns disconnected monuments into one clear story and simplifies movement.' }],
      tourSlugs: ['cairo-and-giza-pyramids', 'egyptian-museum-old-cairo', 'old-cairo-and-khan-el-khalili'],
    },
  },
  {
    title: 'Luxor', slug: 'luxor', image: siteImages.temple, copy: 'Walk through the world\'s greatest open-air museum.',
    detail: {
      heroImage: 'https://images.unsplash.com/photo-1711547789606-a496af0b3582?auto=format&fit=crop&w=2000&q=88', heroAlt: 'The avenue of ram-headed sphinxes at Karnak Temple in Luxor', eyebrow: 'Temples, tombs, Nile light',
      intro: 'Luxor is best experienced as two complementary worlds: the monumental temples of the East Bank and the intimate tombs and desert valleys of the West Bank.',
      facts: [{ label: 'Suggested stay', value: '2-3 days' }, { label: 'Best rhythm', value: 'Sunrise starts' }, { label: 'Travel style', value: 'Archaeology' }, { label: 'Pair it with', value: 'Nile cruise' }],
      bestFor: ['Ancient history', 'Photography', 'Nile journeys', 'Slow cultural travel'],
      experiences: [
        { title: 'Enter Karnak at human pace', copy: 'Let the processional avenues and immense column halls reveal their scale gradually.', image: 'https://images.unsplash.com/photo-1711547789606-a496af0b3582?auto=format&fit=crop&w=1400&q=86', alt: 'Ancient statues leading toward Karnak Temple' },
        { title: 'Cross to the West Bank', copy: 'Tombs, desert cliffs, and temple ruins create a quieter counterpoint to the city across the Nile.', image: '/egypt-hero.png', alt: 'Ancient Egyptian temple columns in warm light' },
        { title: 'Save an evening for the river', copy: 'A slower Nile moment gives the day space to settle after the density of the archaeological sites.', image: siteImages.nile, alt: 'Warm evening light over the Nile landscape' },
      ],
      rhythm: [{ label: 'Day one', title: 'East Bank foundations', copy: 'Build the story with Karnak and Luxor Temple, then return after the harshest midday light.' }, { label: 'Day two', title: 'West Bank depth', copy: 'Start early for the valleys and choose fewer tombs with more time in each.' }, { label: 'Extra time', title: 'Travel beyond Luxor', copy: 'Add Dendera, Abydos, or a Nile sailing experience when your itinerary allows.' }],
      practical: [{ title: 'Start before the heat', copy: 'Early departures improve the light, comfort, and pace of exposed archaeological visits.' }, { title: 'Split the banks', copy: 'Treat the East and West Banks as separate chapters instead of compressing everything into one rush.' }, { title: 'Protect the sites', copy: 'Follow photography rules and avoid touching painted surfaces inside tombs and temples.' }],
      tourSlugs: ['luxor-east-west-bank', 'valley-of-the-kings-day-tour', 'dendera-and-abydos-day-trip'],
    },
  },
  {
    title: 'Aswan', slug: 'aswan', image: siteImages.nile, copy: 'Slow Nile days, Nubian culture, and timeless landscapes.',
    detail: {
      heroImage: 'https://images.unsplash.com/photo-1655163394362-97de2d3c5c85?auto=format&fit=crop&w=2000&q=88', heroAlt: 'A Nubian village beside the Nile in Aswan', eyebrow: 'Nubian warmth, island rhythm',
      intro: 'Aswan softens the pace of an Egypt journey. Granite islands, colorful Nubian communities, and quiet stretches of Nile invite you to look longer and move more slowly.',
      facts: [{ label: 'Suggested stay', value: '2 days' }, { label: 'Best rhythm', value: 'Slow mornings' }, { label: 'Travel style', value: 'Nile + culture' }, { label: 'Pair it with', value: 'Abu Simbel' }],
      bestFor: ['Nile scenery', 'Cultural connection', 'Couples', 'Unhurried itineraries'],
      experiences: [
        { title: 'Arrive by water', copy: 'A boat approach to the islands makes the river part of the experience rather than simply the view.', image: 'https://images.unsplash.com/photo-1655163394179-8b30a553dd6c?auto=format&fit=crop&w=1400&q=86', alt: 'Traditional Nubian houses beside the Nile' },
        { title: 'Meet Nubian Aswan', copy: 'Color, hospitality, and local stories give the city a character distinct from anywhere else in Egypt.', image: 'https://images.unsplash.com/photo-1655163394362-97de2d3c5c85?auto=format&fit=crop&w=1400&q=86', alt: 'Nubian riverside architecture in Aswan' },
        { title: 'Make space for stillness', copy: 'A felucca, garden visit, or unhurried sunset can become the most memorable part of the stay.', image: siteImages.nile, alt: 'A calm Nile landscape near Aswan' },
      ],
      rhythm: [{ label: 'Morning', title: 'Island temples and clear light', copy: 'Begin with a water crossing and one major site while the day still feels calm.' }, { label: 'Afternoon', title: 'Culture at close range', copy: 'Spend time with Nubian heritage, local craft, and the river communities around the city.' }, { label: 'Evening', title: 'Sail without a checklist', copy: 'Let the wind and sunset set the pace for a simple final hour on the Nile.' }],
      practical: [{ title: 'Keep the schedule light', copy: 'Aswan rewards breathing room; two strong experiences often feel better than five rushed stops.' }, { title: 'Plan Abu Simbel separately', copy: 'Treat the long excursion as its own day and protect recovery time afterward.' }, { title: 'Respect local homes', copy: 'Ask before photographing people and choose community experiences that feel reciprocal.' }],
      tourSlugs: ['aswan-and-the-nubian-village', 'philae-temple-felucca-ride', 'abu-simbel-day-trip'],
    },
  },
  {
    title: 'Hurghada', slug: 'hurghada', image: siteImages.redSea, copy: 'Warm water, colorful reefs, and effortless Red Sea escapes.',
    detail: {
      heroImage: siteImages.redSea, heroAlt: 'Divers exploring the clear Red Sea near Hurghada', eyebrow: 'Reef color, desert horizons',
      intro: 'Hurghada gives a classic Egypt itinerary room to breathe, pairing clear Red Sea water with island days, desert landscapes, and an easy resort rhythm.',
      facts: [{ label: 'Suggested stay', value: '3-4 days' }, { label: 'Best rhythm', value: 'Sea days' }, { label: 'Travel style', value: 'Coast + adventure' }, { label: 'Pair it with', value: 'Desert safari' }],
      bestFor: ['Snorkeling', 'Family downtime', 'Diving', 'Winter sun'],
      experiences: [
        { title: 'Meet the reef responsibly', copy: 'Choose guided snorkeling or diving that protects coral and matches the confidence of every traveler.', image: 'https://images.unsplash.com/photo-1581088053806-9ea7682a41e8?auto=format&fit=crop&w=1400&q=86', alt: 'Colorful coral and fish in the Red Sea' },
        { title: 'Give an island day room', copy: 'Open water, bright sand, and a slower boat rhythm are the natural reset after a city-heavy itinerary.', image: siteImages.redSea, alt: 'Divers exploring clear Red Sea water' },
        { title: 'Turn toward the desert', copy: 'The inland landscape adds contrast with wide horizons, mountain silhouettes, and sunset light.', image: siteImages.desert, alt: 'Egyptian desert landscape at sunset' },
      ],
      rhythm: [{ label: 'Day one', title: 'Settle into the water', copy: 'Keep arrival day easy with a beach afternoon or gentle house-reef swim.' }, { label: 'Day two', title: 'Go beyond the shoreline', copy: 'Choose a full snorkeling, diving, or island experience with a trusted operator.' }, { label: 'Day three', title: 'Add the desert contrast', copy: 'Balance the coast with an inland safari or leave the day completely unstructured.' }],
      practical: [{ title: 'Match the activity level', copy: 'Share swimming confidence and equipment needs before selecting a boat or dive plan.' }, { title: 'Protect the reef', copy: 'Use reef-conscious practices, keep distance from coral, and follow your guide\'s route.' }, { title: 'Keep a buffer day', copy: 'Wind and sea conditions can change, so flexibility helps protect your best water experience.' }],
      tourSlugs: ['hurghada-red-sea-escape', 'giftun-island-snorkeling-trip', 'hurghada-desert-safari'],
    },
  },
  {
    title: 'White Desert', slug: 'white-desert', image: siteImages.whiteDesert, copy: 'A surreal landscape carved by wind and time.',
    detail: {
      heroImage: siteImages.whiteDesert, heroAlt: 'Mushroom-shaped chalk formations in Egypt\'s White Desert', eyebrow: 'Silence, chalk, open sky',
      intro: 'The White Desert is less about ticking off sights and more about entering a different scale of time: sculpted formations, shifting light, and a night sky far from the city.',
      facts: [{ label: 'Suggested stay', value: '2 days' }, { label: 'Best rhythm', value: 'Overnight escape' }, { label: 'Travel style', value: '4x4 + camp' }, { label: 'Pair it with', value: 'Bahariya' }],
      bestFor: ['Landscape photography', 'Adventure', 'Stargazing', 'Repeat Egypt visitors'],
      experiences: [
        { title: 'Cross the changing desert', copy: 'The route matters as much as the destination, moving through different textures, colors, and geological forms.', image: siteImages.whiteDesert, alt: 'A wide route through the White Desert near Farafra' },
        { title: 'Walk among natural sculptures', copy: 'Wind-shaped chalk formations turn the landscape into an open-air gallery best explored slowly.', image: siteImages.whiteDesertMushroom, alt: 'Mushroom-shaped limestone formations in the White Desert' },
        { title: 'Stay for the night sky', copy: 'Sunset, camp, and first light reveal three completely different versions of the same landscape.', image: siteImages.whiteDesert, alt: 'Chalk formations beneath the open Western Desert sky' },
      ],
      rhythm: [{ label: 'Departure', title: 'Leave the city behind', copy: 'Build in rest stops and let the landscape transition gradually on the drive west.' }, { label: 'Sunset', title: 'Arrive before the color changes', copy: 'Use the softer final light for walking, photography, and choosing a calm camp setting.' }, { label: 'Morning', title: 'Wake with the desert', copy: 'Keep the first hour unhurried before beginning the return journey.' }],
      practical: [{ title: 'Travel with specialists', copy: 'Use experienced local drivers and guides who understand desert routes and conditions.' }, { title: 'Pack for temperature shifts', copy: 'Light layers, sun protection, and a warm evening layer cover the changing desert day.' }, { title: 'Leave no trace', copy: 'Carry waste out, avoid damaging formations, and keep camp impact as light as possible.' }],
      tourSlugs: ['white-desert-adventure'],
    },
  },
  {
    title: 'Sharm El Sheikh', slug: 'sharm-el-sheikh', image: siteImages.redSea, copy: 'A bright coastal retreat with desert adventures nearby.',
    detail: {
      heroImage: siteImages.redSea, heroAlt: 'Divers in clear Red Sea water near Sharm El Sheikh', eyebrow: 'Red Sea clarity, Sinai drama',
      intro: 'Sharm El Sheikh combines easy resort comfort with serious underwater experiences and the stark mountain landscapes of southern Sinai.',
      facts: [{ label: 'Suggested stay', value: '3-5 days' }, { label: 'Best rhythm', value: 'Water first' }, { label: 'Travel style', value: 'Reef + Sinai' }, { label: 'Pair it with', value: 'Ras Mohammed' }],
      bestFor: ['Diving', 'Snorkeling', 'Resort stays', 'Sinai adventure'],
      experiences: [
        { title: 'Explore beneath the surface', copy: 'Reef walls, clear water, and guided access make the underwater landscape the destination\'s defining experience.', image: siteImages.redSea, alt: 'Scuba divers surrounded by Red Sea fish' },
        { title: 'Choose a protected marine day', copy: 'A thoughtfully paced snorkeling route lets both confident swimmers and beginners enjoy the coast.', image: 'https://images.unsplash.com/photo-1581088053806-9ea7682a41e8?auto=format&fit=crop&w=1400&q=86', alt: 'Colorful coral reef in the Red Sea' },
        { title: 'Turn inland to Sinai', copy: 'Mountain routes and desert evenings create a powerful contrast to the bright resort coastline.', image: siteImages.desert, alt: 'A dramatic desert landscape in Egypt' },
      ],
      rhythm: [{ label: 'Day one', title: 'Ease into the coast', copy: 'Use the first day for a relaxed swim, equipment check, and simple waterfront evening.' }, { label: 'Day two', title: 'Commit to the marine day', copy: 'Plan your strongest reef or diving experience while energy and attention are high.' }, { label: 'Extra day', title: 'See another side of Sinai', copy: 'Choose a mountain, desert, or cultural route to balance the time spent on the water.' }],
      practical: [{ title: 'Book for your experience level', copy: 'Be clear about diving certification and swimming confidence before choosing the route.' }, { title: 'Respect marine rules', copy: 'Follow protected-area guidance and keep fins, hands, and equipment away from coral.' }, { title: 'Plan recovery time', copy: 'Leave space between demanding water activities and any long-distance Sinai excursion.' }],
      tourSlugs: ['sharm-el-sheikh-diving-day', 'ras-mohamed-snorkeling-trip', 'st-catherine-mount-sinai'],
    },
  },
]

export const cars: Car[] = [
  { title: 'Toyota Corolla', slug: 'toyota-corolla', image: 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1200&q=88', seats: '4 seats', transmission: 'Automatic', dailyPrice: 45, copy: 'Reliable comfort for city transfers and day trips.' },
  { title: 'Hyundai H1 Van', slug: 'hyundai-h1-van', image: 'https://images.unsplash.com/photo-1549924231-f129b911e442?auto=format&fit=crop&w=1200&q=88', seats: '8 seats', transmission: 'Automatic', dailyPrice: 75, copy: 'Spacious private transport for families and groups.' },
  { title: 'Mercedes E-Class', slug: 'mercedes-e-class', image: 'https://images.unsplash.com/photo-1503736334956-4c8f8e92946d?auto=format&fit=crop&w=1200&q=88', seats: '3 seats', transmission: 'Automatic', dailyPrice: 110, copy: 'Quiet, polished travel for executive transfers.' },
  { title: 'Toyota Hiace', slug: 'toyota-hiace', image: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=1200&q=88', seats: '14 seats', transmission: 'Manual', dailyPrice: 95, copy: 'A practical choice for larger groups and excursions.' },
]

export const blogs: Blog[] = [
  {
    title: 'The ultimate guide to visiting the Pyramids',
    slug: 'ultimate-guide-pyramids',
    image: siteImages.pyramids,
    category: 'Travel Guide',
    date: 'May 18, 2026',
    excerpt: 'Everything you need for a smooth and memorable visit to Giza.',
    editorial: {
      heroImage: 'https://images.unsplash.com/photo-1738580426685-f8f0d34291dc?auto=format&fit=crop&w=2000&q=88',
      heroAlt: 'The Great Sphinx with the Pyramids of Giza behind it',
      readTime: '8 min read',
      heroDescription: 'Plan the timing, route, and small details that turn a famous landmark into a remarkable day.',
      facts: [
        { icon: 'Sun', label: 'Best rhythm', value: 'Start at opening' },
        { icon: 'Clock3', label: 'Time to allow', value: 'Half a day' },
        { icon: 'Compass', label: 'Setting', value: 'Open desert plateau' },
        { icon: 'ShieldCheck', label: 'Travel style', value: 'Private guide recommended' },
      ],
      sidebarLinks: [
        { href: '#overview', label: 'Why Giza matters' },
        { href: '#timing', label: 'Choose your moment' },
        { href: '#essentials', label: 'Visit essentials' },
        { href: '#experience', label: 'Experience the plateau' },
        { href: '#before-you-go', label: 'Before you go' },
      ],
      sidebarAction: { label: 'Prefer everything arranged?', heading: 'Explore Giza with a private guide and driver.', tourSlug: 'cairo-and-giza-pyramids' },
      sections: [
        {
          id: 'overview', number: '01', eyebrow: 'Begin with the scale', heading: 'More than a photo stop',
          lede: 'The Giza Plateau rewards a slower visit. The Great Pyramid, Khafre\u2019s pyramid, Menkaure\u2019s pyramid, and the Sphinx form one vast landscape, not a single viewpoint.',
          copy: ['Your best experience comes from treating the site as a journey across the plateau: arrive with a route, leave room to walk, and pause where the desert opens around the monuments.'],
        },
        {
          id: 'timing', number: '02', eyebrow: 'Choose your moment', heading: 'Start early. Let the plateau unfold.',
          image: { src: 'https://images.unsplash.com/photo-1636020833630-89d4a5a75807?auto=format&fit=crop&w=1400&q=86', alt: 'The Great Sphinx and Pyramid of Khafre under a clear sky', caption: 'Giza Plateau \u00B7 Cairo' },
          copy: ['Arriving near opening time gives you cooler air, softer light, and a calmer first look at the pyramids. Move from the major viewpoints toward the Sphinx rather than racing between isolated stops.'],
          list: ['Confirm current opening hours before you travel.', 'Keep water, sun protection, and comfortable shoes close.', 'Allow extra time if you plan to enter a pyramid.'],
        },
        {
          id: 'essentials', number: '03', eyebrow: 'Visit essentials', heading: 'Know before you step onto the plateau',
        },
        {
          id: 'experience', number: '04', eyebrow: 'Travel beyond the checklist', heading: 'Give the landscape room to surprise you',
          copy: ['A good guide does more than recite dates. They connect the architecture to the people who built it, choose viewpoints around the changing light, and help you move through the plateau without friction.', 'Pair Giza with a thoughtful Cairo plan rather than squeezing it between unrelated stops. The experience feels richer when the day has one clear story.'],
          image: { src: 'https://images.unsplash.com/photo-1771325676184-44d8035e3cd1?auto=format&fit=crop&w=2000&q=88', alt: 'Camel riders passing the Pyramids of Giza at sunset', caption: 'Golden hour on the desert edge' },
          reverse: true,
        },
        {
          id: 'before-you-go', number: '05', eyebrow: 'Before you go', heading: 'Your Giza day, simplified',
        },
      ],
      tips: [
        { icon: 'Ticket', title: 'Tickets & access', copy: 'General entry and access inside individual pyramids may be ticketed separately. Confirm the current options before your visit.' },
        { icon: 'Compass', title: 'Getting around', copy: 'The plateau is larger than it appears. A planned vehicle route saves energy while preserving time for the best walking sections.' },
        { icon: 'Camera', title: 'Photography', copy: 'Morning light brings out the limestone texture. Follow local rules around interiors, restricted areas, and professional equipment.' },
      ],
      quote: 'The unforgettable part is not simply seeing the pyramids. It is watching their scale change as you move through the desert.',
      checklist: [
        { title: 'Check live details', detail: 'Opening hours, interior access, and photography policies can change.' },
        { title: 'Dress for the setting', detail: 'Choose breathable layers, sturdy shoes, sunglasses, and sun protection.' },
        { title: 'Carry small essentials', detail: 'Water, a charged phone, and a small amount of cash keep the day easy.' },
        { title: 'Use trusted transport', detail: 'A pre-arranged driver and licensed guide remove the most common points of friction.' },
      ],
      wideImage: { src: 'https://images.unsplash.com/photo-1761561291297-a37de90f454c?auto=format&fit=crop&w=1400&q=86', alt: 'Close view of the limestone blocks of a Giza pyramid', caption: 'Up close, the monuments become layers of weathered limestone, marks, and extraordinary human scale.' },
      cta: { eyebrow: 'Private Giza experience', heading: 'See the Pyramids without the guesswork.', copy: 'Your guide, route, and private transport arranged around the way you want to travel.', tourSlug: 'cairo-and-giza-pyramids', tourLabel: 'Explore the tour' },
    },
  },
  {
    title: 'What to pack for a Nile cruise',
    slug: 'what-to-pack-nile-cruise',
    image: siteImages.nile,
    category: 'Travel Tips',
    date: 'April 26, 2026',
    excerpt: 'A thoughtful packing list for sunny days and elegant evenings.',
    editorial: {
      heroImage: 'https://images.unsplash.com/photo-1539768942893-daf53e448371?auto=format&fit=crop&w=2000&q=88',
      heroAlt: 'A Nile cruise boat sailing between Luxor and Aswan at golden hour',
      readTime: '6 min read',
      heroDescription: 'The right preparation turns a good cruise into an effortless one. Pack for temple mornings, poolside afternoons, and smart evenings on the water.',
      facts: [
        { icon: 'Sun', label: 'Climate', value: 'Warm and sunny' },
        { icon: 'Clock3', label: 'Trip length', value: '3 to 7 nights' },
        { icon: 'Compass', label: 'Pace', value: 'Relaxed with excursions' },
        { icon: 'ShieldCheck', label: 'Dress code', value: 'Smart casual evenings' },
      ],
      sidebarLinks: [
        { href: '#clothing', label: 'What to wear' },
        { href: '#essentials', label: 'Travel essentials' },
        { href: '#evenings', label: 'Evening attire' },
        { href: '#tips', label: 'Packing tips' },
      ],
      sidebarAction: { label: 'Ready to sail?', heading: 'Browse our curated Nile cruise itineraries.', tourSlug: 'luxor-to-aswan-cruise' },
      sections: [
        {
          id: 'clothing', number: '01', eyebrow: 'What to wear', heading: 'Light layers for warm days',
          lede: 'Nile cruise days alternate between air-conditioned comfort and sun-warmed temple courtyards. Build your wardrobe around breathable fabrics that transition easily.',
          copy: ['Linen and cotton shirts, lightweight trousers, and a wide-brimmed hat form the core of a comfortable cruise wardrobe. Temperatures along the Nile can climb during midday, so loose-fitting clothing in light colours helps you stay cool during guided walks.', 'A light cardigan or shawl is useful for air-conditioned lounges and the occasional cool evening breeze on deck.'],
        },
        {
          id: 'essentials', number: '02', eyebrow: 'Travel essentials', heading: 'The items that make the difference',
          copy: ['Sun protection is essential along the Nile. Pack high-SPF sunscreen, polarised sunglasses, and a reusable water bottle to stay hydrated between excursions.', 'A compact daypack keeps your hands free during temple visits, while a portable charger ensures your phone stays ready for photographs.'],
          list: ['High-SPF sunscreen and lip balm with SPF', 'Polarised sunglasses and a secure strap', 'Reusable water bottle', 'Compact daypack for shore excursions', 'Portable charger and universal adapter'],
        },
        {
          id: 'evenings', number: '03', eyebrow: 'Evening attire', heading: 'Dress for dinner on the Nile',
          copy: ['Evenings aboard a Nile cruise strike a balance between relaxed and polished. Most dining rooms welcome smart casual attire: a linen shirt, a neat dress, or tailored trousers with a blouse.', 'Pack one slightly dressier outfit for the captain\u2019s dinner or a special evening ashore. Comfortable dress shoes or loafers work better than formal heels on a moving deck.'],
          image: { src: 'https://images.unsplash.com/photo-1548013146-72479768bada?auto=format&fit=crop&w=1400&q=86', alt: 'Evening light over the Nile with a cruise boat in the distance', caption: 'Evening light on the Nile' },
        },
      ],
      checklist: [
        { title: 'Check the weather window', detail: 'Winter evenings can be cool on deck; summer days demand extra sun protection.' },
        { title: 'Pack for temple visits', detail: 'Cover shoulders and knees for religious and historical sites.' },
        { title: 'Bring a power adapter', detail: 'Egypt uses European-style two-pin plugs (Type C/F).' },
        { title: 'Keep medications handy', detail: 'Pack essentials in your daypack for shore excursions.' },
      ],
      cta: { eyebrow: 'Nile cruise journeys', heading: 'Let the river set the pace.', copy: 'Browse our curated Nile cruise itineraries and find the rhythm that suits you.', tourSlug: 'luxor-to-aswan-cruise', tourLabel: 'View Nile cruises' },
    },
  },
  {
    title: 'A local\'s guide to Old Cairo',
    slug: 'locals-guide-old-cairo',
    image: siteImages.cairo,
    category: 'Culture',
    date: 'March 09, 2026',
    excerpt: 'Mosques, markets, coffee, and the small details worth slowing down for.',
    editorial: {
      heroImage: 'https://images.unsplash.com/photo-1572252009286-268acec5ca0a?auto=format&fit=crop&w=2000&q=88',
      heroAlt: 'Narrow alleyway in Khan el-Khalili market with hanging lanterns',
      readTime: '7 min read',
      heroDescription: 'Old Cairo rewards the visitor who walks slowly. Between the historic mosques and the winding market lanes, the real character of the city reveals itself.',
      facts: [
        { icon: 'Sun', label: 'Best time', value: 'Morning or late afternoon' },
        { icon: 'Clock3', label: 'Time to allow', value: 'Half to full day' },
        { icon: 'Compass', label: 'Area', value: 'Historic Fatimid quarter' },
        { icon: 'ShieldCheck', label: 'Style', value: 'Walking exploration' },
      ],
      sidebarLinks: [
        { href: '#khan', label: 'Khan el-Khalili' },
        { href: '#mosques', label: 'Historic mosques' },
        { href: '#food', label: 'Local food & coffee' },
        { href: '#hidden', label: 'Hidden details' },
      ],
      sidebarAction: { label: 'Want a local guide?', heading: 'Explore Cairo with a licensed Egyptologist.', tourSlug: 'cairo-and-giza-pyramids' },
      sections: [
        {
          id: 'khan', number: '01', eyebrow: 'The great market', heading: 'Khan el-Khalili rewards the unhurried',
          lede: 'Khan el-Khalili is more than a souvenir bazaar. It is a living network of workshops, caf\u00e9s, and alleyways where Cairo\u2019s artisan traditions continue alongside daily life.',
          copy: ['Wander past the copper smiths, spice merchants, and textile shops without rushing. The best finds often appear in the quieter lanes where locals shop for household goods and everyday ingredients.', 'Stop at El Fishawy, the historic caf\u00e9 at the heart of the market, for mint tea and a moment to watch the flow of people.'],
        },
        {
          id: 'mosques', number: '02', eyebrow: 'Historic mosques', heading: 'A city built on layers of faith',
          copy: ['Al-Azhar Mosque, founded in 970 AD, stands at the cultural heart of Islamic Cairo. The surrounding university and library complex has shaped scholarship for over a millennium.', 'The Mosque of Sultan Hassan, near the Citadel, offers one of the most impressive interior spaces in the city. Its scale and geometric precision reflect centuries of Mamluk craftsmanship.'],
          image: { src: 'https://images.unsplash.com/photo-1548013146-72479768bada?auto=format&fit=crop&w=1400&q=86', alt: 'Interior courtyard of a historic Cairo mosque with ornate arches', caption: 'Al-Azhar Mosque courtyard' },
        },
        {
          id: 'food', number: '03', eyebrow: 'Local food & coffee', heading: 'Follow the flavours',
          copy: ['Old Cairo\u2019s food scene stretches far beyond tourist menus. Seek out neighbourhood fuul and taameya stands for breakfast, then drift toward the spice市场的 aromas as the morning unfolds.', 'Turkish coffee, cardamom-spiced and thick, is a ritual here. Ask for qahwa arabiyya and take the time to let it cool slowly.'],
          list: ['Fuul medames and taameya for a traditional breakfast', 'Koshary at a local favourite for a hearty lunch', 'Mint tea or Turkish coffee at a market caf\u00e9', 'Kunafa or basbousa for a sweet finish'],
        },
        {
          id: 'hidden', number: '04', eyebrow: 'Hidden details', heading: 'Look for the small things',
          copy: ['The best details in Old Cairo hide in plain sight: carved wooden mashrabiya screens, the sound of a coppersmith\u2019s hammer, and the fading calligraphy above a centuries-old doorway.', 'Allow yourself to get slightly lost. The layout of the old city rewards curiosity, and the most memorable moments often come when you step away from the planned route.'],
        },
      ],
      quote: 'The old city does not give up its secrets all at once. It asks you to slow down, look up, and let the details find you.',
      cta: { eyebrow: 'Explore Cairo', heading: 'See Old Cairo with a knowledgeable local guide.', copy: 'Our licensed guides know the stories behind the walls, the best stalls, and the quiet corners most visitors miss.', tourSlug: 'cairo-and-giza-pyramids', tourLabel: 'Explore Cairo tours' },
    },
  },
  {
    title: 'The best time to visit Egypt',
    slug: 'best-time-visit-egypt',
    image: siteImages.desert,
    category: 'Travel Guide',
    date: 'February 20, 2026',
    excerpt: 'Season-by-season planning for the trip you imagine.',
    editorial: {
      heroImage: 'https://images.unsplash.com/photo-1503177119275-0aa32b3a9368?auto=format&fit=crop&w=2000&q=88',
      heroAlt: 'Desert landscape with distant pyramids under a clear sky',
      readTime: '6 min read',
      heroDescription: 'Egypt is a year-round destination, but the season you choose shapes everything from crowd levels to what you pack.',
      facts: [
        { icon: 'Sun', label: 'Peak season', value: 'October \u2013 February' },
        { icon: 'Clock3', label: 'Best balance', value: 'March & November' },
        { icon: 'Compass', label: 'Red Sea', value: 'Good all year' },
        { icon: 'ShieldCheck', label: 'Summer deals', value: 'June \u2013 August' },
      ],
      sidebarLinks: [
        { href: '#autumn', label: 'Autumn (Oct \u2013 Dec)' },
        { href: '#winter', label: 'Winter (Jan \u2013 Feb)' },
        { href: '#spring', label: 'Spring (Mar \u2013 May)' },
        { href: '#summer', label: 'Summer (Jun \u2013 Sep)' },
      ],
      sections: [
        {
          id: 'autumn', number: '01', eyebrow: 'October \u2013 December', heading: 'Autumn: the sweet spot',
          lede: 'The months from October through December bring comfortable temperatures, clear skies, and a lively but manageable pace at major sites.',
          copy: ['Daytime temperatures in Cairo typically sit between 25\u00B0C and 30\u00B0C, making temple visits and outdoor exploration pleasant from morning to late afternoon. Evenings are cool enough for a light layer.', 'This is the start of the cruise season on the Nile. The river is calm, the light is warm, and Luxor\u2019s temples glow beautifully at sunset.'],
        },
        {
          id: 'winter', number: '02', eyebrow: 'January \u2013 February', heading: 'Winter: cool days, clear light',
          copy: ['Winter in Egypt is mild by global standards, but cooler than the rest of the year. Cairo daytime temperatures hover around 18\u00B0C to 22\u00B0C, and evenings can feel brisk, especially along the Nile.', 'The clear winter light is ideal for photography, and major sites like the Pyramids and Luxor\u2019s Valley of the Kings are at their most comfortable for extended visits.'],
          image: { src: 'https://images.unsplash.com/photo-1568322445389-f64ac2515020?auto=format&fit=crop&w=1400&q=86', alt: 'The Pyramids of Giza on a clear winter morning', caption: 'Winter light at the Pyramids' },
        },
        {
          id: 'spring', number: '03', eyebrow: 'March \u2013 May', heading: 'Spring: warm days, fewer crowds',
          copy: ['Spring brings rising temperatures and a thinner crowd of visitors. March and early April offer a comfortable middle ground before the full heat of summer arrives.', 'This is a strong season for Red Sea resorts, where the water temperature is ideal for diving and snorkelling. Combine a beach stay with a few days of sightseeing for a balanced itinerary.'],
        },
        {
          id: 'summer', number: '04', eyebrow: 'June \u2013 September', heading: 'Summer: budget-friendly and bold',
          copy: ['Summer temperatures in Cairo and Upper Egypt regularly exceed 35\u00B0C, making midday sightseeing challenging. However, the Red Sea coast remains pleasantly warm with cooling breezes.', 'Fewer visitors mean shorter queues, more flexible hotel availability, and often better rates. If you plan around the heat\u2014early mornings and late afternoons for temples, daytime for the coast\u2014summer can be surprisingly rewarding.'],
          image: { src: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1400&q=86', alt: 'Turquoise waters of the Red Sea under a bright summer sky', caption: 'Red Sea summer escape' },
        },
      ],
      quote: 'There is no wrong time to visit Egypt. There is only the time that matches the pace and experience you are looking for.',
      cta: { eyebrow: 'Plan your trip', heading: 'Not sure which season fits you best?', copy: 'Tell us your dates and interests. Our team will shape an itinerary around the weather, the crowds, and the moments that matter most.', customLabel: 'Plan my trip' },
    },
  },
  {
    title: 'Five Egyptian dishes you must try',
    slug: 'five-egyptian-dishes',
    image: siteImages.redSea,
    category: 'Food',
    date: 'January 14, 2026',
    excerpt: 'From koshary to fresh seafood, taste the places you visit.',
    editorial: {
      heroImage: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=2000&q=88',
      heroAlt: 'A vibrant plate of koshary topped with crispy onions and tomato sauce',
      readTime: '5 min read',
      heroDescription: 'Egyptian food is honest, generous, and deeply connected to the places where it is served. These five dishes are a starting point for a delicious journey.',
      facts: [
        { icon: 'Sun', label: 'Best setting', value: 'Street-side to fine dining' },
        { icon: 'Clock3', label: 'Meal pace', value: 'Slow and social' },
        { icon: 'Compass', label: 'Budget', value: 'Very affordable' },
        { icon: 'ShieldCheck', label: 'Tip', value: 'Follow the locals' },
      ],
      sidebarLinks: [
        { href: '#koshary', label: 'Koshary' },
        { href: '#ful', label: 'Ful medames' },
        { href: '#molokhia', label: 'Molokhia' },
        { href: '#seafood', label: 'Fresh seafood' },
        { href: '#desserts', label: 'Sweet endings' },
      ],
      sections: [
        {
          id: 'koshary', number: '01', eyebrow: 'The national staple', heading: 'Koshary: Cairo\u2019s most iconic bowl',
          lede: 'Koshary is Egypt\u2019s beloved comfort food: a hearty mix of rice, lentils, macaroni, and chickpeas, topped with spiced tomato sauce and crispy fried onions.',
          copy: ['Born in the busy streets of Cairo, koshary is served from dedicated shops where the assembly is quick and the flavour is deep. Each vendor has their own ratio and sauce recipe, so trying a few is part of the experience.', 'Add chilli, vinegar, or garlic sauce to taste. It is inexpensive, filling, and available almost everywhere.'],
        },
        {
          id: 'ful', number: '02', eyebrow: 'Morning ritual', heading: 'Ful medames: breakfast like a local',
          copy: ['Ful medames\u2014slow-cooked fava beans seasoned with cumin, lemon, and olive oil\u2014has been a staple of Egyptian meals for centuries. Served with fresh bread, it is the breakfast of choice across the country.', 'Look for the neighbourhood ful stand where locals gather in the morning. The beans are scooped from a large copper pot and customised with tahini, chopped tomatoes, or a drizzle of chilli oil.'],
          image: { src: 'https://images.unsplash.com/photo-1548013146-72479768bada?auto=format&fit=crop&w=1400&q=86', alt: 'A traditional Egyptian breakfast spread with ful medames and fresh bread', caption: 'A traditional ful breakfast' },
        },
        {
          id: 'molokhia', number: '03', eyebrow: 'A green classic', heading: 'Molokhia: the soup Egyptians grow up with',
          copy: ['Molokhia is a rich, dark-green soup made from jute leaves, slow-simmered with garlic and coriander. It is served over rice or with bread and is one of the most deeply personal dishes in Egyptian home cooking.', 'The flavour is earthy and herbaceous. Every family has their own method\u2014some prefer it thick, others more brothy\u2014and it is often the dish that Egyptians miss most when they travel abroad.'],
        },
        {
          id: 'seafood', number: '04', eyebrow: 'From the coast', heading: 'Fresh seafood along the Red Sea',
          copy: ['Egypt\u2019s Red Sea coast offers some of the freshest fish in the region. Grilled hammour, shrimp with garlic, and calamari are staples in coastal towns like Hurghada and El Gouna.', 'Order simply prepared and let the quality of the fish speak for itself. A squeeze of lemon, a side of tahini, and warm bread are all you need.'],
          image: { src: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1400&q=86', alt: 'Grilled fish served with lemon and salad at a Red Sea restaurant', caption: 'Fresh catch on the Red Sea' },
        },
        {
          id: 'desserts', number: '05', eyebrow: 'Sweet endings', heading: 'Finish with something sweet',
          copy: ['No Egyptian meal is complete without a sweet note. Kunafa\u2014crispy shredded pastry filled with sweet cheese and soaked in syrup\u2014is a favourite, especially during warm months.', 'Basbousa, a semolina cake drenched in syrup and sometimes topped with coconut, pairs perfectly with strong Egyptian coffee.']
        },
      ],
      quote: 'The best meals in Egypt are rarely planned. They happen when you follow a local\u2019s suggestion and sit down with an open appetite.',
      cta: { eyebrow: 'Taste Egypt', heading: 'Let your trip be shaped by flavour.', copy: 'From street food tours to riverside dining, we can build an itinerary around the tastes you want to experience.', customLabel: 'Plan a food trip' },
    },
  },
  {
    title: 'Sunrise over Luxor\'s West Bank',
    slug: 'sunrise-luxor-west-bank',
    image: siteImages.temple,
    category: 'Stories',
    date: 'December 05, 2025',
    excerpt: 'One perfect morning among tombs, valleys, and ancient silhouettes.',
    editorial: {
      heroImage: 'https://images.unsplash.com/photo-1548013146-72479768bada?auto=format&fit=crop&w=2000&q=88',
      heroAlt: 'Golden sunrise light over the West Bank of Luxor with the Valley of the Kings in the distance',
      readTime: '5 min read',
      heroDescription: 'There is a particular quality to the first light on the West Bank. The limestone cliffs turn gold, the shadows stretch across the valley, and the ancient world feels closer than usual.',
      facts: [
        { icon: 'Sun', label: 'Best light', value: 'First 30 minutes' },
        { icon: 'Clock3', label: 'Start time', value: 'Before dawn' },
        { icon: 'Compass', label: 'Setting', value: 'Valley of the Kings' },
        { icon: 'ShieldCheck', label: 'Style', value: 'Private early tour' },
      ],
      sidebarLinks: [
        { href: '#morning', label: 'Before dawn' },
        { href: '#valley', label: 'The Valley' },
        { href: '#temples', label: 'Temple moments' },
        { href: '#return', label: 'Returning at noon' },
      ],
      sidebarAction: { label: 'Experience Luxor?', heading: 'See the West Bank with a private guide.', tourSlug: 'luxor-day-tour' },
      sections: [
        {
          id: 'morning', number: '01', eyebrow: 'Before dawn', heading: 'The drive across the river',
          lede: 'The morning begins in darkness. A car crosses the Nile before sunrise, the city still quiet, the water black and smooth under the bridge.',
          copy: ['The West Bank feels like a different country at this hour. The air is cooler, the roads are empty, and the limestone ridges ahead catch the first hints of light as you approach the valley.', 'This is the time to notice the landscape\u2014the dry wadis, the scattered mudbrick ruins, the sense of a place that has been visited for thousands of years and still feels remote.'],
        },
        {
          id: 'valley', number: '02', eyebrow: 'The Valley', heading: 'When the light finds the tombs',
          copy: ['The Valley of the Kings is built for early visits. The tomb corridors are cool and quiet before the day\u2019s first tour groups arrive, and the painted walls hold their colour better in low, even light.', 'Each tomb tells a different story. Some are vast and ornate, others narrow and personal. A good guide helps you read the scenes\u2014the journeys of the pharaohs, the symbols of protection, the carefully placed offerings.'],
          image: { src: 'https://images.unsplash.com/photo-1539768942893-daf53e448371?auto=format&fit=crop&w=1400&q=86', alt: 'The entrance to a painted tomb in the Valley of the Kings at sunrise', caption: 'Valley of the Kings at dawn' },
        },
        {
          id: 'temples', number: '03', eyebrow: 'Temple moments', heading: 'Hatshepsut and the cliffs',
          copy: ['The Temple of Hatshepsut rises from the desert in clean, terraced lines against the sheer cliff face. In the early light, the geometry is sharp and the shadows are long.', 'Stand at the base and look up. The scale of the architecture against the natural rock wall is humbling\u2014a reminder that this was built not just to endure, but to impress across millennia.'],
        },
        {
          id: 'return', number: '04', eyebrow: 'Returning at noon', heading: 'When the valley goes quiet again',
          copy: ['By midday the West Bank empties as quickly as it filled. The tour buses pull away, the ticket offices close their shutters, and the silence returns to the valley.', 'This is the time to stop at a small café on the road back to Luxor, drink a cold hibiscus juice, and let the morning settle. The best travel days leave you with something you did not expect to feel.'],
        },
      ],
      quote: 'The West Bank does not shout. It waits. And if you arrive early enough, you have it almost to yourself.',
      cta: { eyebrow: 'Luxor experiences', heading: 'See the West Bank the way it deserves.', copy: 'Early-morning access, a private guide, and a pace that lets the Valley speak for itself.', tourSlug: 'luxor-day-tour', tourLabel: 'Explore Luxor tours' },
    },
  },
]

export const events: Event[] = [
  { title: 'Eid Holidays in Egypt', slug: 'eid-holidays-egypt', image: siteImages.cairo, date: 'March 20-30, 2027', location: 'Cairo, Luxor & Aswan', category: 'Seasonal journey', copy: 'Celebrate Egypt\'s warmth, food, and living traditions across three iconic cities.', intro: 'A privately coordinated Eid journey linking Cairo\'s festive streets with the temples, river landscapes, and slower rhythm of Upper Egypt.',
    highlights: [
      { title: 'Celebrate in Cairo', description: 'Experience the city during Eid with landmark visits, historic neighborhoods, and time for local food and evening atmosphere.' },
      { title: 'Continue through Upper Egypt', description: 'Move from Luxor\'s monumental temples to Aswan\'s islands and Nubian character in one connected route.' },
      { title: 'Travel with local support', description: 'Private transfers and guided sightseeing keep the multi-city journey clear, comfortable, and well paced.' },
    ],
    program: [
      { day: 'Day 1-2', title: 'Cairo arrival & Eid sights', description: 'Settle in, explore the Giza Pyramids and the Sphinx, and feel the Eid lights at Khan El Khalili bazaar.' },
      { day: 'Day 3-4', title: 'Islamic & Coptic Cairo', description: 'Citadel and historic mosques, old churches, and traditional Eid foods with a local host.' },
      { day: 'Day 5-6', title: 'Luxor temples', description: 'Fly to Luxor for Karnak and Luxor Temple, then the Valley of the Kings and Hatshepsut Temple.' },
      { day: 'Day 7-9', title: 'Aswan & the Nile', description: 'Philae Temple by motorboat, felucca sailing, a Nubian village visit, and the High Dam.' },
      { day: 'Day 10-11', title: 'Farewell', description: 'A last souq morning and relaxed departure transfer.' },
    ],
    included: ['Eid-season airport meet and greet', 'Private transfers with driver', 'Daily guided sightseeing per program', 'Domestic flight Cairo to Luxor'],
    excluded: ['International flights', 'Egypt entry visa', 'Meals and personal expenses unless listed', 'Tips for guides and drivers'],
    addOns: [{ title: 'Hot air balloon over Luxor' }, { title: 'Abu Simbel day trip' }, { title: 'Extra night in Cairo' }],
  },
  { title: 'New Year on the Nile', slug: 'new-year-nile', image: siteImages.nile, date: 'December 28, 2026 - January 04, 2027', location: 'Luxor to Aswan', category: 'Nile celebration', copy: 'Welcome the new year with temple lights, calm river days, and golden sunsets.', intro: 'An eight-day Nile celebration shaped around ancient sites, relaxed sailing, and a New Year\'s Eve gala as the river carries you from Luxor to Aswan.',
    highlights: [
      { title: 'Celebrate on the river', description: 'Mark New Year\'s Eve on board with a gala dinner and midnight countdown during the southbound sailing.' },
      { title: 'Follow the temple route', description: 'Explore Luxor, Edfu, Kom Ombo, and Philae with guided visits woven into the cruise rhythm.' },
      { title: 'Keep time for the Nile', description: 'Balance the archaeological program with golden-hour sailing and calmer moments on deck.' },
    ],
    program: [
      { day: 'Day 1', title: 'Embark in Luxor', description: 'Board the cruise ship, settle into the cabin, and enjoy an evening visit to Luxor Temple.' },
      { day: 'Day 2', title: 'Karnak & the West Bank', description: 'Morning at Karnak Temple complex, then the Valley of the Kings and Hatshepsut Temple.' },
      { day: 'Day 3', title: 'Edfu & sailing south', description: 'Temple of Horus at Edfu by carriage, then a relaxed sailing afternoon toward Kom Ombo.' },
      { day: 'Day 4', title: 'New Year\'s Eve gala', description: 'Sunset visit to Kom Ombo dual temple, followed by the gala dinner and midnight countdown on board.' },
      { day: 'Day 5-6', title: 'Aswan & Philae', description: 'High Dam, unfinished obelisk, island Temple of Philae, and felucca sailing around Elephantine.' },
      { day: 'Day 7-8', title: 'Farewell & disembark', description: 'Slow final morning on the river, disembarkation, and onward transfer.' },
    ],
    included: ['7-night full-board Nile cruise', 'New Year\'s Eve gala dinner on board', 'Guided shore visits per program', 'Port transfers in Luxor and Aswan'],
    excluded: ['International and domestic flights', 'Egypt entry visa', 'Drinks beyond meals and personal expenses', 'Crew and guide tips'],
    addOns: [{ title: 'Abu Simbel extension' }, { title: 'Cabin upgrade to suite' }, { title: 'Cairo stopover package' }],
  },
  { title: 'Cairo Jazz Festival Escape', slug: 'cairo-jazz-festival', image: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1800&q=88', date: 'October 15-18, 2026', location: 'Cairo', category: 'Music & city break', copy: 'Pair the city\'s best music weekend with a curated Cairo cultural escape.', intro: 'A four-day Cairo break where live music leads the rhythm and private cultural visits reveal the city between the opening and closing performances.',
    highlights: [
      { title: 'Festival nights', description: 'A hosted music weekend built around the listed opening, headline, and closing concerts.' },
      { title: 'Cairo between sets', description: 'Use the daytime for the Citadel, historic streets, and a guided visit to the Giza Plateau.' },
      { title: 'A coordinated city escape', description: 'Private transfers and a local host connect the concert schedule with the cultural program.' },
    ],
    program: [
      { day: 'Day 1', title: 'Arrival & opening night', description: 'Settle in, then head out for the festival opening concert with a local host.' },
      { day: 'Day 2', title: 'Concerts & the Citadel', description: 'Daytime visit to the Citadel and historic streets, evening headline concerts.' },
      { day: 'Day 3', title: 'Pyramids day & closing concert', description: 'Morning at the Giza Plateau and Sphinx, farewell evening at the festival closing show.' },
      { day: 'Day 4', title: 'Farewell', description: 'Slow morning, final market stroll, and departure transfer.' },
    ],
    included: ['Jazz festival passes for listed concerts', 'Private transfers with driver', 'Guided Giza pyramids visit', 'Local host throughout'],
    excluded: ['Accommodation and most meals', 'International flights and visa', 'Personal expenses', 'Tips'],
    addOns: [{ title: 'Nile dinner cruise' }, { title: 'Sound & Light show' }, { title: 'Extra Cairo night' }],
  },
]

export const offers: Offer[] = [
  { title: 'Stay longer, discover more', slug: 'stay-longer-discover-more', image: siteImages.nile, badge: 'Save 15%', copy: 'Add two nights to any multi-day itinerary and receive a special upgrade.', highlights: ['Two additional nights', 'A special journey upgrade', 'Made for multi-day itineraries'] },
  { title: 'Private family Egypt escape', slug: 'private-family-escape', image: siteImages.pyramids, badge: 'Family', copy: 'Complimentary airport transfer and a child-friendly Cairo experience.', highlights: ['Complimentary airport transfer', 'Child-friendly Cairo experience', 'Designed for private family travel'] },
  { title: 'Nile & Red Sea combination', slug: 'nile-red-sea-combination', image: siteImages.redSea, badge: 'Limited', copy: 'Combine an iconic Nile cruise with a relaxed beach stay.', highlights: ['Iconic Nile cruise', 'Relaxed Red Sea stay', 'One coordinated itinerary'] },
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
