'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'
import {
  ArrowRight, Bell, CalendarDays, Check, CheckCircle2, ChevronDown, ChevronRight,
  CircleDollarSign, Clock3, CreditCard, ExternalLink, Globe2, Heart, HelpCircle,
  CheckCheck, Download, Eye, EyeOff, FileText, ImagePlus, KeyRound, Laptop, LayoutDashboard, LockKeyhole, LogOut, Mail, Menu,
  MessageCircle, PackageCheck, Paperclip, Plus, Printer, ReceiptText, Search, Send,
  Settings2, ShieldCheck, ShoppingBag, ShoppingCart, Star, Trash2, UserRound,
  Users, WalletCards, X,
} from 'lucide-react'
import { formatPrice, LocaleProvider, useLocale } from '@/components/locale'
import { catalogTours, findTour } from '@/data/tours'
import { countries, countryFlag, defaultCountry } from '@/data/countries'
import { localizeTourDuration, localizeTourLocation } from '@/lib/tour-format'
import { useCart } from '@/lib/cart'
import { useInquiries, useBrandSettings, useLiveTours, readImpersonation, stopImpersonation, type ImpersonatedCustomer } from '@/lib/admin-store'
import { usePagination } from '@/components/admin/admin-pagination'
import { bookings as adminBookings, type BookingRow } from '@/components/admin/admin-data'
import {
  readCustomerProfile, saveCustomerProfile, updateCustomerBooking, useCustomerBookings, useCustomerFavorites,
  useCustomerProfile, type CustomerBooking, type CustomerBookingStatus, type CustomerProfile,
} from '@/lib/customer-account'
import { clearMessageDraft, readMessageDraft, saveMessageDraft } from '@/lib/customer-account'
import {
  markCustomerChatRead, sendCustomerChatMessage, useCustomerChatMessages,
  type CustomerChatAttachment,
} from '@/lib/customer-chat'
import { whatsappHref } from '@/data/company'
import { WhatsAppGlyph } from '@/components/whatsapp-chat'

export type AccountSection = 'overview' | 'bookings' | 'favorites' | 'payments' | 'messages' | 'profile' | 'settings' | 'change-password'

export function useImpersonated() {
  const [impersonated, setImpersonated] = useState<ImpersonatedCustomer | null>(null)
  useEffect(() => {
    const sync = () => setImpersonated(readImpersonation())
    sync()
    window.addEventListener('sp-impersonate', sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener('sp-impersonate', sync)
      window.removeEventListener('storage', sync)
    }
  }, [])
  return impersonated
}

function mapAdminBooking(booking: BookingRow): CustomerBooking {
  return {
    reference: booking.id,
    createdAt: booking.date,
    status: booking.status === 'confirmed' ? 'confirmed' : booking.status === 'cancelled' ? 'cancelled' : 'request_received',
    paymentStatus: booking.status === 'confirmed' ? 'paid' : 'pending',
    paymentMethod: 'arrival',
    total: booking.total,
    currency: 'USD',
    contact: { name: booking.customer, email: '', phone: '' },
    notes: '',
    lines: [{
      key: booking.id, tourSlug: '', title: booking.tour, image: '', date: booking.date,
      adults: booking.guests, children: 0, infants: 0, addons: [], addonTotal: 0,
      adultUnit: 0, childUnit: 0, infantUnit: 0, total: booking.total,
    }],
  }
}

export function useVisibleBookings() {
  const impersonated = useImpersonated()
  const mine = useCustomerBookings()
  return useMemo(() => {
    if (!impersonated) return mine
    return adminBookings.filter((booking) => booking.customer === impersonated.name).map(mapAdminBooking)
  }, [impersonated, mine])
}

export function useVisibleInquiries() {
  const impersonated = useImpersonated()
  const inquiries = useInquiries()
  return useMemo(() => {
    if (!impersonated) return inquiries
    return inquiries.filter((inquiry) => inquiry.name.toLowerCase() === impersonated.name.toLowerCase())
  }, [impersonated, inquiries])
}

const sectionLinks = [
  { id: 'overview', href: '/account', Icon: LayoutDashboard, en: 'Overview', ar: 'نظرة عامة' },
  { id: 'bookings', href: '/account/bookings', Icon: ShoppingBag, en: 'My bookings', ar: 'حجوزاتي' },
  { id: 'favorites', href: '/account/favorites', Icon: Heart, en: 'Saved trips', ar: 'الرحلات المحفوظة' },
  { id: 'payments', href: '/account/payments', Icon: WalletCards, en: 'Payments', ar: 'المدفوعات' },
  { id: 'messages', href: '/account/messages', Icon: MessageCircle, en: 'Messages', ar: 'الرسائل' },
  { id: 'profile', href: '/account/profile', Icon: UserRound, en: 'Profile', ar: 'الملف الشخصي' },
  { id: 'settings', href: '/account/settings', Icon: Settings2, en: 'Settings', ar: 'الإعدادات' },
] as const

const sectionHeadings: Record<AccountSection, { en: string; ar: string; subEn: string; subAr: string }> = {
  overview: { en: 'Your travel desk', ar: 'مكتب رحلتك', subEn: 'Everything you need before, during, and after your Egypt journey.', subAr: 'كل ما تحتاجه قبل رحلتك إلى مصر وأثناءها وبعدها.' },
  bookings: { en: 'Bookings', ar: 'الحجوزات', subEn: 'Track requests, confirmations, travelers, and trip details.', subAr: 'تابع الطلبات والتأكيدات والمسافرين وتفاصيل الرحلات.' },
  favorites: { en: 'Saved trips', ar: 'الرحلات المحفوظة', subEn: 'Keep ideas together until you are ready to book.', subAr: 'اجمع أفكار رحلتك في مكان واحد لحين الحجز.' },
  payments: { en: 'Payments & receipts', ar: 'المدفوعات والإيصالات', subEn: 'A clear record of payment status for every booking.', subAr: 'سجل واضح لحالة الدفع الخاصة بكل حجز.' },
  messages: { en: 'Messages', ar: 'الرسائل', subEn: 'Keep your questions and travel conversations connected to each trip.', subAr: 'احتفظ بأسئلتك ومحادثات السفر مرتبطة بكل رحلة.' },
  profile: { en: 'Profile', ar: 'الملف الشخصي', subEn: 'Keep your identity and contact details accurate for every booking.', subAr: 'حدّث بياناتك الشخصية ووسائل التواصل المستخدمة في الحجوزات.' },
  settings: { en: 'Settings', ar: 'الإعدادات', subEn: 'Control preferences, notifications, security, and privacy.', subAr: 'تحكم في التفضيلات والتنبيهات والأمان والخصوصية.' },
  'change-password': { en: 'Change password', ar: 'تغيير كلمة المرور', subEn: 'Update your password without leaving your traveler account.', subAr: 'حدّث كلمة المرور من داخل حساب المسافر.' },
}

const bookingStatusCopy: Record<CustomerBookingStatus, { en: string; ar: string }> = {
  request_received: { en: 'Request received', ar: 'تم استلام الطلب' },
  confirmed: { en: 'Confirmed', ar: 'مؤكد' },
  completed: { en: 'Completed', ar: 'مكتمل' },
  cancelled: { en: 'Cancelled', ar: 'ملغي' },
}

function CustomerAvatar({ avatar, initials, className, name }: { avatar: string; initials: string; className: string; name: string }) {
  return <span className={className}>{initials}{avatar && <img src={avatar} alt={name} onError={(event) => { if (!event.currentTarget.src.endsWith('/placeholder-user.jpg')) event.currentTarget.src = '/placeholder-user.jpg'; else event.currentTarget.remove() }} />}</span>
}

export function AccountShell({ section, children }: { section: AccountSection; children: ReactNode }) {
  const { locale, setLocale, currency, setCurrency } = useLocale()
  const ar = locale === 'ar'
  const impersonated = useImpersonated()
  const storedProfile = useCustomerProfile()
  const profile = impersonated
    ? { ...storedProfile, fullName: impersonated.name, email: impersonated.email || storedProfile.email, avatar: impersonated.avatar || storedProfile.avatar }
    : storedProfile
  const bookings = useVisibleBookings()
  const inquiries = useVisibleInquiries()
  const chatMessages = useCustomerChatMessages()
  const unreadMessages = chatMessages.filter((message) => message.sender === 'agent' && !message.readByCustomer).length
  const favorites = useCustomerFavorites()
  const cart = useCart()
  const liveTours = useLiveTours(catalogTours)
  const heading = sectionHeadings[section]
  const initials = profile.fullName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'SP'
  const [mobileOpen, setMobileOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [userOpen, setUserOpen] = useState(false)
  const searchResults = useMemo(() => query.trim() ? liveTours.filter((tour) => `${tour.title} ${tour.location}`.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 5) : [], [liveTours, query])

  return <div className={`customer-dashboard section-${section} ${mobileOpen ? 'menu-open' : ''}`}>
    <button type="button" className="customer-dashboard-scrim" aria-label={ar ? 'إغلاق القائمة' : 'Close menu'} onClick={() => setMobileOpen(false)} />
    <aside className="customer-account-side">
      <Link href="/account" className="customer-dashboard-brand" onClick={() => setMobileOpen(false)}>
        <img src="/favicon.png" alt="" />
        <span><strong>STAR PYRAMIDS</strong><small>{ar ? 'حساب المسافر' : 'TRAVELER ACCOUNT'}</small></span>
      </Link>
        <div className="customer-profile-mini">
          <CustomerAvatar avatar={profile.avatar} initials={initials} className="customer-avatar" name={profile.fullName} />
          <div><strong>{profile.fullName}</strong><small>{profile.email}</small></div>
        </div>
        <nav aria-label={ar ? 'قائمة الحساب' : 'Account navigation'}>
          {sectionLinks.map(({ id, href, Icon, en, ar: arLabel }) => {
            const active = section === id || (section === 'change-password' && id === 'settings')
            return <Link key={id} href={href} onClick={() => setMobileOpen(false)} className={active ? 'active' : ''} aria-current={active ? 'page' : undefined}><Icon size={18} /><span>{ar ? arLabel : en}</span>{id === 'bookings' && bookings.length > 0 && <b>{bookings.length}</b>}{id === 'favorites' && favorites.slugs.length > 0 && <b>{favorites.slugs.length}</b>}{id === 'messages' && unreadMessages > 0 && <b>{unreadMessages}</b>}</Link>
          })}
        </nav>
        <div className="customer-side-summary">
          <ShoppingCart size={18} />
          <div><strong>{ar ? 'سلة الرحلات' : 'Trip cart'}</strong><small>{cart.lines ? (ar ? `${cart.lines} رحلات بانتظارك` : `${cart.lines} trip${cart.lines === 1 ? '' : 's'} waiting`) : (ar ? 'ابدأ بإضافة رحلة' : 'Start by adding a trip')}</small></div>
          <Link href="/cart" aria-label={ar ? 'فتح السلة' : 'Open cart'}><ChevronRight size={17} /></Link>
        </div>
        <Link href="/login" className="customer-signout"><LogOut size={17} />{ar ? 'تسجيل الخروج' : 'Sign out'}</Link>
    </aside>

    <div className="customer-dashboard-main">
      <header className="customer-dashboard-topbar">
        <button type="button" className="customer-mobile-menu" onClick={() => setMobileOpen(true)} aria-label={ar ? 'فتح القائمة' : 'Open menu'}><Menu size={20} /></button>
        <Link href="/account" className="customer-mobile-brand"><img src="/favicon.png" alt="" /><strong>STAR PYRAMIDS</strong></Link>
        <div className="customer-dashboard-search">
          <Search size={17} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={ar ? 'ابحث عن رحلة أو وجهة...' : 'Search trips and destinations...'} />
          {query && <button type="button" onClick={() => setQuery('')} aria-label={ar ? 'مسح البحث' : 'Clear search'}><X size={15} /></button>}
          {query && <div className="customer-search-results">{searchResults.length ? searchResults.map((tour) => <Link key={tour.slug} href={`/egypt-tours/${tour.slug}`} onClick={() => setQuery('')}><img src={tour.image} alt="" /><span><strong>{tour.title}</strong><small>{ar ? localizeTourLocation(tour.location) : tour.location}</small></span><ArrowRight size={14} /></Link>) : <span>{ar ? 'لا توجد رحلات مطابقة' : 'No matching trips'}</span>}</div>}
        </div>
        <div className="customer-dashboard-actions">
          <button type="button" className="customer-top-language" onClick={() => { setLocale(ar ? 'en' : 'ar'); setNotificationsOpen(false); setUserOpen(false) }} aria-label={ar ? 'Switch to English' : 'التبديل إلى العربية'}><Globe2 size={18} /><span>{ar ? 'AR' : 'EN'}</span></button>
          <select value={currency} onChange={(event) => setCurrency(event.target.value as 'USD' | 'EUR' | 'EGP')} aria-label={ar ? 'العملة' : 'Currency'}><option value="USD">USD</option><option value="EUR">EUR</option><option value="EGP">EGP</option></select>
          <Link href="/" className="customer-top-icon" aria-label={ar ? 'العودة للموقع' : 'Back to website'} title={ar ? 'العودة للموقع' : 'Back to website'}><ExternalLink size={18} /></Link>
          <Link href="/cart" className="customer-top-icon customer-cart-icon" aria-label={ar ? 'سلة الرحلات' : 'Trip cart'}><ShoppingCart size={18} />{cart.lines > 0 && <b>{cart.lines}</b>}</Link>
          <div className="customer-top-popover">
            <button type="button" className="customer-top-icon" onClick={() => { setNotificationsOpen((open) => !open); setUserOpen(false) }} aria-label={ar ? 'الإشعارات' : 'Notifications'} aria-expanded={notificationsOpen}><Bell size={18} />{(bookings.length + unreadMessages) > 0 && <i />}</button>
            {notificationsOpen && <div className="customer-notifications"><header><strong>{ar ? 'الإشعارات' : 'Notifications'}</strong><small>{bookings.length + unreadMessages}</small></header>{bookings[0] ? <Link href="/account/bookings" onClick={() => setNotificationsOpen(false)}><ShoppingBag size={17} /><span><b>{ar ? 'آخر تحديث للحجز' : 'Latest booking update'}</b><small>{bookings[0].reference}</small></span></Link> : <p>{ar ? 'لا توجد تحديثات حجوزات جديدة.' : 'No new booking updates.'}</p>}{unreadMessages > 0 && <Link href="/account/messages" onClick={() => setNotificationsOpen(false)}><MessageCircle size={17} /><span><b>{ar ? 'رد جديد من فريق الرحلات' : 'New reply from the travel team'}</b><small>{unreadMessages} {ar ? 'غير مقروءة' : 'unread'}</small></span></Link>}</div>}
          </div>
          <div className="customer-top-popover customer-user-popover">
            <button type="button" className="customer-top-user" onClick={() => { setUserOpen((open) => !open); setNotificationsOpen(false) }} aria-expanded={userOpen}><CustomerAvatar avatar={profile.avatar} initials={initials} className="customer-top-avatar" name={profile.fullName} /><div><strong>{profile.fullName}</strong><small>{ar ? 'مسافر' : 'Traveler'}</small></div><ChevronDown size={15} /></button>
            {userOpen && <div className="customer-user-menu"><Link href="/account/profile" onClick={() => setUserOpen(false)}><UserRound size={16} />{ar ? 'الملف الشخصي' : 'Profile'}</Link><Link href="/account/settings" onClick={() => setUserOpen(false)}><Settings2 size={16} />{ar ? 'الإعدادات' : 'Settings'}</Link><Link href="/login"><LogOut size={16} />{ar ? 'تسجيل الخروج' : 'Sign out'}</Link></div>}
          </div>
        </div>
      </header>

      <main className="customer-account">
        {impersonated && <div className="impersonate-banner" role="status">
          <div>
            <strong>{ar ? 'معاينة الموظفين' : 'Staff preview'}</strong>
            <span>{ar ? 'تشاهد الحساب باسم' : 'Viewing as'} <b>{impersonated.name}</b></span>
          </div>
          <button type="button" onClick={() => stopImpersonation()}><LogOut size={15} />{ar ? 'إنهاء المعاينة' : 'Exit preview'}</button>
        </div>}
        <section className="customer-account-main">
        <header className="customer-account-head">
          <div><span>{ar ? 'حساب STAR PYRAMIDS' : 'STAR PYRAMIDS account'}</span><h1>{ar ? heading.ar : heading.en}</h1><p>{ar ? heading.subAr : heading.subEn}</p></div>
          <div className="customer-account-head-actions"><Link href="/trips" className="account-icon-action"><Search size={17} />{ar ? 'استكشف الرحلات' : 'Explore trips'}</Link><Link href="/contact" className="account-icon-action primary"><HelpCircle size={17} />{ar ? 'اطلب مساعدة' : 'Get help'}</Link></div>
        </header>
        {children}
        </section>
      </main>
    </div>
  </div>
}

function Metric({ Icon, value, label, note, tone }: { Icon: typeof Star; value: string | number; label: string; note: string; tone: string }) {
  return <div className={`customer-metric ${tone}`}><span><Icon size={19} /></span><div><small>{label}</small><strong>{value}</strong><em>{note}</em></div></div>
}

function BookingStatus({ booking, ar }: { booking: CustomerBooking; ar: boolean }) {
  return <span className={`customer-status ${booking.status}`}>{booking.status === 'confirmed' || booking.status === 'completed' ? <CheckCircle2 size={13} /> : <Clock3 size={13} />}{ar ? bookingStatusCopy[booking.status].ar : bookingStatusCopy[booking.status].en}</span>
}

function BookingCard({ booking }: { booking: CustomerBooking }) {
  const { locale, currency } = useLocale()
  const ar = locale === 'ar'
  const first = booking.lines[0]
  const travelers = booking.lines.reduce((sum, line) => sum + line.adults + line.children + line.infants, 0)
  return <article className="customer-booking-row">
    <Link href={`/account/bookings/detail?ref=${encodeURIComponent(booking.reference)}`}><img src={first?.image || '/egypt-hero.png'} alt="" /></Link>
    <div className="customer-booking-copy">
      <div className="customer-booking-top"><span>{booking.reference}</span><BookingStatus booking={booking} ar={ar} /></div>
      <h3><Link href={`/account/bookings/detail?ref=${encodeURIComponent(booking.reference)}`}>{first?.title || (ar ? 'رحلة مخصصة' : 'Custom journey')}</Link></h3>
      <div className="customer-booking-meta"><span><CalendarDays size={14} />{first?.date || new Date(booking.createdAt).toLocaleDateString(ar ? 'ar-EG' : 'en-GB')}</span><span><Users size={14} />{travelers} {ar ? 'مسافرين' : 'travelers'}</span><span><PackageCheck size={14} />{booking.lines.length} {ar ? 'رحلات' : 'trip items'}</span></div>
    </div>
    <div className="customer-booking-total"><small>{ar ? 'الإجمالي' : 'Total'}</small><strong>{formatPrice(booking.total, currency, locale)}</strong><span className="customer-booking-links"><Link href={`/account/bookings/detail?ref=${encodeURIComponent(booking.reference)}`}>{ar ? 'عرض التفاصيل' : 'View details'} <ArrowRight size={14} /></Link><Link href="/account/messages" onClick={() => saveMessageDraft({ reference: booking.reference, title: first?.title ?? '' })}>{ar ? 'اسأل عن الحجز' : 'Ask about booking'} <ArrowRight size={14} /></Link></span></div>
  </article>
}

function OverviewSection() {
  const { locale, currency } = useLocale()
  const ar = locale === 'ar'
  const profile = useCustomerProfile()
  const impersonated = useImpersonated()
  const displayName = impersonated ? impersonated.name : profile.fullName
  const bookings = useVisibleBookings()
  const favorites = useCustomerFavorites()
  const inquiries = useVisibleInquiries()
  const chatMessages = useCustomerChatMessages()
  const cart = useCart()
  const latestBooking = bookings[0]
  const liveTours = useLiveTours(catalogTours)
  const savedTours = favorites.slugs.map((slug) => liveTours.find((tour) => tour.slug === slug)).filter((tour) => Boolean(tour)).slice(0, 3)

  return <>
    <section className="customer-welcome-band">
      <div><span>{ar ? 'أهلًا بعودتك' : 'Welcome back'}</span><h2>{displayName.split(' ')[0]}, {ar ? 'خلينا نجهز رحلتك القادمة.' : 'let us keep your next journey moving.'}</h2><p>{latestBooking ? (ar ? `آخر تحديث على الحجز ${latestBooking.reference}` : `Your latest booking update is ready under ${latestBooking.reference}.`) : (ar ? 'احفظ الرحلات أو أضفها للسلة وسيظهر كل شيء هنا.' : 'Save a trip or add it to your cart and everything will stay organized here.')}</p></div>
      <Link href={latestBooking ? '/account/bookings' : '/trips'}>{latestBooking ? (ar ? 'متابعة الحجز' : 'Track booking') : (ar ? 'ابحث عن رحلة' : 'Find a trip')} <ArrowRight size={17} /></Link>
    </section>
    <div className="customer-metrics">
      <Metric Icon={ShoppingBag} value={bookings.length} label={ar ? 'الحجوزات' : 'Bookings'} note={ar ? 'كل الطلبات' : 'All requests'} tone="blue" />
      <Metric Icon={Heart} value={favorites.slugs.length} label={ar ? 'المحفوظة' : 'Saved'} note={ar ? 'أفكار للرحلة' : 'Trip ideas'} tone="orange" />
      <Metric Icon={ShoppingCart} value={cart.lines} label={ar ? 'في السلة' : 'In cart'} note={cart.lines ? formatPrice(cart.subtotal, currency, locale) : (ar ? 'السلة فارغة' : 'Cart is empty')} tone="green" />
      <Metric Icon={MessageCircle} value={inquiries.length + (chatMessages.length ? 1 : 0)} label={ar ? 'المحادثات' : 'Conversations'} note={chatMessages.length ? (ar ? 'دعم مباشر نشط' : 'Active support chat') : (ar ? 'طلبات مسجلة' : 'Recorded enquiries')} tone="violet" />
    </div>
    <div className="customer-overview-grid">
      <section className="customer-account-block customer-span-2">
        <header><div><span>{ar ? 'رحلتك الحالية' : 'Current journey'}</span><h2>{latestBooking ? (ar ? 'آخر حجز' : 'Latest booking') : (ar ? 'مساحة التخطيط' : 'Planning workspace')}</h2></div><Link href={latestBooking ? '/account/bookings' : '/cart'}>{ar ? 'عرض التفاصيل' : 'View details'} <ArrowRight size={15} /></Link></header>
        {latestBooking ? <BookingCard booking={latestBooking} /> : cart.items.length ? <div className="customer-plan-list">{cart.items.slice(0, 3).map((item) => <div key={item.key}><img src={item.image} alt="" /><span><strong>{item.title}</strong><small>{item.date || (ar ? 'موعد مرن' : 'Flexible date')}</small></span><b>{formatPrice(item.total, currency, locale)}</b></div>)}<Link href="/cart" className="account-text-button">{ar ? 'مراجعة السلة وإكمال الحجز' : 'Review cart and continue'} <ArrowRight size={15} /></Link></div> : <EmptyState Icon={CalendarDays} title={ar ? 'لا توجد رحلة نشطة بعد' : 'No active journey yet'} copy={ar ? 'ابدأ من كتالوج الرحلات أو اطلب برنامجًا مخصصًا.' : 'Start with the trip catalogue or ask us to create a custom itinerary.'} href="/trips" action={ar ? 'استكشف الرحلات' : 'Explore trips'} />}
      </section>
      <SupportPanel />
      <section className="customer-account-block customer-span-2">
        <header><div><span>{ar ? 'اختياراتك' : 'Your shortlist'}</span><h2>{ar ? 'رحلات محفوظة' : 'Saved journeys'}</h2></div><Link href="/account/favorites">{ar ? 'عرض الكل' : 'View all'} <ArrowRight size={15} /></Link></header>
        {savedTours.length ? <div className="customer-saved-strip">{savedTours.map((tour) => tour && <MiniTour key={tour.slug} tour={tour} />)}</div> : <div className="customer-inline-empty"><Heart size={20} /><span><strong>{ar ? 'المفضلة جاهزة لاختياراتك' : 'Your shortlist is ready'}</strong><small>{ar ? 'احفظ الرحلات التي تعجبك وقارن بينها هنا.' : 'Save the trips you like and compare them here.'}</small></span><Link href="/account/favorites">{ar ? 'شاهد المقترحات' : 'See suggestions'}</Link></div>}
      </section>
      <QuickActions />
    </div>
  </>
}

function SupportPanel() {
  const { locale } = useLocale()
  const ar = locale === 'ar'
  const brand = useBrandSettings()
  return <aside className="customer-account-block customer-support-panel"><header><div><span>{ar ? 'مساعدة الرحلة' : 'Trip support'}</span><h2>{ar ? 'فريقنا قريب منك' : 'Your team is close by'}</h2></div><span className="customer-online"><i />{ar ? 'متاح' : 'Available'}</span></header><p>{ar ? 'اربط سؤالك بالحجز أو تواصل معنا مباشرة عبر واتساب.' : 'Connect a question to your booking or continue directly on WhatsApp.'}</p><div className="customer-advisor"><span>NS</span><div><strong>{ar ? 'نور، خبيرة رحلات' : 'Nour, travel specialist'}</strong><small>{ar ? 'فريق خدمة العملاء' : 'Customer care team'}</small></div></div><div className="customer-support-actions"><Link href="/account/messages"><MessageCircle size={16} />{ar ? 'افتح الرسائل' : 'Open messages'}</Link><a href={whatsappHref(brand.whatsapp)} target="_blank" rel="noreferrer"><WhatsAppGlyph size={16} />WhatsApp</a></div></aside>
}

function QuickActions() {
  const { locale } = useLocale()
  const ar = locale === 'ar'
  const actions = [
    { href: '/make-your-trip', Icon: Plus, en: 'Plan a custom trip', ar: 'خطط رحلة مخصصة' },
    { href: '/account/payments', Icon: ReceiptText, en: 'Payment records', ar: 'سجل المدفوعات' },
    { href: '/account/profile', Icon: UserRound, en: 'Update profile', ar: 'تحديث الملف' },
  ]
  return <section className="customer-account-block customer-quick-actions"><header><div><span>{ar ? 'اختصارات' : 'Shortcuts'}</span><h2>{ar ? 'إجراءات سريعة' : 'Quick actions'}</h2></div></header>{actions.map(({ href, Icon, en, ar: arLabel }) => <Link key={href} href={href}><Icon size={17} /><span>{ar ? arLabel : en}</span><ChevronRight size={15} /></Link>)}</section>
}

function EmptyState({ Icon, title, copy, href, action }: { Icon: typeof CalendarDays; title: string; copy: string; href: string; action: string }) {
  return <div className="customer-empty"><span><Icon size={24} /></span><h3>{title}</h3><p>{copy}</p><Link href={href}>{action} <ArrowRight size={15} /></Link></div>
}

function CustomerPagination({ page, pageCount, onPage, pageSize, onPageSize, from, to, total }: {
  page: number; pageCount: number; onPage: (page: number) => void; pageSize: number; onPageSize: (size: number) => void; from: number; to: number; total: number
}) {
  const { locale } = useLocale()
  const ar = locale === 'ar'
  const numbers: (number | '…')[] = []
  if (pageCount <= 7) {
    for (let n = 1; n <= pageCount; n++) numbers.push(n)
  } else {
    const set = new Set([1, 2, page - 1, page, page + 1, pageCount - 1, pageCount].filter((n) => n >= 1 && n <= pageCount))
    const sorted = [...set].sort((a, b) => a - b)
    sorted.forEach((n, i) => {
      if (i > 0 && n - sorted[i - 1] > 1) numbers.push('…')
      numbers.push(n)
    })
  }
  return <div className="customer-pagination">
    <div className="customer-pagination-group">
      <span className="customer-pagination-info">{ar ? `عرض ${from}–${to} من ${total}` : `Showing ${from}–${to} of ${total}`}</span>
      <label className="customer-pagination-size">{ar ? 'الصفوف:' : 'Rows:'}
        <select value={pageSize} onChange={(e) => onPageSize(Number(e.target.value))} aria-label={ar ? 'عدد الصفوف في الصفحة' : 'Rows per page'}>
          {[10, 20, 30, 50].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>
    </div>
    <div className="customer-page-btns" role="navigation" aria-label={ar ? 'ترقيم الصفحات' : 'Pagination'}>
      <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label={ar ? 'الصفحة السابقة' : 'Previous page'}>‹</button>
      {numbers.map((n, i) => n === '…' ? <span key={`gap-${i}`}>…</span> : (
        <button key={n} type="button" className={n === page ? 'active' : ''} aria-current={n === page ? 'page' : undefined} onClick={() => onPage(n)}>{n}</button>
      ))}
      <button type="button" disabled={page >= pageCount} onClick={() => onPage(page + 1)} aria-label={ar ? 'الصفحة التالية' : 'Next page'}>›</button>
    </div>
  </div>
}

function MiniTour({ tour }: { tour: (typeof catalogTours)[number] }) {
  const { locale, currency } = useLocale()
  const favorites = useCustomerFavorites()
  const ar = locale === 'ar'
  const title = ar && tour.titleAr ? tour.titleAr : tour.title
  return <article className="customer-mini-tour"><Link href={`/egypt-tours/${tour.slug}`}><img src={tour.image} alt={title} /></Link><div><span>{ar ? localizeTourLocation(tour.location) : tour.location}</span><h3><Link href={`/egypt-tours/${tour.slug}`}>{title}</Link></h3><small>{ar ? localizeTourDuration(tour.duration) : tour.duration} · {formatPrice(tour.price, currency, locale)}</small></div><button type="button" onClick={() => favorites.toggle(tour.slug)} aria-label={ar ? 'إزالة من المحفوظات' : 'Remove from saved'}><Heart size={17} fill={favorites.has(tour.slug) ? 'currentColor' : 'none'} /></button></article>
}

function BookingDetailSection({ reference, autoPrint = false }: { reference: string; autoPrint?: boolean }) {
  const { locale, currency } = useLocale()
  const ar = locale === 'ar'
  const impersonated = useImpersonated()
  const bookings = useVisibleBookings()
  const [cancelled, setCancelled] = useState(false)
  const booking = bookings.find((item) => item.reference === reference) ?? null

  useEffect(() => {
    if (autoPrint && booking) {
      const timer = window.setTimeout(() => window.print(), 700)
      return () => window.clearTimeout(timer)
    }
  }, [autoPrint, booking])

  if (!booking) {
    return <EmptyState Icon={ShoppingBag} title={ar ? 'الحجز غير موجود' : 'Booking not found'} copy={ar ? 'ربما تم إلغاؤه أو أنك تتصفح حسابا مختلفا.' : 'It may have been cancelled or you are viewing a different account.'} href="/account/bookings" action={ar ? 'عودة للحجوزات' : 'Back to bookings'} />
  }

  const travelers = booking.lines.reduce((sum, line) => sum + line.adults + line.children + line.infants, 0)
  const linesTotal = booking.lines.reduce((sum, line) => sum + line.total, 0)
  const canCancel = !impersonated && (booking.status === 'request_received' || booking.status === 'confirmed') && !cancelled
  const activeStatus = cancelled ? 'cancelled' : booking.status
  const createdOn = new Date(booking.createdAt).toLocaleDateString(ar ? 'ar-EG' : 'en-GB')
  const steps = [
    { done: true, label: ar ? 'تم الاستلام' : 'Received', date: createdOn },
    { done: booking.status !== 'request_received' || cancelled, label: ar ? 'التأكيد والدفع' : 'Confirmation & payment', date: booking.status !== 'request_received' ? createdOn : '—' },
    { done: activeStatus === 'completed', label: ar ? 'اكتمال الرحلة' : 'Trip completed', date: activeStatus === 'completed' ? createdOn : '—' },
    ...(activeStatus === 'cancelled' ? [{ done: true, label: ar ? 'ملغي' : 'Cancelled', date: '—' }] : []),
  ]

  const cancel = () => {
    updateCustomerBooking(booking.reference, { status: 'cancelled' })
    setCancelled(true)
  }

  return <>
    <section className="customer-account-block">
      <header><div><span>{booking.reference}</span><h2>{booking.lines[0]?.title || (ar ? 'تفاصيل الحجز' : 'Booking details')}</h2></div><BookingStatus booking={{ ...booking, status: activeStatus }} ar={ar} /></header>
      <div className="customer-detail-grid">
        <div><small>{ar ? 'تاريخ السفر' : 'Travel date'}</small><strong>{booking.lines[0]?.date || createdOn}</strong></div>
        <div><small>{ar ? 'المسافرون' : 'Travelers'}</small><strong>{travelers}</strong></div>
        <div><small>{ar ? 'طريقة الدفع' : 'Payment method'}</small><strong>{booking.paymentMethod === 'arrival' ? (ar ? 'الدفع عند الوصول' : 'Pay on arrival') : (ar ? 'بطاقة بنكية' : 'Card')}</strong></div>
        <div><small>{ar ? 'حالة الدفع' : 'Payment status'}</small><strong>{booking.paymentStatus === 'paid' ? (ar ? 'مدفوع' : 'Paid') : booking.paymentStatus === 'pay_on_arrival' ? (ar ? 'عند الوصول' : 'On arrival') : (ar ? 'قيد التأكيد' : 'Pending')}</strong></div>
      </div>
      <div className="customer-detail-actions">
        <Link href="/account/messages" className="account-icon-action" onClick={() => saveMessageDraft({ reference: booking.reference, title: booking.lines[0]?.title ?? '' })}><MessageCircle size={17} />{ar ? 'اسأل عن الحجز' : 'Ask about booking'}</Link>
        <button type="button" className="account-icon-action" onClick={() => window.print()}><ReceiptText size={17} />{ar ? 'طباعة الإيصال' : 'Print receipt'}</button>
        {canCancel && <button type="button" className="account-icon-action danger" onClick={cancel}><X size={17} />{ar ? 'طلب الإلغاء' : 'Request cancellation'}</button>}
      </div>
    </section>

    <section className="customer-account-block">
      <header><div><span>{booking.lines.length} {ar ? 'بنود' : 'items'}</span><h2>{ar ? 'تفاصيل الرحلات' : 'Trip details'}</h2></div></header>
      {booking.lines.map((line) => (
        <article key={line.key} className="customer-booking-row">
          <Link href={line.tourSlug ? `/egypt-tours/${line.tourSlug}` : '/trips'}><img src={line.image || '/egypt-hero.png'} alt="" /></Link>
          <div className="customer-booking-copy">
            <div className="customer-booking-top"><span>{line.date || (ar ? 'موعد مرن' : 'Flexible date')}</span></div>
            <h3>{line.tourSlug ? <Link href={`/egypt-tours/${line.tourSlug}`}>{line.title}</Link> : line.title}</h3>
            <div className="customer-booking-meta">
              <span><Users size={14} />{line.adults} {ar ? 'بالغين' : 'adults'}</span>
              {line.children > 0 && <span>{line.children} {ar ? 'أطفال' : 'children'}</span>}
              {line.infants > 0 && <span>{line.infants} {ar ? 'رضع' : 'infants'}</span>}
            </div>
            <div className="customer-booking-meta"><span>{ar ? 'البالغ' : 'Adult'}: {formatPrice(line.adultUnit, currency, locale)}</span>{line.children > 0 && <span>{ar ? 'الطفل' : 'Child'}: {formatPrice(line.childUnit, currency, locale)}</span>}</div>
            {line.addons.length > 0 && <div className="customer-booking-meta"><span><Plus size={14} />{line.addons.join(' · ')}</span></div>}
          </div>
          <div className="customer-booking-total"><small>{ar ? 'إجمالي البند' : 'Line total'}</small><strong>{formatPrice(line.total, currency, locale)}</strong></div>
        </article>
      ))}
      <div className="customer-payment-total-row"><span>{ar ? 'إجمالي البنود' : 'Lines total'}</span><strong>{formatPrice(linesTotal, currency, locale)}</strong></div>
      <div className="customer-payment-total-row grand"><span>{ar ? 'الإجمالي' : 'Grand total'}</span><strong>{formatPrice(booking.total, currency, locale)}</strong></div>
    </section>

    <section className="customer-account-block">
      <header><div><span>{ar ? 'التواصل' : 'Contact'}</span><h2>{ar ? 'بيانات المسافر' : 'Traveler details'}</h2></div></header>
      <div className="customer-detail-grid">
        <div><small>{ar ? 'الاسم' : 'Name'}</small><strong>{booking.contact.name}</strong></div>
        <div><small>{ar ? 'البريد' : 'Email'}</small><strong>{booking.contact.email || '—'}</strong></div>
        <div><small>{ar ? 'الهاتف' : 'Phone'}</small><strong>{booking.contact.phone || '—'}</strong></div>
        {booking.notes ? <div><small>{ar ? 'ملاحظات' : 'Notes'}</small><strong>{booking.notes}</strong></div> : null}
      </div>
    </section>

    <section className="customer-account-block">
      <header><div><span>{ar ? 'التتبع' : 'Tracking'}</span><h2>{ar ? 'مراحل الحجز' : 'Booking timeline'}</h2></div></header>
      <ol className="customer-timeline">
        {steps.map((step) => (
          <li key={step.label} className={step.done ? 'done' : ''}><span /><div><strong>{step.label}</strong><small>{step.date}</small></div></li>
        ))}
      </ol>
    </section>
  </>
}

export function BookingDetailPage({ reference, autoPrint = false }: { reference: string; autoPrint?: boolean }) {
  return <LocaleProvider><AccountShell section="bookings"><BookingDetailSection reference={reference} autoPrint={autoPrint} /></AccountShell></LocaleProvider>
}

function BookingTableRow({ booking, index }: { booking: CustomerBooking; index: number }) {
  const { locale, currency } = useLocale()
  const ar = locale === 'ar'
  const first = booking.lines[0]
  const travelers = booking.lines.reduce((sum, line) => sum + line.adults + line.children + line.infants, 0)
  const detailHref = '/account/bookings/detail?ref=' + encodeURIComponent(booking.reference)
  return <tr>
    <td className="customer-row-number">{index}</td>
    <td><span className="customer-trip-cell"><Link href={detailHref}><img src={first?.image || '/egypt-hero.png'} alt="" /></Link><span><strong><Link href={detailHref}>{first?.title || (ar ? 'رحلة مخصصة' : 'Custom journey')}</Link></strong><small>{booking.reference} · {booking.lines.length} {ar ? 'بنود' : 'items'}</small></span></span></td>
    <td>{first?.date || new Date(booking.createdAt).toLocaleDateString(ar ? 'ar-EG' : 'en-GB')}</td>
    <td>{travelers}</td>
    <td><strong>{formatPrice(booking.total, currency, locale)}</strong></td>
    <td><BookingStatus booking={booking} ar={ar} /></td>
    <td><span className="customer-table-actions"><Link href={detailHref} aria-label={ar ? 'عرض التفاصيل' : 'View details'} title={ar ? 'عرض التفاصيل' : 'View details'}><Eye size={16} /></Link><Link href="/account/messages" onClick={() => saveMessageDraft({ reference: booking.reference, title: first?.title ?? '' })} aria-label={ar ? 'اسأل عن الحجز' : 'Ask about booking'} title={ar ? 'اسأل عن الحجز' : 'Ask about booking'}><MessageCircle size={16} /></Link></span></td>
  </tr>
}

function BookingsSection() {
  const { locale } = useLocale()
  const ar = locale === 'ar'
  const bookings = useVisibleBookings()
  const [filter, setFilter] = useState<'all' | CustomerBookingStatus>('all')
  const visible = filter === 'all' ? bookings : bookings.filter((booking) => booking.status === filter)
  const paging = usePagination(visible)
  return <section className="customer-account-block customer-full-block"><div className="customer-filterbar"><div role="tablist" aria-label={ar ? 'فلترة الحجوزات' : 'Filter bookings'}>{(['all', 'request_received', 'confirmed', 'completed', 'cancelled'] as const).map((status) => <button type="button" key={status} className={filter === status ? 'active' : ''} onClick={() => setFilter(status)}>{status === 'all' ? (ar ? 'الكل' : 'All') : (ar ? bookingStatusCopy[status].ar : bookingStatusCopy[status].en)}</button>)}</div><Link href="/trips"><Plus size={16} />{ar ? 'حجز رحلة' : 'Book a trip'}</Link></div>{visible.length ? <><div className="customer-table-wrap"><table className="customer-table"><thead><tr><th>#</th><th>{ar ? 'الرحلة' : 'Trip'}</th><th>{ar ? 'التاريخ' : 'Date'}</th><th>{ar ? 'المسافرون' : 'Travelers'}</th><th>{ar ? 'الإجمالي' : 'Total'}</th><th>{ar ? 'الحالة' : 'Status'}</th><th></th></tr></thead><tbody>{paging.pageRows.map((booking, index) => <BookingTableRow key={booking.reference} booking={booking} index={paging.from + index} />)}</tbody></table></div><CustomerPagination page={paging.page} pageCount={paging.pageCount} onPage={paging.setPage} pageSize={paging.pageSize} onPageSize={paging.setPageSize} from={paging.from} to={paging.to} total={paging.total} /></> : <EmptyState Icon={ShoppingBag} title={ar ? 'لا توجد حجوزات في هذه الحالة' : 'No bookings in this view'} copy={ar ? 'أي حجز تكمله من صفحة الدفع سيظهر هنا تلقائيًا.' : 'Any booking completed through checkout will appear here automatically.'} href="/trips" action={ar ? 'تصفح الرحلات' : 'Browse trips'} />}</section>
}

function FavoritesSection() {
  const { locale } = useLocale()
  const ar = locale === 'ar'
  const favorites = useCustomerFavorites()
  const liveTours = useLiveTours(catalogTours)
  const saved = favorites.slugs.map((slug) => liveTours.find((tour) => tour.slug === slug)).filter((tour) => Boolean(tour))
  const recommendations = liveTours.filter((tour) => !favorites.has(tour.slug)).slice(0, 6)
  const savedPaging = usePagination(saved)
  return <div className="customer-favorites-page">{saved.length > 0 && <section className="customer-account-block"><header><div><span>{ar ? 'قائمتك' : 'Your shortlist'}</span><h2>{ar ? 'محفوظة للمقارنة' : 'Saved for comparison'}</h2></div><small>{saved.length} {ar ? 'رحلات' : 'trips'}</small></header><div className="customer-saved-grid">{savedPaging.pageRows.map((tour) => tour && <MiniTour key={tour.slug} tour={tour} />)}</div><CustomerPagination page={savedPaging.page} pageCount={savedPaging.pageCount} onPage={savedPaging.setPage} pageSize={savedPaging.pageSize} onPageSize={savedPaging.setPageSize} from={savedPaging.from} to={savedPaging.to} total={savedPaging.total} /></section>}<section className="customer-account-block"><header><div><span>{saved.length ? (ar ? 'أفكار إضافية' : 'More ideas') : (ar ? 'ابدأ قائمتك' : 'Start your shortlist')}</span><h2>{ar ? 'رحلات قد تعجبك' : 'Trips you may like'}</h2></div></header><div className="customer-saved-grid">{recommendations.map((tour) => <MiniTour key={tour.slug} tour={tour} />)}</div></section></div>
}

function PaymentsSection() {
  const { locale, currency } = useLocale()
  const ar = locale === 'ar'
  const bookings = useVisibleBookings()
  const paid = bookings.filter((booking) => booking.paymentStatus === 'paid').reduce((sum, booking) => sum + booking.total, 0)
  const pending = bookings.filter((booking) => booking.paymentStatus === 'pending').reduce((sum, booking) => sum + booking.total, 0)
  const paging = usePagination(bookings)
  return <><div className="customer-payment-summary"><Metric Icon={CheckCircle2} value={formatPrice(paid, currency, locale)} label={ar ? 'تم دفعه' : 'Paid'} note={ar ? 'مدفوعات مؤكدة' : 'Confirmed payments'} tone="green" /><Metric Icon={Clock3} value={formatPrice(pending, currency, locale)} label={ar ? 'قيد التأكيد' : 'Pending'} note={ar ? 'لا يتم الخصم في النسخة التجريبية' : 'No charge in preview mode'} tone="orange" /><Metric Icon={ReceiptText} value={bookings.length} label={ar ? 'السجلات' : 'Records'} note={ar ? 'مرتبطة بالحجوزات' : 'Linked to bookings'} tone="blue" /></div><section className="customer-account-block customer-full-block"><header><div><span>{ar ? 'السجل المالي' : 'Payment history'}</span><h2>{ar ? 'الحجوزات والمدفوعات' : 'Bookings and payment status'}</h2></div><ShieldCheck size={20} /></header>      {bookings.length ? <><div className="customer-table-wrap"><table className="customer-table">
        <thead><tr><th>#</th><th>{ar ? 'المرجع' : 'Reference'}</th><th>{ar ? 'الرحلة' : 'Tour'}</th><th>{ar ? 'التاريخ' : 'Date'}</th><th>{ar ? 'الطريقة' : 'Method'}</th><th>{ar ? 'الحالة' : 'Status'}</th><th>{ar ? 'المبلغ' : 'Amount'}</th><th></th></tr></thead>
        <tbody>{paging.pageRows.map((booking, index) => (
          <tr key={booking.reference}>
            <td className="customer-row-number">{paging.from + index}</td>
            <td><strong>{booking.reference}</strong></td>
            <td>{booking.lines[0]?.title || (ar ? 'رحلة مخصصة' : 'Custom journey')}</td>
            <td>{new Date(booking.createdAt).toLocaleDateString(ar ? 'ar-EG' : 'en-GB')}</td>
            <td>{booking.paymentMethod === 'arrival' ? (ar ? 'عند الوصول' : 'On arrival') : (ar ? 'بطاقة' : 'Card')}</td>
            <td><span className={`customer-payment-state ${booking.paymentStatus}`}>{booking.paymentStatus === 'pay_on_arrival' ? (ar ? 'عند الوصول' : 'On arrival') : booking.paymentStatus === 'paid' ? (ar ? 'مدفوع' : 'Paid') : (ar ? 'قيد التأكيد' : 'Pending')}</span></td>
            <td><strong>{formatPrice(booking.total, currency, locale)}</strong></td>
            <td><span className="customer-table-actions">
              <Link href={'/account/bookings/detail?ref=' + encodeURIComponent(booking.reference)} aria-label={ar ? 'عرض الحجز' : 'View booking'} title={ar ? 'عرض الحجز' : 'View booking'}><Eye size={16} /></Link>
              <Link href={'/account/bookings/detail?ref=' + encodeURIComponent(booking.reference) + '&print=1'} aria-label={ar ? 'طباعة الإيصال' : 'Print receipt'} title={ar ? 'طباعة الإيصال' : 'Print receipt'}><Printer size={16} /></Link>
            </span></td>
          </tr>
        ))}</tbody>
      </table></div><CustomerPagination page={paging.page} pageCount={paging.pageCount} onPage={paging.setPage} pageSize={paging.pageSize} onPageSize={paging.setPageSize} from={paging.from} to={paging.to} total={paging.total} /></> : <EmptyState Icon={ReceiptText} title={ar ? 'لا توجد مدفوعات بعد' : 'No payment records yet'} copy={ar ? 'تظهر الإيصالات وحالة الدفع هنا بمجرد وجود حجز.' : 'Receipts and payment status will appear here once you have a booking.'} href="/trips" action={ar ? 'ابدأ بحجز رحلة' : 'Start with a trip'} />}</section></>
}

function MessagesSection() {
  const { locale } = useLocale()
  const ar = locale === 'ar'
  const inquiries = useVisibleInquiries()
  const brand = useBrandSettings()
  const profile = useCustomerProfile()
  const impersonated = useImpersonated()
  const bookings = useVisibleBookings()
  const messages = useCustomerChatMessages()
  const [draft, setDraft] = useState('')
  const [attachment, setAttachment] = useState<CustomerChatAttachment | undefined>()
  const [fileError, setFileError] = useState('')

  useEffect(() => {
    const pending = readMessageDraft()
    if (pending) {
      setDraft(ar
        ? `مرحبا، عندي سؤال عن الحجز ${pending.reference}${pending.title ? ` (${pending.title})` : ''}: `
        : `Hi, I have a question about booking ${pending.reference}${pending.title ? ` (${pending.title})` : ''}: `)
      clearMessageDraft()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const bodyRef = useRef<HTMLDivElement>(null)
  const latestBooking = bookings[0]

  useEffect(() => {
    markCustomerChatRead('customer')
    const frame = window.requestAnimationFrame(() => bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' }))
    return () => window.cancelAnimationFrame(frame)
  }, [messages.length])

  const send = () => {
    if (impersonated || (!draft.trim() && !attachment)) return
    sendCustomerChatMessage(draft, attachment)
    setDraft('')
    setAttachment(undefined)
    setFileError('')
  }

  const chooseAttachment = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (file.size > 1.5 * 1024 * 1024) {
      setFileError(ar ? 'الحد الأقصى للمرفق 1.5 ميجابايت.' : 'Attachments must be smaller than 1.5 MB.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result !== 'string') return
      setAttachment({ name: file.name, type: file.type || 'application/octet-stream', size: file.size, url: reader.result })
      setFileError('')
    }
    reader.readAsDataURL(file)
    event.target.value = ''
  }

  const keyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      send()
    }
  }

  return <div className="customer-chat-layout">
    <section className="customer-chat-panel">
      <header className="customer-chat-head">
        <span className="customer-chat-team-avatar"><img src="/favicon.png" alt="" /></span>
        <div><strong>{ar ? 'فريق رحلات STAR PYRAMIDS' : 'STAR PYRAMIDS travel team'}</strong><small><i />{ar ? 'دعم حسابك وحجوزاتك' : 'Account and booking support'}</small></div>
        <span className="customer-chat-channel"><MessageCircle size={14} />{ar ? 'محادثة الحساب' : 'Account chat'}</span>
      </header>

      <div className="customer-chat-body" ref={bodyRef} aria-live="polite">
        {!messages.length && <div className="customer-chat-welcome"><span><MessageCircle size={25} /></span><h2>{ar ? `أهلًا ${profile.fullName.split(' ')[0]}` : `Hi ${profile.fullName.split(' ')[0]}`}</h2><p>{ar ? 'اكتب سؤالك عن الحجز أو الأسعار أو تفاصيل رحلتك، وسيظهر الرد هنا في نفس المحادثة.' : 'Ask about a booking, pricing, or trip details. The team reply will stay here in this conversation.'}</p><div>{(ar ? ['أريد متابعة حجزي', 'أحتاج تعديل موعد الرحلة', 'لدي سؤال عن الدفع'] : ['Track my booking', 'Change my travel date', 'I have a payment question']).map((prompt) => <button type="button" key={prompt} onClick={() => setDraft(prompt)}>{prompt}</button>)}</div></div>}
        {messages.map((message) => <div key={message.id} className={`customer-chat-row ${message.sender}`}>
          {message.sender === 'agent' && <span className="customer-chat-bubble-avatar"><img src="/favicon.png" alt="" /></span>}
          <div>
            <span className="customer-chat-bubble">
              {message.text && <p>{message.text}</p>}
              {message.attachment && <a href={message.attachment.url} download={message.attachment.name}><FileText size={17} /><span><strong>{message.attachment.name}</strong><small>{Math.max(1, Math.round(message.attachment.size / 1024))} KB</small></span></a>}
            </span>
            <small className="customer-chat-time">{new Date(message.createdAt).toLocaleTimeString(ar ? 'ar-EG' : 'en-GB', { hour: '2-digit', minute: '2-digit' })}{message.sender === 'customer' && <CheckCheck size={13} aria-label={message.readByAdmin ? (ar ? 'مقروءة' : 'Seen') : (ar ? 'تم الإرسال' : 'Sent')} />}</small>
          </div>
        </div>)}
      </div>

      {attachment && <div className="customer-chat-attachment"><FileText size={17} /><span><strong>{attachment.name}</strong><small>{Math.max(1, Math.round(attachment.size / 1024))} KB</small></span><button type="button" onClick={() => setAttachment(undefined)} aria-label={ar ? 'إزالة المرفق' : 'Remove attachment'}><X size={15} /></button></div>}
      {fileError && <p className="customer-chat-error">{fileError}</p>}
      <form className="customer-chat-composer" onSubmit={(event) => { event.preventDefault(); send() }}>
        <label title={ar ? 'إرفاق ملف' : 'Attach file'}><Paperclip size={18} /><input type="file" accept="image/*,.pdf,.doc,.docx" onChange={chooseAttachment} disabled={Boolean(impersonated)} /></label>
        <textarea rows={1} value={draft} disabled={Boolean(impersonated)} onChange={(event) => setDraft(event.target.value)} onKeyDown={keyDown} placeholder={impersonated ? (ar ? 'الإرسال متوقف أثناء معاينة الموظفين' : 'Sending is disabled during staff preview') : (ar ? 'اكتب رسالتك...' : 'Write a message...')} />
        <button type="submit" disabled={Boolean(impersonated) || (!draft.trim() && !attachment)} aria-label={ar ? 'إرسال الرسالة' : 'Send message'}><Send size={18} /></button>
      </form>
    </section>

    <aside className="customer-chat-context">
      <section className="customer-account-block">
        <header><div><span>{ar ? 'عن المحادثة' : 'Conversation context'}</span><h2>{ar ? 'مساعدة الرحلة' : 'Trip support'}</h2></div><ShieldCheck size={19} /></header>
        <div className="customer-chat-profile"><CustomerAvatar avatar={profile.avatar} initials={profile.fullName.slice(0, 2).toUpperCase()} className="customer-profile-avatar" name={profile.fullName} /><div><strong>{profile.fullName}</strong><small>{profile.email}</small></div></div>
        {latestBooking ? <Link href="/account/bookings" className="customer-chat-booking"><span><ShoppingBag size={16} /></span><div><small>{ar ? 'الحجز المرتبط' : 'Latest booking'}</small><strong>{latestBooking.reference}</strong></div><ChevronRight size={16} /></Link> : <Link href="/trips" className="customer-chat-booking"><span><Plus size={16} /></span><div><small>{ar ? 'لا يوجد حجز حالي' : 'No current booking'}</small><strong>{ar ? 'استكشف الرحلات' : 'Explore trips'}</strong></div><ChevronRight size={16} /></Link>}
        <dl className="customer-chat-summary"><div><dt>{ar ? 'رسائل المحادثة' : 'Chat messages'}</dt><dd>{messages.length}</dd></div><div><dt>{ar ? 'استفسارات سابقة' : 'Previous enquiries'}</dt><dd>{inquiries.length}</dd></div></dl>
      </section>
      <section className="customer-account-block customer-chat-alternative"><span><WhatsAppGlyph size={20} /></span><h2>{ar ? 'تحتاج واتساب؟' : 'Prefer WhatsApp?'}</h2><p>{ar ? 'استخدم الرقم الرسمي إذا احتجت قناة بديلة.' : 'Use the official number when you need another channel.'}</p><a href={whatsappHref(brand.whatsapp)} target="_blank" rel="noreferrer">WhatsApp <ArrowRight size={15} /></a><small>{brand.whatsapp}</small></section>
    </aside>
  </div>
}

function ProfileSection() {
  const { locale, setLocale } = useLocale()
  const ar = locale === 'ar'
  const current = useCustomerProfile()
  const [form, setForm] = useState<CustomerProfile>(current)
  const [saved, setSaved] = useState(false)
  const [avatarError, setAvatarError] = useState('')
  useEffect(() => setForm(current), [current])
  const update = <K extends keyof CustomerProfile>(key: K, value: CustomerProfile[K]) => setForm((prev) => ({ ...prev, [key]: value }))
  const changeAvatar = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/') || file.size > 2 * 1024 * 1024) {
      setAvatarError(ar ? 'اختر صورة بحجم أقل من 2 ميجابايت.' : 'Choose an image smaller than 2 MB.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      update('avatar', typeof reader.result === 'string' ? reader.result : '')
      setAvatarError('')
      setSaved(false)
    }
    reader.readAsDataURL(file)
  }
  const submit = (event: FormEvent) => { event.preventDefault(); saveCustomerProfile(form); setLocale(form.preferredLanguage); setSaved(true) }
  const profileInitials = form.fullName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'SP'
  return <form className="customer-profile-form" onSubmit={submit}><section className="customer-account-block"><header><div><span>{ar ? 'البيانات الشخصية' : 'Personal details'}</span><h2>{ar ? 'معلومات الحساب' : 'Account information'}</h2></div>{saved && <span className="customer-saved-notice"><Check size={14} />{ar ? 'تم الحفظ' : 'Saved'}</span>}</header><div className="customer-avatar-editor"><CustomerAvatar avatar={form.avatar} initials={profileInitials} className="customer-profile-avatar" name={form.fullName} /><div><strong>{ar ? 'صورة الحساب' : 'Profile photo'}</strong><small>{ar ? 'JPG أو PNG حتى 2 ميجابايت' : 'JPG or PNG up to 2 MB'}</small>{avatarError && <em>{avatarError}</em>}</div><label><ImagePlus size={16} />{ar ? 'تغيير الصورة' : 'Change photo'}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={changeAvatar} /></label>{form.avatar && <button type="button" onClick={() => { update('avatar', ''); setAvatarError(''); setSaved(false) }} aria-label={ar ? 'حذف الصورة' : 'Remove photo'} title={ar ? 'حذف الصورة' : 'Remove photo'}><Trash2 size={16} /></button>}</div><div className="customer-form-grid"><label>{ar ? 'الاسم بالكامل' : 'Full name'}<input required value={form.fullName} onChange={(event) => update('fullName', event.target.value)} /></label><label>{ar ? 'اسم المستخدم' : 'Username'}<input required dir="ltr" value={form.username} onChange={(event) => update('username', event.target.value.replace(/[^A-Za-z0-9_]/g, ''))} /></label><label>{ar ? 'البريد الإلكتروني' : 'Email address'}<input required type="email" dir="ltr" value={form.email} onChange={(event) => update('email', event.target.value)} /></label><label>{ar ? 'رقم الهاتف' : 'Phone number'}<input type="tel" dir="ltr" value={form.phone} onChange={(event) => update('phone', event.target.value)} placeholder="+20 ..." /></label><label>{ar ? 'الدولة' : 'Country'}<select value={form.country} onChange={(event) => update('country', event.target.value)}><option value="EG">{ar ? 'مصر' : 'Egypt'}</option><option value="SA">{ar ? 'السعودية' : 'Saudi Arabia'}</option><option value="AE">{ar ? 'الإمارات' : 'United Arab Emirates'}</option><option value="US">{ar ? 'الولايات المتحدة' : 'United States'}</option><option value="GB">{ar ? 'المملكة المتحدة' : 'United Kingdom'}</option></select></label><label>{ar ? 'اللغة المفضلة' : 'Preferred language'}<select value={form.preferredLanguage} onChange={(event) => update('preferredLanguage', event.target.value as 'en' | 'ar')}><option value="en">English</option><option value="ar">العربية</option></select></label></div></section><section className="customer-account-block"><header><div><span>{ar ? 'التنبيهات' : 'Notifications'}</span><h2>{ar ? 'كيف نتواصل معك' : 'How we keep you updated'}</h2></div><Bell size={19} /></header><label className="customer-switch-row"><span><strong>{ar ? 'تحديثات الحجوزات' : 'Booking updates'}</strong><small>{ar ? 'التأكيدات وتغييرات المواعيد وتفاصيل الاستلام.' : 'Confirmations, schedule changes, and pickup details.'}</small></span><input type="checkbox" checked={form.bookingUpdates} onChange={(event) => update('bookingUpdates', event.target.checked)} /></label><label className="customer-switch-row"><span><strong>{ar ? 'أفكار وعروض السفر' : 'Travel inspiration and offers'}</strong><small>{ar ? 'رسائل اختيارية يمكنك إيقافها في أي وقت.' : 'Optional emails you can turn off at any time.'}</small></span><input type="checkbox" checked={form.marketingEmails} onChange={(event) => update('marketingEmails', event.target.checked)} /></label></section><section className="customer-account-block"><header><div><span>{ar ? 'الدخول والأمان' : 'Access & security'}</span><h2>{ar ? 'طرق تسجيل الدخول' : 'Sign-in methods'}</h2></div><LockKeyhole size={19} /></header><div className="customer-security-list"><div><span className="customer-provider google">G</span><div><strong>Google</strong><small>{ar ? 'جاهز للربط عند تشغيل OAuth' : 'Ready when backend OAuth is connected'}</small></div><span>{ar ? 'غير مربوط' : 'Not connected'}</span></div><div><span className="customer-provider facebook">f</span><div><strong>Facebook</strong><small>{ar ? 'جاهز للربط عند تشغيل OAuth' : 'Ready when backend OAuth is connected'}</small></div><span>{ar ? 'غير مربوط' : 'Not connected'}</span></div></div></section><div className="customer-profile-actions"><button type="submit">{ar ? 'حفظ التغييرات' : 'Save changes'}</button><button type="button" onClick={() => { const reset = readCustomerProfile(); setForm(reset); setAvatarError(''); setSaved(false) }}>{ar ? 'إلغاء التعديلات' : 'Discard changes'}</button></div></form>
}

function PersonalProfileSection() {
  const { locale } = useLocale()
  const ar = locale === 'ar'
  const current = useCustomerProfile()
  const [form, setForm] = useState<CustomerProfile>(current)
  const [saved, setSaved] = useState(false)
  const [avatarError, setAvatarError] = useState('')
  useEffect(() => setForm(current), [current])
  const update = <K extends keyof CustomerProfile>(key: K, value: CustomerProfile[K]) => {
    setForm((previous) => ({ ...previous, [key]: value }))
    setSaved(false)
  }
  const changeAvatar = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/') || file.size > 2 * 1024 * 1024) {
      setAvatarError(ar ? 'اختر صورة بحجم أقل من 2 ميجابايت.' : 'Choose an image smaller than 2 MB.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      update('avatar', typeof reader.result === 'string' ? reader.result : '')
      setAvatarError('')
    }
    reader.readAsDataURL(file)
  }
  const reset = () => {
    setForm(readCustomerProfile())
    setAvatarError('')
    setSaved(false)
  }
  const submit = (event: FormEvent) => {
    event.preventDefault()
    saveCustomerProfile(form)
    setSaved(true)
  }
  const displayName = `${form.firstName} ${form.lastName}`.trim()
  const initials = [form.firstName, form.lastName].filter(Boolean).map((part) => part[0]).join('').toUpperCase() || 'SP'
  const selectedCountry = countries.find((country) => country.code === form.country) ?? defaultCountry

  return <form className="customer-profile-form customer-profile-only" onSubmit={submit}>
    <section className="customer-account-block">
      <header><div><span>{ar ? 'البيانات الشخصية' : 'Personal details'}</span><h2>{ar ? 'معلومات الحساب' : 'Account information'}</h2></div>{saved && <span className="customer-saved-notice"><Check size={14} />{ar ? 'تم الحفظ' : 'Saved'}</span>}</header>
      <div className="customer-avatar-editor">
        <CustomerAvatar avatar={form.avatar} initials={initials} className="customer-profile-avatar" name={displayName} />
        <div><strong>{ar ? 'صورة الحساب' : 'Profile photo'}</strong><small>{ar ? 'JPG أو PNG حتى 2 ميجابايت' : 'JPG or PNG up to 2 MB'}</small>{avatarError && <em>{avatarError}</em>}</div>
        <label><ImagePlus size={16} />{ar ? 'تغيير الصورة' : 'Change photo'}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={changeAvatar} /></label>
        {form.avatar && <button type="button" onClick={() => { update('avatar', ''); setAvatarError('') }} aria-label={ar ? 'حذف الصورة' : 'Remove photo'} title={ar ? 'حذف الصورة' : 'Remove photo'}><Trash2 size={16} /></button>}
      </div>
      <div className="customer-form-grid">
        <label>{ar ? 'الاسم الأول' : 'First name'}<input required autoComplete="given-name" value={form.firstName} onChange={(event) => update('firstName', event.target.value)} /></label>
        <label>{ar ? 'اسم العائلة' : 'Last name'}<input required autoComplete="family-name" value={form.lastName} onChange={(event) => update('lastName', event.target.value)} /></label>
        <label>{ar ? 'اسم المستخدم' : 'Username'}<input required dir="ltr" value={form.username} onChange={(event) => update('username', event.target.value.replace(/[^A-Za-z0-9_]/g, ''))} /></label>
        <label>{ar ? 'البريد الإلكتروني' : 'Email address'}<input required type="email" dir="ltr" value={form.email} onChange={(event) => update('email', event.target.value)} /></label>
        <label>{ar ? 'الدولة' : 'Country'}<select value={form.country} onChange={(event) => { const next = countries.find((country) => country.code === event.target.value) ?? defaultCountry; setForm((previous) => ({ ...previous, country: next.code, dialCode: next.dialCode })); setSaved(false) }}>{countries.map((country) => <option key={country.code} value={country.code}>{countryFlag(country.code)} {country.name} ({country.dialCode})</option>)}</select></label>
        <label>{ar ? 'رقم الهاتف' : 'Phone number'}<span className="customer-phone-field"><span aria-label={ar ? 'كود الدولة' : 'Country calling code'}>{countryFlag(selectedCountry.code)} {selectedCountry.dialCode}</span><input type="tel" inputMode="tel" autoComplete="tel-national" dir="ltr" value={form.phone} onChange={(event) => update('phone', event.target.value)} placeholder={ar ? 'رقم الهاتف' : 'Phone number'} /></span></label>
      </div>
    </section>
    <div className="customer-profile-actions"><button type="submit">{ar ? 'حفظ الملف الشخصي' : 'Save profile'}</button><button type="button" onClick={reset}>{ar ? 'إلغاء التعديلات' : 'Discard changes'}</button></div>
  </form>
}

function SettingsSection() {
  const { locale, setLocale, currency, setCurrency } = useLocale()
  const ar = locale === 'ar'
  const current = useCustomerProfile()
  const [form, setForm] = useState<CustomerProfile>(current)
  const [selectedCurrency, setSelectedCurrency] = useState(currency)
  const [saved, setSaved] = useState(false)
  useEffect(() => setForm(current), [current])
  useEffect(() => setSelectedCurrency(currency), [currency])
  const update = <K extends keyof CustomerProfile>(key: K, value: CustomerProfile[K]) => {
    setForm((previous) => ({ ...previous, [key]: value }))
    setSaved(false)
  }
  const reset = () => {
    setForm(readCustomerProfile())
    setSelectedCurrency(currency)
    setSaved(false)
  }
  const submit = (event: FormEvent) => {
    event.preventDefault()
    saveCustomerProfile(form)
    setCurrency(selectedCurrency)
    setLocale(form.preferredLanguage)
    setSaved(true)
  }

  return <form className="customer-settings-form" onSubmit={submit}>
    <div className="customer-settings-column">
      <section className="customer-account-block">
        <header><div><span>{ar ? 'التفضيلات' : 'Preferences'}</span><h2>{ar ? 'اللغة والعملة' : 'Language & currency'}</h2></div><Globe2 size={19} /></header>
        <div className="customer-settings-selects">
          <label>{ar ? 'اللغة المفضلة' : 'Preferred language'}<select value={form.preferredLanguage} onChange={(event) => update('preferredLanguage', event.target.value as 'en' | 'ar')}><option value="en">English</option><option value="ar">{ar ? 'العربية' : 'Arabic'}</option></select></label>
          <label>{ar ? 'عملة العرض' : 'Display currency'}<select value={selectedCurrency} onChange={(event) => { setSelectedCurrency(event.target.value as typeof currency); setSaved(false) }}><option value="USD">USD</option><option value="EUR">EUR</option><option value="EGP">EGP</option></select></label>
        </div>
      </section>
      <section className="customer-account-block">
        <header><div><span>{ar ? 'التنبيهات' : 'Notifications'}</span><h2>{ar ? 'كيف نبقيك على اطلاع' : 'How we keep you updated'}</h2></div><Bell size={19} /></header>
        <label className="customer-switch-row"><span><strong>{ar ? 'تحديثات الحجوزات' : 'Booking updates'}</strong><small>{ar ? 'التأكيدات وتغييرات المواعيد وتفاصيل الاستلام.' : 'Confirmations, schedule changes, and pickup details.'}</small></span><input type="checkbox" checked={form.bookingUpdates} onChange={(event) => update('bookingUpdates', event.target.checked)} /></label>
        <label className="customer-switch-row"><span><strong>{ar ? 'تذكيرات الرحلة' : 'Trip reminders'}</strong><small>{ar ? 'تذكيرات قبل الرحلة بالمواعيد والمستندات المهمة.' : 'Timely reminders for departures and required documents.'}</small></span><input type="checkbox" checked={form.tripReminders} onChange={(event) => update('tripReminders', event.target.checked)} /></label>
        <label className="customer-switch-row"><span><strong>{ar ? 'تحديثات الدفع والإيصالات' : 'Payment & receipt updates'}</strong><small>{ar ? 'حالة الدفع والتأكيدات والإيصالات الجديدة.' : 'Payment status, confirmations, and new receipts.'}</small></span><input type="checkbox" checked={form.paymentUpdates} onChange={(event) => update('paymentUpdates', event.target.checked)} /></label>
        <label className="customer-switch-row"><span><strong>{ar ? 'ردود الرسائل والدعم' : 'Messages & support replies'}</strong><small>{ar ? 'تنبيه عند وصول رد جديد من فريق الرحلات.' : 'Notify me when the travel team sends a new reply.'}</small></span><input type="checkbox" checked={form.messageReplies} onChange={(event) => update('messageReplies', event.target.checked)} /></label>
        <label className="customer-switch-row"><span><strong>{ar ? 'تذكيرات السلة' : 'Cart reminders'}</strong><small>{ar ? 'ذكّرني بالرحلات التي لم أكمل حجزها.' : 'Remind me about trips waiting in my cart.'}</small></span><input type="checkbox" checked={form.cartReminders} onChange={(event) => update('cartReminders', event.target.checked)} /></label>
        <label className="customer-switch-row"><span><strong>{ar ? 'تحديثات الرحلات المحفوظة' : 'Saved trip updates'}</strong><small>{ar ? 'تغييرات أو عروض تخص الرحلات التي حفظتها.' : 'Changes or offers related to trips I saved.'}</small></span><input type="checkbox" checked={form.savedTripUpdates} onChange={(event) => update('savedTripUpdates', event.target.checked)} /></label>
        <label className="customer-switch-row"><span><strong>{ar ? 'رسائل SMS' : 'SMS updates'}</strong><small>{ar ? 'تنبيهات عاجلة على رقم الهاتف المسجل.' : 'Urgent travel updates sent to your saved phone number.'}</small></span><input type="checkbox" checked={form.smsUpdates} onChange={(event) => update('smsUpdates', event.target.checked)} /></label>
        <label className="customer-switch-row"><span><strong>{ar ? 'أفكار وعروض السفر' : 'Travel inspiration and offers'}</strong><small>{ar ? 'رسائل اختيارية يمكنك إيقافها في أي وقت.' : 'Optional emails you can turn off at any time.'}</small></span><input type="checkbox" checked={form.marketingEmails} onChange={(event) => update('marketingEmails', event.target.checked)} /></label>
        <label className="customer-switch-row customer-required-notification"><span><strong>{ar ? 'تنبيهات الأمان' : 'Security alerts'}</strong><small>{ar ? 'تسجيل دخول جديد وتغييرات كلمة المرور والنشاط المهم.' : 'New sign-ins, password changes, and important account activity.'}</small><em>{ar ? 'مطلوبة لحماية الحساب' : 'Required for account security'}</em></span><input type="checkbox" checked={form.securityAlerts} disabled readOnly /></label>
      </section>
    </div>
    <div className="customer-settings-column">
      <section className="customer-account-block">
        <header><div><span>{ar ? 'الدخول والأمان' : 'Access & security'}</span><h2>{ar ? 'حماية الحساب' : 'Protect your account'}</h2></div><LockKeyhole size={19} /></header>
        <div className="customer-settings-list">
          <div><span className="customer-setting-icon"><KeyRound size={17} /></span><div><strong>{ar ? 'كلمة المرور' : 'Password'}</strong><small>{ar ? 'غيّر كلمة المرور من داخل حسابك.' : 'Change your password inside your account.'}</small></div><Link href="/account/change-password">{ar ? 'تغيير' : 'Change'}</Link></div>
          <div><span className="customer-provider google">G</span><div><strong>Google</strong><small>{ar ? 'سيعمل بعد ربط OAuth بالباك.' : 'Available after backend OAuth is connected.'}</small></div><span className="customer-backend-state">{ar ? 'يحتاج باك' : 'Backend required'}</span></div>
          <div><span className="customer-provider facebook">f</span><div><strong>Facebook</strong><small>{ar ? 'سيعمل بعد ربط OAuth بالباك.' : 'Available after backend OAuth is connected.'}</small></div><span className="customer-backend-state">{ar ? 'يحتاج باك' : 'Backend required'}</span></div>
          <div><span className="customer-setting-icon"><Laptop size={17} /></span><div><strong>{ar ? 'الجلسات والأجهزة' : 'Sessions & devices'}</strong><small>{ar ? 'راجع الأجهزة المسجل منها الدخول وأنهِ أي جلسة.' : 'Review signed-in devices and end a session.'}</small></div><button type="button" disabled>{ar ? 'يحتاج باك' : 'Backend required'}</button></div>
        </div>
      </section>
      <section className="customer-account-block">
        <header><div><span>{ar ? 'الخصوصية والبيانات' : 'Privacy & data'}</span><h2>{ar ? 'بيانات حسابك' : 'Your account data'}</h2></div><ShieldCheck size={19} /></header>
        <div className="customer-settings-list">
          <div><span className="customer-setting-icon"><Download size={17} /></span><div><strong>{ar ? 'تنزيل بيانات الحساب' : 'Download account data'}</strong><small>{ar ? 'اطلب نسخة من بياناتك وحجوزاتك ورسائلك.' : 'Request a copy of your profile, bookings, and messages.'}</small></div><button type="button" disabled>{ar ? 'يحتاج باك' : 'Backend required'}</button></div>
          <div className="danger"><span className="customer-setting-icon"><Trash2 size={17} /></span><div><strong>{ar ? 'حذف الحساب' : 'Delete account'}</strong><small>{ar ? 'يتطلب تأكيد الهوية قبل إرسال طلب الحذف.' : 'Identity confirmation is required before deletion.'}</small></div><button type="button" disabled>{ar ? 'يحتاج باك' : 'Backend required'}</button></div>
        </div>
      </section>
    </div>
    <div className="customer-profile-actions">{saved && <span className="customer-saved-notice"><Check size={14} />{ar ? 'تم الحفظ' : 'Saved'}</span>}<button type="submit">{ar ? 'حفظ الإعدادات' : 'Save settings'}</button><button type="button" onClick={reset}>{ar ? 'إلغاء التعديلات' : 'Discard changes'}</button></div>
  </form>
}

function ChangePasswordSection() {
  const { locale } = useLocale()
  const ar = locale === 'ar'
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const matches = newPassword.length > 0 && newPassword === confirmPassword
  const strongEnough = newPassword.length >= 8 && /[A-Z]/.test(newPassword) && /[0-9]/.test(newPassword)
  const canSubmit = currentPassword.length > 0 && matches && strongEnough
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (canSubmit) setSubmitted(true)
  }

  return <div className="customer-password-layout">
    <form className="customer-account-block customer-password-card" onSubmit={submit}>
      <header><div><span>{ar ? 'الدخول والأمان' : 'Access & security'}</span><h2>{ar ? 'أنشئ كلمة مرور جديدة' : 'Create a new password'}</h2></div><LockKeyhole size={19} /></header>
      <div className="customer-password-fields">
        <label>{ar ? 'كلمة المرور الحالية' : 'Current password'}<span><input required type={showCurrent ? 'text' : 'password'} autoComplete="current-password" value={currentPassword} onChange={(event) => { setCurrentPassword(event.target.value); setSubmitted(false) }} /><button type="button" onClick={() => setShowCurrent((visible) => !visible)} aria-label={showCurrent ? (ar ? 'إخفاء كلمة المرور' : 'Hide password') : (ar ? 'إظهار كلمة المرور' : 'Show password')}>{showCurrent ? <EyeOff size={17} /> : <Eye size={17} />}</button></span></label>
        <label>{ar ? 'كلمة المرور الجديدة' : 'New password'}<span><input required type={showNew ? 'text' : 'password'} autoComplete="new-password" value={newPassword} onChange={(event) => { setNewPassword(event.target.value); setSubmitted(false) }} /><button type="button" onClick={() => setShowNew((visible) => !visible)} aria-label={showNew ? (ar ? 'إخفاء كلمة المرور' : 'Hide password') : (ar ? 'إظهار كلمة المرور' : 'Show password')}>{showNew ? <EyeOff size={17} /> : <Eye size={17} />}</button></span></label>
        <label>{ar ? 'تأكيد كلمة المرور الجديدة' : 'Confirm new password'}<span><input required type={showNew ? 'text' : 'password'} autoComplete="new-password" value={confirmPassword} onChange={(event) => { setConfirmPassword(event.target.value); setSubmitted(false) }} /></span></label>
      </div>
      <div className="customer-password-rules" aria-live="polite">
        <span className={newPassword.length >= 8 ? 'valid' : ''}><Check size={14} />{ar ? '8 أحرف على الأقل' : 'At least 8 characters'}</span>
        <span className={/[A-Z]/.test(newPassword) ? 'valid' : ''}><Check size={14} />{ar ? 'حرف إنجليزي كبير' : 'One uppercase letter'}</span>
        <span className={/[0-9]/.test(newPassword) ? 'valid' : ''}><Check size={14} />{ar ? 'رقم واحد على الأقل' : 'One number'}</span>
        <span className={matches ? 'valid' : ''}><Check size={14} />{ar ? 'كلمتا المرور متطابقتان' : 'Passwords match'}</span>
      </div>
      {submitted && <div className="customer-password-ready"><CheckCircle2 size={17} /><div><strong>{ar ? 'النموذج جاهز' : 'Password change is ready'}</strong><small>{ar ? 'سيتم تنفيذ التغيير الفعلي بعد ربط التحقق بالباك.' : 'The actual update will work after backend verification is connected.'}</small></div></div>}
      <div className="customer-password-actions"><Link href="/account/settings">{ar ? 'العودة للإعدادات' : 'Back to settings'}</Link><button type="submit" disabled={!canSubmit}>{ar ? 'تحديث كلمة المرور' : 'Update password'}</button></div>
    </form>
    <aside className="customer-account-block customer-password-help"><span><ShieldCheck size={20} /></span><h2>{ar ? 'حافظ على أمان حسابك' : 'Keep your account secure'}</h2><p>{ar ? 'استخدم كلمة مرور لا تستخدمها في أي حساب آخر، ولا تشاركها مع أي شخص.' : 'Use a password you do not use elsewhere and never share it with anyone.'}</p><small>{ar ? 'لن يطلب فريق STAR PYRAMIDS كلمة مرورك.' : 'STAR PYRAMIDS staff will never ask for your password.'}</small></aside>
  </div>
}

export function CustomerAccountPage({ section = 'overview' }: { section?: AccountSection }) {
  return <LocaleProvider><AccountShell section={section}>{section === 'overview' ? <OverviewSection /> : section === 'bookings' ? <BookingsSection /> : section === 'favorites' ? <FavoritesSection /> : section === 'payments' ? <PaymentsSection /> : section === 'messages' ? <MessagesSection /> : section === 'settings' ? <SettingsSection /> : section === 'change-password' ? <ChangePasswordSection /> : <PersonalProfileSection />}</AccountShell></LocaleProvider>
}
