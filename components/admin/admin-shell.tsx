'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import {
  Bell,
  CalendarCheck,
  CarFront,
  ChevronDown,
  ClipboardList,
  Compass,
  CreditCard,
  ExternalLink,
  Globe2,
  LayoutDashboard,
  LogOut,
  Mail,
  Map,
  MapPinned,
  Menu,
  MessageCircle,
  Newspaper,
  PanelLeftClose,
  Search,
  Settings,
  ShoppingCart,
  Sparkles,
  Tags,
  Ticket,
  User,
  Users,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCurrentUser } from '@/lib/use-current-user'
import { useAdminNotifications, type AdminNotification } from '@/lib/admin-notifications'
import { NotificationPanel as SharedNotificationPanel } from '@/components/notification-panel'
import { Avatar } from './admin-ui'
import { AdminBackButton } from './admin-back'

function timeAgo(iso: string, ar: boolean): string {
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return ''
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000))
  if (seconds < 60) return ar ? 'الآن' : 'Just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return ar ? `منذ ${minutes} د` : `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return ar ? `منذ ${hours} س` : `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return ar ? `منذ ${days} يوم` : `${days}d ago`
  return new Date(iso).toLocaleDateString(ar ? 'ar-EG' : 'en-US', { day: 'numeric', month: 'short' })
}

function iconForAdminNotification(type: string) {
  switch (type) {
    case 'admin_booking_created':
      return ShoppingCart
    case 'admin_trip_request_submitted':
      return Compass
    case 'admin_car_request_submitted':
      return CarFront
    case 'admin_event_request_submitted':
      return ClipboardList
    case 'admin_payment_initiated':
      return CreditCard
    default:
      return Bell
  }
}

/**
 * Minimum view permission (any-of) required to show each admin section.
 * Dashboard stays visible to every staff identity as the shell landing
 * page; every other section mirrors the `*.view` key its API enforces,
 * so a bookings-only user never sees Payments, Users or Settings links.
 * APIs remain the source of truth — this only keeps navigation honest.
 */
const NAV_VIEW_PERMISSIONS: Record<string, string[]> = {
  '/admin/bookings': ['bookings.view'],
  '/admin/payments': ['payments.view'],
  '/admin/trips': ['tours.view'],
  '/admin/destinations': ['destinations.view'],
  '/admin/multi-day-categories': ['categories.view'],
  '/admin/events': ['events.view'],
  '/admin/event-requests': ['requests.view'],
  '/admin/offers': ['offers.view'],
  '/admin/blogs': ['blogs.view'],
  '/admin/cars': ['cars.view'],
  '/admin/car-requests': ['requests.view'],
  '/admin/trip-requests': ['requests.view'],
  '/admin/customers': ['customers.view'],
  '/admin/inbox': ['support.view'],
  '/admin/emails': ['emails.view'],
  '/admin/reviews': ['reviews.view'],
  '/admin/users': ['users.view', 'roles.view'],
  '/admin/settings': ['settings.view'],
}

function canSeeNavItem(
  user: { roles?: string[]; permissions?: string[] },
  href: string,
): boolean {
  if (user.roles?.includes('SUPER_ADMIN')) return true
  const keys = NAV_VIEW_PERMISSIONS[href]
  if (!keys) return true
  const permissions = user.permissions ?? []
  return keys.some((key) => permissions.includes(key))
}

const groups = [
  {
    label: 'القائمة',
    items: [
      { href: '/admin/dashboard', icon: LayoutDashboard, en: 'Dashboard', ar: 'لوحة المؤشرات' },
      { href: '/admin/bookings', icon: ShoppingCart, en: 'Bookings', ar: 'الحجوزات' },
      { href: '/admin/payments', icon: CreditCard, en: 'Payments', ar: 'المدفوعات' },
      { href: '/admin/trips', icon: Map, en: 'Trips', ar: 'الرحلات' },
      { href: '/admin/destinations', icon: MapPinned, en: 'Destinations', ar: 'الوجهات' },
      { href: '/admin/multi-day-categories', icon: Tags, en: 'Multi Day Categories', ar: 'فئات الرحلات' },
      { href: '/admin/events', icon: CalendarCheck, en: 'Events', ar: 'الفعاليات' },
      { href: '/admin/event-requests', icon: ClipboardList, en: 'Event Requests', ar: 'طلبات الفعاليات' },
      { href: '/admin/offers', icon: Ticket, en: 'Special Offers', ar: 'العروض الخاصة' },
      { href: '/admin/blogs', icon: Newspaper, en: 'Blogs', ar: 'المدونة' },
      { href: '/admin/cars', icon: CarFront, en: 'Rent Cars', ar: 'تأجير السيارات' },
      { href: '/admin/car-requests', icon: ClipboardList, en: 'Car Requests', ar: 'طلبات السيارات' },
      { href: '/admin/trip-requests', icon: Compass, en: 'Trip Requests', ar: 'طلبات الرحلات' },
      { href: '/admin/customers', icon: Users, en: 'Customers', ar: 'العملاء' },
    ],
  },
  {
    label: 'التواصل',
    items: [
      { href: '/admin/inbox', icon: MessageCircle, en: 'Inbox', ar: 'صندوق المراسلة' },
      { href: '/admin/emails', icon: Mail, en: 'Emails', ar: 'البريد' },
      { href: '/admin/reviews', icon: Sparkles, en: 'Reviews', ar: 'التقييمات' },
    ],
  },
  {
    label: 'الإدارة',
    items: [
      { href: '/admin/users', icon: Users, en: 'Users & Roles', ar: 'المستخدمون والصلاحيات' },
      { href: '/admin/settings', icon: Settings, en: 'Settings', ar: 'الإعدادات' },
    ],
  },
]

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [locale, setLocale] = useState<'en' | 'ar'>('en')
  const [currency, setCurrency] = useState<'USD' | 'EUR' | 'EGP'>('USD')
  const [languageOpen, setLanguageOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [userMenu, setUserMenu] = useState(false)
  const { user, loading: sessionLoading } = useCurrentUser()
  const adminNotifications = useAdminNotifications()
  const unreadCount = adminNotifications.unreadCount
  useEffect(() => {
    document.documentElement.classList.add('sp-admin-root')
    const c = window.localStorage.getItem('sp-admin-collapsed')
    if (c === '1') setCollapsed(true)
    const l = window.localStorage.getItem('star-locale')
    if (l === 'ar' || l === 'en') setLocale(l)
    const cur = window.localStorage.getItem('star-currency')
    if (cur === 'USD' || cur === 'EUR' || cur === 'EGP') setCurrency(cur)
    return () => {
      document.documentElement.classList.remove('sp-admin-root')
    }
  }, [])

  useEffect(() => {
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr'
    document.documentElement.lang = locale
    window.dispatchEvent(new Event('sp-admin-locale'))
  }, [locale])

  const changeLocale = useCallback((next: 'en' | 'ar') => {
    window.localStorage.setItem('star-locale', next)
    setLocale(next)
  }, [])

  const changeCurrency = useCallback((next: 'USD' | 'EUR' | 'EGP') => {
    window.localStorage.setItem('star-currency', next)
    setCurrency(next)
  }, [])

  useEffect(() => {
    window.localStorage.setItem('sp-admin-collapsed', collapsed ? '1' : '0')
  }, [collapsed])

  useEffect(() => {
    setNotificationsOpen(false)
    setUserMenu(false)
    setMobileOpen(false)
  }, [pathname])

  const logout = async () => {
    setUserMenu(false)
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
      })
    } catch {
      // Logout request failed; still redirect to login
    }
    router.push('/login')
  }

  const ar = locale === 'ar'
  // Until the session (roles + permissions) resolves, no real navigation
  // item is rendered — only neutral placeholders. This guarantees an
  // unauthorized link is never visible, even for a frame.
  const navReady = !sessionLoading && user !== null
  const visibleGroups = navReady
    ? groups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => canSeeNavItem(user, item.href)),
      }))
      .filter((group) => group.items.length > 0)
    : []
  const searchResults = query.trim()
    ? visibleGroups.flatMap((group) => group.items).filter((item) => `${item.en} ${item.ar}`.toLowerCase().includes(query.trim().toLowerCase()))
    : []

  return (
    <div className={cn('sp-admin', collapsed && 'is-collapsed', ar && 'is-rtl')}>
      <div
        className={cn('sp-scrim', mobileOpen && 'show')}
        onClick={() => setMobileOpen(false)}
      />
      <aside className={cn('sp-side', mobileOpen && 'open')}>
        <div className="sp-brand">
          <Link href="/admin/dashboard" className="sp-brand-link">
            <span className="sp-brand-mark"><img src="/favicon.png" alt="" /></span>
            {!collapsed && (
              <span className="sp-brand-copy">
                <strong>STAR PYRAMIDS</strong>
                <small>{ar ? 'لوحة الإدارة' : 'INTERNAL DASHBOARD'}</small>
              </span>
            )}
          </Link>
        </div>

        <nav className="sp-nav" aria-busy={!navReady}>
          {!navReady && (
            <p role="status" style={{ margin: '6px 8px 4px', color: '#9db4e8', fontSize: 12 }}>
              {ar ? 'جارٍ تحميل القائمة…' : 'Loading menu…'}
            </p>
          )}
          {(navReady ? visibleGroups : []).map((g) => (
            <div key={g.label} className="sp-nav-group">
              {!collapsed && <p>{ar ? g.label : g.label === 'القائمة' ? 'MENU' : g.label === 'التواصل' ? 'INBOX' : 'ADMINISTRATION'}</p>}
              {g.items.map((item) => {
                const active = pathname === item.href || pathname?.startsWith(item.href + '/')
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={ar ? item.ar : item.en}
                    className={cn('sp-nav-link', active && 'active')}
                    onClick={() => setMobileOpen(false)}
                  >
                    <item.icon size={18} />
                    {!collapsed && <span>{ar ? item.ar : item.en}</span>}
                  </Link>
                )
              })}
            </div>
          ))}
          {!navReady && groups.map((g) => (
            <div key={g.label} className="sp-nav-group" aria-hidden="true">
              {!collapsed && <p>{ar ? g.label : g.label === 'القائمة' ? 'MENU' : g.label === 'التواصل' ? 'INBOX' : 'ADMINISTRATION'}</p>}
              {g.items.map((item) => (
                <span key={item.href} className="sp-nav-link" style={{ pointerEvents: 'none' }}>
                  <span style={{ width: 18, height: 18, borderRadius: 6, background: 'rgba(255,255,255,.14)' }} />
                  {!collapsed && <span style={{ height: 12, borderRadius: 6, background: 'rgba(255,255,255,.14)', flex: 1 }} />}
                </span>
              ))}
            </div>
          ))}
        </nav>

        <div className="sp-side-user">
          <Avatar name={user?.email?.split('@')[0] ?? 'Admin'} size={38} online />
          {!collapsed && user && (
            <div>
              <strong>{user.email.split('@')[0]}</strong>
              <small>{user.email}</small>
            </div>
          )}
        </div>
      </aside>

      <div className="sp-main">
        <header className="sp-top">
          <button
            type="button"
            className="sp-icon-btn only-mobile"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <button
            type="button"
            className={cn('sp-icon-btn', 'sp-collapse-btn', collapsed && 'is-collapsed')}
            onClick={() => setCollapsed((v) => !v)}
            aria-label={ar ? 'طي القائمة الجانبية' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
            title={ar ? 'طي القائمة الجانبية' : 'Collapse sidebar'}
          >
            <PanelLeftClose size={18} />
          </button>
          <div className="sp-search">
            <Search size={17} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={ar ? 'بحث عن حجز أو رحلة أو عميل...' : 'Search bookings, trips, customers...'}
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} aria-label="Clear">
                <X size={15} />
              </button>
            )}
            {query && <div className="sp-search-results" role="listbox" aria-label={ar ? 'نتائج البحث' : 'Search results'}>
              {searchResults.length ? searchResults.map((item) => <Link key={item.href} href={item.href} onClick={() => setQuery('')}><item.icon size={16} /><span>{ar ? item.ar : item.en}</span></Link>) : <span>{ar ? 'لا توجد أقسام مطابقة' : 'No matching modules'}</span>}
            </div>}
          </div>
          <div className="sp-top-actions">
            <button className="language" onClick={() => setLanguageOpen(true)} aria-label="Open language and currency">
              <Globe2 size={18} />
              <span className="language-label-full">{(locale === 'ar' ? 'AR' : 'EN') + ' - ' + currency}</span>
              <span className="language-label-compact">{locale === 'ar' ? 'AR' : 'EN'}</span>
            </button>
            <Link
              className="sp-icon-btn"
              href="/"
              aria-label={ar ? 'فتح الموقع' : 'View website'}
              title={ar ? 'فتح الموقع' : 'View website'}
            >
              <ExternalLink size={18} />
            </Link>
            <button type="button" className="sp-icon-btn" aria-label={ar ? 'الإشعارات' : 'Notifications'} aria-expanded={notificationsOpen} onClick={() => { setNotificationsOpen((open) => !open); setUserMenu(false) }}>
              <Bell size={18} />
              {unreadCount > 0 && <i className="dot" aria-hidden="true" />}
            </button>
            {notificationsOpen && (
              <AdminNotificationPanel
                ar={ar}
                state={adminNotifications}
                onOpen={(href) => {
                  setNotificationsOpen(false)
                  if (href) router.push(href)
                }}
              />
            )}
            <div className="sp-user-wrap">
              <button
                type="button"
                className="sp-user-chip"
                aria-haspopup="menu"
                aria-expanded={userMenu}
                aria-label={ar ? 'قائمة الحساب' : 'Account menu'}
                onClick={() => { setUserMenu((open) => !open); setNotificationsOpen(false) }}
              >
                <Avatar name={user?.email?.split('@')[0] ?? 'Admin'} size={34} />
                <span>
                  <strong>{user?.email?.split('@')[0] ?? 'Admin'}</strong>
                  <small>{user?.roles?.join(', ') ?? ''}</small>
                </span>
                <ChevronDown size={15} />
              </button>
              {userMenu && <div className="sp-user-menu" role="menu">
                <Link href="/admin/profile" role="menuitem" onClick={() => setUserMenu(false)}><User size={16} /><span><b>{ar ? 'البروفايل' : 'Profile'}</b><small>{user?.email}</small></span></Link>
                <button type="button" role="menuitem" onClick={logout}><LogOut size={16} /><span><b>{ar ? 'تسجيل الخروج' : 'Logout'}</b></span></button>
              </div>}
            </div>
          </div>
        </header>
        <main className="sp-content">
          {children}
        </main>
      </div>
      {languageOpen && (
        <AdminLanguageModal
          locale={locale}
          currency={currency}
          onClose={() => setLanguageOpen(false)}
          onSelect={changeLocale}
          onCurrency={changeCurrency}
        />
      )}
    </div>
  )
}

const adminCopy = {
  en: { modalTitle: 'Language and Currency', curTitle: 'Currency', regTitle: 'Region and Language', soon: 'Soon', comingSoon: 'Coming soon' },
  ar: { modalTitle: 'اللغة والعملة', curTitle: 'العملة', regTitle: 'المنطقة واللغة', soon: 'قريبًا', comingSoon: 'قريبًا' },
} as const

function AdminLanguageModal({
  locale,
  currency,
  onClose,
  onSelect,
  onCurrency,
}: {
  locale: 'en' | 'ar'
  currency: 'USD' | 'EUR' | 'EGP'
  onClose: () => void
  onSelect: (locale: 'en' | 'ar') => void
  onCurrency: (currency: 'USD' | 'EUR' | 'EGP') => void
}) {
  const copy = adminCopy[locale]
  const currencies = [['US Dollar', '$ USD', 'USD'], ['Euro', '€ EUR', 'EUR'], ['Egyptian Pound', '£ EGP', 'EGP']] as const
  const regions = [['United States', 'English', 'en'], ['Egypt', 'العربية', 'ar'], ['France', 'Français', null], ['Germany', 'Deutsch', null], ['Italy', 'Italiano', null], ['Portugal', 'Português', null], ['Spain', 'Español', null], ['China', '中文', null]] as const
  return (
    <div className="language-backdrop" role="presentation" onMouseDown={onClose}>
      <div className="language-modal" role="dialog" aria-modal="true" aria-labelledby="language-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="language-modal-head">
          <h2 id="language-title">{copy.modalTitle}</h2>
          <button className="language-close" onClick={onClose} aria-label="Close language and currency"><X size={20} /></button>
        </div>
        <h3>{copy.curTitle}</h3>
        <div className="language-options currency-options">
          {currencies.map(([name, code, value]) => (
            <button key={code} className={currency === value ? 'selected' : ''} onClick={() => { onCurrency(value); onClose() }} aria-pressed={currency === value}>
              <span>{name}</span><strong>{code}</strong>
            </button>
          ))}
        </div>
        <h3>{copy.regTitle}</h3>
        <div className="language-options region-options">
          {regions.map(([region, language, value]) => value === null ? (
            <button key={region} type="button" disabled aria-disabled="true" title={copy.comingSoon}>
              <span>{region}</span><strong>{language}</strong><em className="lang-soon">{copy.soon}</em>
            </button>
          ) : (
            <button key={region} type="button" className={value === locale ? 'selected' : ''} onClick={() => { onSelect(value); onClose() }} aria-pressed={value === locale}>
              <span>{region}</span><strong>{language}</strong>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function AdminNotificationPanel({
  ar,
  state,
  onOpen,
}: {
  ar: boolean
  state: {
    recent: AdminNotification[]
    unreadCount: number
    loading: boolean
    loadError: string
    refresh: () => void
    markRead: (id: string) => Promise<boolean>
    markAllRead: () => Promise<boolean>
  }
  onOpen: (href: string | null) => void
}) {
  const { recent, unreadCount, loading, loadError, refresh, markRead, markAllRead } = state

  const openNotification = async (item: AdminNotification) => {
    await markRead(item.id)
    onOpen(item.href)
  }

  return (
    <SharedNotificationPanel
      items={recent}
      unreadCount={unreadCount}
      loading={loading}
      loadError={loadError}
      title={ar ? 'الإشعارات' : 'Notifications'}
      dialogLabel={ar ? 'الإشعارات' : 'Notifications'}
      unreadLabel={unreadCount > 0 ? (ar ? `${unreadCount} غير مقروء` : `${unreadCount} unread`) : null}
      markAllLabel={ar ? 'تعليم الكل كمقروء' : 'Mark all read'}
      markingAllLabel={ar ? 'جارٍ التعليم…' : 'Marking…'}
      loadingLabel={ar ? 'جارٍ تحميل الإشعارات' : 'Loading notifications'}
      retryLabel={ar ? 'إعادة المحاولة' : 'Retry'}
      emptyTitle={ar ? 'لا توجد إشعارات' : "You're all caught up"}
      emptyHint={ar ? 'ستظهر هنا طلبات العملاء والمدفوعات الجديدة.' : 'New customer requests and payments will appear here.'}
      iconForType={iconForAdminNotification}
      formatTime={(iso) => timeAgo(iso, ar)}
      linkItems={false}
      onOpenItem={openNotification}
      onMarkAll={() => markAllRead()}
      onRetry={refresh}
    />
  )
}

export function PageHead({
  eyebrow,
  title,
  titleAr,
  sub,
  subAr,
  actions,
  backHref,
  backLabelEn,
  backLabelAr,
}: {
  eyebrow: string
  title: string
  titleAr?: string
  sub?: string
  subAr?: string
  actions?: React.ReactNode
  backHref?: string
  backLabelEn?: string
  backLabelAr?: string
}) {
  const [locale, setLocale] = useState<'en' | 'ar'>('en')
  useEffect(() => {
    const syncLocale = () => setLocale(window.localStorage.getItem('star-locale') === 'ar' ? 'ar' : 'en')
    syncLocale()
    window.addEventListener('sp-admin-locale', syncLocale)
    return () => window.removeEventListener('sp-admin-locale', syncLocale)
  }, [])
  return (
    <div className="sp-pagehead">
      <div className="sp-pagehead-title-row">
        {backHref && <AdminBackButton href={backHref} labelEn={backLabelEn ?? 'Back'} labelAr={backLabelAr ?? 'رجوع'} />}
        <div>
          <p>{eyebrow}</p>
          <h1>{locale === 'ar' && titleAr ? titleAr : title}</h1>
          {sub && <span>{locale === 'ar' && subAr ? subAr : sub}</span>}
        </div>
      </div>
      {actions && <div className="sp-pagehead-actions">{actions}</div>}
    </div>
  )
}
