import { CRUISE_HERO_IDS } from './compact-hero-defaults'
import { SHOWCASE_PAGES } from './showcase-heroes'
// Verified route templates, not copies of dynamic source records.
export const heroCatalogue = [
  { id: 'guide', name: 'Egypt travel guide', route: '/egypt-travel-guide', group: 'Company & information', type: 'Editorial + page content', source: 'components/information-page.tsx', editor: '/admin/website-cms/hero-sections/guide', cms: true },
  { id: 'accessible', name: 'Accessible travel', route: '/accessible-travel', group: 'Company & information', type: 'Editorial + page content', source: 'components/information-page.tsx', editor: '/admin/website-cms/hero-sections/accessible', cms: true },
  { id: 'trips', name: 'All trips', route: '/trips', group: 'Tours & destinations', type: 'Catalogue introduction', source: 'components/trips-page.tsx', editor: '/admin/website-cms/hero-sections/trips', cms: true },
  ...CRUISE_HERO_IDS.map((id) => ({ id, ...SHOWCASE_PAGES[id], group: 'Tours & destinations', type: 'Cruise introduction', source: 'components/site.tsx', editor: '/admin/website-cms/hero-sections/' + id, cms: true as const })),
  { id: 'homepage', name: 'Homepage', route: '/', group: 'Homepage', type: 'Search hero', source: 'components/homepage.tsx', editor: '/admin/website-cms/hero-sections/homepage', cms: true },
  { id: 'about', name: 'About company', route: '/about', group: 'Company & information', type: 'Showcase', source: 'components/about-page.tsx', editor: '/admin/website-cms/hero-sections/about', cms: true },
  { id: 'contact', name: 'Contact', route: '/contact', group: 'Company & information', type: 'Showcase', source: 'components/extended-pages.tsx', editor: '/admin/website-cms/hero-sections/contact', cms: true },
  { id: 'destinations', name: 'Destinations', route: '/destinations', group: 'Tours & destinations', type: 'Editorial', source: 'components/extended-pages.tsx', editor: '/admin/website-cms/hero-sections/destinations', cms: true },
  { id: 'blogs', name: 'Blogs', route: '/blogs', group: 'Content', type: 'Showcase', source: 'components/extended-pages.tsx', editor: '/admin/website-cms/hero-sections/blogs', cms: true },
  { id: 'events', name: 'Events', route: '/events', group: 'Events & cars', type: 'Events hero', source: 'components/extended-pages.tsx', editor: '/admin/website-cms/hero-sections/events', cms: true },
  { id: 'cars', name: 'Rent cars', route: '/rent-car', group: 'Events & cars', type: 'Showcase', source: 'components/extended-pages.tsx', editor: '/admin/website-cms/hero-sections/cars', cms: true },
  { id: 'offers', name: 'Special offers', route: '/special-offers', group: 'Offers & marketing', type: 'Showcase', source: 'components/extended-pages.tsx', editor: '/admin/website-cms/hero-sections/offers', cms: true },
  { id: 'faq', name: 'FAQ', route: '/faq', group: 'Company & information', type: 'Editorial', source: 'components/extended-pages.tsx', editor: '/admin/website-cms/hero-sections/faq', cms: true },
  { id: 'one-day', name: 'One-day tours', route: '/egypt-tours/one-day-tours', group: 'Tours & destinations', type: 'Category showcase', source: 'components/site.tsx', editor: '/admin/website-cms/hero-sections/one-day', cms: true },
  { id: 'multi-day', name: 'Multi-day tours', route: '/egypt-tours/multi-days-tours', group: 'Tours & destinations', type: 'Category showcase', source: 'components/site.tsx', editor: '/admin/website-cms/hero-sections/multi-day', cms: true },
  { id: 'nile', name: 'Nile cruises', route: '/egypt-tours/nile-cruises', group: 'Tours & destinations', type: 'Category showcase', source: 'components/site.tsx', editor: '/admin/website-cms/hero-sections/nile', cms: true },
  { id: 'shore', name: 'Shore excursions', route: '/egypt-tours/shore-excursions', group: 'Tours & destinations', type: 'Category showcase', source: 'components/site.tsx', editor: '/admin/website-cms/hero-sections/shore', cms: true },
  { id: 'blog-detail', name: 'Blog articles', route: '/blogs/[slug]', group: 'Dynamic content', type: 'Editorial', source: 'components/extended-pages.tsx', editor: '/admin/blogs' },
  { id: 'tour-detail', name: 'Tour details (day tours and packages)', route: '/egypt-tours/[slug]', group: 'Dynamic content', type: 'Tour detail', source: 'components/tour-detail.tsx', editor: '/admin/trips' },
  { id: 'one-day-region', name: 'One-day destinations', route: '/egypt-tours/one-day-tours/[region]', group: 'Dynamic content', type: 'Destination introduction', source: 'components/site.tsx', editor: '/admin/destinations' },
  { id: 'multi-day-category', name: 'Multi-day categories', route: '/egypt-tours/multi-days-tours/[category]', group: 'Dynamic content', type: 'Category introduction', source: 'components/site.tsx', editor: '/admin/multi-day-categories' },
  { id: 'destination-detail', name: 'Destination stories', route: '/destinations/[slug]', group: 'Dynamic content', type: 'Destination hero', source: 'components/extended-pages.tsx', editor: '/admin/destinations' },
  { id: 'event-detail', name: 'Event details', route: '/events/[slug]', group: 'Dynamic content', type: 'Event hero', source: 'components/extended-pages.tsx', editor: '/admin/events' },
  { id: 'campaign-detail', name: 'Marketing campaigns', route: '/special-offers/[slug]', group: 'Dynamic content', type: 'Campaign hero', source: 'components/offer-campaigns.tsx', editor: '/admin/offers' },
] as const
