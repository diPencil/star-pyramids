import { heroCatalogue } from './hero-catalogue'
import { HOME_SECTIONS } from './page-sections'
import { CRUISE_HERO_IDS } from './compact-hero-defaults'
import { isTemplatePageId, templateSections } from './template-presentation'

export type CoverageOwner = 'cms' | 'business' | 'functional' | 'uncovered'
export type CoverageSection = { id: string; name: string; owner: CoverageOwner; editor?: string; note?: string }
export type CmsPageDefinition = { key: string; name: string; route: string; pattern?: string; group: string; type: string; source: string; inventory: 'verified' | 'partial'; sections: CoverageSection[] }
const body = (id: string, name: string, owner: CoverageOwner, editor?: string): CoverageSection => ({ id, name, owner, ...(editor ? { editor } : {}) })
const listing = (editor: string): CoverageSection[] => [body('filters', 'Catalogue navigation, filtering and request controls', 'functional'), body('catalogue', 'Catalogue records', 'business', editor), { ...body('presentation', 'Functional catalogue chrome', 'functional'), note: 'Inspected source: hero presentation has its CMS editor; remaining counts, filtering, result states and pagination are functional UI, not a second marketing body.' }]
const pageBodies: Record<string, CoverageSection[]> = {
  about: [body('destinations', 'Destination marquee records', 'business', '/admin/destinations')],
  contact: [body('form', 'Enquiry submission, validation and abuse prevention', 'functional'), body('contact', 'Contact channel values', 'business', '/admin/settings')],
  faq: [body('intro', 'FAQ introduction', 'cms', '/admin/website-cms/pages/faq'), body('questions', 'FAQ questions and answers', 'cms', '/admin/website-cms/pages/faq')],
  guide: [body('topics', 'Travel guide topics, order and translations', 'cms', '/admin/website-cms/hero-sections/guide'), body('help', 'Contact CTA', 'cms', '/admin/website-cms/pages/guide')],
  accessible: [body('topics', 'Assistance sections, order and translations', 'cms', '/admin/website-cms/hero-sections/accessible'), body('help', 'Contact CTA', 'cms', '/admin/website-cms/pages/accessible')],
  destinations: listing('/admin/destinations'), blogs: listing('/admin/blogs'), events: listing('/admin/events'), cars: listing('/admin/cars'), offers: listing('/admin/offers'),
}
const dynamicEditors: Record<string, string> = { 'blog-detail': '/admin/blogs', 'tour-detail': '/admin/trips', 'destination-detail': '/admin/destinations', 'event-detail': '/admin/events', 'campaign-detail': '/admin/offers', 'one-day-region': '/admin/destinations', 'multi-day-category': '/admin/multi-day-categories' }
const functionalRoutes = [
  ['privacy', 'Privacy policy', '/privacy', 'app/privacy/page.tsx', true], ['terms', 'Terms of use', '/terms', 'app/terms/page.tsx', true],
  ['search', 'Site search', '/search', 'components/extended-pages.tsx'], ['planner', 'Make Your Trip', '/make-your-trip', 'app/make-your-trip/page.tsx'],
  ['car-request', 'Car request', '/rent-car/request', 'components/extended-pages.tsx'], ['cart', 'Trip cart', '/cart', 'app/cart/page.tsx'], ['checkout', 'Checkout', '/checkout', 'app/checkout/page.tsx'],
  ['login', 'Sign in', '/login', 'components/auth-pages.tsx'], ['register', 'Registration', '/register', 'components/auth-pages.tsx'], ['forgot-password', 'Password recovery', '/forgot-password', 'components/extended-pages.tsx'], ['reset-password', 'Password reset', '/reset-password', 'app/reset-password/page.tsx'],
  ['guest-booking', 'Guest booking access', '/booking/[token]', 'app/booking/[token]/page.tsx'], ['voucher', 'Voucher verification', '/verify-voucher/[token]', 'app/verify-voucher/[token]/page.tsx'],
] as const
const accountRoutes = ['', '/profile', '/bookings', '/bookings/detail', '/favorites', '/change-password', '/payments', '/payments/detail', '/car-requests', '/car-requests/detail', '/event-requests', '/event-requests/detail', '/trip-requests', '/trip-requests/detail', '/messages', '/settings']
function sectionsForHero(hero: typeof heroCatalogue[number]): CoverageSection[] {
  if (hero.id === 'homepage') return HOME_SECTIONS.map(section => ({ id: section.id, name: section.name, owner: 'cms', editor: section.id === 'hero' ? section.editor : '/admin/website-cms/pages/homepage' }))
  if (isTemplatePageId(hero.id)) {
    const editor = '/admin/website-cms/pages/' + hero.id
    const sections: CoverageSection[] = templateSections(hero.id).map(section => ({ id: section.id, name: section.name, owner: section.id === 'hero' && dynamicEditors[hero.id] ? 'business' : 'cms', editor: section.id === 'hero' ? hero.editor : editor, note: section.mandatory ? 'Required functional structure stays visible; registered presentation fields remain editable.' : 'Published presentation is rendered by the original component; business records remain in their original source.' }))
    if (dynamicEditors[hero.id]) sections.push(body('booking', 'Booking/enquiry controls and contractual labels', 'functional'))
    else sections.push(...(pageBodies[hero.id] ?? []).filter(section => section.owner === 'business' || section.owner === 'functional' && section.id !== 'presentation'))
    if (hero.id === 'about') sections.push(body('help', 'Shared trip-help enquiry presentation', 'cms', '/admin/website-cms/pages/shared'))
    return sections
  }
  if (dynamicEditors[hero.id]) return [body('record', 'Original record content and hero', 'business', dynamicEditors[hero.id]), { ...body('presentation', 'Fixed template interface labels', 'functional'), note: 'Inspected components/site.tsx, tour-detail.tsx and day-tour-detail.tsx: itinerary, story and imagery belong to original records; remaining tabs, booking, pricing, availability, filters and contractual labels stay fixed.' }, body('booking', 'Existing booking/enquiry interactions', 'functional')]
  return [body('hero', 'Hero', 'cms', hero.editor), ...(pageBodies[hero.id] ?? listing('/admin/trips'))]
}
export const cmsPageRegistry: CmsPageDefinition[] = [
  ...heroCatalogue.map((hero): CmsPageDefinition => ({ key: hero.id, name: hero.name, route: hero.route, group: hero.group, type: hero.type, source: hero.source, inventory: 'verified', sections: sectionsForHero(hero) })),
  ...functionalRoutes.map(([key, name, route, source, legal]): CmsPageDefinition => ({ key, name, route, source, group: legal ? 'Policies' : 'Functional pages', type: legal ? 'Legal information' : 'Application workflow', inventory: 'verified', sections: [body('content', legal ? 'Owner-approved policy content (original placeholder retained until publication)' : 'Functional application content', legal ? 'cms' : 'functional', legal ? '/admin/website-cms/pages/' + key : undefined)] })),
  ...accountRoutes.map((suffix): CmsPageDefinition => ({ key: 'account' + suffix.replaceAll('/', '-'), name: 'Customer account' + (suffix ? ': ' + suffix.slice(1).replaceAll('/', ' / ') : ''), route: '/account' + suffix, source: 'app/account' + suffix + '/page.tsx', group: 'Customer account', type: 'Authenticated workflow', inventory: 'verified', sections: [body('account', 'Account data, forms and permissions', 'functional')] })),
]
export function findCmsPage(key: string) { return cmsPageRegistry.find((page) => page.key === key) }
export function cmsRoutePattern(page: CmsPageDefinition) { return (CRUISE_HERO_IDS as readonly string[]).includes(page.key) ? '/egypt-tours/nile-cruises/[type]' : page.pattern ?? page.route }
export const cmsSharedRegistry: CoverageSection[] = [
  body('brand', 'Header logo, favicon and brand settings', 'business', '/admin/settings'),
  body('navigation', 'Navigation routes, search and account controls', 'functional'),
  body('nav-labels', 'Localized navigation labels', 'cms', '/admin/website-cms/pages/shared'),
  body('footer-company', 'Footer description, copyright and contact details', 'business', '/admin/settings'),
  body('footer-labels', 'Localized footer navigation and certification labels', 'cms', '/admin/website-cms/pages/shared'),
  body('top-promos', 'Top promotional bars', 'business', '/admin/offers'),
  body('footer-promos', 'Footer promotional bars', 'business', '/admin/offers'),
  body('review-feeds', 'Review sources and moderation', 'business', '/admin/reviews'),
  body('journey-assets', 'Journey gallery items', 'business', '/admin/gallery'),
  body('support', 'Support widgets and contact channels', 'business', '/admin/settings'),
  body('help-cta', 'Shared help CTA presentation; enquiry submission stays functional', 'cms', '/admin/website-cms/pages/shared'),
]
export function coverageCounts() {
  const sections = cmsPageRegistry.flatMap((page) => page.sections)
  return { pages: cmsPageRegistry.length, manageable: cmsPageRegistry.filter((page) => page.sections.some((section) => section.owner === 'cms' || section.owner === 'business')).length, routePatterns: new Set(cmsPageRegistry.map(cmsRoutePattern)).size, sections: sections.length, cms: sections.filter((s) => s.owner === 'cms').length, business: sections.filter((s) => s.owner === 'business').length, functional: sections.filter((s) => s.owner === 'functional').length, uncovered: sections.filter((s) => s.owner === 'uncovered').length, partialInventories: cmsPageRegistry.filter((page) => page.inventory === 'partial').length, shared: cmsSharedRegistry.length, sharedUncovered: cmsSharedRegistry.filter((section) => section.owner === 'uncovered').length }
}
