'use client'

import { trackPublicNavigation } from "@/lib/tracking/tracking-events";
import { NavigationMenu } from "./navigation-menu";
import { usePublishedNavigation } from "./navigation-context";
import { useMarketingNotifications } from "@/lib/marketing/marketing-notifications-client";
import { localizedNotification } from "@/lib/marketing/marketing-notifications";
import { HeaderSearch } from "./header-search";
import { useSharedCopy } from "../cms/presentation-content-context";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Home, Compass, Menu, ShoppingCart, X, ArrowRight, BadgePercent, Bell, UserRound, LayoutDashboard } from "lucide-react";
import { offers } from "@/data/content";
import { catalogTours } from "@/data/tours";
import { useBrandSettings } from "@/lib/admin-store";
import { useDbOffers } from "@/lib/catalogue/offers-blogs-client";
import { toTopBarSlides } from "@/lib/marketing/marketing-campaigns";
import { BarIcons } from "../cms/promo-bar-icons";
import { useDbTours } from "@/lib/tours/tours-client";
import { useCart } from "@/lib/booking/cart";
import { tx, useLocale, type Locale } from "../locale";
import { HeaderSocials } from "./social-icons";
import { LanguageModal, LanguageToggle } from "../shared/language-selector";
import { LOCALE_SHORT_LABELS } from "@/lib/i18n/locale-config";
import { useCurrentUser } from "@/lib/use-current-user";
import type { AuthenticatedUser } from "@/lib/auth-types";
import { copy, extra } from "@/lib/i18n/site-copy";




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
 * Shared navigation configuration  -  single source of truth for both
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
 * Shared navigation links component  -  used by both normal and sticky headers.
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
        <HeaderSearch query={query} onQueryChange={setQuery} placeholder={t.search} submitLabel={ex.searchBtn}/>
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
          <nav onClickCapture={event => trackPublicNavigation(event.target, 'header')} className={publishedMenu !== null ? 'cms-managed-nav' : undefined} aria-label={tx(locale, { en: 'Primary navigation', es: 'Navegación principal', it: 'Navigazione principale', ar: 'القائمة الرئيسية' })}>
            {publishedMenu !== null ? <NavigationMenu navigation={publishedMenu} locale={locale} pathname={pathname} idPrefix="published-primary"/> : <NavLinks nav={navConfig} activeKey={activeNav} pathname={pathname} idPrefix="primary-nav" onToursOpen={() => setToursOpen((value) => !value)} toursOpen={toursOpen} onCompanyOpen={() => setCompanyOpen((value) => !value)} companyOpen={companyOpen} tourLinks={tourLinks} t={t} ex={ex} />}
          </nav>
          <div className="nav-right-actions" onClickCapture={event => trackPublicNavigation(event.target, 'header')}>{publishedMenu !== null ? <NavigationMenu navigation={publishedMenu} locale={locale} pathname={pathname} actions/> : <Link className={`make-trip-link${activeNav === 'make' ? ' active' : ''}`} href="/make-your-trip">{t.make}</Link>}<HeaderAuthAction user={headerUser} loading={headerUserLoading} signInLabel={t.signIn} dashboardLabel={t.dashboard} accountLabel={t.account} /></div>
        </div>
      </div>

      {languageOpen && <LanguageModal locale={locale} currency={currency} onClose={() => setLanguageOpen(false)} onSelect={setLocale} onCurrency={setCurrency}/>}
      {menu && <dialog ref={mobileMenuRef} id="public-mobile-menu" className="mobile-nav" aria-label={tx(locale, { en: 'Mobile navigation', es: 'Navegación móvil', it: 'Navigazione mobile', ar: 'قائمة الموبايل' })} onCancel={() => setMenu(false)} onMouseDown={(event) => { if (event.target === event.currentTarget) setMenu(false) }}>
        <div className="mobile-nav-content">
          <div className="mobile-nav-heading"><Logo/><button type="button" className="icon-btn" autoFocus onClick={() => setMenu(false)} aria-label={tx(locale, { en: 'Close menu', es: 'Cerrar menú', it: 'Chiudi menu', ar: 'إغلاق القائمة' })}><X size={20}/></button></div>
          <nav onClickCapture={event => trackPublicNavigation(event.target, 'mobile_menu')}>{publishedMenu !== null ? <NavigationMenu navigation={publishedMenu} locale={locale} pathname={pathname} mobile onNavigate={() => setMenu(false)}/> : mobileGroups.map((group) => <section key={group.label}><h2>{group.label}</h2>{group.links.map(([label, href]) => <Link key={href} href={href} aria-current={pathname === href ? 'page' : undefined} onClick={() => setMenu(false)}>{label}<ArrowRight size={16} aria-hidden="true"/></Link>)}</section>)}</nav>
          <div className="mobile-nav-account"><HeaderAuthAction mobile user={headerUser} loading={headerUserLoading} signInLabel={t.signIn} dashboardLabel={t.dashboard} accountLabel={t.account} onNavigate={() => setMenu(false)} /></div>
        </div>
      </dialog>}
    </header>
    <HeaderSearch mobile query={query} onQueryChange={setQuery} placeholder={t.search} submitLabel={ex.searchBtn}/>
    <div className={scrolled ? 'compact-sticky-header is-open' : 'compact-sticky-header'} aria-hidden={!scrolled}>
      <div className="container compact-sticky-inner">
        <Logo/>
        <nav onClickCapture={event => trackPublicNavigation(event.target, 'sticky_header')} className={publishedMenu !== null ? 'cms-managed-nav' : undefined} aria-label={tx(locale, { en: 'Sticky navigation', es: 'Navegación fija', it: 'Navigazione fissa', ar: 'القائمة العائمة' })}>
          {publishedMenu !== null ? <NavigationMenu navigation={publishedMenu} locale={locale} pathname={pathname} idPrefix="published-sticky"/> : <NavLinks nav={navConfig} activeKey={activeNav} pathname={pathname} idPrefix="compact-nav" onToursOpen={() => setToursOpen((value) => !value)} toursOpen={toursOpen} onCompanyOpen={() => setCompanyOpen((value) => !value)} companyOpen={companyOpen} tourLinks={tourLinks} t={t} ex={ex} />}
        </nav>
        <div className="compact-sticky-actions" onClickCapture={event => trackPublicNavigation(event.target, 'sticky_header')}>
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

export { COMPANY_LABELS }
