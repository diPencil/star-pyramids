'use client'
import { NavigationMenu } from './navigation-menu'
import { usePublishedNavigation } from './navigation-context'
import { useMarketingNotifications } from '@/lib/marketing-notifications-client'
import { localizedNotification } from '@/lib/marketing-notifications'
import { useShowcaseHero } from './showcase-hero-context'
import { useSharedCopy } from './presentation-content-context'
import { SharedHelpCTA } from './shared-help-cta'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useRef, useState, type MouseEvent as CardMouseEvent } from 'react'
import { ChevronDown, Globe2, Heart, Home, Compass, CalendarCheck, Menu, Search, Share2, ShoppingCart, X, ArrowRight, ArrowUp, Check, MapPin, Clock3, Users, CarFront, Mail, Phone, Star, Sun, Ship, Anchor, Package, Ticket, BadgePercent, Accessibility, BadgeCheck, Gift, Bell, Sparkles, UserRound, LayoutDashboard } from 'lucide-react'
import { blogs, cars, destinations, events, faqs, offers, siteImages, policies, findBlog, findCar, findDestination, findEvent, findOffer } from '@/data/content'
import { assignableOneDayTours, catalogTours, getCruiseTypeBySlug, getMultiDayToursForCategory, getOneDayToursForDestination, getPublishedMultiDayCategories, getPublishedOneDayDestinations, getToursByCategory, multiDayCategories, seasonalTours, tourCategories, tourImages } from '@/data/tours'
import { matchPriceBand, parseTourListingQuery, tourListingSorts, tourPriceBands, type TourListingQuery } from '@/lib/query'
import { localizeTourDuration, localizeTourLocation } from '@/lib/tour-format'
import { COMPANY_ADDRESS, phoneHref, whatsappHref } from '@/data/company'
import { useBrandSettings } from '@/lib/admin-store'
import { useDbOffers } from '@/lib/offers-blogs-client'
import { campaignCtaHref, placedOffers, readCampaign, toTopBarSlides } from '@/lib/marketing-campaigns'
import { BarIcons } from './promo-bar-icons'
import { DEFAULT_ACCESS_ICON } from '@/lib/promo-bar-defaults'
import { useDbCategories, useDbDestinations } from '@/lib/catalogue-client'
import { useDbTours } from '@/lib/tours-client'
import { useCart } from '@/lib/cart'
import { useCustomerFavorites } from '@/lib/customer-account'
import type { Tour, TourCategory, TourVariant } from '@/data/types'
import { LocaleProvider, tx, useLocale, formatPrice, type Locale, type Currency } from './locale'
import { LiveChatWidget } from './live-chat'
import { WhatsAppGlyph, WhatsAppWidget } from './whatsapp-chat'
import { FooterSocials, HeaderSocials } from './social-icons'
import { LanguageModal, LanguageToggle } from './language-selector'
import { LOCALE_SHORT_LABELS, pickLocaleText } from '@/lib/locale-config'
import { InternationalPhoneInput } from './international-phone-input'
import { CountrySelect } from './country-select'
import { SharedSelect } from './shared-select'
import { defaultCountry } from '@/data/countries'
import { DateInput } from './date-input'
import { useCurrentUser } from '@/lib/use-current-user'
import type { AuthenticatedUser } from '@/lib/auth-types'

export const images = tourImages

const oneDayTourBase = assignableOneDayTours
const multiDayTourBase = getToursByCategory('multi-days-tours')

import { copy, extra } from '@/lib/site-copy'
export { extra } from '@/lib/site-copy'



export function Logo(){const brand=useBrandSettings(); return <Link href="/" className="brand-logo" aria-label="STAR PYRAMIDS Tours Egypt"><img className="brand-img" src={brand.logo || '/logo.png'} alt="STAR PYRAMIDS Tours Egypt"/></Link>}

export function NotificationDropdown({ locale, onClose, state }: { locale: Locale; onClose: () => void; state: ReturnType<typeof useMarketingNotifications> }) {
  const { unreadCount, loading, error, busy, refresh, markRead, markAllRead } = state
  const items = state.items.map(item => localizedNotification(item, locale))
  return (
    <div className="notif-dropdown" role="dialog" aria-label="Notifications" onClick={e => e.stopPropagation()}>
      <div className="notif-head">
        <div className="notif-head-title">
          <h4>{tx(locale, { en: 'Notifications & Offers', es: 'Notificaciones y ofertas', it: 'Notifiche e offerte', ar: 'الإشعارات والعروض' })}</h4>
          {unreadCount > 0 && <span className="notif-count-badge">{unreadCount} {tx(locale, { en: 'new', es: 'nuevas', it: 'nuove', ar: 'جديد' })}</span>}
        </div>
        {unreadCount > 0 && (
          <button type="button" className="notif-mark-read" disabled={busy} onClick={() => { void markAllRead() }}>
            {tx(locale, { en: 'Mark all read', es: 'Marcar todo como leído', it: 'Segna tutto come letto', ar: 'تعيين الكل كمقروء' })}
          </button>
        )}
      </div>
      <div className="notif-list">
        {loading && <p role="status">{tx(locale, { en: 'Loading offers…', es: 'Cargando ofertas…', it: 'Caricamento offerte…' })}</p>}
        {error && <div role="alert"><p>{tx(locale, { en: 'Offers could not be updated. Please try again.', es: 'No se pudieron actualizar las ofertas. Inténtalo de nuevo.', it: 'Impossibile aggiornare le offerte. Riprova.' })}</p><button type="button" className="text-link" onClick={refresh}>{tx(locale, { en: 'Try again', es: 'Reintentar', it: 'Riprova' })}</button></div>}
        {!loading && !error && !items.length && <p role="status">{tx(locale, { en: 'No current offers. New published offers will appear here.', es: 'No hay ofertas actuales. Las nuevas ofertas aparecerán aquí.', it: 'Nessuna offerta attuale. Le nuove offerte appariranno qui.' })}</p>}
        {items.map(item => (
          <Link
            key={item.id}
            href={item.href}
            onClick={() => {
              void markRead(item.id);
              onClose();
            }}
            className={`notif-item ${!item.readAt ? 'unread' : ''}`}
          >
            <div className="notif-icon-bubble offer">
              <BadgePercent size={18} />
            </div>
            <div className="notif-content">
              <strong>{item.title}</strong>
              <p>{item.message}</p>
              <span className="notif-time">{new Date(item.createdAt).toLocaleString(locale === 'es' ? 'es-ES' : locale === 'it' ? 'it-IT' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            {!item.readAt && <span className="notif-unread-dot" />}
          </Link>
        ))}
      </div>
      <div className="notif-footer">
        <Link href="/special-offers" onClick={onClose}>
          {tx(locale, { en: 'View all special offers →', es: 'Ver todas las ofertas especiales →', it: 'Vedi tutte le offerte speciali →', ar: 'عرض جميع العروض الخاصة ←' })}
        </Link>
      </div>
    </div>
  );
}

const STAFF_ROLE_KEYS = ['SUPER_ADMIN', 'ADMIN', 'STAFF'] as const

function isStaffUser(user: AuthenticatedUser | null): boolean {
  // Array.isArray guards against a malformed session payload: an
  // authenticated user must still render the account branch, never crash.
  return !!user && Array.isArray(user.roles) && user.roles.some((role) => (STAFF_ROLE_KEYS as readonly string[]).includes(role))
}

/**
 * Shared public-header auth action (desktop bar, sticky bar, mobile menu).
 * Source of truth is the DB-backed session (`GET /api/auth/me`); no
 * localStorage auth state. Guests keep the existing Sign in link; customers
 * get a compact Account link to /account; staff get a Dashboard link to
 * /admin and are never routed to the customer account.
 */
function HeaderAuthAction({ user, loading, signInLabel, dashboardLabel, accountLabel, mobile = false, onNavigate }: {
  user: AuthenticatedUser | null
  loading: boolean
  signInLabel: string
  dashboardLabel: string
  accountLabel: string
  mobile?: boolean
  onNavigate?: () => void
}) {
  // While the session resolves, hold layout space without flashing the wrong
  // state. SSR and first hydration both render this placeholder, so there is
  // no hydration mismatch.
  if (loading) {
    if (mobile) return null
    return <span className="outline-btn header-auth-loading" aria-hidden="true">{signInLabel}</span>
  }
  if (!user) {
    return mobile
      ? <Link href="/login" onClick={onNavigate}>{signInLabel}</Link>
      : <Link className="outline-btn header-account-btn header-auth-action" href="/login">{signInLabel}</Link>
  }
  if (isStaffUser(user)) {
    return mobile
      ? <Link href="/admin" onClick={onNavigate} aria-label={dashboardLabel}><LayoutDashboard size={16} />{dashboardLabel}</Link>
      : <Link className="outline-btn header-account-btn header-auth-action" href="/admin" aria-label={dashboardLabel}><LayoutDashboard size={16} />{dashboardLabel}</Link>
  }
  return mobile
    ? <Link className="header-auth-action" href="/account" onClick={onNavigate}><UserRound size={16} />{accountLabel}</Link>
    : <Link className="outline-btn header-account-btn header-auth-action" href="/account"><UserRound size={16} />{accountLabel}</Link>
}

/**
 * Shared route-aware active navigation state.
 * Derives the active nav item from the current pathname.
 * Returns the nav key that should be highlighted, or null if none match.
 */
export function useActiveNav(pathname: string): string | null {
  if (pathname === '/') return 'home'
  if (pathname.startsWith('/egypt-tours') || pathname.startsWith('/trips') || pathname.startsWith('/destinations')) return 'tours'
  if (pathname.startsWith('/rent-car')) return 'rent'
  if (pathname === '/about' || pathname.startsWith('/about/') || pathname === '/contact' || pathname.startsWith('/contact/')) return 'company'
  if (pathname.startsWith('/blogs')) return 'blogs'
  if (pathname.startsWith('/events')) return 'events'
  if (pathname.startsWith('/special-offers')) return 'offer'
  if (pathname.startsWith('/make-your-trip')) return 'make'
  return null
}

const COMPANY_LABELS: Record<string, string> = {
  en: 'About Company',
  es: 'Nuestra empresa',
  it: 'La nostra azienda',
  ar: 'عن الشركة',
}

/**
 * Shared navigation configuration — single source of truth for both
 * the normal header and the compact sticky header.
 * Order: Home, Egypt Tours, Rent Car, Events, About Company, Blogs, Special Offer, Make Your Trip.
 * About Us / Contact Us live ONLY inside the About Company dropdown.
 */
export function getNavConfig(t: Record<string, string>, ex: Record<string, string>, locale: string) {
  return {
    home: { label: t.home, href: '/', key: 'home' },
    tours: { label: t.tours, href: '/trips', key: 'tours', dropdown: true },
    rent: { label: t.rent, href: '/rent-car', key: 'rent' },
    events: { label: t.events, href: '/events', key: 'events' },
    company: {
      label: t.companyLabel ?? COMPANY_LABELS[locale] ?? COMPANY_LABELS.en,
      key: 'company',
      dropdown: true as const,
      children: [
        { label: t.about, href: '/about', key: 'about' },
        { label: t.contact, href: '/contact', key: 'contact' },
      ],
    },
    blogs: { label: t.blogs, href: '/blogs', key: 'blogs' },
    offer: { label: t.offer, href: '/special-offers', key: 'offer' },
    make: { label: t.make, href: '/make-your-trip', key: 'make' },
  }
}

/** Keep desktop/sticky discovery links in sync without moving existing mobile links. */
export function getEgyptTourNavLinks(t: Record<string, string>, ex: Record<string, string>, locale: Locale) {
  const categories = [
    [tx(locale, { en: 'All Trips', es: 'Todos los viajes', it: 'Tutti i viaggi', ar: 'كل الرحلات' }), '/trips'],
    [ex.cat1, '/egypt-tours/one-day-tours'],
    [ex.cat2, '/egypt-tours/multi-days-tours'],
    [ex.cat3, '/egypt-tours/nile-cruises'],
    [ex.cat4, '/egypt-tours/shore-excursions'],
  ] as const
  const destination = [tx(locale, { en: 'Destinations', es: 'Destinos', it: 'Destinazioni', ar: 'الوجهات' }), '/destinations'] as const
  return { desktop: [...categories, destination], mobile: [...categories, [t.offer, '/special-offers'] as const, destination] }
}

/**
 * Shared navigation links component — used by both normal and sticky headers.
 * Single source for order, routes, labels, dropdown definitions, and active state.
 * Renders: Home, Egypt Tours (+dropdown), Rent Car, Events, About Company (+dropdown), Blogs, Special Offer.
 */
export function NavLinks({ nav, activeKey, pathname, idPrefix, onToursOpen, toursOpen, onCompanyOpen, companyOpen, tourLinks, t, ex }: {
  nav: ReturnType<typeof getNavConfig>
  activeKey: string | null
  pathname: string
  idPrefix: string
  onToursOpen: () => void
  toursOpen: boolean
  onCompanyOpen: () => void
  companyOpen: boolean
  tourLinks: readonly (readonly [string, string])[]
  t: Record<string, string>
  ex: Record<string, string>
}) {
  const toursMenuId = `${idPrefix}-tours-menu`
  const companyMenuId = `${idPrefix}-company-menu`
  const closeMenus = () => {
    if (toursOpen) onToursOpen()
    if (companyOpen) onCompanyOpen()
  }
  return <>
    <Link href={nav.home.href} className={activeKey === 'home' ? 'active' : ''}>{nav.home.label}</Link>
    <div className="nav-dropdown">
      <button type="button" onClick={onToursOpen} onKeyDown={(event) => { if (event.key === 'Escape') closeMenus() }} aria-expanded={toursOpen} aria-haspopup="true" aria-controls={toursMenuId} className={activeKey === 'tours' ? 'active' : ''}>
        {nav.tours.label} <ChevronDown size={14}/>
      </button>
      {toursOpen && <div className="tour-menu" id={toursMenuId} role="menu">{tourLinks.map(([label, href]) => <Link key={href} href={href} role="menuitem" onClick={closeMenus}>{label}</Link>)}</div>}
    </div>
    <Link href={nav.rent.href} className={activeKey === 'rent' ? 'active' : ''}>{nav.rent.label}</Link>
    <Link href={nav.events.href} className={activeKey === 'events' ? 'active' : ''}>{nav.events.label}</Link>
    <div className="nav-dropdown">
      <button type="button" onClick={onCompanyOpen} onKeyDown={(event) => { if (event.key === 'Escape') closeMenus() }} aria-expanded={companyOpen} aria-haspopup="true" aria-controls={companyMenuId} className={activeKey === 'company' ? 'active' : ''}>
        {nav.company.label} <ChevronDown size={14}/>
      </button>
      {companyOpen && <div className="tour-menu company-menu" id={companyMenuId} role="menu">{nav.company.children.map((child) => <Link key={child.href} href={child.href} role="menuitem" className={pathname === child.href ? 'active' : ''} aria-current={pathname === child.href ? 'page' : undefined} onClick={closeMenus}>{child.label}</Link>)}</div>}
    </div>
    <Link href={nav.blogs.href} className={activeKey === 'blogs' ? 'active' : ''}>{nav.blogs.label}</Link>
    <Link href={nav.offer.href} className={activeKey === 'offer' ? 'active' : ''}>{nav.offer.label}</Link>
  </>
}

export function Header() {
  const publishedMenu = usePublishedNavigation()
  const [menu, setMenu] = useState(false)
  const { user: headerUser, loading: headerUserLoading } = useCurrentUser()
  const [toursOpen, setToursOpen] = useState(false)
  const [companyOpen, setCompanyOpen] = useState(false)
  const [languageOpen, setLanguageOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const marketingNotifications = useMarketingNotifications(headerUserLoading ? undefined : headerUser?.roles.includes('CUSTOMER') && !isStaffUser(headerUser) ? headerUser.publicId : null)
  const marketingUnreadCount = marketingNotifications.unreadCount
  const [query, setQuery] = useState('')
  const [promoIdx, setPromoIdx] = useState(0)
  const [scrolled, setScrolled] = useState(false)
  const promoHold = useRef(false)
  const primaryHeaderRef = useRef<HTMLElement>(null)
  const mobileMenuRef = useRef<HTMLDialogElement>(null)
  const mobileMenuTriggerRef = useRef<HTMLButtonElement>(null)
  const router = useRouter()
  const pathname = usePathname()
  const activeNav = useActiveNav(pathname)
  const { locale, setLocale, currency, setCurrency } = useLocale()
  const { lines: cartLines } = useCart()
  const dbOffers = useDbOffers(offers)
  const dbTours = useDbTours(catalogTours, { includeNew: true })
  const t = useSharedCopy({ ...copy[locale], companyLabel: COMPANY_LABELS[locale] ?? COMPANY_LABELS.en, explore: tx(locale, { en: 'Explore', es: 'Explorar', it: 'Esplora', ar: 'استكشف' }), cart: tx(locale, { en: 'Cart', es: 'Carrito', it: 'Carrello', ar: 'السلة' }), bookings: tx(locale, { en: 'Bookings', es: 'Reservas', it: 'Prenotazioni', ar: 'الحجوزات' }) }, 'navigation')
  const navExtra = useSharedCopy(extra[locale], 'navigation')
  const ex = useSharedCopy(navExtra, 'footer')
  const cartLabel = tx(locale, { en: `Trip cart, ${cartLines} ${cartLines === 1 ? 'trip' : 'trips'}`, es: `Carrito de viajes, ${cartLines} ${cartLines === 1 ? 'viaje' : 'viajes'}`, it: `Carrello viaggi, ${cartLines} ${cartLines === 1 ? 'viaggio' : 'viaggi'}`, ar: `سلة الرحلات، ${cartLines} ${cartLines === 1 ? 'رحلة' : 'رحلات'}` })

  // Header promotional bar: database records are the single source of truth.
  // No eligible published record = the bar is hidden entirely; the original
  // announcements are no longer rendered as hardcoded fallbacks.
  const promos = toTopBarSlides(dbOffers, dbTours).map((slide) => ({
    text: slide.text,
    href: slide.href,
    label: slide.label || ex.viewOffers,
    icons: <BarIcons ids={slide.icons} />,
  }))
  const promoCount = promos.length
  const activePromoIdx = promoCount ? promoIdx % promoCount : 0

  useEffect(() => {
    setMenu(false)
    setToursOpen(false)
    setCompanyOpen(false)
    setNotifOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!menu) return
    const dialog = mobileMenuRef.current
    if (!dialog) return
    dialog.showModal()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const desktop = window.matchMedia('(min-width: 1025px)')
    const closeOnDesktop = () => { if (desktop.matches) setMenu(false) }
    desktop.addEventListener('change', closeOnDesktop)
    return () => {
      dialog.close()
      document.body.style.overflow = previousOverflow
      desktop.removeEventListener('change', closeOnDesktop)
      mobileMenuTriggerRef.current?.focus({ preventScroll: true })
    }
  }, [menu])

  useEffect(() => {
    const onDocumentClick = (event: globalThis.MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('.nav-dropdown') && !target.closest('.mobile-nav')) {
        setToursOpen(false)
        setCompanyOpen(false)
      }
      if (!target.closest('.notif-wrapper')) setNotifOpen(false)
    }
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setToursOpen(false)
        setCompanyOpen(false)
        setNotifOpen(false)
        setMenu(false)
      }
    }
    document.addEventListener('click', onDocumentClick)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('click', onDocumentClick)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  useEffect(() => {
    if (promoCount < 2) return
    const interval = window.setInterval(() => {
      if (!promoHold.current) setPromoIdx((index) => (index + 1) % promoCount)
    }, 5000)
    return () => window.clearInterval(interval)
  }, [promoCount])

  useEffect(() => {
    const syncScrollState = () => {
      const next = window.scrollY > 130
      setScrolled((prev) => {
        if (prev !== next) {
          setToursOpen(false)
          setCompanyOpen(false)
        }
        return next
      })
    }
    syncScrollState()
    window.addEventListener('scroll', syncScrollState, { passive: true })
    window.addEventListener('pageshow', syncScrollState)
    return () => {
      window.removeEventListener('scroll', syncScrollState)
      window.removeEventListener('pageshow', syncScrollState)
    }
  }, [])

  const { desktop: tourLinks, mobile: mobileTourLinks } = getEgyptTourNavLinks(t, ex, locale)
  const mobileGroups = [
    { label: t.tours, links: mobileTourLinks },
    { label: tx(locale, { en: 'Plan & discover', es: 'Planifica y descubre', it: 'Pianifica e scopri', ar: 'خطط واستكشف' }), links: [[t.make, '/make-your-trip'], [t.rent, '/rent-car'], [t.events, '/events'], [t.blogs, '/blogs'], [ex.guideLink, '/egypt-travel-guide']] },
    { label: tx(locale, { en: 'Help & company', es: 'Ayuda y empresa', it: 'Assistenza e azienda', ar: 'المساعدة والشركة' }), links: [[t.about, '/about'], [t.contact, '/contact'], [ex.faqsLink, '/faq'], [ex.accessLink, '/accessible-travel']] },
  ]
  const staff = isStaffUser(headerUser)
  const mobileAccountHref = headerUser ? (staff ? '/admin' : '/account') : '/login'
  const mobileBottomLinks = [
    { href: '/', label: t.home, icon: Home, active: pathname === '/' },
    { href: '/trips', label: t.explore, icon: Compass, active: pathname === '/trips' || pathname.startsWith('/egypt-tours') || pathname.startsWith('/destinations') },
    { href: mobileAccountHref, label: headerUser ? (staff ? t.dashboard : t.account) : t.signIn, icon: staff ? LayoutDashboard : UserRound, active: pathname === '/login' || pathname === '/register' || (pathname.startsWith('/account') && !pathname.startsWith('/account/bookings')) },
  ]

  const navConfig = getNavConfig(t, ex, locale)

  return <>
    <header ref={primaryHeaderRef} suppressHydrationWarning className="site-header">
      <div className="header-top container">
        <button ref={mobileMenuTriggerRef} type="button" className="mobile-menu" onClick={(event) => { event.stopPropagation(); setMenu(true) }} aria-label={tx(locale, { en: 'Open menu', es: 'Abrir el menú', it: 'Apri il menu', ar: 'فتح القائمة' })} aria-expanded={menu} aria-controls="public-mobile-menu"><Menu/></button>
        <Logo/>
        <form className="site-search" role="search" onSubmit={(event) => { event.preventDefault(); router.push('/search?q=' + encodeURIComponent(query)) }}>
          <Search size={19}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.search} aria-label={t.search}/>
        </form>
        <div className="header-actions">
          <LanguageToggle label={LOCALE_SHORT_LABELS[locale] + ' - ' + currency} onOpen={() => setLanguageOpen(true)}/>
          <div className="notif-wrapper">
            <button type="button" className={`icon-btn notif-btn ${notifOpen ? 'active' : ''}`} onClick={() => { setNotifOpen((value) => !value); marketingNotifications.refresh() }} aria-label={tx(locale, { en: 'Notifications', es: 'Notificaciones', it: 'Notifiche', ar: 'الإشعارات' })} aria-expanded={notifOpen}><Bell size={18}/>{marketingUnreadCount > 0 && <span className="notif-badge-pulse"/>}</button>
            {notifOpen && <NotificationDropdown locale={locale} onClose={() => setNotifOpen(false)} state={marketingNotifications}/>}
          </div>
          <Link className={`icon-btn header-cart${cartLines > 0 ? ' has-items' : ''}`} href="/cart" aria-label={cartLabel}>
            <ShoppingCart size={18}/>
            {cartLines > 0 && <span className="cart-count-badge" aria-hidden="true">{cartLines > 9 ? '9+' : cartLines}</span>}
          </Link>
          <div className="header-socials"><HeaderSocials /></div>
        </div>
      </div>

      <div className="header-nav">
        <div className="container header-nav-inner">
          <nav className={publishedMenu !== null ? 'cms-managed-nav' : undefined} aria-label={tx(locale, { en: 'Primary navigation', es: 'Navegación principal', it: 'Navigazione principale', ar: 'القائمة الرئيسية' })}>
            {publishedMenu !== null ? <NavigationMenu navigation={publishedMenu} locale={locale} pathname={pathname} idPrefix="published-primary"/> : <NavLinks nav={navConfig} activeKey={activeNav} pathname={pathname} idPrefix="primary-nav" onToursOpen={() => setToursOpen((value) => !value)} toursOpen={toursOpen} onCompanyOpen={() => setCompanyOpen((value) => !value)} companyOpen={companyOpen} tourLinks={tourLinks} t={t} ex={ex} />}
          </nav>
          <div className="nav-right-actions">{publishedMenu !== null ? <NavigationMenu navigation={publishedMenu} locale={locale} pathname={pathname} actions/> : <Link className={`make-trip-link${activeNav === 'make' ? ' active' : ''}`} href="/make-your-trip">{t.make}</Link>}<HeaderAuthAction user={headerUser} loading={headerUserLoading} signInLabel={t.signIn} dashboardLabel={t.dashboard} accountLabel={t.account} /></div>
        </div>
      </div>

      {languageOpen && <LanguageModal locale={locale} currency={currency} onClose={() => setLanguageOpen(false)} onSelect={setLocale} onCurrency={setCurrency}/>}
      {menu && <dialog ref={mobileMenuRef} id="public-mobile-menu" className="mobile-nav" aria-label={tx(locale, { en: 'Mobile navigation', es: 'Navegación móvil', it: 'Navigazione mobile', ar: 'قائمة الموبايل' })} onCancel={() => setMenu(false)} onMouseDown={(event) => { if (event.target === event.currentTarget) setMenu(false) }}>
        <div className="mobile-nav-content">
          <div className="mobile-nav-heading"><Logo/><button type="button" className="icon-btn" autoFocus onClick={() => setMenu(false)} aria-label={tx(locale, { en: 'Close menu', es: 'Cerrar menú', it: 'Chiudi menu', ar: 'إغلاق القائمة' })}><X size={20}/></button></div>
          <nav>{publishedMenu !== null ? <NavigationMenu navigation={publishedMenu} locale={locale} pathname={pathname} mobile onNavigate={() => setMenu(false)}/> : mobileGroups.map((group) => <section key={group.label}><h2>{group.label}</h2>{group.links.map(([label, href]) => <Link key={href} href={href} aria-current={pathname === href ? 'page' : undefined} onClick={() => setMenu(false)}>{label}<ArrowRight size={16} aria-hidden="true"/></Link>)}</section>)}</nav>
          <div className="mobile-nav-account"><HeaderAuthAction mobile user={headerUser} loading={headerUserLoading} signInLabel={t.signIn} dashboardLabel={t.dashboard} accountLabel={t.account} onNavigate={() => setMenu(false)} /></div>
        </div>
      </dialog>}
    </header>
    <form className="mobile-header-search container" role="search" onSubmit={(event) => { event.preventDefault(); router.push('/search?q=' + encodeURIComponent(query.trim())) }}>
      <Search size={18} aria-hidden="true" />
      <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.search} aria-label={t.search} enterKeyHint="search" />
      <button type="submit" aria-label={ex.searchBtn}><ArrowRight size={18} /></button>
    </form>
    <div className={scrolled ? 'compact-sticky-header is-open' : 'compact-sticky-header'} aria-hidden={!scrolled}>
      <div className="container compact-sticky-inner">
        <Logo/>
        <nav className={publishedMenu !== null ? 'cms-managed-nav' : undefined} aria-label={tx(locale, { en: 'Sticky navigation', es: 'Navegación fija', it: 'Navigazione fissa', ar: 'القائمة العائمة' })}>
          {publishedMenu !== null ? <NavigationMenu navigation={publishedMenu} locale={locale} pathname={pathname} idPrefix="published-sticky"/> : <NavLinks nav={navConfig} activeKey={activeNav} pathname={pathname} idPrefix="compact-nav" onToursOpen={() => setToursOpen((value) => !value)} toursOpen={toursOpen} onCompanyOpen={() => setCompanyOpen((value) => !value)} companyOpen={companyOpen} tourLinks={tourLinks} t={t} ex={ex} />}
        </nav>
        <div className="compact-sticky-actions">
          <Link className={`icon-btn header-cart${cartLines > 0 ? ' has-items' : ''}`} href="/cart" aria-label={cartLabel}>
            <ShoppingCart size={16}/>
            {cartLines > 0 && <span className="cart-count-badge" aria-hidden="true">{cartLines > 9 ? '9+' : cartLines}</span>}
          </Link>
          {publishedMenu !== null ? <NavigationMenu navigation={publishedMenu} locale={locale} pathname={pathname} actions idPrefix="published-sticky-actions"/> : <Link className={`make-trip-link${activeNav === 'make' ? ' active' : ''}`} href="/make-your-trip">{t.make}</Link>}
          <HeaderAuthAction user={headerUser} loading={headerUserLoading} signInLabel={t.signIn} dashboardLabel={t.dashboard} accountLabel={t.account} />
        </div>
      </div>
    </div>


    {promoCount > 0 && <div className="promo" aria-live="polite" onMouseEnter={() => { promoHold.current = true }} onMouseLeave={() => { promoHold.current = false }}>
      <span className="promo-icons" key={'pi' + activePromoIdx}>{promos[activePromoIdx].icons}</span><strong key={'pt' + activePromoIdx} className="promo-swap">{promos[activePromoIdx].text}</strong>{promos[activePromoIdx].href.startsWith('/') ? <Link key={'pl' + activePromoIdx} href={promos[activePromoIdx].href} className="promo-swap">{promos[activePromoIdx].label}</Link> : <a key={'pl' + activePromoIdx} href={promos[activePromoIdx].href} target="_blank" rel="noopener noreferrer" className="promo-swap">{promos[activePromoIdx].label}</a>}<span className="promo-dots">{promos.map((_, index) => <button key={index} type="button" className={index === activePromoIdx ? 'active' : ''} aria-label={'Show announcement ' + (index + 1)} aria-current={index === activePromoIdx} onClick={() => setPromoIdx(index)}/>)}</span>
    </div>}
    <nav className="mobile-bottom-nav" aria-label={tx(locale, { en: 'Quick navigation', es: 'Navegación rápida', it: 'Navigazione rapida', ar: 'التنقل السريع' })}>
      {mobileBottomLinks.slice(0, 2).map((item) => <Link key={item.href} href={item.href} aria-current={item.active ? 'page' : undefined}><item.icon size={21} aria-hidden="true"/><span>{item.label}</span></Link>)}
      <div id="mobile-whatsapp-trigger" className="mobile-support-slot"/>
      <div id="mobile-livechat-trigger" className="mobile-support-slot"/>
      <Link href={mobileBottomLinks[2].href} aria-current={mobileBottomLinks[2].active ? 'page' : undefined}>{(() => { const Icon = mobileBottomLinks[2].icon; return <Icon size={21} aria-hidden="true"/> })()}<span>{mobileBottomLinks[2].label}</span></Link>
    </nav>
  </>
}



export function SupportWidgets(){const [active,setActive]=useState<'live'|'wa'|null>(null); return <div className="support-widgets"><LiveChatWidget open={active==='live'} onOpen={()=>setActive('live')} onClose={()=>setActive((a)=>a==='live'?null:a)}/><WhatsAppWidget open={active==='wa'} onOpen={()=>setActive('wa')} onClose={()=>setActive((a)=>a==='wa'?null:a)}/></div>}

// Commercial footer promotional bar — database records are the single source
// of truth (placement `footer-promo`). The original accessibility notice is
// itself a managed record, so no separate static strip is rendered here.
function FooterPromoStrip(){
  const {locale}=useLocale();
  const ex=extra[locale];
  const bars=placedOffers(useDbOffers(offers),'footer-promo');
  const tours=useDbTours(catalogTours,{includeNew:true});
  const [show,setShow]=useState(true);
  const item=bars[0];
  if(!show||!item) return null;
  const campaign=readCampaign(item.campaign);
  const href=campaignCtaHref(item,tours);
  const label=campaign.ctaLabel||ex.viewOffers;
  const icons=campaign.icons.length?campaign.icons:[DEFAULT_ACCESS_ICON];
  return <div className="access-strip"><span className="promo-icons"><BarIcons ids={icons} size={20}/></span><p>{item.title}</p>{href.startsWith('/')?<Link href={href}>{label}</Link>:<a href={href} target="_blank" rel="noopener noreferrer">{label}</a>}<button type="button" onClick={()=>setShow(false)} aria-label="Dismiss">×</button></div>
}

function ScrollTop(){const [show,setShow]=useState(false); useEffect(()=>{const onScroll=()=>setShow(window.scrollY>500); onScroll(); window.addEventListener('scroll',onScroll,{passive:true}); return ()=>window.removeEventListener('scroll',onScroll);},[]); const goTop=()=>{const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches; window.scrollTo({top:0,behavior:reduced?'auto':'smooth'});}; return <button type="button" className={'scroll-top'+(show?' show':'')} onClick={goTop} aria-label="Scroll to top"><ArrowUp size={20}/></button>}

export function SiteShell({children, initialLocale}:{children:React.ReactNode; initialLocale?: Locale}){return <LocaleProvider initialLocale={initialLocale}><Header/>{children}<FooterPromoStrip/><SupportWidgets/><ScrollTop/><DynamicFooter/></LocaleProvider>}


function DynamicFooter() {
  const { locale } = useLocale()
  const navExtra = useSharedCopy(extra[locale], 'navigation')
  const ex = useSharedCopy({ ...navExtra, allTrips: tx(locale, { en: 'All Trips', es: 'Todos los viajes', it: 'Tutti i viaggi', ar: 'كل الرحلات' }) }, 'footer')
  const t = useSharedCopy({ ...copy[locale], companyLabel: COMPANY_LABELS[locale] ?? COMPANY_LABELS.en }, 'navigation')
  const brand = useBrandSettings()
  const footerTag = locale === 'ar' ? (brand.aboutAr || ex.footerTag) : (brand.aboutEn || ex.footerTag)
  const copyright = locale === 'ar' ? (brand.copyrightAr || ex.rights) : (brand.copyrightEn || ex.rights)

  return <footer>
    <div className="container footer-grid">
      <div className="foot-brand">
        <Logo />
        <p>{footerTag}</p>
        <span className="cert-badge"><Gift size={14} /><span>{ex.certBadge}</span></span>
        <div className="socials foot-socials"><FooterSocials /></div>
      </div>
      <div>
        <h3>{ex.footExplore}</h3>
        <Link href="/">{t.home}</Link>
        <Link href="/trips">{ex.allTrips}</Link>
        <Link href="/egypt-tours/one-day-tours">{ex.cat1}</Link>
        <Link href="/egypt-tours/multi-days-tours">{ex.cat2}</Link>
        <Link href="/egypt-tours/nile-cruises">{ex.cat3}</Link>
        <Link href="/egypt-tours/shore-excursions">{ex.cat4}</Link>
        <Link href="/special-offers">{t.offer}</Link>
      </div>
      <div>
        <h3>{ex.footCompany}</h3>
        <Link href="/rent-car">{t.rent}</Link>
        <Link href="/about">{t.about}</Link>
        <Link href="/contact">{t.contact}</Link>
        <Link href="/egypt-travel-guide">{ex.guideLink}</Link>
        <Link href="/faq">{ex.faqsLink}</Link>
        <Link href="/events">{t.events}</Link>
        <Link href="/accessible-travel">{ex.accessLink}</Link>
      </div>
      <div>
        <h3>{ex.contactInfo}</h3>
        <div className="foot-contact">
          <a href={phoneHref(brand.phone)} aria-label={tx(locale, { en: 'Call STAR PYRAMIDS', es: 'Llama a STAR PYRAMIDS', it: 'Chiama STAR PYRAMIDS', ar: 'اتصل بستار بيراميدز' })}><Phone size={15} /><span>{brand.phone}</span></a>
          <a href={whatsappHref(brand.whatsapp)} target="_blank" rel="noreferrer" aria-label={tx(locale, { en: 'Chat with STAR PYRAMIDS on WhatsApp', es: 'Habla con STAR PYRAMIDS por WhatsApp', it: 'Chatta con STAR PYRAMIDS su WhatsApp', ar: 'راسل ستار بيراميدز على واتساب' })}><WhatsAppGlyph size={16} /><span>{brand.whatsapp}</span></a>
          <a href={`mailto:${brand.email}`}><Mail size={15} /><span>{brand.email}</span></a>
          <span className="foot-addr"><MapPin size={15} /><span>{brand.address}</span></span>
        </div>
      </div>
    </div>
    <div className="container copyright">
      {copyright} <span className="powered-by">| {ex.poweredBy} <a href="https://panel.dipencil.com" target="_blank" rel="noreferrer" aria-label="Dipencil"><img src="https://panel.dipencil.com/pencil-logo.png" alt="Dipencil" /></a></span>
      <span><Link href="/privacy">{ex.privacy}</Link>&nbsp;<Link href="/terms">{ex.terms}</Link></span>
    </div>
  </footer>
}

export function FilterField({label,placeholder,date=false,value,onChange,options}:{label:string;placeholder:string;date?:boolean;value?:string;onChange?:(v:string)=>void;options?:readonly (string|{value:string;label:string})[]}){const fieldStyle={border:0,outline:0,background:'transparent',width:'100%',font:'inherit',color:'inherit',minHeight:'auto'} as const; const {locale:ffLocale}=useLocale(); return <label className="filter-field"><span>{label}</span><div>{options?<SharedSelect value={value??''} onChange={(next)=>onChange?.(next)} locale={ffLocale} label={label} options={[{value:'',label:placeholder},...options.map((o)=>typeof o==='string'?{value:o,label:o}:{value:o.value,label:o.label})]} />:date?<DateInput aria-label={label} value={value??''} onChange={(e)=>onChange?.(e.target.value)} hideNativeIndicator style={fieldStyle}/>:value!==undefined?<input aria-label={label} value={value} onChange={(e)=>onChange?.(e.target.value)} placeholder={placeholder} style={fieldStyle}/>:<>{placeholder}<ChevronDown size={17}/></>}</div></label>}

export function HeroField({title,placeholder,value,onChange,options,date=false}:{title:string;placeholder:string;value:string;onChange:(v:string)=>void;options?:string[];date?:boolean}){const control={width:'100%',border:0,outline:0,background:'transparent',fontSize:15,fontFamily:'inherit',color:value?'#1d1f1f':'#a7a7a7',padding:0,minHeight:28} as const; const {locale:hfLocale}=useLocale(); return <label className="hero-field"><span className="hero-field-title">{title}</span>{options?<span className="hero-field-control"><SharedSelect value={value} onChange={onChange} locale={hfLocale} label={title} options={[{value:'',label:placeholder},...options.map((o)=>({value:o,label:o}))]} modal={false} /></span>:<span className="hero-field-control">{date?<DateInput aria-label={title} value={value} onChange={(e)=>onChange(e.target.value)} placeholder={placeholder} placeholderMode hideNativeIndicator style={control}/>:<input aria-label={title} value={value} onChange={(e)=>onChange(e.target.value)} placeholder={placeholder} style={control}/>}{!date&&<ChevronDown size={20}/>}</span>}</label>}

export function TripSearchEngine() {
  const [tab, setTab] = useState('Make Your Trip');
  const [trip, setTrip] = useState('exact');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [where, setWhere] = useState('');
  const [howLong, setHowLong] = useState('');
  const [tripKind, setTripKind] = useState('');
  const [tripType, setTripType] = useState('One Way');
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [pickupDate, setPickupDate] = useState('');
  const router = useRouter();
  const tabNames = ['Make Your Trip', 'Find your trip', 'Rent Car'];
  const { locale: tl } = useLocale();
  const ex = extra[tl];
  const tabIndex = Math.max(0, tabNames.indexOf(tab));
  const rtl = typeof document !== 'undefined' && document.documentElement.dir === 'rtl';

  // Fetch all live tours once, then filter by category client-side (single DB query)
  // Use getToursByCategory to avoid import issue with catalogTours
  const allLiveTours = useDbTours([
    ...assignableOneDayTours,
    ...getToursByCategory('multi-days-tours'),
    ...getToursByCategory('nile-cruises'),
    ...getToursByCategory('shore-excursions'),
  ]);

  // Derive unique destinations from published tours
  const destinationOptions = Array.from(
    new Set(allLiveTours.map((t) => t.location).filter(Boolean))
  ).sort();

  // Derive unique durations from published tours
  const durationOptions = Array.from(
    new Set(allLiveTours.map((t) => t.duration).filter(Boolean))
  ).sort((a, b) => {
    const numA = parseInt(a);
    const numB = parseInt(b);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    return a.localeCompare(b);
  });

  // Category counts from single array (no extra queries)
  const liveOneDayTours = allLiveTours.filter(t => t.category === 'one-day-tours');
  const liveMultiDayTours = allLiveTours.filter(t => t.category === 'multi-days-tours');
  const liveNileCruises = allLiveTours.filter(t => t.category === 'nile-cruises');
  const liveShoreExcursions = allLiveTours.filter(t => t.category === 'shore-excursions');

  // Trip kind configuration with real-time tour counts
  const tripKinds = [
    { value: 'one-day-tours', label: ex.k1, count: liveOneDayTours.length, icon: Sun },
    { value: 'multi-days-tours', label: ex.k2, count: liveMultiDayTours.length, icon: Package },
    { value: 'nile-cruises', label: ex.k3, count: liveNileCruises.length, icon: Ship },
    { value: 'shore-excursions', label: ex.k4, count: liveShoreExcursions.length, icon: Anchor },
  ];

  // Handle search with proper query parameters
  const handleSearch = () => {
    if (tripKind) {
      const params = new URLSearchParams();
      if (where) params.set('destination', where);
      if (howLong) params.set('duration', howLong);
      const queryString = params.toString();
      router.push(`/egypt-tours/${tripKind}${queryString ? `?${queryString}` : ''}`);
    } else {
      const searchTerms = [where, howLong].filter(Boolean).join(' ');
      router.push(`/search?q=${encodeURIComponent(searchTerms || 'Egypt')}`);
    }
  };

  // Reset all filters
  const handleReset = () => {
    setWhere('');
    setHowLong('');
    setTripKind('');
  };

  const hasActiveFilters = where || howLong || tripKind;

  return (
    <div className="search-wrap">
      <div className="search-tabs" role="tablist" aria-label="Trip search">
        <span
          className="seg-indicator"
          aria-hidden="true"
          style={{ transform: `translateX(${(rtl ? -1 : 1) * tabIndex * 100}%)` }}
        />
        {tabNames.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            className={tab === t ? 'active' : ''}
            onClick={() => setTab(t)}
          >
            {[ex.tabMake, ex.tabFind, ex.tabRent][tabNames.indexOf(t)]}
          </button>
        ))}
      </div>
      <div className="search-panel">
        <div className="search-panel-body" key={tab} role="tabpanel">
          {/* Make Your Trip Tab */}
          {tab === 'Make Your Trip' && (
            <>
              <div className="trip-question trip-time-selector">
                <strong>{ex.qWhen}</strong>
                {[['exact', ex.qExact], ['approx', ex.qApprox], ['unsure', ex.qUnsure]].map(
                  ([v, l]) => (
                    <button
                      key={v}
                      type="button"
                      className={trip === v ? 'selected-radio' : ''}
                      aria-pressed={trip === v}
                      onClick={() => setTrip(v)}
                    >
                      <i className={trip === v ? 'checked' : ''} />
                      {l}
                    </button>
                  )
                )}
              </div>
              <div className="field-grid cols-2">
                <HeroField
                  title={ex.fFrom}
                  placeholder={ex.fFromPh}
                  date
                  value={from}
                  onChange={setFrom}
                />
                <HeroField
                  title={ex.fTo}
                  placeholder={ex.fToPh}
                  date
                  value={to}
                  onChange={setTo}
                />
                <Link
                  className="primary-btn"
                  href={`/make-your-trip${from || to ? `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}` : ''}`}
                >
                  {ex.makeTripBtn} <ArrowRight size={18} />
                </Link>
              </div>
            </>
          )}

          {/* Find Your Trip Tab - Improved */}
          {tab === 'Find your trip' && (
            <>
              <div className="trip-question trip-kind-selector">
                <strong>{ex.qWhat}</strong>
                <div className="trip-kind-options" role="radiogroup" aria-label={ex.qWhat}>
                  {tripKinds.map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      type="button"
                      className={`trip-kind-btn ${tripKind === value ? 'selected' : ''}`}
                      aria-pressed={tripKind === value}
                      onClick={() => setTripKind(tripKind === value ? '' : value)}
                    >
                      <Icon size={18} aria-hidden="true" />
                      <span className="trip-kind-label">{label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="field-grid cols-2">
                <HeroField
                  title={ex.wWhere}
                  placeholder={ex.wWherePh}
                  value={where}
                  onChange={setWhere}
                  options={destinationOptions}
                />
                <HeroField
                  title={ex.wLong}
                  placeholder={ex.wLongPh}
                  value={howLong}
                  onChange={setHowLong}
                  options={durationOptions}
                />
                <button
                  type="button"
                  className="primary-btn"
                  onClick={handleSearch}
                  disabled={!tripKind && !where && !howLong}
                >
                  {ex.searchBtn} <ArrowRight size={18} />
                </button>
              </div>
              {hasActiveFilters && (
                <button
                  type="button"
                  className="reset-btn"
                  onClick={handleReset}
                >
                  {ex.resetFilters || 'Reset filters'}
                </button>
              )}
              {!tripKind && !where && !howLong && (
                <p className="search-hint" aria-live="polite">
                  {ex.searchHint || 'Select a trip type or enter a destination to begin'}
                </p>
              )}
            </>
          )}

          {/* Rent Car Tab - Preserved as-is */}
          {tab === 'Rent Car' && (
            <>
              <div className="trip-question">
                <strong>{ex.qType}</strong>
                {[['One Way', ex.tOne], ['Round Trip', ex.tRound]].map(([v, l]) => (
                  <button
                    key={v}
                    type="button"
                    className={tripType === v ? 'selected-radio' : ''}
                    aria-pressed={tripType === v}
                    onClick={() => setTripType(v)}
                  >
                    <i className={tripType === v ? 'checked' : ''} />
                    {l}
                  </button>
                ))}
              </div>
              <div className="field-grid cols-3">
                <HeroField
                  title={ex.cHolder}
                  placeholder={ex.cHolderPh}
                  value={pickup}
                  onChange={setPickup}
                />
                <HeroField
                  title={ex.cDrop}
                  placeholder={ex.cDropPh}
                  value={dropoff}
                  onChange={setDropoff}
                />
                <HeroField
                  title={ex.cDate}
                  placeholder={ex.cDatePh}
                  date
                  value={pickupDate}
                  onChange={setPickupDate}
                />
                <button
                  type="button"
                  className="primary-btn"
                  onClick={() =>
                    router.push(
                      `/rent-car/request?pickup=${encodeURIComponent(pickup)}&dropoff=${encodeURIComponent(dropoff)}&type=${encodeURIComponent(tripType)}&date=${encodeURIComponent(pickupDate)}`
                    )
                  }
                >
                  {ex.sendReq} <ArrowRight size={18} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function CardGallery({ images: imgs, title, href, children }: { images: readonly string[]; title: string; href: string; children?: React.ReactNode }) {
  const [idx, setIdx] = useState(0)
  const scrub = (e: CardMouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    setIdx(Math.min(imgs.length - 1, Math.max(0, Math.floor((e.clientX - r.left) / r.width * imgs.length))))
  }
  return (
    <div className="card-gallery" onMouseMove={scrub} onMouseLeave={() => setIdx(0)}>
      <Link href={href} aria-label={title} className="tour-gallery-link">
        {imgs.map((src, i) => (
          <Image
            key={src + i}
            src={src}
            alt={i === 0 ? title : ''}
            aria-hidden={i !== 0}
            className={i === idx ? 'on' : ''}
            fill
            sizes="(max-width: 760px) 100vw, (max-width: 1100px) 50vw, 25vw"
            loading="lazy"
            placeholder="blur"
            blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
          />
        ))}
      </Link>
      {children}
      <div className="tour-dots" role="tablist" aria-label="Photos">
        {imgs.map((_, i) => (
          <button key={i} type="button" role="tab" aria-selected={i === idx} aria-label={'Show photo ' + (i + 1)} className={i === idx ? 'active' : ''} onClick={() => setIdx(i)} />
        ))}
      </div>
    </div>
  )
}

export function TourCard({ tour, variant = 'multi' }: { tour: Tour; variant?: TourVariant }) {
  const [copied, setCopied] = useState(false)
  const favorites = useCustomerFavorites()
  const { currency, locale: plc } = useLocale()
  const href = `/egypt-tours/${tour.slug}`
  const title = pickLocaleText(plc, { en: tour.title, ar: tour.titleAr })
  const saved = favorites.has(tour.slug)
  const share = async () => {
    const url = window.location.origin + href
    if (navigator.share) {
      try { await navigator.share({ title, url }) } catch { /* sharing was cancelled */ }
      return
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch { /* clipboard can be unavailable */ }
  }

  return <TourCardPresentation tour={tour} variant={variant} saved={saved} copied={copied} onToggle={() => favorites.toggle(tour.slug)} onShare={share}/>
}

/** Same visual card for public interactivity and read-only editor previews. No account/network hooks. */
export function TourCardPresentation({ tour, variant = 'multi', saved = false, copied = false, onToggle, onShare, passive = false }: { tour: Tour; variant?: TourVariant; saved?: boolean; copied?: boolean; onToggle?: () => void; onShare?: () => void; passive?: boolean }) {
  const { currency, locale: plc } = useLocale()
  const href = `/egypt-tours/${tour.slug}`
  const title = pickLocaleText(plc, { en: tour.title, ar: tour.titleAr })
  const cruiseTypeInfo = variant === 'cruise' && tour.cruiseType ? getCruiseTypeBySlug(tour.cruiseType) : undefined
  let offset = 0
  for (const ch of tour.slug) offset = (offset + ch.charCodeAt(0)) % images.length
  const gallery = (tour.gallery && tour.gallery.length > 0) ? tour.gallery : [tour.image, ...images.slice(offset), ...images.slice(0, offset)].filter((src, index, all) => all.indexOf(src) === index).slice(0, 5)

  return <article className={`tour-card ${variant}`}>
    <div className="tour-image">
      <CardGallery images={gallery} title={title} href={href}>
        <button type="button" className="tour-fav" aria-label={saved ? tx(plc, { en: 'Remove from saved', es: 'Quitar de guardados', it: 'Rimuovi dai salvati', ar: 'إزالة من المحفوظات' }) : tx(plc, { en: 'Save tour', es: 'Guardar el viaje', it: 'Salva il viaggio', ar: 'حفظ الرحلة' })} aria-pressed={saved} disabled={passive} onClick={onToggle}><Heart size={17} fill={saved ? '#f7951d' : 'none'} color={saved ? '#f7951d' : '#1f2937'} strokeWidth={2} /></button>
        <button type="button" className="tour-share" aria-label={copied ? tx(plc, { en: 'Link copied', es: 'Enlace copiado', it: 'Link copiato', ar: 'تم نسخ الرابط' }) : tx(plc, { en: 'Share tour', es: 'Compartir el viaje', it: 'Condividi il viaggio', ar: 'مشاركة الرحلة' })} disabled={passive} onClick={onShare}>{copied ? <Check size={17} color="#1d4ed8" /> : <Share2 size={17} color="#1f2937" />}</button>
      </CardGallery>
    </div>
    <div className="tour-body">
      {cruiseTypeInfo ? <div className="meta cruise-meta"><span className="cities-pill">◉ {plc === 'ar' ? localizeTourLocation(tour.location) : tour.location}</span><em>{plc === 'ar' ? cruiseTypeInfo.titleAr : cruiseTypeInfo.titleEn}</em></div> : <div className="meta">◉ {plc === 'ar' ? localizeTourLocation(tour.location) : tour.location} <em>{tour.travelStyle ?? 'Classic'}</em></div>}
      <h3><Link href={href}>{title}</Link></h3>
      <div className="tour-bottom"><div><small>{tx(plc, { en: 'Start From', es: 'Desde', it: 'Da', ar: 'يبدأ من' })}</small><strong>{formatPrice(tour.price, currency, plc)}</strong></div><span>{variant === 'day' ? <Clock3 size={12} /> : variant === 'cruise' ? <Ship size={12} /> : variant === 'shore' ? <Anchor size={12} /> : null}{plc === 'ar' ? localizeTourDuration(tour.duration) : tour.duration}</span></div>
    </div>
  </article>
}

type PageShowcaseHeroProps = {
  showFeatured?: boolean
  image: string
  eyebrow: string
  title: string
  intro: string
  primaryLabel: string
  primaryHref: string
  secondaryLabel: string
  secondaryHref: string
  railLabel: string
  railTitle: string
  railHref: string
  railMeta: readonly { Icon: typeof Clock3; label: string }[]
  statsLabel: string
  stats: readonly { value: string | number; label: string }[]
}

export function PageShowcaseHero({ showFeatured = true, image, eyebrow, title, intro, primaryLabel, primaryHref, secondaryLabel, secondaryHref, railLabel, railTitle, railHref, railMeta, statsLabel, stats }: PageShowcaseHeroProps) {
  const state = useShowcaseHero()
  const { locale } = useLocale()
  if (state?.hidden || state?.unavailable) return null
  const content = state?.content
  const text = content && locale !== 'ar' ? content.text[locale] : {}
  eyebrow = text.eyebrow ?? eyebrow; title = text.title ?? title; intro = text.intro ?? intro
  primaryLabel = text.primaryLabel ?? primaryLabel; secondaryLabel = text.secondaryLabel ?? secondaryLabel
  railLabel = text.railLabel ?? railLabel; railTitle = text.railTitle ?? railTitle; statsLabel = text.statsLabel ?? statsLabel
  primaryHref = content?.links.primaryHref ?? primaryHref; secondaryHref = content?.links.secondaryHref ?? secondaryHref; railHref = content?.links.railHref ?? railHref
  railMeta = railMeta.map((item, index) => ({ ...item, label: text['meta' + index] ?? item.label }))
  stats = stats.map((item, index) => ({ ...item, label: text['stat' + index] ?? item.label }))
  return <section className="events-page-hero tour-category-page-hero">
    {content?.image || content?.mobileImage ? <picture><source media="(max-width: 760px)" srcSet={content.mobileImage || content.image || image} /><img src={content.image || image} alt={locale !== 'ar' ? content.alt[locale] : ''} className="hero-bg-img" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: content.position === 'source' ? undefined : content.position }} fetchPriority="high" /></picture> : <Image src={image} alt={content && locale !== 'ar' ? content.alt[locale] : ''} fill priority sizes="100vw" className="hero-bg-img" style={content && content.position !== 'source' ? { objectPosition: content.position } : undefined} />}
    <div className="events-page-hero-shade" style={content?.overlay != null ? { background: `rgba(10,32,76,${content.overlay})` } : undefined} />
    <div className="container events-page-hero-content">
      <div className="events-page-hero-copy">
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{intro}</p>
        <div className="events-page-hero-actions">
          <a href={primaryHref} className="primary-btn">{primaryLabel} <ArrowRight size={17}/></a>
          {showFeatured && <Link href={secondaryHref} className="events-hero-link">{secondaryLabel} <ArrowRight size={16}/></Link>}
        </div>
      </div>
      {showFeatured && <div className="events-hero-rail">
        <Link href={railHref} className="events-next-event">
          <span>{railLabel}</span>
          <strong>{railTitle}</strong>
          <small>{railMeta.map(({ Icon, label }, index) => <span className="showcase-hero-meta" key={`${label}-${index}`}>{index > 0 && <i aria-hidden="true"/>}<Icon size={14}/>{label}</span>)}</small>
        </Link>
        <div className="events-hero-stats" aria-label={statsLabel}>
          {stats.map((stat) => <span key={stat.label}><b>{stat.value}</b>{stat.label}</span>)}
        </div>
      </div>}
    </div>
  </section>
}

type TourCategoryHeroProps = Omit<PageShowcaseHeroProps, 'secondaryLabel' | 'secondaryHref' | 'railLabel' | 'railTitle' | 'railHref' | 'railMeta'> & {
  featuredLabel: string
  featuredTitle: string
  featuredHref: string
  featuredLocation: string
  featuredDuration: string
}

export function TourCategoryHero({ featuredLabel, featuredTitle, featuredHref, featuredLocation, featuredDuration, ...hero }: TourCategoryHeroProps) {
  return <PageShowcaseHero {...hero} secondaryLabel={featuredLabel} secondaryHref={featuredHref} railLabel={featuredLabel} railTitle={featuredTitle} railHref={featuredHref} railMeta={[{ Icon: Clock3, label: featuredDuration }, { Icon: MapPin, label: featuredLocation }]}/>
}

export function OneDayToursRegions(){return <SiteShell><OneDayToursRegionsContent/></SiteShell>}

function OneDayToursRegionsContent(){const {locale:dl}=useLocale(); const set=tourCategories['one-day-tours']; const meta=catMeta.day;  const catTitle=pickLocaleText(dl, { en: set.title, ar: categoryCopy['one-day-tours'].titleAr }); const catIntro=pickLocaleText(dl, { en: set.intro, ar: categoryCopy['one-day-tours'].introAr }); const catEyebrow=dl === 'ar' ? meta.eyebrowAr : meta.eyebrow; const liveDestinations=useDbDestinations(destinations);const liveTours=useDbTours(oneDayTourBase);const regions=getPublishedOneDayDestinations(liveDestinations).map((d)=>({slug:d.slug,title:dl==='ar'?(d.nameAr??d.title):d.title,copy:dl==='ar'?(d.copyAr??d.copy):d.copy,items:getOneDayToursForDestination(liveTours,d.slug)})).filter((r)=>r.items.length>0); const total=regions.reduce((n,r)=>n+r.items.length,0); const featured=regions.flatMap((region)=>region.items)[0]??liveTours[0]; return <><TourCategoryHero showFeatured={!!featured} image={featured?.image || '/egypt-hero.png'} eyebrow={catEyebrow} title={catTitle} intro={catIntro} primaryLabel={tx(dl, { en: 'Explore day tours', es: 'Explora los circuitos de un día', it: 'Esplora i tour di un giorno', ar: 'استكشف رحلات اليوم الواحد' })} primaryHref="#one-day-regions" featuredLabel={tx(dl, { en: 'Featured day tour', es: 'Circuito destacado de un día', it: 'Tour di un giorno in evidenza', ar: 'رحلة يوم مميزة' })} featuredTitle={pickLocaleText(dl, { en: featured?.title ?? '', ar: featured?.titleAr })} featuredHref={`/egypt-tours/${featured?.slug ?? ''}`} featuredLocation={dl === 'ar' ? localizeTourLocation((featured?.location ?? '')) : (featured?.location ?? '')} featuredDuration={dl === 'ar' ? localizeTourDuration((featured?.duration ?? '')) : (featured?.duration ?? '')} statsLabel={tx(dl, { en: 'One-day tours summary', es: 'Resumen de circuitos de un día', it: 'Riepilogo dei tour di un giorno', ar: 'ملخص رحلات اليوم الواحد' })} stats={[{value:total,label:tx(dl, { en: 'Tours available', es: 'Circuitos disponibles', it: 'Tour disponibili', ar: 'رحلات متاحة' })},{value:regions.length,label:tx(dl, { en: 'Egypt destinations', es: 'Destinos egipcios', it: 'Destinazioni egiziane', ar: 'وجهات مصرية' })}]}/><Breadcrumb items={[tx(dl, { en: 'Egypt Tours', es: 'Circuitos por Egipto', it: 'Tour in Egitto', ar: 'جولات مصر' }), catTitle]}/><main id="one-day-regions" className="listing-page container"><nav className="category-pills region-nav" aria-label={tx(dl, { en: 'Governorates', es: 'Gobernaciones', it: 'Governatorati', ar: 'المحافظات' })}>{regions.map(r=><a key={r.slug} href={'#'+r.slug}>{r.title}</a>)}</nav><p className="region-count">{tx(dl, { en: 'Browse', es: 'Explora', it: 'Sfoglia', ar: 'تصفح' })} <strong>{total}</strong> {tx(dl, { en: 'one-day tours across', es: 'circuitos de un día en', it: 'tour di un giorno in', ar: 'رحلة يوم واحد في' })} <strong>{regions.length}</strong> {tx(dl, { en: 'governorates', es: 'gobernaciones', it: 'governatorati', ar: 'محافظات' })}</p>{regions.map(r=><section key={r.slug} id={r.slug} className="region-block" aria-label={r.title}><div className="region-head"><div><span className="eyebrow">{catTitle}</span><h2>{r.title}</h2><p>{r.copy}</p></div><div className="region-badge-wrap"><span className="region-badge">{r.items.length} {tx(dl, { en: 'tours', es: 'circuitos', it: 'tour', ar: 'رحلات' })}</span><Link href={`/egypt-tours/one-day-tours/${r.slug}`} className="region-see-more">{tx(dl, { en: 'See more', es: 'Ver más', it: 'Vedi di più', ar: 'شاهد الكل' })} <ArrowRight size={14}/></Link></div></div><div className="compact-tour-grid region-tours">{r.items.slice(0,4).map(t=><TourCard key={t.slug} tour={t} variant='day'/>)}</div></section>)}<HelpCTA/></main></>}

type RegionTourProps = {
  region: { name: string; nameAr: string; slug: string; copy: string; copyAr?: string; tourSlugs: readonly string[] }
  tours: Tour[]
  page: number
  category?: TourCategory
}

export function RegionTourPage(props: RegionTourProps) {
  return <SiteShell><RegionTourContent {...props}/></SiteShell>
}

function RegionTourContent({ region, tours, page, category = 'one-day-tours' }: RegionTourProps) {
  const { locale } = useLocale()
  const hero = useShowcaseHero()
  const heroText = hero?.content && locale !== 'ar' ? hero.content.text[locale] : undefined
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const set = tourCategories[category]
  const variant = set.variant
  const meta = catMeta[variant]
  const HeroIcon = meta.HeroIcon
  const isCruise = category === 'nile-cruises'
  const regionTitle = locale === 'ar' ? region.nameAr : region.name
  const [durFilter, setDurFilter] = useState('')
  const filteredTours = durFilter ? tours.filter((tour) => tour.duration === durFilter) : tours
  const durationOptions = isCruise ? Array.from(new Set(tours.map((tour) => tour.duration))) : []
  const perPage = 9
  const totalPages = Math.max(1, Math.ceil(filteredTours.length / perPage))
  const queryPage = Number(searchParams.get('page'))
  const requestedPage = Number.isInteger(queryPage) && queryPage > 0 && queryPage <= 999 ? queryPage : page
  const safePage = Math.max(1, Math.min(requestedPage, totalPages))
  const start = (safePage - 1) * perPage
  const paged = filteredTours.slice(start, start + perPage)
  const makeHref = (number: number) => `/egypt-tours/${category}/${region.slug}${number > 1 ? `?page=${number}` : ''}`
  const setDuration = (value: string) => {
    setDurFilter(value)
    if (requestedPage > 1) router.replace(pathname, { scroll: false })
  }

  return <>
    <Breadcrumb items={[tx(locale, { en: 'Egypt Tours', es: 'Circuitos por Egipto', it: 'Tour in Egitto', ar: 'جولات مصر' }), pickLocaleText(locale, { en: set.title, ar: categoryCopy[category].titleAr }), regionTitle]}/>
    <main className="listing-page container">
      {!hero?.hidden && !hero?.unavailable && <div className={`cat-hero ${variant}`}>
        <span className="cat-hero-ic" aria-hidden="true"><HeroIcon size={34}/></span>
        <div>
          <span className="eyebrow">{heroText?.eyebrow ?? tx(locale, { en: meta.eyebrow, es: isCruise ? 'Navega por el Nilo' : (eyebrowEs[meta.eyebrow] ?? meta.eyebrow), it: isCruise ? 'Naviga sul Nilo' : (eyebrowIt[meta.eyebrow] ?? meta.eyebrow), ar: isCruise ? 'أبحر في النيل' : meta.eyebrowAr })}</span>
          <h1>{heroText?.title ?? regionTitle}</h1>
          <p>{heroText?.intro ?? pickLocaleText(locale, { en: region.copy, ar: region.copyAr })}</p>
          <div className="cat-feats">{(isCruise ? [{ Icon: Ship, text: heroText?.stat0 ?? featLabel(locale, 'Nile itineraries', 'مسارات نيلية') }, { Icon: Users, text: heroText?.stat1 ?? featLabel(locale, 'Cruise options', 'خيارات متعددة') }] : meta.feats.map((feature, index) => ({ Icon: feature.Icon, text: featLabel(locale, feature.text, meta.featsAr[index]?.text ?? feature.text) }))).map((feature) => <span key={feature.text}><feature.Icon size={14}/>{feature.text}</span>)}</div>
        </div>
      </div>}
      <div className="results-bar"><span>{tx(locale, { en: 'Showing', es: 'Mostrando', it: 'Visualizzati', ar: 'عرض' })} <strong>{paged.length}</strong> {tx(locale, { en: 'of', es: 'de', it: 'di', ar: 'من' })} <strong>{filteredTours.length}</strong> {tx(locale, { en: 'tours', es: 'recorridos', it: 'tour', ar: 'رحلة' })}</span></div>
      {durationOptions.length > 1 && <nav className="category-pills" aria-label={tx(locale, { en: 'Filter by duration', es: 'Filtrar por duración', it: 'Filtra per durata', ar: 'تصفية حسب المدة' })}>
        {['', ...durationOptions].map((duration) => <button key={duration || 'all'} type="button" className={durFilter === duration ? 'active' : ''} aria-pressed={durFilter === duration} onClick={() => setDuration(duration)}>{duration ? (locale === 'ar' ? localizeTourDuration(duration) : duration) : tx(locale, { en: 'All', es: 'Todo', it: 'Tutto', ar: 'الكل' })}</button>)}
      </nav>}
      {paged.length ? <div className="compact-tour-grid region-tours">{paged.map((tour) => <TourCard key={tour.slug} tour={tour} variant={variant}/>)}</div> : <p className="region-count">{tx(locale, { en: 'No tours available at the moment.', es: 'No hay viajes disponibles por el momento.', it: 'Nessun viaggio disponibile al momento.', ar: 'لا توجد رحلات حالياً' })}</p>}
      {totalPages > 1 && <nav className="pagination" aria-label={tx(locale, { en: 'Pagination', es: 'Paginación', it: 'Paginazione', ar: 'صفحات الرحلات' })}>
        <Link href={makeHref(safePage - 1)} className={safePage <= 1 ? 'disabled' : ''} aria-disabled={safePage <= 1} onClick={(event) => { if (safePage <= 1) event.preventDefault() }}><ArrowRight size={14} style={{ transform: 'rotate(180deg)' }}/> {tx(locale, { en: 'Previous', es: 'Anterior', it: 'Precedente', ar: 'السابق' })}</Link>
        {Array.from({ length: totalPages }, (_, index) => index + 1).map((number) => <Link key={number} href={makeHref(number)} className={number === safePage ? 'active' : ''} aria-current={number === safePage ? 'page' : undefined}>{number}</Link>)}
        <Link href={makeHref(safePage + 1)} className={safePage >= totalPages ? 'disabled' : ''} aria-disabled={safePage >= totalPages} onClick={(event) => { if (safePage >= totalPages) event.preventDefault() }}>{tx(locale, { en: 'Next', es: 'Siguiente', it: 'Avanti', ar: 'التالي' })} <ArrowRight size={14}/></Link>
      </nav>}
    </main>
  </>
}

function MultiDayToursCategoriesContent(){
  const {locale:dl}=useLocale();
  const set=tourCategories['multi-days-tours'];
  const meta=catMeta.multi;
  const catTitle=pickLocaleText(dl, { en: set.title, ar: categoryCopy['multi-days-tours'].titleAr });
  const catIntro=pickLocaleText(dl, { en: set.intro, ar: categoryCopy['multi-days-tours'].introAr });
  const catEyebrow=dl === 'ar' ? meta.eyebrowAr : meta.eyebrow;
  const liveCategories=useDbCategories(multiDayCategories);const liveMultiTours=useDbTours(multiDayTourBase);const entries=getPublishedMultiDayCategories(liveCategories).map((category)=>({category,tours:getMultiDayToursForCategory(liveMultiTours,category.slug)})).filter((entry)=>entry.tours.length>0);
  const total=entries.reduce((n,entry)=>n+entry.tours.length,0);
  const featured=entries.flatMap((entry)=>entry.tours)[0]??liveMultiTours[0];
  return <><TourCategoryHero showFeatured={!!featured} image={featured?.image || '/egypt-hero.png'} eyebrow={catEyebrow} title={catTitle} intro={catIntro} primaryLabel={tx(dl, { en: 'Explore multi-day journeys', es: 'Explora los viajes de varios días', it: 'Esplora i viaggi di più giorni', ar: 'استكشف رحلات متعددة الأيام' })} primaryHref="#multi-day-categories" featuredLabel={tx(dl, { en: 'Featured journey', es: 'Viaje destacado', it: 'Viaggio in evidenza', ar: 'رحلة مميزة' })} featuredTitle={pickLocaleText(dl, { en: featured?.title ?? '', ar: featured?.titleAr })} featuredHref={`/egypt-tours/${featured?.slug ?? ''}`} featuredLocation={dl === 'ar' ? localizeTourLocation((featured?.location ?? '')) : (featured?.location ?? '')} featuredDuration={dl === 'ar' ? localizeTourDuration((featured?.duration ?? '')) : (featured?.duration ?? '')} statsLabel={tx(dl, { en: 'Multi-day tours summary', es: 'Resumen de viajes de varios días', it: 'Riepilogo dei viaggi di più giorni', ar: 'ملخص رحلات متعددة الأيام' })} stats={[{value:total,label:tx(dl, { en: 'Journeys available', es: 'Viajes disponibles', it: 'Viaggi disponibili', ar: 'رحلات متاحة' })},{value:entries.length,label:tx(dl, { en: 'Travel categories', es: 'Categorías de viaje', it: 'Categorie di viaggio', ar: 'فئات سفر' })}]}/><Breadcrumb items={[tx(dl, { en: 'Egypt Tours', es: 'Circuitos por Egipto', it: 'Tour in Egitto', ar: 'جولات مصر' }), catTitle]}/><main id="multi-day-categories" className="listing-page container"><nav className="category-pills region-nav" aria-label={tx(dl, { en: 'Travel categories', es: 'Categorías de viaje', it: 'Categorie di viaggio', ar: 'فئات السفر' })}>{entries.map(({category})=><a key={category.slug} href={'#'+category.slug}>{dl==='ar'?category.nameAr:category.name}</a>)}</nav><p className="region-count">{tx(dl, { en: 'Browse', es: 'Explora', it: 'Sfoglia', ar: 'تصفح' })} <strong>{total}</strong> {tx(dl, { en: 'multi-day journeys across', es: 'viajes de varios días en', it: 'viaggi di più giorni in', ar: 'رحلة متعددة الأيام في' })} <strong>{entries.length}</strong> {tx(dl, { en: 'travel categories', es: 'categorías de viaje', it: 'categorie di viaggio', ar: 'فئات سفر' })}</p>{entries.map(({category,tours})=><section key={category.slug} id={category.slug} className="region-block" aria-label={dl==='ar'?category.nameAr:category.name}><div className="region-head"><div><span className="eyebrow">{catTitle}</span><h2>{dl==='ar'?category.nameAr:category.name}</h2><p>{dl==='ar'?category.copyAr:category.copy}</p></div><div className="region-badge-wrap"><span className="region-badge">{tours.length} {tx(dl, { en: 'tours', es: 'viajes', it: 'viaggi', ar: 'رحلات' })}</span><Link href={`/egypt-tours/multi-days-tours/${category.slug}`} className="region-see-more">{tx(dl, { en: 'See more', es: 'Ver más', it: 'Vedi di più', ar: 'شاهد المزيد' })} <ArrowRight size={14}/></Link></div></div><div className="compact-tour-grid region-tours">{tours.slice(0,4).map(t=><TourCard key={t.slug} tour={t} variant='multi'/>)}</div></section>)}<HelpCTA/></main></>
}

export function MultiDayCategoryPage({ categorySlug }: { categorySlug: string }) {
  return <SiteShell><Suspense><MultiDayCategoryContent categorySlug={categorySlug}/></Suspense></SiteShell>
}

function MultiDayCategoryContent({ categorySlug }: { categorySlug: string }) {
  const { locale } = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const liveCategories = useDbCategories(multiDayCategories); const liveCatTours = useDbTours(multiDayTourBase); const category = liveCategories.find((c) => c.slug === categorySlug); const tours = category ? getMultiDayToursForCategory(liveCatTours, category.slug) : []; const set = tourCategories['multi-days-tours']
  const variant = set.variant
  const meta = catMeta[variant]
  const HeroIcon = meta.HeroIcon

  const parentTitle = pickLocaleText(locale, { en: set.title, ar: categoryCopy['multi-days-tours'].titleAr })
  const categoryTitle = category ? pickLocaleText(locale, { en: category.name, ar: category.nameAr }) : categorySlug
  const categoryDesc = category ? pickLocaleText(locale, { en: category.copy, ar: category.copyAr }) : ''
  const sortLabel = (o: string) => tx(locale, { en: o, es: o === 'Price: low to high' ? 'Precio: de menor a mayor' : o === 'Price: high to low' ? 'Precio: de mayor a menor' : 'Recomendados', it: o === 'Price: low to high' ? 'Prezzo: dal più basso' : o === 'Price: high to low' ? 'Prezzo: dal più alto' : 'Consigliati', ar: o === 'Price: low to high' ? 'السعر: من الأقل' : o === 'Price: high to low' ? 'السعر: من الأعلى' : 'الموصى بها' })
  const destinationOptions = Array.from(new Set(tours.map((tour) => tour.location)))
  const durationOptions = Array.from(new Set(tours.map((tour) => tour.duration)))
  const query = parseTourListingQuery(searchParams, destinationOptions, durationOptions)
  const [destination, setDestination] = useState(query.destination)
  const [duration, setDuration] = useState(query.duration)
  const [price, setPrice] = useState(query.price)
  useEffect(() => { setDestination(query.destination); setDuration(query.duration); setPrice(query.price) }, [query.destination, query.duration, query.price])
  const perPage = 6
  const go = (next: TourListingQuery) => {
    const params = new URLSearchParams()
    if (next.destination) params.set('destination', next.destination)
    if (next.duration) params.set('duration', next.duration)
    if (next.price) params.set('price', next.price)
    if (next.sort !== 'Recommended') params.set('sort', next.sort)
    if (next.page > 1) params.set('page', String(next.page))
    const qs = params.toString()
    router.replace(pathname + (qs ? `?${qs}` : ''), { scroll: false })
  }
  const applyFilters = () => go({ destination, duration, price, sort: query.sort, page: 1 })
  const resetFilters = () => { setDestination(''); setDuration(''); setPrice(''); go({ destination: '', duration: '', price: '', sort: query.sort, page: 1 }) }
  const appliedCount = [query.destination, query.duration, query.price].filter(Boolean).length
  const filtered = tours.filter((t) => (!query.destination || t.location === query.destination) && (!query.duration || t.duration === query.duration) && matchPriceBand(t.price, query.price))
  const sorted = [...filtered].sort((a, b) => query.sort === 'Price: low to high' ? (a.price - b.price || (a.slug < b.slug ? -1 : 1)) : query.sort === 'Price: high to low' ? (b.price - a.price || (a.slug < b.slug ? -1 : 1)) : 0)
  const totalPages = Math.max(1, Math.ceil(sorted.length / perPage))
  const safePage = Math.min(Math.max(1, query.page), totalPages)
  const paged = sorted.slice((safePage - 1) * perPage, safePage * perPage)

  return <>
    <Breadcrumb items={[tx(locale, { en: 'Egypt Tours', es: 'Circuitos por Egipto', it: 'Tour in Egitto', ar: 'جولات مصر' }), parentTitle, categoryTitle]}/>{category && category.image ? <div className="mdc-cover"><img src={category.image} alt={categoryTitle}/></div> : null}
    <main className="listing-page container">
      <div className={`cat-hero ${variant}`}>
        <span className="cat-hero-ic" aria-hidden="true"><HeroIcon size={34}/></span>
        <div>
          <span className="eyebrow">{tx(locale, { en: meta.eyebrow, es: eyebrowEs[meta.eyebrow] ?? meta.eyebrow, it: eyebrowIt[meta.eyebrow] ?? meta.eyebrow, ar: meta.eyebrowAr })}</span>
          <h1>{categoryTitle}</h1>
          <p>{categoryDesc}</p>
          <div className="cat-feats">{meta.feats.map((feature, index) => ({ Icon: feature.Icon, text: featLabel(locale, feature.text, meta.featsAr[index]?.text ?? feature.text) })).map((feature) => <span key={feature.text}><feature.Icon size={14}/>{feature.text}</span>)}</div>
        </div>
      </div>
      {!category || !category.active ? <div className="account-empty"><h3>{tx(locale, { en: 'Category not found.', es: 'Categoría no encontrada.', it: 'Categoria non trovata.', ar: 'الفئة غير موجودة.' })}</h3><p>{tx(locale, { en: 'The category you are looking for is not available right now.', es: 'La categoría que buscas no está disponible ahora mismo.', it: 'La categoria che cerchi non è disponibile al momento.', ar: 'الفئة التي تبحث عنها غير متاحة حاليا.' })}</p><Link href="/egypt-tours/multi-days-tours" className="primary-btn">{tx(locale, { en: 'Multi day tours', es: 'Viajes de varios días', it: 'Viaggi di più giorni', ar: 'رحلات متعددة الأيام' })}</Link></div> : tours.length ? <>
        <CategoryFilter destination={destination} duration={duration} price={price} destinationOptions={destinationOptions} durationOptions={durationOptions} appliedCount={appliedCount} onDestination={setDestination} onDuration={setDuration} onPrice={setPrice} onSearch={applyFilters} onReset={resetFilters}/>
        <div className="results-bar"><strong role="status">{tx(locale, { en: `${sorted.length} tour${sorted.length === 1 ? '' : 's'} found`, es: `${sorted.length} recorridos disponibles`, it: `${sorted.length} tour disponibili`, ar: `${sorted.length} رحلات متاحة` })}</strong><SharedSelect value={query.sort} onChange={(o) => go({ ...query, sort: o as TourListingQuery['sort'], page: 1 })} locale={locale} label={tx(locale, { en: 'Sort by', es: 'Ordenar por', it: 'Ordina per', ar: 'ترتيب حسب' })} options={tourListingSorts.map((o) => ({ value: o, label: sortLabel(o) }))} /></div>
        {paged.length ? <div className="listing-grid">{paged.map(t => <TourCard key={t.slug} tour={t} variant={variant}/>)}</div> : <div className="account-empty"><h3>{tx(locale, { en: 'No tours match your filters.', es: 'Ningún viaje coincide con tus filtros.', it: 'Nessun viaggio corrisponde ai tuoi filtri.', ar: 'لا توجد رحلات تطابق الفلاتر.' })}</h3><p>{tx(locale, { en: 'Try a different destination or reset the filters to see everything.', es: 'Prueba otro destino o restablece los filtros para verlo todo.', it: 'Prova un’altra destinazione o reimposta i filtri per vedere tutto.', ar: 'جرّب وجهة مختلفة أو أعد ضبط الفلاتر لرؤية كل شيء.' })}</p><button type="button" className="primary-btn" onClick={resetFilters}>{tx(locale, { en: 'Reset Filters', es: 'Borrar filtros', it: 'Cancella i filtri', ar: 'إعادة ضبط الفلاتر' })}</button></div>}
        <nav className="pagination" aria-label={tx(locale, { en: 'Tour listing pages', es: 'Páginas de viajes', it: 'Pagine dei viaggi', ar: 'صفحات الرحلات' })}><button type="button" onClick={() => go({ ...query, page: Math.max(1, safePage - 1) })} aria-label={tx(locale, { en: 'Previous page', es: 'Página anterior', it: 'Pagina precedente', ar: 'الصفحة السابقة' })} disabled={safePage <= 1} style={safePage <= 1 ? { opacity: .5 } : undefined}>{tx(locale, { en: '‹ Back', es: '‹ Atrás', it: '‹ Indietro', ar: '‹ السابق' })}</button>{Array.from({ length: totalPages }, (_, i) => safePage === i + 1 ? <b key={i + 1} aria-current="page">{i + 1}</b> : <button key={i + 1} type="button" aria-label={tx(locale, { en: `Go to page ${i + 1}`, es: `Ve a la página ${i + 1}`, it: `Vai alla pagina ${i + 1}`, ar: `انتقل إلى الصفحة ${i + 1}` })} onClick={() => go({ ...query, page: i + 1 })}>{i + 1}</button>)}<button type="button" onClick={() => go({ ...query, page: Math.min(totalPages, safePage + 1) })} aria-label={tx(locale, { en: 'Next page', es: 'Página siguiente', it: 'Pagina successiva', ar: 'الصفحة التالية' })} disabled={safePage >= totalPages} style={safePage >= totalPages ? { opacity: .5 } : undefined}>{tx(locale, { en: 'Next ›', es: 'Siguiente ›', it: 'Avanti ›', ar: 'التالي ›' })}</button></nav>
      </> : <div className="account-empty"><h3>{tx(locale, { en: 'No journeys in this category yet.', es: 'Aún no hay viajes en esta categoría.', it: 'Non ci sono ancora viaggi in questa categoria.', ar: 'لا توجد رحلات في هذه الفئة بعد.' })}</h3><p>{tx(locale, { en: 'New journeys are added regularly — check back soon.', es: 'Añadimos viajes nuevos con frecuencia; vuelve pronto.', it: 'Aggiungiamo regolarmente nuovi viaggi; torna presto.', ar: 'نضيف رحلات جديدة باستمرار — عاود الزيارة قريباً.' })}</p></div>}
      <HelpCTA/>
    </main>
  </>
}

export function OneDayDestinationPage({ slug }: { slug: string }) {
  return <SiteShell><Suspense><OneDayDestinationContent slug={slug} /></Suspense></SiteShell>
}

function OneDayDestinationContent({ slug }: { slug: string }) {
  const { locale } = useLocale()
  const searchParams = useSearchParams()
  const set = tourCategories['one-day-tours']
  const variant = set.variant
  const meta = catMeta.day
  const HeroIcon = meta.HeroIcon

  const liveDestinations = useDbDestinations(destinations)
  const liveTours = useDbTours(oneDayTourBase)
  const destination = liveDestinations.find((item) => item.slug === slug && item.showInOneDayTours === true)
  const tours = destination ? getOneDayToursForDestination(liveTours, destination.slug) : []
  const perPage = 9
  const queryPage = Number(searchParams.get('page'))
  const requestedPage = Number.isInteger(queryPage) && queryPage > 0 && queryPage <= 999 ? queryPage : 1
  const totalPages = Math.max(1, Math.ceil(tours.length / perPage))
  const safePage = Math.max(1, Math.min(requestedPage, totalPages))
  const paged = tours.slice((safePage - 1) * perPage, safePage * perPage)
  const makeHref = (number: number) => `/egypt-tours/one-day-tours/${slug}${number > 1 ? `?page=${number}` : ''}`
  const parentTitle = pickLocaleText(locale, { en: set.title, ar: categoryCopy['one-day-tours'].titleAr })
  if (!destination || destination.isPublished === false) {
    return <>
      <Breadcrumb items={[tx(locale, { en: 'Egypt Tours', es: 'Circuitos por Egipto', it: 'Tour in Egitto', ar: 'جولات مصر' }), parentTitle]} />
      <main className="listing-page container"><div className="account-empty"><h3>{tx(locale, { en: 'Destination not found.', es: 'Destino no encontrado.', it: 'Destinazione non trovata.', ar: 'الوجهة غير موجودة.' })}</h3><p>{tx(locale, { en: 'The destination you are looking for is not available right now.', es: 'El destino que buscas no está disponible ahora mismo.', it: 'La destinazione che cerchi non è disponibile al momento.', ar: 'الوجهة التي تبحث عنها غير متاحة حاليا.' })}</p><Link href="/egypt-tours/one-day-tours" className="primary-btn">{tx(locale, { en: 'One day tours', es: 'Circuitos de un día', it: 'Tour di un giorno', ar: 'رحلات اليوم الواحد' })}</Link></div></main>
    </>
  }
  const destTitle = pickLocaleText(locale, { en: destination.title, ar: destination.nameAr })
  const destDesc = pickLocaleText(locale, { en: destination.copy, ar: destination.copyAr })
  return <>
    <Breadcrumb items={[tx(locale, { en: 'Egypt Tours', es: 'Circuitos por Egipto', it: 'Tour in Egitto', ar: 'جولات مصر' }), parentTitle, destTitle]} />
    <main className="listing-page container">
      <div className={`cat-hero ${variant}`}>
        <span className="cat-hero-ic" aria-hidden="true"><HeroIcon size={34} /></span>
        <div>
          <span className="eyebrow">{tx(locale, { en: meta.eyebrow, es: eyebrowEs[meta.eyebrow] ?? meta.eyebrow, it: eyebrowIt[meta.eyebrow] ?? meta.eyebrow, ar: meta.eyebrowAr })}</span>
          <h1>{destTitle}</h1>
          <p>{destDesc}</p>
          <div className="cat-feats">{meta.feats.map((feature, index) => ({ Icon: feature.Icon, text: featLabel(locale, feature.text, meta.featsAr[index]?.text ?? feature.text) })).map((feature) => <span key={feature.text}><feature.Icon size={14} />{feature.text}</span>)}</div>
        </div>
      </div>
      <div className="results-bar"><span>{tx(locale, { en: 'Showing', es: 'Mostrando', it: 'Visualizzati', ar: 'عرض' })} <strong>{paged.length}</strong> {tx(locale, { en: 'of', es: 'de', it: 'di', ar: 'من' })} <strong>{tours.length}</strong> {tx(locale, { en: 'tours', es: 'recorridos', it: 'tour', ar: 'رحلة' })}</span></div>
      {paged.length ? <div className="compact-tour-grid region-tours">{paged.map((tour) => <TourCard key={tour.slug} tour={tour} variant={variant} />)}</div> : <p className="region-count">{tx(locale, { en: 'No tours available at the moment.', es: 'No hay viajes disponibles por el momento.', it: 'Nessun viaggio disponibile al momento.', ar: 'لا توجد رحلات حالياً' })}</p>}
      {totalPages > 1 && <nav className="pagination" aria-label={tx(locale, { en: 'Pagination', es: 'Paginación', it: 'Paginazione', ar: 'صفحات الرحلات' })}>
        <Link href={makeHref(safePage - 1)} className={safePage <= 1 ? 'disabled' : ''} aria-disabled={safePage <= 1} onClick={(event) => { if (safePage <= 1) event.preventDefault() }}><ArrowRight size={14} style={{ transform: 'rotate(180deg)' }} /> {tx(locale, { en: 'Previous', es: 'Anterior', it: 'Precedente', ar: 'السابق' })}</Link>
        {Array.from({ length: totalPages }, (_, index) => index + 1).map((number) => <Link key={number} href={makeHref(number)} className={number === safePage ? 'active' : ''} aria-current={number === safePage ? 'page' : undefined}>{number}</Link>)}
        <Link href={makeHref(safePage + 1)} className={safePage >= totalPages ? 'disabled' : ''} aria-disabled={safePage >= totalPages} onClick={(event) => { if (safePage >= totalPages) event.preventDefault() }}>{tx(locale, { en: 'Next', es: 'Siguiente', it: 'Avanti', ar: 'التالي' })} <ArrowRight size={14} /></Link>
      </nav>}
    </main>
  </>
}

export function MultiDayToursCategories(){return <SiteShell><MultiDayToursCategoriesContent/></SiteShell>}
export const catMeta: Record<TourVariant, { eyebrow: string; eyebrowAr: string; HeroIcon: typeof Sun; feats: { Icon: typeof Sun; text: string }[]; featsAr: { Icon: typeof Sun; text: string }[] }> = {
  multi: { eyebrow: 'Take your time', eyebrowAr: 'خذ وقتك', HeroIcon: Package, feats: [{ Icon: MapPin, text: 'Multi-city routes' }, { Icon: Users, text: 'Private groups' }], featsAr: [{ Icon: MapPin, text: 'مسارات متعددة المدن' }, { Icon: Users, text: 'مجموعات خاصة' }] },
  day: { eyebrow: 'One day, zero rush', eyebrowAr: 'يوم واحد بدون استعجال', HeroIcon: Sun, feats: [{ Icon: Clock3, text: 'Hours, not days' }, { Icon: MapPin, text: 'Single city' }], featsAr: [{ Icon: Clock3, text: 'ساعات لا أيام' }, { Icon: MapPin, text: 'مدينة واحدة' }] },
  cruise: { eyebrow: 'Sail in style', eyebrowAr: 'أبحر بأناقة', HeroIcon: Ship, feats: [{ Icon: Star, text: '5-star decks' }, { Icon: Users, text: 'Full board' }], featsAr: [{ Icon: Star, text: 'أجنحة 5 نجوم' }, { Icon: Users, text: 'إقامة شاملة' }] },
  shore: { eyebrow: 'From port to wonders', eyebrowAr: 'من الميناء إلى العجائب', HeroIcon: Anchor, feats: [{ Icon: Anchor, text: 'Port pickup' }, { Icon: Clock3, text: 'Back on time' }], featsAr: [{ Icon: Anchor, text: 'استلام من الميناء' }, { Icon: Clock3, text: 'عودة في الموعد' }] },
}

export const categoryCopy: Record<TourCategory, { titleAr: string; introAr: string }> = {
  'one-day-tours': { titleAr: 'رحلات اليوم الواحد', introAr: 'اكتشف أعظم كنوز مصر في يوم واحد لا يُنسى.' },
  'multi-days-tours': { titleAr: 'رحلات متعددة الأيام', introAr: 'خذ وقتك واستمتع بمصر أبعد من المعالم.' },
  'nile-cruises': { titleAr: 'كروز النيل', introAr: 'أبحر بين المعابد القديمة براحة وخدمة ومناظر لا تُنسى.' },
  'shore-excursions': { titleAr: 'رحلات الشواطئ', introAr: 'استغل كل ميناء مع رحلات شاطئية مخططة بخبرة.' },
}
const eyebrowEs: Record<string, string> = { 'Take your time': 'Tómate tu tiempo', 'One day, zero rush': 'Un día sin prisas', 'Sail in style': 'Navega con estilo', 'From port to wonders': 'Del puerto a las maravillas' }
const eyebrowIt: Record<string, string> = { 'Take your time': 'Prenditi il tuo tempo', 'One day, zero rush': 'Un giorno senza fretta', 'Sail in style': 'Naviga con stile', 'From port to wonders': 'Dal porto alle meraviglie' }
const featEs: Record<string, string> = { 'Multi-city routes': 'Rutas por varias ciudades', 'Private groups': 'Grupos privados', 'Hours, not days': 'Horas, no días', 'Single city': 'Una sola ciudad', '5-star decks': 'Cubiertas de 5 estrellas', 'Full board': 'Pensión completa', 'Port pickup': 'Recogida en el puerto', 'Back on time': 'Regreso a tiempo', 'Nile itineraries': 'Itinerarios por el Nilo', 'Cruise options': 'Opciones de crucero' }
const featIt: Record<string, string> = { 'Multi-city routes': 'Itinerari multi-città', 'Private groups': 'Gruppi privati', 'Hours, not days': 'Ore, non giorni', 'Single city': 'Una sola città', '5-star decks': 'Ponti a 5 stelle', 'Full board': 'Pensione completa', 'Port pickup': 'Prelievo al porto', 'Back on time': 'Rientro in orario', 'Nile itineraries': 'Itinerari sul Nilo', 'Cruise options': 'Opzioni di crociera' }
function featLabel(locale: Locale, text: string, arText: string) { return tx(locale, { en: text, es: featEs[text] ?? text, it: featIt[text] ?? text, ar: arText }) }

const crumbNames: Record<string, { ar: string; es: string; it: string }> = {'Egypt Tours': { ar: 'جولات مصر', es: 'Circuitos por Egipto', it: 'Tour in Egitto' }, 'Nile Cruises': { ar: 'رحلات النيل', es: 'Cruceros por el Nilo', it: 'Crociere sul Nilo' }, Trips: { ar: 'كل الرحلات', es: 'Viajes', it: 'Viaggi' }}
export function Breadcrumb({items}:{items:string[]}){const {locale}=useLocale(); return <div className="breadcrumb"><div className="container"><Link href="/">{tx(locale, { en: 'Home', es: 'Inicio', it: 'Home', ar: 'الرئيسية' })}</Link>{items.map(i=><span key={i}>› {tx(locale, { en: i, es: crumbNames[i]?.es, it: crumbNames[i]?.it, ar: crumbNames[i]?.ar })}</span>)}</div></div>}

export function Heading({title,copy}:{title:string;copy?:string}){return <div className="section-heading"><h1>{title}</h1>{copy&&<p>{copy}</p>}</div>}

export type TourFilters={destination:string;duration:string;price:string}

export function CategoryFilter({destination,duration,price,destinationOptions,durationOptions,appliedCount,onDestination,onDuration,onPrice,onSearch,onReset}:{destination:string;duration:string;price:string;destinationOptions:readonly string[];durationOptions:readonly string[];appliedCount:number;onDestination:(v:string)=>void;onDuration:(v:string)=>void;onPrice:(v:string)=>void;onSearch:()=>void;onReset:()=>void}){const {currency,locale:fl}=useLocale(); const lo=formatPrice(200,currency,fl); const hi=formatPrice(400,currency,fl); const bandLabel=(id:string)=>tx(fl, { en: id==='under-200' ? `Under ${lo}` : id==='200-400' ? `${lo} - ${hi}` : `Over ${hi}`, es: id==='under-200' ? `Menos de ${lo}` : id==='200-400' ? `${lo} - ${hi}` : `Más de ${hi}`, it: id==='under-200' ? `Meno di ${lo}` : id==='200-400' ? `${lo} - ${hi}` : `Più di ${hi}`, ar: id==='under-200' ? `أقل من ${lo}` : id==='200-400' ? `${lo} - ${hi}` : `أكثر من ${hi}` }); const rtl=typeof document!=='undefined'&&document.documentElement.dir==='rtl'; return <div className="category-filter"><div className="filter-wrapper" dir={rtl ? 'rtl' : 'ltr'}><div className="filter-grid"><label className="filter-field"><span>{tx(fl, { en: 'Destination', es: 'Destino', it: 'Destinazione', ar: 'الوجهة' })}</span><SharedSelect value={destination} onChange={onDestination} locale={fl} options={[{value:'',label:tx(fl, { en: 'All destinations', es: 'Todos los destinos', it: 'Tutte le destinazioni', ar: 'كل الوجهات' })},...destinationOptions.map((d)=>({value:d,label:d}))]} /></label><label className="filter-field"><span>{tx(fl, { en: 'Duration', es: 'Duración', it: 'Durata', ar: 'المدة' })}</span><SharedSelect value={duration} onChange={onDuration} locale={fl} options={[{value:'',label:tx(fl, { en: 'Any duration', es: 'Cualquier duración', it: 'Qualsiasi durata', ar: 'أي مدة' })},...durationOptions.map((d)=>({value:d,label:d}))]} /></label><label className="filter-field"><span>{tx(fl, { en: 'Price', es: 'Precio', it: 'Prezzo', ar: 'السعر' })}</span><SharedSelect value={price} onChange={onPrice} locale={fl} options={[{value:'',label:tx(fl, { en: 'Any price', es: 'Cualquier precio', it: 'Qualsiasi prezzo', ar: 'أي سعر' })},...tourPriceBands.filter((band)=>band.id!=='').map((band)=>({value:band.id,label:bandLabel(band.id)}))]} /></label></div><div className="filter-actions">{appliedCount>0?<div className="applied-count">{tx(fl, { en: `${appliedCount} filter${appliedCount!==1?'s':''} applied`, es: `${appliedCount} filtro${appliedCount!==1?'s':''} aplicado`, it: `${appliedCount} filtro${appliedCount!==1?'i':''} applicati`, ar: `${appliedCount} فلتر${appliedCount!==1?'s':''} مطبق` })}</div>:null}<button type="button" className="reset-btn" onClick={onReset}>{tx(fl, { en: 'Reset Filters', es: 'Borrar filtros', it: 'Cancella i filtri', ar: 'إعادة ضبط الفلاتر' })}</button><button type="button" className="primary-btn search-btn" onClick={onSearch}>{tx(fl, { en: 'Search', es: 'Buscar', it: 'Cerca', ar: 'بحث' })}</button></div></div></div>}

export function TourListing({slug}:{slug:TourCategory}){return <SiteShell><Suspense><TourListingInner slug={slug}/></Suspense></SiteShell>}

function TourListingInner({slug}:{slug:TourCategory}){const set=tourCategories[slug]; const variant=set.variant; const meta=catMeta[variant]; const {locale:tl}=useLocale(); const catTitle=pickLocaleText(tl, { en: set.title, ar: categoryCopy[slug].titleAr }); const catIntro=pickLocaleText(tl, { en: set.intro, ar: categoryCopy[slug].introAr }); const catEyebrow=tx(tl, { en: meta.eyebrow, es: eyebrowEs[meta.eyebrow] ?? meta.eyebrow, it: eyebrowIt[meta.eyebrow] ?? meta.eyebrow, ar: meta.eyebrowAr }); const sortLabel=(o:string)=>tx(tl, { en: o, es: o==='Price: low to high' ? 'Precio: de menor a mayor' : o==='Price: high to low' ? 'Precio: de mayor a menor' : 'Recomendados', it: o==='Price: low to high' ? 'Prezzo: dal più basso' : o==='Price: high to low' ? 'Prezzo: dal più alto' : 'Consigliati', ar: o==='Price: low to high' ? 'السعر: من الأقل' : o==='Price: high to low' ? 'السعر: من الأعلى' : 'الموصى بها' }); const allTours=useDbTours(getToursByCategory(slug)); const featured=allTours[0]; const destinationOptions=Array.from(new Set(allTours.map((tour)=>tour.location))); const durationOptions=Array.from(new Set(allTours.map((tour)=>tour.duration))); const searchParams=useSearchParams(); const router=useRouter(); const pathname=usePathname(); const query=parseTourListingQuery(searchParams,destinationOptions,durationOptions); const [destination,setDestination]=useState(query.destination); const [duration,setDuration]=useState(query.duration); const [price,setPrice]=useState(query.price); useEffect(()=>{setDestination(query.destination);setDuration(query.duration);setPrice(query.price)},[query.destination,query.duration,query.price]); const perPage=6; const go=(next:TourListingQuery)=>{const params=new URLSearchParams(); if(next.destination)params.set('destination',next.destination); if(next.duration)params.set('duration',next.duration); if(next.price)params.set('price',next.price); if(next.sort!=='Recommended')params.set('sort',next.sort); if(next.page>1)params.set('page',String(next.page)); const qs=params.toString(); router.replace(pathname+(qs?`?${qs}`:''),{scroll:false})}; const applyFilters=()=>go({destination,duration,price,sort:query.sort,page:1}); const resetFilters=()=>{setDestination('');setDuration('');setPrice('');go({destination:'',duration:'',price:'',sort:query.sort,page:1})}; const appliedCount=[query.destination,query.duration,query.price].filter(Boolean).length; const filtered=allTours.filter((t)=>(!query.destination||t.location===query.destination)&&(!query.duration||t.duration===query.duration)&&matchPriceBand(t.price,query.price)); const sorted=[...filtered].sort((a,b)=>query.sort==='Price: low to high'?(a.price-b.price||(a.slug<b.slug?-1:1)):query.sort==='Price: high to low'?(b.price-a.price||(a.slug<b.slug?-1:1)):0); const totalPages=Math.max(1,Math.ceil(sorted.length/perPage)); const safePage=Math.min(Math.max(1,query.page),totalPages); const paged=sorted.slice((safePage-1)*perPage,safePage*perPage); const isShore=slug==='shore-excursions'; return <><TourCategoryHero showFeatured={!!featured} image={featured?.image || '/egypt-hero.png'} eyebrow={catEyebrow} title={catTitle} intro={catIntro} primaryLabel={isShore ? tx(tl, { en: 'Explore shore excursions', es: 'Explora las excursiones en tierra', it: 'Esplora le escursioni a terra', ar: 'استكشف رحلات الموانئ' }) : tx(tl, { en: 'Explore journeys', es: 'Explora los viajes', it: 'Esplora i viaggi', ar: 'استكشف الباقات' })} primaryHref="#tour-listing" featuredLabel={isShore ? tx(tl, { en: 'Featured shore excursion', es: 'Excursión en tierra destacada', it: 'Escursione a terra in evidenza', ar: 'رحلة ميناء مميزة' }) : tx(tl, { en: 'Featured journey', es: 'Viaje destacado', it: 'Viaggio in evidenza', ar: 'باقة مميزة' })} featuredTitle={pickLocaleText(tl, { en: featured?.title ?? '', ar: featured?.titleAr })} featuredHref={`/egypt-tours/${featured?.slug ?? ''}`} featuredLocation={tl === 'ar' ? localizeTourLocation((featured?.location ?? '')) : (featured?.location ?? '')} featuredDuration={tl === 'ar' ? localizeTourDuration((featured?.duration ?? '')) : (featured?.duration ?? '')} statsLabel={tx(tl, { en: 'Tours summary', es: 'Resumen de viajes', it: 'Riepilogo dei viaggi', ar: 'ملخص الرحلات' })} stats={[{value:allTours.length,label:isShore ? tx(tl, { en: 'Shore excursions', es: 'Excursiones en tierra', it: 'Escursioni a terra', ar: 'رحلات موانئ' }) : tx(tl, { en: 'Journeys available', es: 'Viajes disponibles', it: 'Viaggi disponibili', ar: 'باقات متاحة' })},{value:destinationOptions.length,label:isShore ? tx(tl, { en: 'Ports & destinations', es: 'Puertos y destinos', it: 'Porti e destinazioni', ar: 'موانئ ووجهات' }) : tx(tl, { en: 'Egypt destinations', es: 'Destinos egipcios', it: 'Destinazioni egiziane', ar: 'وجهات مصرية' })}]}/><Breadcrumb items={[tx(tl, { en: 'Egypt Tours', es: 'Circuitos por Egipto', it: 'Tour in Egitto', ar: 'جولات مصر' }), catTitle]}/><main id="tour-listing" className="listing-page container"><CategoryFilter destination={destination} duration={duration} price={price} destinationOptions={destinationOptions} durationOptions={durationOptions} appliedCount={appliedCount} onDestination={setDestination} onDuration={setDuration} onPrice={setPrice} onSearch={applyFilters} onReset={resetFilters}/><div className="results-bar"><strong role="status">{tx(tl, { en: `${sorted.length} tour${sorted.length===1?'':'s'} found`, es: `${sorted.length} recorridos disponibles`, it: `${sorted.length} tour disponibili`, ar: `${sorted.length} رحلات متاحة` })}</strong><SharedSelect value={query.sort} onChange={(o)=>go({...query,sort:o as TourListingQuery['sort'],page:1})} locale={tl} label={tx(tl, { en: 'Sort by', es: 'Ordenar por', it: 'Ordina per', ar: 'ترتيب حسب' })} options={tourListingSorts.map((o)=>({value:o,label:sortLabel(o)}))} /></div>{paged.length?<div className="listing-grid">{paged.map(t=><TourCard key={t.slug} tour={t} variant={variant}/>)}</div>:<div className="account-empty"><h3>{tx(tl, { en: 'No tours match your filters.', es: 'Ningún viaje coincide con tus filtros.', it: 'Nessun viaggio corrisponde ai tuoi filtri.', ar: 'لا توجد رحلات تطابق الفلاتر.' })}</h3><p>{tx(tl, { en: 'Try a different destination or reset the filters to see everything.', es: 'Prueba otro destino o borra los filtros para verlo todo.', it: 'Prova un’altra destinazione o cancella i filtri per vedere tutto.', ar: 'جرّب وجهة مختلفة أو امسح الفلاتر لعرض كل الرحلات.' })}</p><button type="button" className="primary-btn" onClick={resetFilters}>{tx(tl, { en: 'Reset Filters', es: 'Borrar filtros', it: 'Cancella i filtri', ar: 'مسح الفلاتر' })}</button></div>}<nav className="pagination" aria-label={tx(tl, { en: 'Tour listing pages', es: 'Páginas de viajes', it: 'Pagine dei viaggi', ar: 'صفحات الرحلات' })}><button type="button" onClick={()=>go({...query,page:Math.max(1,safePage-1)})} aria-label={tx(tl, { en: 'Previous page', es: 'Página anterior', it: 'Pagina precedente', ar: 'الصفحة السابقة' })} disabled={safePage<=1} style={safePage<=1?{opacity:.5}:undefined}>{tx(tl, { en: '‹ Back', es: '‹ Atrás', it: '‹ Indietro', ar: '› السابق' })}</button>{Array.from({length:totalPages},(_,i)=>safePage===i+1?<b key={i+1} aria-current="page">{i+1}</b>:<button key={i+1} type="button" aria-label={tx(tl, { en: `Go to page ${i+1}`, es: `Ve a la página ${i+1}`, it: `Vai alla pagina ${i+1}`, ar: `انتقل إلى صفحة ${i+1}` })} onClick={()=>go({...query,page:i+1})}>{i+1}</button>)}<button type="button" onClick={()=>go({...query,page:Math.min(totalPages,safePage+1)})} aria-label={tx(tl, { en: 'Next page', es: 'Página siguiente', it: 'Pagina successiva', ar: 'الصفحة التالية' })} disabled={safePage>=totalPages} style={safePage>=totalPages?{opacity:.5}:undefined}>{tx(tl, { en: 'Next ›', es: 'Siguiente ›', it: 'Avanti ›', ar: 'التالي ‹' })}</button></nav></main><HelpCTA/></>}

export function HelpCTA(){return <SharedHelpCTA />}

export function HomePage(){return <SiteShell><main><section className="hero"><img src="/egypt-hero.png" alt="Egyptian temple and desert"/><div className="hero-overlay"/><div className="hero-copy"><span>Get started your</span><h1>Exciting Journey With Us</h1></div><TripSearchEngine/></section><section className="stats container">{[['+100K','Happy customers'],['+50','Years of experience'],['+60','Total destinations'],['5.0','Rating in Tripadvisor']].map(([a,b])=><div key={b}><b>{a}</b><span>{b}</span></div>)}</section><section className="section container"><Heading title="Explore Egypt's Top Tours" copy="From the Pyramids to the Nile - find your perfect adventure."/><div className="tour-grid">{seasonalTours.map(t=><TourCard key={t.slug} tour={t}/>)}</div></section><section className="section pale"><div className="container"><Heading title="Popular Destination" copy="Every corner of Egypt has a story waiting for you."/><div className="destination-grid">{['Pyramids & Giza','White Desert','Nile Valley','Red Sea','Luxor Temples','Cairo Markets'].map((x,i)=><article className="destination" key={x}><img src={images[(i+1)%images.length]} alt={x}/><div><small>Explore now</small><h3>{x}</h3></div></article>)}</div></div></section><section className="section how"><div className="container"><Heading title="How it works?" copy="Only three steps away from Egypt."/><div className="steps">{['Finding Trip','Booking','Enjoy'].map((x,i)=><div key={x}><b>{i+1}</b><h3>{x}</h3><p>Start your journey</p></div>)}</div></div></section><section className="section container"><Heading title="Highlights of Egypt" copy="Discover the most important landmarks in Egypt."/><div className="highlight-row">{['Aswan Tours','Hurghada Tours','Sharm El Sheikh Tours','Dahab Tours'].map((x,i)=><div key={x}><img src={images[i%images.length]} alt={x}/><strong>{x}</strong></div>)}</div></section><HelpCTA/></main></SiteShell>}
