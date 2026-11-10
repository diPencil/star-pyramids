import { canMeasureLocation } from './tracking'
import { analyticsDataLayer, pushPublicInteraction, readTrackingGrants } from './tracking-browser'
import { isFunnelLead, isPublicTourId, parseBookingFunnelEvent, type BookingMeasurementGrants } from './leads/booking-measurement'

const NAV_PLACEMENTS = ['header', 'sticky_header', 'mobile_menu', 'footer'] as const
const DESTINATIONS = ['home', 'trips', 'tours', 'destinations', 'offers', 'blogs', 'events', 'rent_car', 'planner', 'contact', 'company', 'external'] as const
const SEARCH_PLACEMENTS = ['header', 'mobile_header', 'trips', 'tour_search'] as const
const CTA_IDS = ['hero_primary', 'hero_secondary', 'hero_rail', 'offer', 'shore_enquiry', 'booking_shortcut', 'ask_question', 'homepage_planner'] as const
const CONTACT_CHANNELS = ['whatsapp', 'email', 'phone', 'contact_page'] as const
const CONTACT_PLACEMENTS = [...NAV_PLACEMENTS, 'support_widget', 'tour_enquiry'] as const

type NavPlacement = typeof NAV_PLACEMENTS[number]
type Destination = typeof DESTINATIONS[number]

export type PublicInteraction =
  | { event: 'sp_navigation_click'; placement: NavPlacement; destination: Destination }
  | { event: 'sp_select_item'; itemId: string }
  | { event: 'sp_book_now_click'; itemId: string }
  | { event: 'sp_search_submit'; placement: typeof SEARCH_PLACEMENTS[number] }
  | { event: 'sp_cta_click'; ctaId: typeof CTA_IDS[number] }
  | { event: 'sp_contact_click'; channel: typeof CONTACT_CHANNELS[number]; placement: typeof CONTACT_PLACEMENTS[number] }
  | { event: 'sp_whatsapp_open'; placement: 'support_widget' }

export function queuePublicInteraction(browser: Window, environment: string | undefined, interaction: PublicInteraction): boolean {
  // Project only known fields. Callers cannot attach URLs, form data or labels.
  const { event } = interaction
  switch (event) {
    case 'sp_navigation_click':
      if (!NAV_PLACEMENTS.includes(interaction.placement) || !DESTINATIONS.includes(interaction.destination)) return false
      return pushPublicInteraction(browser, environment, { event, placement: interaction.placement, destination: interaction.destination })
    case 'sp_select_item':
      if (!isPublicTourId(interaction.itemId)) return false
      return pushPublicInteraction(browser, environment, { event, items: [{ item_id: interaction.itemId }], placement: 'tour_card' })
    case 'sp_book_now_click':
      if (!isPublicTourId(interaction.itemId)) return false
      return pushPublicInteraction(browser, environment, { event, item_id: interaction.itemId, placement: 'tour_detail' })
    case 'sp_search_submit':
      if (!SEARCH_PLACEMENTS.includes(interaction.placement)) return false
      return pushPublicInteraction(browser, environment, { event, placement: interaction.placement })
    case 'sp_cta_click':
      if (!CTA_IDS.includes(interaction.ctaId)) return false
      return pushPublicInteraction(browser, environment, { event, cta_id: interaction.ctaId })
    case 'sp_contact_click':
      if (!CONTACT_CHANNELS.includes(interaction.channel) || !CONTACT_PLACEMENTS.includes(interaction.placement)) return false
      return pushPublicInteraction(browser, environment, { event, channel: interaction.channel, placement: interaction.placement })
    case 'sp_whatsapp_open':
      if (interaction.placement !== 'support_widget') return false
      return pushPublicInteraction(browser, environment, { event, channel: 'whatsapp', placement: interaction.placement })
    default:
      return false
  }
}

export function queueBookingFunnelEvent(browser: Window, environment: string | undefined, input: unknown, grants?: BookingMeasurementGrants): boolean {
  const layer = analyticsDataLayer(browser, environment)
  if (!layer) return false
  const event = parseBookingFunnelEvent(input)
  if (!event) return false
  try {
    if (isFunnelLead(event)) {
      const current = readTrackingGrants(browser)
      if (!grants || grants.analytics !== current.analytics) return false
      layer.push({ ...event, ads_eligible: Boolean(grants.marketing && grants.marketing === current.marketing) })
    } else layer.push(event)
    return true
  } catch { return false }
}

export function trackPublicInteraction(interaction: PublicInteraction) {
  if (typeof window === 'undefined') return
  try {
    queuePublicInteraction(window, process.env.NODE_ENV, interaction)
  } catch { /* Measurement must not interrupt an interaction if a tag throws. */ }
}

const NAV_SECTIONS: Readonly<Record<string, Destination>> = {
  '': 'home', trips: 'trips', 'egypt-tours': 'tours', destinations: 'destinations',
  'special-offers': 'offers', blogs: 'blogs', events: 'events', 'rent-car': 'rent_car',
  'make-your-trip': 'planner', about: 'company', faq: 'company', 'egypt-travel-guide': 'company',
  'accessible-travel': 'company', privacy: 'company', terms: 'company',
}

export function navigationInteraction(href: string, currentOrigin: string, placement: NavPlacement): PublicInteraction | null {
  let target: URL
  try { target = new URL(href, currentOrigin) } catch { return null }
  if (target.username || target.password || href.startsWith('#')) return null
  if (target.protocol === 'mailto:' || target.protocol === 'tel:') {
    return { event: 'sp_contact_click', channel: target.protocol === 'mailto:' ? 'email' : 'phone', placement }
  }
  if (target.protocol !== 'https:' && target.protocol !== 'http:') return null
  if (target.hostname === 'wa.me' || target.hostname === 'api.whatsapp.com') {
    return { event: 'sp_contact_click', channel: 'whatsapp', placement }
  }
  if (target.origin !== currentOrigin) return { event: 'sp_navigation_click', destination: 'external', placement }
  if (target.pathname === '/contact' || target.pathname === '/contact/') {
    return { event: 'sp_contact_click', channel: 'contact_page', placement }
  }
  const section = target.pathname.split('/')[1]
  return Object.hasOwn(NAV_SECTIONS, section) ? { event: 'sp_navigation_click', destination: NAV_SECTIONS[section], placement } : null
}

export function trackPublicNavigation(target: EventTarget | null, placement: NavPlacement) {
  if (!(target instanceof Element)) return
  const href = target.closest('a')?.getAttribute('href')
  if (!href) return
  const interaction = navigationInteraction(href, window.location.origin, placement)
  if (interaction) trackPublicInteraction(interaction)
}

const PAGE_TITLES: Readonly<Record<string, string>> = {
  '/': 'Discover Egypt', '/trips': 'Egypt Trips', '/egypt-tours': 'Egypt Tours',
  '/destinations': 'Destinations', '/blogs': 'Travel Blog', '/events': 'Events',
  '/special-offers': 'Special Offers', '/rent-car': 'Rent a Car', '/about': 'About Us',
  '/accessible-travel': 'Accessible Travel', '/egypt-travel-guide': 'Egypt Travel Guide',
  '/faq': 'Frequently Asked Questions', '/privacy': 'Privacy Policy', '/terms': 'Terms and Conditions',
  '/make-your-trip': 'Plan Your Egypt Trip',
  '/contact': 'Contact Us', '/rent-car/request': 'Request a Car',
  '/cart': 'Cart',
  '/booking-confirmation': 'Booking Request Confirmation',
}

export function publicPageView(url: URL, environment: string | undefined) {
  if (!canMeasureLocation(url, environment)) return null
  const pathname = url.pathname.replace(/\/$/, '') || '/'
  const page = ['/make-your-trip', '/cart', '/booking-confirmation'].includes(pathname) ? 0 : Number(url.searchParams.get('page'))
  const pagePath = page > 1 ? `${pathname}?page=${page}` : pathname
  // A committed route provides a stable public title even when Next streams
  // metadata after the navigation or the previous document title is still set.
  const label = PAGE_TITLES[pathname] ?? pathname.split('/').at(-1)!.split('-').map(word => word[0].toUpperCase() + word.slice(1)).join(' ')
  return {
    event: 'sp_page_view',
    page_path: pagePath,
    page_location: url.origin + pagePath,
    page_title: `${label.slice(0, 150)} | STAR PYRAMIDS`,
  } as const
}

type PageCommit = { pathname: string | null; search: string; enabled: boolean; restored?: boolean }

export function createPageViewTracker() {
  let location: string | undefined
  let sent = false
  return (browser: Window, environment: string | undefined, { pathname, search, enabled, restored }: PageCommit): boolean => {
    const current = new URL(browser.location.href)
    if (current.pathname !== pathname || current.searchParams.toString() !== search) return false
    const view = publicPageView(current, environment)
    if (restored || location !== view?.page_location) {
      location = view?.page_location
      sent = false
    }
    if (!view || sent || !enabled) return false
    const layer = analyticsDataLayer(browser, environment)
    if (!layer) return false
    try { layer.push(view) } catch { return false }
    sent = true
    return true
  }
}
