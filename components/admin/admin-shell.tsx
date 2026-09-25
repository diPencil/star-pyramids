'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  Bell,
  CalendarCheck,
  CarFront,
  ChevronDown,
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
  Ticket,
  User,
  Users,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { readAdminProfile, type AdminProfile } from '@/lib/admin-store'
import { currentUser } from './admin-data'
import { Avatar } from './admin-ui'

const groups = [
  {
    label: 'القائمة',
    items: [
      { href: '/admin/dashboard', icon: LayoutDashboard, en: 'Dashboard', ar: 'لوحة المؤشرات' },
      { href: '/admin/bookings', icon: ShoppingCart, en: 'Bookings', ar: 'الحجوزات', badge: '6' },
      { href: '/admin/trips', icon: Map, en: 'Trips', ar: 'الرحلات' },
      { href: '/admin/destinations', icon: MapPinned, en: 'Destinations', ar: 'الوجهات' },
      { href: '/admin/events', icon: CalendarCheck, en: 'Events', ar: 'الفعاليات' },
      { href: '/admin/offers', icon: Ticket, en: 'Special Offers', ar: 'العروض الخاصة' },
      { href: '/admin/blogs', icon: Newspaper, en: 'Blogs', ar: 'المدونة' },
      { href: '/admin/cars', icon: CarFront, en: 'Rent Cars', ar: 'تأجير السيارات' },
      { href: '/admin/customers', icon: Users, en: 'Customers', ar: 'العملاء' },
    ],
  },
  {
    label: 'التواصل',
    items: [
      { href: '/admin/inbox', icon: MessageCircle, en: 'Inbox', ar: 'صندوق المراسلة', badge: '2' },
      { href: '/admin/emails', icon: Mail, en: 'Emails', ar: 'البريد' },
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
  const [profile, setProfile] = useState<AdminProfile>(() => readAdminProfile())

  useEffect(() => {
    document.documentElement.classList.add('sp-admin-root')
    const c = window.localStorage.getItem('sp-admin-collapsed')
    if (c === '1') setCollapsed(true)
    const l = window.localStorage.getItem('star-locale')
    if (l === 'ar') setLocale('ar')
    const cur = window.localStorage.getItem('star-currency')
    if (cur === 'USD' || cur === 'EUR' || cur === 'EGP') setCurrency(cur)
    return () => {
      document.documentElement.classList.remove('sp-admin-root')
    }
  }, [])

  useEffect(() => {
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr'
    document.documentElement.lang = locale
    window.localStorage.setItem('star-locale', locale)
    window.dispatchEvent(new Event('sp-admin-locale'))
  }, [locale])

  useEffect(() => {
    window.localStorage.setItem('star-currency', currency)
  }, [currency])

  useEffect(() => {
    window.localStorage.setItem('sp-admin-collapsed', collapsed ? '1' : '0')
  }, [collapsed])

  useEffect(() => {
    const sync = () => setProfile(readAdminProfile())
    sync()
    window.addEventListener('sp-profile', sync)
    return () => window.removeEventListener('sp-profile', sync)
  }, [])

  useEffect(() => {
    setNotificationsOpen(false)
    setUserMenu(false)
    setMobileOpen(false)
  }, [pathname])

  const logout = () => {
    setUserMenu(false)
    router.push('/login')
  }

  const ar = locale === 'ar'
  const searchResults = query.trim()
    ? groups.flatMap((group) => group.items).filter((item) => `${item.en} ${item.ar}`.toLowerCase().includes(query.trim().toLowerCase()))
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

        <nav className="sp-nav">
          {groups.map((g) => (
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
                    {!collapsed && item.badge && <em>{item.badge}</em>}
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        <div className="sp-side-user">
          <Avatar name={profile.name} src={profile.avatar} size={38} online />
          {!collapsed && (
            <div>
              <strong>{profile.name}</strong>
              <small>{profile.email}</small>
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
            <a
              className="sp-icon-btn"
              href="/"
              target="_blank"
              rel="noreferrer"
              aria-label={ar ? 'فتح الموقع' : 'View website'}
              title={ar ? 'فتح الموقع' : 'View website'}
            >
              <ExternalLink size={18} />
            </a>
            <button type="button" className="sp-icon-btn" aria-label="Notifications" aria-expanded={notificationsOpen} onClick={() => { setNotificationsOpen((open) => !open); setUserMenu(false) }}>
              <Bell size={18} />
              <i className="dot" />
            </button>
            {notificationsOpen && <div className="sp-notifications" role="dialog" aria-label={ar ? 'الإشعارات' : 'Notifications'}>
              <header><strong>{ar ? 'الإشعارات' : 'Notifications'}</strong><small>3 {ar ? 'جديدة' : 'new'}</small></header>
              <Link href="/admin/bookings" onClick={() => setNotificationsOpen(false)}><ShoppingCart size={17} /><span><b>{ar ? 'حجز جديد يحتاج مراجعة' : 'New booking needs review'}</b><small>BK-9040, 4 guests</small></span></Link>
              <Link href="/admin/inbox" onClick={() => setNotificationsOpen(false)}><MessageCircle size={17} /><span><b>{ar ? 'رسالتان غير مقروءتين' : 'Two unread messages'}</b><small>WhatsApp inbox</small></span></Link>
              <Link href="/admin/emails" onClick={() => setNotificationsOpen(false)}><Mail size={17} /><span><b>{ar ? 'طلب عرض سعر جديد' : 'New quote request'}</b><small>Nile cruise for 4</small></span></Link>
            </div>}
            <div className="sp-user-wrap">
              <button
                type="button"
                className="sp-user-chip"
                aria-haspopup="menu"
                aria-expanded={userMenu}
                aria-label={ar ? 'قائمة الحساب' : 'Account menu'}
                onClick={() => { setUserMenu((open) => !open); setNotificationsOpen(false) }}
              >
                <Avatar name={profile.name} src={profile.avatar} size={34} />
                <span>
                  <strong>{profile.name}</strong>
                  <small>{currentUser.roleLabel}</small>
                </span>
                <ChevronDown size={15} />
              </button>
              {userMenu && <div className="sp-user-menu" role="menu">
                <Link href="/admin/profile" role="menuitem" onClick={() => setUserMenu(false)}><User size={16} /><span><b>{ar ? 'البروفايل' : 'Profile'}</b><small>{profile.email}</small></span></Link>
                <button type="button" role="menuitem" onClick={logout}><LogOut size={16} /><span><b>{ar ? 'تسجيل الخروج' : 'Logout'}</b></span></button>
              </div>}
            </div>
          </div>
        </header>
        <main className="sp-content">{children}</main>
      </div>
      {languageOpen && (
        <AdminLanguageModal
          locale={locale}
          currency={currency}
          onClose={() => setLanguageOpen(false)}
          onSelect={setLocale}
          onCurrency={setCurrency}
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

export function PageHead({
  eyebrow,
  title,
  titleAr,
  sub,
  subAr,
  actions,
}: {
  eyebrow: string
  title: string
  titleAr?: string
  sub?: string
  subAr?: string
  actions?: React.ReactNode
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
      <div>
        <p>{eyebrow}</p>
        <h1>{locale === 'ar' && titleAr ? titleAr : title}</h1>
        {sub && <span>{locale === 'ar' && subAr ? subAr : sub}</span>}
      </div>
      {actions && <div className="sp-pagehead-actions">{actions}</div>}
    </div>
  )
}
