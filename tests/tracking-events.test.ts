import { randomUUID } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { GTM_CONSENT_READY_EVENT, initializeGtm, isGtmReady, readTrackingGrants } from '@/lib/tracking/tracking-browser'
import { createPageViewTracker, navigationInteraction, publicPageView, queueBookingFunnelEvent, queuePublicInteraction, type PublicInteraction } from '@/lib/tracking/tracking-events'
import { TRACKING_CONSENT_STORAGE_KEY } from '@/lib/tracking/tracking'

const origin = 'https://starpyramids.com'
const denied = { analytics: false, marketing: false }
const granted = { analytics: true, marketing: false }

describe('checkout continuation click', () => {
  const interaction = { event: 'sp_checkout_continue' } as const

  it('pushes only the event name for an eligible, consenting summary', () => {
    const page = fixture('/checkout')
    const input = { ...interaction, email: 'private@example.test', total: 500 }
    expect(queuePublicInteraction(page.browser, 'production', input)).toBe(true)
    expect(page.dataLayer).toEqual([interaction])
    page.applyConsent(denied)
    expect(queuePublicInteraction(page.browser, 'production', interaction)).toBe(false)
  })

  it.each(['/cart', '/checkout/details', '/checkout?token=private', '/checkout#private'])('blocks the event on %s', path => {
    const page = fixture(path)
    expect(queuePublicInteraction(page.browser, 'production', interaction)).toBe(false)
    expect(page.dataLayer).toEqual([])
  })

  it('does not dispatch with Marketing-only consent or in development', () => {
    const marketingOnly = fixture('/checkout', { analytics: false, marketing: true })
    const page = fixture('/checkout')
    expect(queuePublicInteraction(marketingOnly.browser, 'production', interaction)).toBe(false)
    expect(queuePublicInteraction(page.browser, 'development', interaction)).toBe(false)
    expect(marketingOnly.dataLayer).toEqual([])
    expect(page.dataLayer).toEqual([])
  })

  it('dispatches a buffered click once when GTM becomes ready on the summary', () => {
    const page = fixture('/checkout', granted, 'GTM-KQ8GR36H', false)
    expect(queuePublicInteraction(page.browser, 'production', interaction)).toBe(true)
    expect(page.dataLayer).toEqual([])
    page.ready()
    page.ready()
    expect(page.dataLayer.filter(entry => (entry as { event?: string }).event === interaction.event)).toEqual([interaction])
  })

  it('drops a buffered click when consent is withdrawn or the page becomes private', () => {
    const withdrawn = fixture('/checkout', granted, 'GTM-KQ8GR36H', false)
    const privatePage = fixture('/checkout', granted, 'GTM-KQ8GR36H', false)
    expect(queuePublicInteraction(withdrawn.browser, 'production', interaction)).toBe(true)
    expect(queuePublicInteraction(privatePage.browser, 'production', interaction)).toBe(true)
    withdrawn.applyConsent(denied)
    privatePage.location.href = origin + '/checkout/details'
    for (const page of [withdrawn, privatePage]) {
      page.ready()
      expect(page.dataLayer).not.toContainEqual(interaction)
    }
  })
})

describe('WhatsApp interaction privacy and eligibility', () => {
  it('projects widget open and contact handoff without any message, phone or URL', () => {
    const page = fixture('/trips')
    const extra = { message: 'private text', phone: '+12025550123', url: 'https://wa.me/123?text=private' }
    expect(queuePublicInteraction(page.browser, 'production', { event: 'sp_whatsapp_open', placement: 'support_widget', ...extra } as PublicInteraction)).toBe(true)
    expect(queuePublicInteraction(page.browser, 'production', { event: 'sp_contact_click', channel: 'whatsapp', placement: 'support_widget', ...extra } as PublicInteraction)).toBe(true)
    expect(page.dataLayer).toEqual([
      { event: 'sp_whatsapp_open', channel: 'whatsapp', placement: 'support_widget' },
      { event: 'sp_contact_click', channel: 'whatsapp', placement: 'support_widget' },
    ])
  })
  it('rejects unsupported widget-open placements', () => {
    const page = fixture('/trips')
    expect(queuePublicInteraction(page.browser, 'production', { event: 'sp_whatsapp_open', placement: 'private' } as unknown as PublicInteraction)).toBe(false)
    expect(page.dataLayer).toEqual([])
  })
  it.each([denied, { analytics: false, marketing: true }])('requires Analytics consent even when Marketing is %s', choice => {
    const page = fixture('/trips', choice)
    expect(queuePublicInteraction(page.browser, 'production', { event: 'sp_whatsapp_open', placement: 'support_widget' })).toBe(false)
    expect(queuePublicInteraction(page.browser, 'production', { event: 'sp_contact_click', channel: 'whatsapp', placement: 'support_widget' })).toBe(false)
    expect(page.dataLayer).toEqual([])
  })
  it('blocks private URLs, development hosts and withdrawn consent', () => {
    const page = fixture('/trips')
    for (const href of [origin + '/account', origin + '/trips?token=private', 'http://localhost:3000/trips']) {
      page.location.href = href
      expect(queuePublicInteraction(page.browser, 'production', { event: 'sp_whatsapp_open', placement: 'support_widget' })).toBe(false)
      expect(queuePublicInteraction(page.browser, 'production', { event: 'sp_contact_click', channel: 'whatsapp', placement: 'support_widget' })).toBe(false)
    }
    page.location.href = origin + '/trips'
    expect(queuePublicInteraction(page.browser, 'development', { event: 'sp_whatsapp_open', placement: 'support_widget' })).toBe(false)
    page.applyConsent(denied)
    expect(queuePublicInteraction(page.browser, 'production', { event: 'sp_contact_click', channel: 'whatsapp', placement: 'support_widget' })).toBe(false)
    expect(page.dataLayer.filter(entry => ['sp_whatsapp_open', 'sp_contact_click'].includes((entry as { event?: string }).event ?? ''))).toEqual([])
  })
  it('keeps startup events queued once, and drops them after withdrawal', () => {
    const page = fixture('/trips', granted, 'GTM-KQ8GR36H', false)
    expect(queuePublicInteraction(page.browser, 'production', { event: 'sp_whatsapp_open', placement: 'support_widget' })).toBe(true)
    expect(page.dataLayer).toEqual([])
    page.ready(); page.ready()
    expect(page.dataLayer.filter(entry => (entry as { event?: string }).event === 'sp_whatsapp_open')).toHaveLength(1)
    const withdrawn = fixture('/trips', granted, 'GTM-KQ8GR36H', false)
    queuePublicInteraction(withdrawn.browser, 'production', { event: 'sp_contact_click', channel: 'whatsapp', placement: 'support_widget' })
    withdrawn.applyConsent(denied); withdrawn.ready()
    expect(withdrawn.dataLayer.some(entry => (entry as { event?: string }).event === 'sp_contact_click')).toBe(false)
  })
})

it.each([
  ['/contact', 'contact_methods', 'email'],
  ['/contact', 'contact_methods', 'phone'],
  ['/contact', 'contact_methods', 'whatsapp'],
  ['/rent-car/request', 'car_request', 'whatsapp'],
  ['/events/cairo-event', 'event_organizer', 'email'],
  ['/events/cairo-event', 'event_organizer', 'phone'],
  ['/events/cairo-event', 'event_organizer', 'whatsapp'],
] as const)('projects %s contact clicks with only the approved channel and placement', (path, placement, channel) => {
  const page = fixture(path)
  const interaction = { event: 'sp_contact_click', placement, channel } as const
  expect(queuePublicInteraction(page.browser, 'production', { ...interaction, url: 'mailto:private@example.test' } as PublicInteraction)).toBe(true)
  expect(page.dataLayer).toEqual([interaction])
  page.applyConsent(denied)
  expect(queuePublicInteraction(page.browser, 'production', interaction)).toBe(false)
})

function fixture(path = '/', consent = granted, id: string | null = 'GTM-KQ8GR36H', autoReady = true) {
  const dataLayer: unknown[] = []
  const location = { href: origin + path }
  const script: { onload?: () => void } = {}
  const analytics = randomUUID()
  const save = (choice: typeof consent) => values.set(TRACKING_CONSENT_STORAGE_KEY, JSON.stringify({ ...choice, grants: { analytics } }))
  const values = new Map<string, string>()
  save(consent)
  const browser = Object.assign(new EventTarget(), {
    location,
    dataLayer,
    crypto: { randomUUID },
    localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value) },
      removeItem: (key: string) => { values.delete(key) },
    },
    document: { createElement: () => script, head: { appendChild: vi.fn() } },
  }) as unknown as Window
  const ready = () => { if (!isGtmReady(browser)) script.onload?.() }
  initializeGtm(browser, id, consent, 'production')
  if (autoReady) ready()
  dataLayer.length = 0
  return { browser, location, dataLayer, ready, applyConsent(choice: typeof consent) {
    save(choice)
    initializeGtm(browser, id, choice, 'production')
    if (autoReady) ready()
  } }
}

describe('public page views', () => {
  it('keeps public section navigation measured without duplicate page views or fragments', () => {
    const page = fixture('/contact')
    const observe = createPageViewTracker()
    const commit = { pathname: '/contact', search: '', enabled: true }
    expect(observe(page.browser, 'production', commit)).toBe(true)
    page.location.href = origin + '/contact#contact-enquiry'
    expect(observe(page.browser, 'production', commit)).toBe(false)
    expect(page.dataLayer).toEqual([{ event: 'sp_page_view', page_path: '/contact', page_location: origin + '/contact', page_title: 'Contact Us | STAR PYRAMIDS' }])
    expect(queuePublicInteraction(page.browser, 'production', { event: 'sp_cta_click', ctaId: 'hero_primary' })).toBe(true)
    page.location.href = origin + '/contact#private-token'
    expect(queuePublicInteraction(page.browser, 'production', { event: 'sp_cta_click', ctaId: 'hero_primary' })).toBe(false)
    expect(JSON.stringify(page.dataLayer)).not.toContain('#')
  })
  it('counts the sanitized cart once and blocks private checkout transitions', () => {
    const page = fixture('/cart?gtm_debug=x&page=2')
    const observe = createPageViewTracker()
    const commit = { pathname: '/cart', search: 'gtm_debug=x&page=2', enabled: true }
    expect(observe(page.browser, 'production', commit)).toBe(true)
    expect(observe(page.browser, 'production', commit)).toBe(false)
    expect(page.dataLayer).toEqual([{ event: 'sp_page_view', page_path: '/cart', page_location: `${origin}/cart`, page_title: 'Cart | STAR PYRAMIDS' }])
    page.location.href = origin + '/checkout/details'
    expect(observe(page.browser, 'production', { pathname: '/checkout/details', search: '', enabled: true })).toBe(false)
    expect(page.dataLayer).toHaveLength(1)
  })
  it('uses a fixed planner title and canonical URL without dates, source or guest counts', () => {
    expect(publicPageView(new URL(`${origin}/make-your-trip?from=2026-11-27&to=2026-11-30&guests=2&utm_source=google`), 'production'))
      .toEqual({ event: 'sp_page_view', page_path: '/make-your-trip', page_location: `${origin}/make-your-trip`, page_title: 'Plan Your Egypt Trip | STAR PYRAMIDS' })
  })
  it('does not send the Tag Assistant signal or count it as another page view', () => {
    const page = fixture('/trips?gtm_debug=1794000000000')
    const observe = createPageViewTracker()
    expect(observe(page.browser, 'production', { pathname: '/trips', search: 'gtm_debug=1794000000000', enabled: true })).toBe(true)
    expect(page.dataLayer.at(-1)).toMatchObject({ event: 'sp_page_view', page_path: '/trips', page_location: `${origin}/trips` })
    page.location.href = `${origin}/trips?gtm_debug=x`
    expect(observe(page.browser, 'production', { pathname: '/trips', search: 'gtm_debug=x', enabled: true })).toBe(false)
    expect(JSON.stringify(page.dataLayer)).not.toContain('gtm_debug')
  })
  it('can report an initial page view once the container has applied the current consent', () => {
    const page = fixture('/', granted, 'GTM-TEST', false)
    const observe = createPageViewTracker()
    const commit = { pathname: '/', search: '', enabled: true }
    expect(observe(page.browser, 'production', commit)).toBe(false)
    page.ready()
    expect(observe(page.browser, 'production', commit)).toBe(true)
    expect(observe(page.browser, 'production', commit)).toBe(false)
    expect(page.dataLayer.at(-1)).toMatchObject({ event: 'sp_page_view', page_path: '/' })
  })
  it('uses the committed public tour and pagination, omitting campaign and filter parameters', () => {
    expect(publicPageView(new URL(`${origin}/egypt-tours/full-day-cairo/?gclid=click&utm_source=google&utm_campaign=Cairo+Summer&page=2&sort=Recommended`), 'production')).toEqual({
      event: 'sp_page_view',
      page_path: '/egypt-tours/full-day-cairo?page=2',
      page_location: `${origin}/egypt-tours/full-day-cairo?page=2`,
      page_title: 'Full Day Cairo | STAR PYRAMIDS',
    })
  })

  it.each(['/search?q=private', '/trips?q=private', '/booking/private', '/account', '/trips#private', '/trips?token=private'])(
    'does not create a payload for %s', path => {
      expect(publicPageView(new URL(origin + path), 'production')).toBeNull()
    },
  )

  it('counts committed navigation, pagination and back/forward without rerender or filter duplicates', () => {
    const { browser, location, dataLayer } = fixture('/trips')
    const observe = createPageViewTracker()
    const commit = (pathname: string, search = '', enabled = true) => observe(browser, 'production', { pathname, search, enabled })
    expect(commit('/trips', '', false)).toBe(false)
    expect(commit('/trips')).toBe(true)
    expect(commit('/trips')).toBe(false)
    location.href = `${origin}/trips?price=under-200&gclid=click&utm_source=google`
    expect(commit('/trips', 'price=under-200&gclid=click&utm_source=google')).toBe(false)
    location.href = `${origin}/trips?page=2`
    expect(commit('/trips')).toBe(false) // Router has not committed the query yet.
    expect(commit('/trips', 'page=2')).toBe(true)
    location.href = `${origin}/egypt-tours/full-day-cairo`
    expect(commit('/trips', 'page=2')).toBe(false)
    expect(commit('/egypt-tours/full-day-cairo')).toBe(true)
    location.href = `${origin}/trips?page=2`
    expect(commit('/trips', 'page=2')).toBe(true)
    location.href = `${origin}/egypt-tours/full-day-cairo`
    expect(commit('/egypt-tours/full-day-cairo')).toBe(true)
    expect(dataLayer.map(value => (value as { page_path: string }).page_path)).toEqual([
      '/trips', '/trips?page=2', '/egypt-tours/full-day-cairo', '/trips?page=2', '/egypt-tours/full-day-cairo',
    ])
  })

  it('honors late consent, withdrawal and a browser back/forward cache restoration', () => {
    const { browser, dataLayer, applyConsent } = fixture('/', denied)
    const observe = createPageViewTracker()
    const commit = { pathname: '/', search: '', enabled: true }
    expect(observe(browser, 'production', commit)).toBe(false)
    applyConsent(granted)
    expect(observe(browser, 'production', commit)).toBe(true)
    expect(observe(browser, 'production', { ...commit, restored: true })).toBe(true)
    applyConsent(denied)
    expect(observe(browser, 'production', { ...commit, restored: true })).toBe(false)
    expect(dataLayer.filter(value => (value as { event?: string }).event === 'sp_page_view')).toHaveLength(2)
  })
})

describe('public interaction events', () => {
  it('keeps consented startup clicks outside GTM until ready and drops them on withdrawal', () => {
    const interaction = { event: 'sp_search_submit', placement: 'header' } as const
    const first = fixture('/', granted, 'GTM-TEST', false)
    expect(queuePublicInteraction(first.browser, 'production', interaction)).toBe(true)
    expect(first.dataLayer).not.toContainEqual(interaction)
    first.ready()
    expect(first.dataLayer.at(-1)).toEqual(interaction)

    const second = fixture('/', granted, 'GTM-TEST', false)
    expect(queuePublicInteraction(second.browser, 'production', interaction)).toBe(true)
    second.applyConsent(denied)
    second.applyConsent(granted)
    second.ready()
    expect(second.dataLayer).not.toContainEqual(interaction)
  })
  it('projects only event-specific fields and emits a GA4-compatible item array for card selections', () => {
    const { browser, dataLayer } = fixture('/trips')
    const inputs: PublicInteraction[] = [
      { event: 'sp_navigation_click', placement: 'mobile_menu', destination: 'trips' },
      { event: 'sp_select_item', itemId: 'full-day-cairo' },
      { event: 'sp_search_submit', placement: 'header' },
      { event: 'sp_cta_click', ctaId: 'offer' },
      { event: 'sp_contact_click', channel: 'whatsapp', placement: 'support_widget' },
    ]
    for (const input of inputs) {
      expect(queuePublicInteraction(browser, 'production', { ...input, searchText: 'private', email: 'person@example.com' } as PublicInteraction)).toBe(true)
    }
    expect(dataLayer).toEqual([
      { event: 'sp_navigation_click', placement: 'mobile_menu', destination: 'trips' },
      { event: 'sp_select_item', items: [{ item_id: 'full-day-cairo' }], placement: 'tour_card' },
      { event: 'sp_search_submit', placement: 'header' },
      { event: 'sp_cta_click', cta_id: 'offer' },
      { event: 'sp_contact_click', channel: 'whatsapp', placement: 'support_widget' },
    ])
  })

  it('drops contact addresses, link parameters and private destinations', () => {
    expect(navigationInteraction('/trips?q=private', origin, 'header')).toEqual({ event: 'sp_navigation_click', destination: 'trips', placement: 'header' })
    expect(navigationInteraction('https://wa.me/123456?text=private', origin, 'footer')).toEqual({ event: 'sp_contact_click', channel: 'whatsapp', placement: 'footer' })
    expect(navigationInteraction('mailto:person@example.com', origin, 'footer')).toEqual({ event: 'sp_contact_click', channel: 'email', placement: 'footer' })
    expect(navigationInteraction('/contact?ref=private', origin, 'header')).toEqual({ event: 'sp_contact_click', channel: 'contact_page', placement: 'header' })
    expect(navigationInteraction('/booking/private', origin, 'header')).toBeNull()
    expect(navigationInteraction('javascript:void(0)', origin, 'header')).toBeNull()
  })

  it('requires an active container, analytics consent, a production host and an eligible current URL', () => {
    const action = { event: 'sp_search_submit', placement: 'header' } as const
    const { browser, location, dataLayer, applyConsent } = fixture('/', denied)
    expect(queuePublicInteraction(browser, 'production', action)).toBe(false)
    applyConsent({ analytics: false, marketing: true })
    expect(queuePublicInteraction(browser, 'production', action)).toBe(false)
    applyConsent(granted)
    expect(queuePublicInteraction(browser, 'test', action)).toBe(false)
    location.href = 'https://qa.starpyramids.com/trips'
    expect(queuePublicInteraction(browser, 'production', action)).toBe(false)
    location.href = `${origin}/trips?q=private`
    expect(queuePublicInteraction(browser, 'production', action)).toBe(false)
    location.href = `${origin}/trips`
    expect(queuePublicInteraction(browser, 'production', { event: 'sp_select_item', itemId: 'person@example.com' })).toBe(false)
    expect(queuePublicInteraction(browser, 'production', action)).toBe(true)
    applyConsent(denied)
    expect(queuePublicInteraction(browser, 'production', action)).toBe(false)
    const disabled = fixture('/', granted, null)
    expect(queuePublicInteraction(disabled.browser, 'production', action)).toBe(false)
    expect(dataLayer.filter(value => {
      const { event } = value as { event?: string }
      return event?.startsWith('sp_') && event !== GTM_CONSENT_READY_EVENT
    })).toEqual([action])
  })

  it('blocks all application dispatchers on sensitive URLs after GTM has loaded', () => {
    const { browser, location, dataLayer, ready } = fixture('/trips')
    ready()
    expect(isGtmReady(browser)).toBe(true)
    const observe = createPageViewTracker()
    const addToCart = {
      event: 'sp_add_to_cart', event_id: 'f_aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      items: [{ item_id: 'cairo-tour', quantity: 1 }],
    }
    for (const path of ['/trips#token=private', '/trips?token=private', '/booking/private']) {
      const url = new URL(path, origin)
      location.href = url.href
      expect(observe(browser, 'production', { pathname: url.pathname, search: url.searchParams.toString(), enabled: true })).toBe(false)
      expect(queuePublicInteraction(browser, 'production', { event: 'sp_search_submit', placement: 'header' })).toBe(false)
      expect(queueBookingFunnelEvent(browser, 'production', addToCart, { analytics: readTrackingGrants(browser).analytics! })).toBe(false)
    }
    expect(dataLayer).toEqual([])
    location.href = origin + '/trips'
    expect(queueBookingFunnelEvent(browser, 'production', addToCart, { analytics: readTrackingGrants(browser).analytics! })).toBe(true)
  })
})
