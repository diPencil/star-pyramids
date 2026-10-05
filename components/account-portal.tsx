'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'
import {
  ArrowRight, ArrowLeft, Ban, Bell, CalendarDays, CarFront, Check, CheckCircle2, ChevronDown, ChevronRight, Compass,
  CircleDollarSign, Clock3, CreditCard, ExternalLink, Globe2, Heart, HelpCircle,
  CheckCheck, Download, Eye, EyeOff, FileText, FlaskConical, ImagePlus, KeyRound, Laptop, LayoutDashboard, LockKeyhole, LogOut, Mail, Menu,
  MessageCircle, PackageCheck, Paperclip, Pencil, Plus, Printer, ReceiptText, Search, Send,
  Settings2, ShieldCheck, ShoppingBag, ShoppingCart, Star, Ticket, Trash2, UserRound,
  Users, WalletCards, X,
} from 'lucide-react'
import { formatPrice, LocaleProvider, useLocale } from '@/components/locale'
import { catalogTours, findTour } from '@/data/tours'
import { countries, defaultCountry } from '@/data/countries'
import { localizeTourDuration, localizeTourLocation } from '@/lib/tour-format'
import { estimateCart, isValidPreferredDate } from '@/lib/booking'
import { useCart } from '@/lib/cart'
import { useInquiries, useBrandSettings, useLiveCollection, useLiveTours, readImpersonation, stopImpersonation, type ImpersonatedCustomer } from '@/lib/admin-store'
import { cars } from '@/data/content'
import { clearCarPreview, useCarRequestPreview, type CarRequestPreview } from '@/lib/car-request'
import { useCustomerEffectiveCarRequest, removeAmendmentsForRequest, useAmendments, AMENDMENT_STATUS_COPY, AMENDABLE_FIELD_COPY, type CarRequestAmendment } from '@/lib/car-request-amendments'
import { RequestAmendmentBadge, RequestAmendmentsSection } from './account-car-change'
import { usePagination } from '@/components/admin/admin-pagination'
import { bookings as adminBookings, type BookingRow } from '@/components/admin/admin-data'
import {
  saveCustomerProfile, updateCustomerBooking, useCustomerBookings, useCustomerFavorites,
  useCustomerProfile, type CustomerBooking, type CustomerBookingOrigin, type CustomerBookingStatus, type CustomerProfile,
} from '@/lib/customer-account'
import { clearMessageDraft, readMessageDraft, saveMessageDraft } from '@/lib/customer-account'
import {
  markCustomerChatRead, sendCustomerChatMessage, useCustomerChatMessages,
  type CustomerChatAttachment,
} from '@/lib/customer-chat'
import { whatsappHref } from '@/data/company'
import { CountrySelect } from '@/components/country-select'
import { InternationalPhoneInput } from '@/components/international-phone-input'
import { SharedSelect } from '@/components/shared-select'
import { WhatsAppGlyph } from '@/components/whatsapp-chat'
import { LanguageModal } from '@/components/language-selector'
import { ENABLED_LOCALES, LOCALE_LABELS, LOCALE_SHORT_LABELS, type EnabledLocale } from '@/lib/locale-config'
import { useAuthenticatedUser } from '@/components/authenticated-user'

export type AccountSection = 'overview' | 'bookings' | 'car-requests' | 'event-requests' | 'trip-requests' | 'favorites' | 'payments' | 'messages' | 'profile' | 'settings' | 'change-password'

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
    // Admin connection: a staff-cancelled booking carries no pending charge,
    // so its payment reads Rejected on the customer side.
    paymentStatus: booking.status === 'confirmed' ? 'paid' : booking.status === 'cancelled' ? 'rejected' : 'pending',
    total: booking.total,
    currency: 'USD',
    contact: { name: booking.customer, email: '', phone: '' },
    notes: '',
    origin: 'demo',
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
  { id: 'car-requests', href: '/account/car-requests', Icon: CarFront, en: 'Car Requests', ar: 'طلبات السيارات' },
  { id: 'event-requests', href: '/account/event-requests', Icon: Ticket, en: 'Event Requests', ar: 'طلبات الفعاليات' },
  { id: 'trip-requests', href: '/account/trip-requests', Icon: Compass, en: 'Trip Requests', ar: 'طلبات الرحلات' },
  { id: 'payments', href: '/account/payments', Icon: WalletCards, en: 'Payments', ar: 'المدفوعات' },
  { id: 'favorites', href: '/account/favorites', Icon: Heart, en: 'Saved trips', ar: 'الرحلات المحفوظة' },
  { id: 'messages', href: '/account/messages', Icon: MessageCircle, en: 'Messages', ar: 'الرسائل' },
  { id: 'profile', href: '/account/profile', Icon: UserRound, en: 'Profile', ar: 'الملف الشخصي' },
  { id: 'settings', href: '/account/settings', Icon: Settings2, en: 'Settings', ar: 'الإعدادات' },
] as const

const sectionHeadings: Record<AccountSection, { en: string; ar: string; subEn: string; subAr: string }> = {
  overview: { en: 'Your travel desk', ar: 'مكتب رحلتك', subEn: 'Everything you need before, during, and after your Egypt journey.', subAr: 'كل ما تحتاجه قبل رحلتك إلى مصر وأثناءها وبعدها.' },
  bookings: { en: 'Bookings', ar: 'الحجوزات', subEn: 'Track requests, confirmations, travelers, and trip details.', subAr: 'تابع الطلبات والتأكيدات والمسافرين وتفاصيل الرحلات.' },
  'car-requests': { en: 'Car Requests', ar: 'طلبات السيارات', subEn: 'Review and manage your saved vehicle requests.', subAr: 'راجع طلبات السيارات المحفوظة وأدرها بسهولة.' },
  'event-requests': { en: 'Event Requests', ar: 'طلبات الفعاليات', subEn: 'Track your local event attendance requests.', subAr: 'تابع طلبات حضور الفعاليات المحفوظة محليًا.' },
  'trip-requests': { en: 'Trip Requests', ar: 'طلبات الرحلات', subEn: 'Review your saved trip request or plan a new journey.', subAr: 'راجع طلب رحلتك المحفوظ أو خطط لرحلة جديدة.' },
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

function useAccountProfile(): CustomerProfile {
  const user = useAuthenticatedUser()
  const stored = useCustomerProfile()
  // Memoized: consumers sync this value into local form state via
  // `useEffect(..., [current])`. A fresh object identity on every render
  // retriggered those effects endlessly ("Maximum update depth exceeded"),
  // which broke client-side navigation out of profile/settings pages.
  // `user` (context) and `stored` (useState) are both referentially stable.
  return useMemo(() => {
    const emailMatches = stored.email.trim().toLowerCase() === user.email.trim().toLowerCase()
    const selectedCountry = countries.find((country) => country.code === user.countryCode) ?? defaultCountry
    const emailName = user.email.split('@')[0] || 'traveler'
    const firstName = user.firstName || emailName
    const lastName = user.lastName || ''
    return {
      ...stored,
      firstName,
      lastName,
      fullName: `${firstName} ${lastName}`.trim(),
      username: user.username || emailName.replace(/[^A-Za-z0-9_]/g, '_'),
      email: user.email,
      country: selectedCountry.code,
      dialCode: selectedCountry.dialCode,
      phone: user.phone || '',
      avatar: emailMatches ? stored.avatar : '',
    }
  }, [user, stored])
}

export function AccountShell({ section, children, headLeading }: { section: AccountSection; children: ReactNode; headLeading?: ReactNode }) {
  const router = useRouter()
  const { locale, setLocale, currency, setCurrency } = useLocale()
  const ar = locale === 'ar'
  const impersonated = useImpersonated()
  const storedProfile = useAccountProfile()
  const profile = impersonated
    ? { ...storedProfile, fullName: impersonated.name, email: impersonated.email || storedProfile.email, avatar: impersonated.avatar || storedProfile.avatar }
    : storedProfile
  const bookings = useVisibleBookings()
  const inquiries = useVisibleInquiries()
  const chatMessages = useCustomerChatMessages()
  const unreadMessages = chatMessages.filter((message) => message.sender === 'agent' && !message.readByCustomer).length
  const favorites = useCustomerFavorites()
  const cart = useCart()
  const carPreview = useCarRequestPreview()
  const liveTours = useLiveTours(catalogTours)
  const heading = sectionHeadings[section]
  const initials = profile.fullName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'SP'
  const [mobileOpen, setMobileOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [userOpen, setUserOpen] = useState(false)
  const [languageOpen, setLanguageOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const searchResults = useMemo(() => query.trim() ? liveTours.filter((tour) => `${tour.title} ${tour.location}`.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 5) : [], [liveTours, query])
  const logout = async () => {
    if (loggingOut) return
    setLoggingOut(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' })
    } finally {
      router.replace('/login')
      router.refresh()
    }
  }

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
            return <Link key={id} href={href} onClick={() => setMobileOpen(false)} className={active ? 'active' : ''} aria-current={active ? 'page' : undefined}><Icon size={18} /><span>{ar ? arLabel : en}</span>{id === 'bookings' && bookings.length > 0 && <b>{bookings.length}</b>}{id === 'car-requests' && carPreview && <b>1</b>}{id === 'favorites' && favorites.slugs.length > 0 && <b>{favorites.slugs.length}</b>}{id === 'messages' && unreadMessages > 0 && <b>{unreadMessages}</b>}</Link>
          })}
        </nav>
        <div className="customer-side-summary">
          <ShoppingCart size={18} />
          <div><strong>{ar ? 'سلة الرحلات' : 'Trip cart'}</strong><small>{cart.lines ? (ar ? `${cart.lines} رحلات بانتظارك` : `${cart.lines} trip${cart.lines === 1 ? '' : 's'} waiting`) : (ar ? 'ابدأ بإضافة رحلة' : 'Start by adding a trip')}</small></div>
          <Link href="/cart" aria-label={ar ? 'فتح السلة' : 'Open cart'}><ChevronRight size={17} /></Link>
        </div>
        <button type="button" className="customer-signout" onClick={logout} disabled={loggingOut}><LogOut size={17} />{loggingOut ? (ar ? 'جارٍ الخروج...' : 'Signing out...') : (ar ? 'تسجيل الخروج' : 'Sign out')}</button>
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
          <button type="button" className="customer-top-language" onClick={() => { setLanguageOpen(true); setNotificationsOpen(false); setUserOpen(false) }} aria-label={ar ? 'اختيار اللغة والعملة' : 'Choose language and currency'}><Globe2 size={18} /><span>{LOCALE_SHORT_LABELS[locale]}</span></button>
          {languageOpen && <LanguageModal locale={locale} currency={currency} onClose={() => setLanguageOpen(false)} onSelect={setLocale} onCurrency={setCurrency} />}
          <SharedSelect value={currency} onChange={(next) => setCurrency(next as 'USD' | 'EUR' | 'EGP')} locale={locale} label={ar ? 'العملة' : 'Currency'} options={[{ value: 'USD', label: 'USD' }, { value: 'EUR', label: 'EUR' }, { value: 'EGP', label: 'EGP' }]} />
          <Link href="/" className="customer-top-icon" aria-label={ar ? 'العودة للموقع' : 'Back to website'} title={ar ? 'العودة للموقع' : 'Back to website'}><ExternalLink size={18} /></Link>
          <Link href="/cart" className="customer-top-icon customer-cart-icon" aria-label={ar ? 'سلة الرحلات' : 'Trip cart'}><ShoppingCart size={18} />{cart.lines > 0 && <b>{cart.lines}</b>}</Link>
          <div className="customer-top-popover">
            <button type="button" className="customer-top-icon" onClick={() => { setNotificationsOpen((open) => !open); setUserOpen(false) }} aria-label={ar ? 'الإشعارات' : 'Notifications'} aria-expanded={notificationsOpen}><Bell size={18} />{(bookings.length + unreadMessages) > 0 && <i />}</button>
            {notificationsOpen && <div className="customer-notifications"><header><strong>{ar ? 'الإشعارات' : 'Notifications'}</strong><small>{bookings.length + unreadMessages}</small></header>{bookings[0] ? <Link href="/account/bookings" onClick={() => setNotificationsOpen(false)}><ShoppingBag size={17} /><span><b>{ar ? 'آخر تحديث للحجز' : 'Latest booking update'}</b><small>{bookings[0].reference}</small></span></Link> : <p>{ar ? 'لا توجد تحديثات حجوزات جديدة.' : 'No new booking updates.'}</p>}{unreadMessages > 0 && <Link href="/account/messages" onClick={() => setNotificationsOpen(false)}><MessageCircle size={17} /><span><b>{ar ? 'رد جديد من فريق الرحلات' : 'New reply from the travel team'}</b><small>{unreadMessages} {ar ? 'غير مقروءة' : 'unread'}</small></span></Link>}</div>}
          </div>
          <div className="customer-top-popover customer-user-popover">
            <button type="button" className="customer-top-user" onClick={() => { setUserOpen((open) => !open); setNotificationsOpen(false) }} aria-expanded={userOpen}><CustomerAvatar avatar={profile.avatar} initials={initials} className="customer-top-avatar" name={profile.fullName} /><div><strong>{profile.fullName}</strong><small>{ar ? 'مسافر' : 'Traveler'}</small></div><ChevronDown size={15} /></button>
            {userOpen && <div className="customer-user-menu"><Link href="/account/profile" onClick={() => setUserOpen(false)}><UserRound size={16} />{ar ? 'الملف الشخصي' : 'Profile'}</Link><Link href="/account/settings" onClick={() => setUserOpen(false)}><Settings2 size={16} />{ar ? 'الإعدادات' : 'Settings'}</Link><button type="button" onClick={logout} disabled={loggingOut}><LogOut size={16} />{ar ? 'تسجيل الخروج' : 'Sign out'}</button></div>}
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
        <p className="customer-demo-notice" role="note"><FlaskConical size={16} /><span><strong>{ar ? 'الحساب متصل' : 'Account connected'}</strong>{ar ? 'هويتك وملفك الشخصي وتسجيل الدخول مدعومة بقاعدة البيانات، وطلبات الرحلات تُحفظ في قاعدة البيانات. تظل الحجوزات وطلبات السيارات وطلبات الفعاليات والمدفوعات والرسائل بيانات معاينة حتى مراحل الباك إند الخاصة بها.' : 'Your identity, profile, and sign-in are database-backed, and trip requests are saved to the database. Bookings, car requests, event requests, payments, and messages remain preview data until their backend phases.'}</span></p>
        <header className="customer-account-head">
          <div><span>{ar ? 'حساب STAR PYRAMIDS' : 'STAR PYRAMIDS account'}</span><h1>{ar ? heading.ar : heading.en}</h1><p>{ar ? heading.subAr : heading.subEn}</p></div>
          <div className="customer-account-head-actions">{headLeading}<Link href="/trips" className="account-icon-action"><Search size={17} />{ar ? 'استكشف الرحلات' : 'Explore trips'}</Link><Link href="/contact" className="account-icon-action primary"><HelpCircle size={17} />{ar ? 'اطلب مساعدة' : 'Get help'}</Link></div>
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
  // Browser-local previews are not part of any server lifecycle: they were
  // never received, confirmed, or processed by STAR PYRAMIDS.
  if ((booking.origin ?? 'demo') === 'local' && booking.status !== 'cancelled') {
    return <span className="customer-status local"><Clock3 size={13} />{ar ? 'معاينة محلية' : 'Local preview'}</span>
  }
  return <span className={`customer-status ${booking.status}`}>{booking.status === 'confirmed' || booking.status === 'completed' ? <CheckCircle2 size={13} /> : <Clock3 size={13} />}{ar ? bookingStatusCopy[booking.status].ar : bookingStatusCopy[booking.status].en}</span>
}

function OriginChip({ origin, ar }: { origin: CustomerBookingOrigin | undefined; ar: boolean }) {
  const resolved = origin ?? 'demo'
  return <em className={`origin-chip ${resolved}`}>{resolved === 'local' ? (ar ? 'معاينة محلية' : 'Local preview') : (ar ? 'سجل تجريبي' : 'Demo record')}</em>
}

/** Prefer a valid stored line date, then a parseable creation date. Never throws on malformed storage. */
function displayBookingDate(booking: CustomerBooking, ar: boolean): string {
  const lineDate = booking.lines.find((line) => isValidPreferredDate(line.date))?.date
  if (lineDate) return lineDate
  const created = new Date(booking.createdAt)
  if (!Number.isNaN(created.getTime())) return created.toLocaleDateString(ar ? 'ar-EG' : 'en-GB')
  return booking.lines[0]?.date || '—'
}

/**
 * No payment policy (including pay-on-arrival) has been established.
 * Only an explicitly stored card method on demo fixtures is named;
 * everything else — always for local previews — stays unclaimed.
 */
function displayPaymentMethod(booking: CustomerBooking, ar: boolean): string {
  if (booking.paymentMethod === 'card') return ar ? 'بطاقة بنكية' : 'Card'
  return ar ? 'تُؤكد لاحقًا' : 'To be confirmed'
}

function displayPaymentStatus(booking: CustomerBooking, ar: boolean): string {
  if (booking.paymentStatus === 'paid') return ar ? 'مدفوع' : 'Paid'
  if (booking.paymentStatus === 'rejected') return ar ? 'مرفوض' : 'Rejected'
  return ar ? 'قيد التأكيد' : 'Pending'
}

function BookingCard({ booking }: { booking: CustomerBooking }) {
  const { locale, currency } = useLocale()
  const ar = locale === 'ar'
  const first = booking.lines[0]
  const travelers = booking.lines.reduce((sum, line) => sum + line.adults + line.children + line.infants, 0)
  return <article className="customer-booking-row">
    <Link href={`/account/bookings/detail?ref=${encodeURIComponent(booking.reference)}`}><img src={first?.image || '/egypt-hero.png'} alt="" /></Link>
    <div className="customer-booking-copy">
      <div className="customer-booking-top"><span>{booking.reference}</span><OriginChip origin={booking.origin} ar={ar} /><BookingStatus booking={booking} ar={ar} /></div>
      <h3><Link href={`/account/bookings/detail?ref=${encodeURIComponent(booking.reference)}`}>{first?.title || (ar ? 'رحلة مخصصة' : 'Custom journey')}</Link></h3>
      <div className="customer-booking-meta"><span><CalendarDays size={14} />{displayBookingDate(booking, ar)}</span><span><Users size={14} />{travelers} {ar ? 'مسافرين' : 'travelers'}</span><span><PackageCheck size={14} />{booking.lines.length} {ar ? 'رحلات' : 'trip items'}</span></div>
    </div>
    <div className="customer-booking-total"><small>{ar ? 'الإجمالي' : 'Total'}</small><strong>{formatPrice(booking.total, currency, locale)}</strong><span className="customer-booking-links"><Link href={`/account/bookings/detail?ref=${encodeURIComponent(booking.reference)}`}>{ar ? 'عرض التفاصيل' : 'View details'} <ArrowRight size={14} /></Link><Link href="/account/messages" onClick={() => saveMessageDraft({ reference: booking.reference, title: first?.title ?? '' })}>{ar ? 'اسأل عن الحجز' : 'Ask about booking'} <ArrowRight size={14} /></Link></span></div>
  </article>
}

function OverviewSection() {
  const { locale, currency } = useLocale()
  const ar = locale === 'ar'
  const profile = useAccountProfile()
  const impersonated = useImpersonated()
  const displayName = impersonated ? impersonated.name : profile.fullName
  const bookings = useVisibleBookings()
  const favorites = useCustomerFavorites()
  const inquiries = useVisibleInquiries()
  const chatMessages = useCustomerChatMessages()
  const cart = useCart()
  const cartEstimate = useMemo(() => estimateCart(cart.items), [cart.items])
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
      <Metric Icon={ShoppingCart} value={cart.lines} label={ar ? 'في السلة' : 'In cart'} note={cart.lines ? formatPrice(cartEstimate.subtotal, currency, locale) : (ar ? 'السلة فارغة' : 'Cart is empty')} tone="green" />
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
    { href: '/account/trip-requests', Icon: Plus, en: 'Plan a custom trip', ar: 'خطط رحلة مخصصة' },
    { href: '/account/payments', Icon: ReceiptText, en: 'Payment records', ar: 'سجل المدفوعات' },
    { href: '/account/profile', Icon: UserRound, en: 'Update profile', ar: 'تحديث الملف' },
  ]
  return <section className="customer-account-block customer-quick-actions"><header><div><span>{ar ? 'اختصارات' : 'Shortcuts'}</span><h2>{ar ? 'إجراءات سريعة' : 'Quick actions'}</h2></div></header>{actions.map(({ href, Icon, en, ar: arLabel }) => <Link key={href} href={href}><Icon size={17} /><span>{ar ? arLabel : en}</span><ChevronRight size={15} /></Link>)}</section>
}

export function EmptyState({ Icon, title, copy, href, action }: { Icon: typeof CalendarDays; title: string; copy: string; href: string; action: string }) {
  return <div className="customer-empty"><span><Icon size={24} /></span><h3>{title}</h3><p>{copy}</p><Link href={href}>{action} <ArrowRight size={15} /></Link></div>
}

export function CustomerPagination({ page, pageCount, onPage, pageSize, onPageSize, from, to, total }: {
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
        <SharedSelect value={String(pageSize)} onChange={(next) => onPageSize(Number(next))} locale={locale} label={ar ? 'عدد الصفوف في الصفحة' : 'Rows per page'} options={[10, 20, 30, 50].map((n) => ({ value: String(n), label: String(n) }))} />
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
  const createdOn = displayBookingDate(booking, ar)
  const isLocal = (booking.origin ?? 'demo') === 'local'
  const steps = [
    { done: true, label: isLocal ? (ar ? 'محفوظ في هذا المتصفح' : 'Saved in this browser') : (ar ? 'تم الاستلام' : 'Received'), date: createdOn },
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
      <header><div><span>{booking.reference}</span><h2>{booking.lines[0]?.title || (ar ? 'تفاصيل الحجز' : 'Booking details')}</h2></div><span className="customer-booking-flags"><OriginChip origin={booking.origin} ar={ar} /><BookingStatus booking={{ ...booking, status: activeStatus }} ar={ar} /></span></header>
      {booking.origin === 'local' && <p className="customer-local-note" role="note"><FlaskConical size={15} />{ar ? 'معاينة طلب محلية محفوظة في هذا المتصفح فقط. لم تُرسل أو تُؤكد أو تُدفع.' : 'Local request preview saved in this browser only. It has not been submitted, confirmed, or paid.'}</p>}
      <div className="customer-detail-grid">
        <div><small>{ar ? 'تاريخ السفر' : 'Travel date'}</small><strong>{booking.lines[0]?.date || createdOn}</strong></div>
        <div><small>{ar ? 'المسافرون' : 'Travelers'}</small><strong>{travelers}</strong></div>
        <div><small>{ar ? 'طريقة الدفع' : 'Payment method'}</small><strong>{displayPaymentMethod(booking, ar)}</strong></div>
        <div><small>{ar ? 'حالة الدفع' : 'Payment status'}</small><strong>{displayPaymentStatus(booking, ar)}</strong></div>
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
    <td>{displayBookingDate(booking, ar)}</td>
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
  // Lifecycle tabs describe server-side states, so browser-local previews
  // (never received by STAR PYRAMIDS) appear only under 'All'.
  const visible = filter === 'all' ? bookings : bookings.filter((booking) => (booking.origin ?? 'demo') !== 'local' && booking.status === filter)
  const paging = usePagination(visible)
  return <section className="customer-account-block customer-full-block"><div className="customer-filterbar"><div role="tablist" aria-label={ar ? 'فلترة الحجوزات' : 'Filter bookings'}>{(['all', 'request_received', 'confirmed', 'completed', 'cancelled'] as const).map((status) => <button type="button" key={status} className={filter === status ? 'active' : ''} onClick={() => setFilter(status)}>{status === 'all' ? (ar ? 'الكل' : 'All') : (ar ? bookingStatusCopy[status].ar : bookingStatusCopy[status].en)}</button>)}</div><Link href="/trips"><Plus size={16} />{ar ? 'حجز رحلة' : 'Book a trip'}</Link></div>{visible.length ? <><div className="customer-table-wrap"><table className="customer-table"><thead><tr><th>#</th><th>{ar ? 'الرحلة' : 'Trip'}</th><th>{ar ? 'التاريخ' : 'Date'}</th><th>{ar ? 'المسافرون' : 'Travelers'}</th><th>{ar ? 'الإجمالي' : 'Total'}</th><th>{ar ? 'الحالة' : 'Status'}</th><th></th></tr></thead><tbody>{paging.pageRows.map((booking, index) => <BookingTableRow key={booking.reference} booking={booking} index={paging.from + index} />)}</tbody></table></div><CustomerPagination page={paging.page} pageCount={paging.pageCount} onPage={paging.setPage} pageSize={paging.pageSize} onPageSize={paging.setPageSize} from={paging.from} to={paging.to} total={paging.total} /></> : <EmptyState Icon={ShoppingBag} title={ar ? 'لا توجد حجوزات في هذه الحالة' : 'No bookings in this view'} copy={ar ? 'أي طلب حجز تنشئه من صفحة الدفع سيظهر هنا تلقائيًا.' : 'Any booking request created at checkout will appear here automatically.'} href="/trips" action={ar ? 'تصفح الرحلات' : 'Browse trips'} />}</section>
}

/**
 * Customer car requests (Phase E.4). Presentation model over the SINGLE
 * browser-local preview from lib/car-request.ts — never admin DEMO fixtures,
 * never admin overlays, statuses, notes, or assignments. Shaped so future
 * backend records can map into the same sections (overview / journey /
 * contact / notes / state notice) without redesigning this UI.
 */
function carRequestVehicleTitle(liveCars: { slug: string; title: string }[], slug: string): string {
  return liveCars.find((car) => car.slug === slug)?.title ?? slug
}

function carTripLabel(tripType: string, ar: boolean): string {
  if (tripType === 'One Way') return ar ? 'ذهاب فقط' : 'One Way'
  if (tripType === 'Round Trip') return ar ? 'ذهاب وعودة' : 'Round Trip'
  return ar ? 'لم يحدد' : 'Not set'
}

/** Customer-friendly display date only (e.g. "27 Sep 2026"). Stored ISO is never modified. */
function formatCarDate(iso: string, ar: boolean): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso
  const parsed = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return iso
  if (ar) return parsed.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', year: 'numeric' })
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${parsed.getDate()} ${months[parsed.getMonth()]} ${parsed.getFullYear()}`
}

function passengerCountLabel(count: number, ar: boolean): string {
  if (!ar) return count === 1 ? '1 passenger' : `${count} passengers`
  if (count === 1) return 'مسافر واحد'
  if (count === 2) return 'مسافران'
  if (count <= 10) return `${count} مسافرين`
  return `${count} مسافر`
}

export function CustomerConfirmDialog({ open, title, copy, confirmLabel, cancelLabel, onConfirm, onClose }: {
  open: boolean
  title: string
  copy: string
  /** Omitted = blocking notice mode: no destructive confirm is offered. */
  confirmLabel?: string
  /** Defaults to a short keep/dismiss wording. */
  cancelLabel?: string
  onConfirm: () => void
  onClose: () => void
}) {
  const { locale } = useLocale()
  const ar = locale === 'ar'
  const panelRef = useRef<HTMLDivElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)
  const restoreRef = useRef<Element | null>(null)
  useEffect(() => {
    if (!open) return
    restoreRef.current = document.activeElement
    if (confirmRef.current) confirmRef.current.focus()
    else panelRef.current?.focus()
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key === 'Tab' && panelRef.current) {
        const items = Array.from(
          panelRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
          ),
        )
        if (!items.length) return
        const first = items[0]
        const last = items[items.length - 1]
        const active = document.activeElement
        if (event.shiftKey && (active === first || !panelRef.current.contains(active))) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && active === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      if (restoreRef.current instanceof HTMLElement) restoreRef.current.focus()
    }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="language-backdrop" role="presentation" onMouseDown={onClose}>
      <div ref={panelRef} tabIndex={-1} className="language-modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
        <div className="language-modal-head">
          <h2>{title}</h2>
          <button type="button" className="language-close" onClick={onClose} aria-label={ar ? 'إغلاق الحوار' : 'Close dialog'}><X size={18} /></button>
        </div>
        <p style={{ margin: '12px 0 0', color: '#667085', fontSize: 13, lineHeight: 1.7 }}>{copy}</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap', marginTop: 18 }}>
          <button type="button" className="account-icon-action" onClick={onClose}>{cancelLabel ?? (ar ? 'تراجع' : 'Keep it')}</button>
          {confirmLabel && <button ref={confirmRef} type="button" className="account-icon-action danger" onClick={onConfirm}>{confirmLabel}</button>}
        </div>
      </div>
    </div>
  )
}

/**
 * Original-request discard with amendment-history protection.
 * - A pending amendment BLOCKS the discard (explained, no confirm offered).
 * - Draft/decided history is removed together with the request, but only
 *   after an explicit confirmation that names the amendment count.
 * Documented rule: history is never destroyed silently.
 */
function useDiscardCarPreview(requestRef: string) {
  const [open, setOpen] = useState(false)
  const amendments = useAmendments()
  const related = amendments.filter((entry) => entry.requestRef === requestRef)
  const pending = related.find((entry) => entry.status === 'pending') ?? null
  const discard = () => {
    if (pending) {
      setOpen(false)
      return
    }
    if (requestRef) removeAmendmentsForRequest(requestRef)
    clearCarPreview()
    setOpen(false)
  }
  return { open, setOpen, discard, pending, relatedCount: related.length }
}

function CarRequestsSection() {
  const { locale } = useLocale()
  const ar = locale === 'ar'
  // Effective view: original preview plus any demo-approved amendment override.
  const effective = useCustomerEffectiveCarRequest()
  const liveCars = useLiveCollection('cars', cars)
  const amendments = useAmendments()
  const { open, setOpen, discard, pending: pendingDiscard, relatedCount: discardRelated } = useDiscardCarPreview(effective?.preview.localRef ?? '')
  const [filter, setFilter] = useState<'all' | 'active' | 'draft' | 'pending' | 'decided'>('all')

  if (!effective && !amendments.length) {
    return <section className="customer-account-block customer-full-block"><EmptyState Icon={CarFront} title={ar ? 'لا توجد طلبات سيارات بعد' : 'No car requests yet'} copy={ar ? 'ابدأ طلب سيارة أو وسيلة انتقال وسيظهر هنا.' : 'Plan your transfer or vehicle request and it will appear here.'} href="/rent-car" action={ar ? 'استكشف السيارات' : 'Browse rental cars'} /></section>
  }

  const drafts = amendments.filter((a) => a.status === 'draft')
  const pendings = amendments.filter((a) => a.status === 'pending')
  const decided = amendments.filter((a) => a.status === 'approved' || a.status === 'rejected')
  const shownAmendments = filter === 'all' ? amendments : filter === 'draft' ? drafts : filter === 'pending' ? pendings : filter === 'decided' ? decided : []
  const showRequest = Boolean(effective) && (filter === 'all' || filter === 'active')
  const tabs = [
    { id: 'all', en: 'All', ar: 'الكل' },
    { id: 'active', en: 'Active request', ar: 'الطلب النشط' },
    { id: 'draft', en: 'Draft changes', ar: 'مسودات التعديل' },
    { id: 'pending', en: 'Pending review', ar: 'قيد المراجعة' },
    { id: 'decided', en: 'Decided', ar: 'تم البت فيها' },
  ] as const

  const preview = effective?.preview ?? null
  const draft = preview?.draft ?? null
  const vehicleTitle = draft ? carRequestVehicleTitle(liveCars, draft.vehicleSlug) : ''
  const vehicleImage = (draft && liveCars.find((car) => car.slug === draft.vehicleSlug)?.image) || '/egypt-hero.png'
  const detailHref = preview ? `/account/car-requests/detail?ref=${encodeURIComponent(preview.localRef)}` : ''
  const showReturn = draft?.tripType === 'Round Trip' && (draft?.preferredReturnDate ?? '') !== ''
  const viewLabel = ar ? 'عرض الطلب' : 'View request'
  const changeLabel = ar ? 'طلب تعديل' : 'Request changes'
  const discardLabel = ar ? 'تجاهل المعاينة' : 'Discard preview'
  const amendmentTone = (status: CarRequestAmendment['status']) => status === 'draft' ? 'draft' : status === 'pending' ? 'reviewing' : status === 'approved' ? 'confirmed' : 'cancelled'
  return <>
    <section className="customer-account-block customer-full-block">
      <div className="customer-filterbar"><div role="tablist" aria-label={ar ? 'فلترة طلبات السيارات' : 'Filter car requests'}>{tabs.map((tab) => <button type="button" key={tab.id} className={filter === tab.id ? 'active' : ''} onClick={() => setFilter(tab.id)}>{ar ? tab.ar : tab.en}</button>)}</div><Link href="/rent-car"><Plus size={16} />{ar ? 'طلب سيارة' : 'Request a car'}</Link></div>
      {showRequest && preview && draft ? <div className="customer-table-wrap"><table className="customer-table">
        <thead><tr><th>#</th><th>{ar ? 'السيارة' : 'Vehicle'}</th><th>{ar ? 'المسار' : 'Route'}</th><th>{ar ? 'التواريخ' : 'Dates'}</th><th>{ar ? 'المسافرون' : 'Passengers'}</th><th>{ar ? 'الحالة' : 'Status'}</th><th></th></tr></thead>
        <tbody><tr>
          <td className="customer-row-number">1</td>
          <td><span className="customer-trip-cell"><img src={vehicleImage} alt="" /><span><strong><Link href={detailHref}>{vehicleTitle}</Link></strong><small><span dir="ltr">{preview.localRef}</span> · {carTripLabel(draft.tripType, ar)}{effective?.amended && <> · {ar ? 'محدّث بموافقة' : 'Updated on approval'}</>}</small></span></span></td>
          <td><span dir="ltr">{draft.pickup} → {draft.dropoff}</span></td>
          <td><span dir="ltr">{formatCarDate(draft.preferredPickupDate, ar)}</span>{showReturn && <><br /><small style={{ color: '#667283' }}><span dir="ltr">{formatCarDate(draft.preferredReturnDate, ar)}</span></small></>}</td>
          <td>{passengerCountLabel(draft.passengers, ar)}</td>
          <td><span className="customer-status local"><Clock3 size={13} />{ar ? 'معاينة محلية' : 'Local preview'}</span><RequestAmendmentBadge requestRef={preview.localRef} /></td>
          <td><span className="customer-table-actions">
            <Link href={detailHref} aria-label={viewLabel} title={viewLabel}><Eye size={16} /></Link>
            <Link href={`/account/car-requests/change?ref=${encodeURIComponent(preview.localRef)}`} aria-label={changeLabel} title={changeLabel}><Pencil size={16} /></Link>
            <button type="button" className="danger" onClick={() => setOpen(true)} aria-label={discardLabel} title={discardLabel}><Ban size={16} /></button>
          </span></td>
        </tr></tbody>
      </table></div> : null}
      {shownAmendments.length > 0 ? <div className="customer-table-wrap"><table className="customer-table">
        <thead><tr><th>#</th><th>{ar ? 'التعديل' : 'Change'}</th><th>{ar ? 'البنود' : 'Fields'}</th><th>{ar ? 'آخر تحديث' : 'Updated'}</th><th>{ar ? 'الحالة' : 'Status'}</th><th></th></tr></thead>
        <tbody>{shownAmendments.map((amendment, index) => {
          const fields = amendment.changedFields.map((field) => ar ? AMENDABLE_FIELD_COPY[field].ar : AMENDABLE_FIELD_COPY[field].en)
          const extra = fields.length > 3 ? ` +${fields.length - 3}` : ''
          return <tr key={amendment.amendmentRef}>
            <td className="customer-row-number">{index + 1}</td>
            <td><span className="customer-trip-cell"><span><strong><Link href={`/account/car-requests/change/detail?ref=${encodeURIComponent(amendment.amendmentRef)}`}><span dir="ltr">{amendment.amendmentRef}</span></Link></strong><small><span dir="ltr">{amendment.requestRef}</span></small></span></span></td>
            <td>{[...fields.slice(0, 3)].join(ar ? '، ' : ', ')}{extra}</td>
            <td><span dir="ltr">{new Date(amendment.updatedAt).toLocaleDateString(ar ? 'ar-EG' : 'en-US')}</span></td>
            <td><span className={`customer-status ${amendmentTone(amendment.status)}`}>{ar ? AMENDMENT_STATUS_COPY[amendment.status].ar : AMENDMENT_STATUS_COPY[amendment.status].en}</span></td>
            <td><span className="customer-table-actions">
              <Link href={`/account/car-requests/change/detail?ref=${encodeURIComponent(amendment.amendmentRef)}`} aria-label={ar ? 'عرض التعديل' : 'View change'} title={ar ? 'عرض التعديل' : 'View change'}><Eye size={16} /></Link>
              {amendment.status === 'draft' && <Link href={`/account/car-requests/change?ref=${encodeURIComponent(amendment.requestRef)}&amendment=${encodeURIComponent(amendment.amendmentRef)}`} aria-label={ar ? 'متابعة التعديل' : 'Continue editing'} title={ar ? 'متابعة التعديل' : 'Continue editing'}><Pencil size={16} /></Link>}
            </span></td>
          </tr>
        })}</tbody>
      </table></div> : null}
      {!showRequest && !shownAmendments.length ? <EmptyState Icon={CarFront} title={ar ? 'لا توجد عناصر في هذه الحالة' : 'No items in this view'} copy={ar ? 'جرب حالة مختلفة من الفلتر بالأعلى.' : 'Try a different status from the filter above.'} href="/rent-car" action={ar ? 'استكشف السيارات' : 'Browse rental cars'} /> : null}
      <div style={{ padding: '14px 18px 18px' }}>
        <p className="car-request-notice" role="note"><FlaskConical size={15} /><span>{ar ? 'محفوظ في هذا المتصفح فقط. لم يتم إرسال هذا الطلب إلى STAR PYRAMIDS.' : 'Saved in this browser only. This request has not been submitted to STAR PYRAMIDS.'}</span></p>
      </div>
    </section>
    <CustomerConfirmDialog
      open={open}
      onClose={() => setOpen(false)}
      onConfirm={discard}
      title={ar ? 'تجاهل المعاينة المحلية؟' : 'Discard local preview?'}
      copy={pendingDiscard
        ? (ar ? `لا يمكن التجاهل الآن: التعديل ${pendingDiscard.amendmentRef} قيد المراجعة. بتّ فيه أولًا من صفحة التعديل.` : `Cannot discard now: change ${pendingDiscard.amendmentRef} is under review. Decide it from the change page first.`)
        : discardRelated > 0
          ? (ar ? `سيؤدي هذا إلى إزالة المعاينة المحلية ومعها ${discardRelated} من سجلات التعديل المرتبطة. لن يتأثر أي شيء آخر.` : `This removes the local preview plus its ${discardRelated} linked change record(s). Nothing else is affected.`)
          : (ar ? 'سيؤدي هذا إلى إزالة معاينة الطلب المحفوظة في هذا المتصفح فقط. لن يتأثر أي شيء آخر.' : 'This removes only the browser-local request preview. Nothing else is affected.')}
      confirmLabel={pendingDiscard ? undefined : (ar ? 'تجاهل المعاينة' : 'Discard preview')}
    />
  </>
}

function CarRequestDetailSection({ reference }: { reference: string }) {
  const { locale } = useLocale()
  const ar = locale === 'ar'
  const effective = useCustomerEffectiveCarRequest()
  const liveCars = useLiveCollection('cars', cars)
  const matched = effective && effective.preview.localRef === reference ? effective : null
  const { open, setOpen, discard, pending: pendingDiscard, relatedCount: discardRelated } = useDiscardCarPreview(reference)

  if (!matched) {
    return <EmptyState Icon={CarFront} title={ar ? 'طلب السيارة غير موجود' : 'Car request not found'} copy={ar ? 'ربما تم تجاهله أو أنه محفوظ في متصفح مختلف.' : 'It may have been discarded or saved in a different browser.'} href="/account/car-requests" action={ar ? 'عودة لطلبات السيارات' : 'Back to car requests'} />
  }

  const draft: CarRequestPreview['draft'] = matched.preview.draft
  const vehicleTitle = carRequestVehicleTitle(liveCars, draft.vehicleSlug)
  return <>
    <section className="customer-account-block">
      <header><div><span>{ar ? 'طلب سيارة' : 'Car request'}</span><h2>{vehicleTitle}</h2></div><span className="customer-status local"><Clock3 size={13} />{ar ? 'معاينة محلية' : 'Local preview'}</span></header>
      <p className="car-request-notice" role="note"><FlaskConical size={15} /><span><span dir="ltr">{matched.preview.localRef}</span>{ar ? ' · محفوظ في هذا المتصفح فقط. لم يتم إرسال هذا الطلب إلى STAR PYRAMIDS.' : ' · Saved in this browser only. This request has not been submitted to STAR PYRAMIDS.'}{matched.amended && (ar ? ' · يشمل تعديلات تمت الموافقة عليها.' : ' · Includes approved changes.')}</span></p>
      <div className="customer-detail-grid">
        <div><small>{ar ? 'السيارة المطلوبة' : 'Requested vehicle'}</small><strong>{vehicleTitle}</strong></div>
        <div><small>{ar ? 'النوع' : 'Trip type'}</small><strong>{carTripLabel(draft.tripType, ar)}</strong></div>
        <div><small>{ar ? 'الركاب' : 'Passengers'}</small><strong>{draft.passengers}</strong></div>
      </div>
    </section>

    <section className="customer-account-block">
      <header><div><span>{ar ? 'المسار' : 'Route'}</span><h2>{ar ? 'الرحلة' : 'Journey'}</h2></div></header>
      <div className="customer-detail-grid">
        <div><small>{ar ? 'نقطة الانطلاق' : 'Pickup'}</small><strong>{draft.pickup}</strong></div>
        <div><small>{ar ? 'الوجهة' : 'Drop-off'}</small><strong>{draft.dropoff}</strong></div>
        <div><small>{ar ? 'تاريخ الانطلاق' : 'Pick-up date'}</small><strong dir="ltr">{formatCarDate(draft.preferredPickupDate, ar)}</strong></div>
        <div><small>{ar ? 'تاريخ العودة' : 'Return date'}</small><strong dir="ltr">{draft.tripType === 'Round Trip' && draft.preferredReturnDate ? formatCarDate(draft.preferredReturnDate, ar) : '—'}</strong></div>
      </div>
    </section>

    <section className="customer-account-block">
      <header><div><span>{ar ? 'التواصل' : 'Contact'}</span><h2>{ar ? 'بيانات التواصل' : 'Contact details'}</h2></div></header>
      <div className="customer-detail-grid">
        <div><small>{ar ? 'الاسم الكامل' : 'Full name'}</small><strong>{draft.contact.fullName}</strong></div>
        <div><small>{ar ? 'البريد الإلكتروني' : 'Email'}</small><strong dir="ltr">{draft.contact.email}</strong></div>
        <div><small>{ar ? 'رقم الهاتف' : 'Phone'}</small><strong dir="ltr">{draft.contact.phone}</strong></div>
      </div>
    </section>

    <section className="customer-account-block">
      <header><div><span>{ar ? 'إضافي' : 'Additional'}</span><h2>{ar ? 'طلب إضافي' : 'Additional request'}</h2></div></header>
      {draft.notes !== '' ? <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{draft.notes}</p> : <p style={{ margin: 0, color: '#667085', fontSize: 12 }}>{ar ? 'لا توجد ملاحظات إضافية.' : 'No additional notes.'}</p>}
    </section>

    <RequestAmendmentsSection requestRef={matched.preview.localRef} />

    <section className="customer-account-block">
      <header><div><span>{ar ? 'الحالة' : 'State'}</span><h2>{ar ? 'حالة الطلب' : 'Request state'}</h2></div></header>
      <p style={{ margin: '0 0 8px', fontSize: 13, lineHeight: 1.7 }}>{ar ? 'محفوظ في هذا المتصفح فقط. لم يتم إرسال هذا الطلب إلى STAR PYRAMIDS.' : 'Saved in this browser only. This request has not been submitted to STAR PYRAMIDS.'}</p>
      <p style={{ margin: 0, color: '#667085', fontSize: 12, lineHeight: 1.7 }}>{ar ? 'لم يتم حجز أي سيارة ولم يتم التحقق من التوافر أو تأكيد أي سعر.' : 'No vehicle has been reserved, no availability was checked, and no rate was confirmed.'}</p>
      <div className="customer-detail-actions">
        <Link href={`/account/car-requests/change?ref=${encodeURIComponent(matched.preview.localRef)}`} className="account-icon-action"><Pencil size={16} />{ar ? 'طلب تعديل' : 'Request changes'}</Link>
        <Link href="/rent-car" className="account-icon-action"><CarFront size={16} />{ar ? 'استكشف السيارات' : 'Browse cars'}</Link>
        <button type="button" className="account-icon-action danger" onClick={() => setOpen(true)}><Ban size={16} />{ar ? 'تجاهل المعاينة' : 'Discard preview'}</button>
      </div>
    </section>
    <CustomerConfirmDialog
      open={open}
      onClose={() => setOpen(false)}
      onConfirm={discard}
      title={ar ? 'تجاهل المعاينة المحلية؟' : 'Discard local preview?'}
      copy={pendingDiscard
        ? (ar ? `لا يمكن التجاهل الآن: التعديل ${pendingDiscard.amendmentRef} قيد المراجعة. بتّ فيه أولًا من صفحة التعديل.` : `Cannot discard now: change ${pendingDiscard.amendmentRef} is under review. Decide it from the change page first.`)
        : discardRelated > 0
          ? (ar ? `سيؤدي هذا إلى إزالة المعاينة المحلية ومعها ${discardRelated} من سجلات التعديل المرتبطة. لن يتأثر أي شيء آخر.` : `This removes the local preview plus its ${discardRelated} linked change record(s). Nothing else is affected.`)
          : (ar ? 'سيؤدي هذا إلى إزالة معاينة الطلب المحفوظة في هذا المتصفح فقط. لن يتأثر أي شيء آخر.' : 'This removes only the browser-local request preview. Nothing else is affected.')}
      confirmLabel={pendingDiscard ? undefined : (ar ? 'تجاهل المعاينة' : 'Discard preview')}
    />
  </>
}

export function CarRequestDetailPage({ reference }: { reference: string }) {
  return <LocaleProvider><CarRequestDetailHeader reference={reference} /></LocaleProvider>
}

function CarRequestDetailHeader({ reference }: { reference: string }) {
  const { locale } = useLocale()
  const ar = locale === 'ar'
  return (
    <AccountShell
      section="car-requests"
      headLeading={<Link href="/account/car-requests" className="account-icon-action">{ar ? <ArrowRight size={16} /> : <ArrowLeft size={16} />}{ar ? 'عودة لطلبات السيارات' : 'Back to car requests'}</Link>}
    ><CarRequestDetailSection reference={reference} /></AccountShell>
  )
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
  const [filter, setFilter] = useState<'all' | 'paid' | 'pending' | 'rejected'>('all')
  const visible = filter === 'all' ? bookings : bookings.filter((booking) => booking.paymentStatus === filter)
  const paid = bookings.filter((booking) => booking.paymentStatus === 'paid').reduce((sum, booking) => sum + booking.total, 0)
  const pending = bookings.filter((booking) => booking.paymentStatus === 'pending').reduce((sum, booking) => sum + booking.total, 0)
  const paging = usePagination(visible)
  return <><div className="customer-payment-summary"><Metric Icon={CheckCircle2} value={formatPrice(paid, currency, locale)} label={ar ? 'تم دفعه' : 'Paid'} note={ar ? 'مدفوعات مؤكدة' : 'Confirmed payments'} tone="green" /><Metric Icon={Clock3} value={formatPrice(pending, currency, locale)} label={ar ? 'قيد التأكيد' : 'Pending'} note={ar ? 'لا يتم الخصم في النسخة التجريبية' : 'No charge in preview mode'} tone="orange" /><Metric Icon={ReceiptText} value={bookings.length} label={ar ? 'السجلات' : 'Records'} note={ar ? 'مرتبطة بالحجوزات' : 'Linked to bookings'} tone="blue" /></div><section className="customer-account-block customer-full-block"><header><div><span>{ar ? 'السجل المالي' : 'Payment history'}</span><h2>{ar ? 'الحجوزات والمدفوعات' : 'Bookings and payment status'}</h2></div><ShieldCheck size={20} /></header><div className="customer-filterbar"><div role="tablist" aria-label={ar ? 'فلترة المدفوعات' : 'Filter payments'}>{(['all', 'paid', 'pending', 'rejected'] as const).map((status) => <button type="button" key={status} className={filter === status ? 'active' : ''} onClick={() => setFilter(status)}>{status === 'all' ? (ar ? 'الكل' : 'All') : displayPaymentStatus({ paymentStatus: status } as CustomerBooking, ar)}</button>)}</div><Link href="/trips"><Plus size={16} />{ar ? 'حجز رحلة' : 'Book a trip'}</Link></div>      {visible.length ? <><div className="customer-table-wrap"><table className="customer-table">
        <thead><tr><th>#</th><th>{ar ? 'المرجع' : 'Reference'}</th><th>{ar ? 'الرحلة' : 'Tour'}</th><th>{ar ? 'التاريخ' : 'Date'}</th><th>{ar ? 'الطريقة' : 'Method'}</th><th>{ar ? 'الحالة' : 'Status'}</th><th>{ar ? 'المبلغ' : 'Amount'}</th><th></th></tr></thead>
        <tbody>{paging.pageRows.map((booking, index) => (
          <tr key={booking.reference}>
            <td className="customer-row-number">{paging.from + index}</td>
            <td><strong>{booking.reference}</strong></td>
            <td>{booking.lines[0]?.title || (ar ? 'رحلة مخصصة' : 'Custom journey')}</td>
            <td>{displayBookingDate(booking, ar)}</td>
            <td>{displayPaymentMethod(booking, ar)}</td>
            <td><span className={`customer-payment-state ${booking.paymentStatus}`}>{displayPaymentStatus(booking, ar)}</span></td>
            <td><strong>{formatPrice(booking.total, currency, locale)}</strong></td>
            <td><span className="customer-table-actions">
              <Link href={'/account/bookings/detail?ref=' + encodeURIComponent(booking.reference)} aria-label={ar ? 'عرض الحجز' : 'View booking'} title={ar ? 'عرض الحجز' : 'View booking'}><Eye size={16} /></Link>
              <Link href={'/account/bookings/detail?ref=' + encodeURIComponent(booking.reference) + '&print=1'} aria-label={ar ? 'طباعة الإيصال' : 'Print receipt'} title={ar ? 'طباعة الإيصال' : 'Print receipt'}><Printer size={16} /></Link>
            </span></td>
          </tr>
        ))}</tbody>
      </table></div><CustomerPagination page={paging.page} pageCount={paging.pageCount} onPage={paging.setPage} pageSize={paging.pageSize} onPageSize={paging.setPageSize} from={paging.from} to={paging.to} total={paging.total} /></> : <EmptyState Icon={ReceiptText} title={bookings.length ? (ar ? 'لا توجد سجلات في هذه الحالة' : 'No records in this view') : (ar ? 'لا توجد مدفوعات بعد' : 'No payment records yet')} copy={bookings.length ? (ar ? 'جرب حالة مختلفة من الفلتر بالأعلى.' : 'Try a different status from the filter above.') : (ar ? 'تظهر الإيصالات وحالة الدفع هنا بمجرد وجود حجز.' : 'Receipts and payment status will appear here once you have a booking.')} href="/trips" action={ar ? 'ابدأ بحجز رحلة' : 'Start with a trip'} />}</section></>
}

function MessagesSection() {
  const { locale } = useLocale()
  const ar = locale === 'ar'
  const inquiries = useVisibleInquiries()
  const brand = useBrandSettings()
  const profile = useAccountProfile()
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


function PersonalProfileSection() {
  const router = useRouter()
  const { locale } = useLocale()
  const ar = locale === 'ar'
  const current = useAccountProfile()
  const [form, setForm] = useState<CustomerProfile>(current)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
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
    setForm(current)
    setAvatarError('')
    setSaveError('')
    setSaved(false)
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (saving) return
    setSaving(true)
    setSaveError('')
    try {
      const response = await fetch('/api/account/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          username: form.username,
          countryCode: form.country,
          phone: form.phone,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        setSaveError(data.error || (ar ? 'تعذر حفظ الملف الشخصي.' : 'Could not save your profile.'))
        return
      }
      saveCustomerProfile(form)
      setSaved(true)
      router.refresh()
    } catch {
      setSaveError(ar ? 'تعذر حفظ الملف الشخصي.' : 'Could not save your profile.')
    } finally {
      setSaving(false)
    }
  }
  const displayName = `${form.firstName} ${form.lastName}`.trim()
  const initials = [form.firstName, form.lastName].filter(Boolean).map((part) => part[0]).join('').toUpperCase() || 'SP'
  const [phoneCountry, setPhoneCountry] = useState(defaultCountry.code)

  return <form className="customer-profile-form customer-profile-only" onSubmit={submit}>
    <section className="customer-account-block">
      <header><div><span>{ar ? 'البيانات الشخصية' : 'Personal details'}</span><h2>{ar ? 'معلومات الحساب' : 'Account information'}</h2></div>{saved && <span className="customer-saved-notice"><Check size={14} />{ar ? 'تم الحفظ' : 'Saved'}</span>}</header>
      <div className="customer-avatar-editor">
        <CustomerAvatar avatar={form.avatar} initials={initials} className="customer-profile-avatar" name={displayName} />
        <div><strong>{ar ? 'صورة الحساب' : 'Profile photo'}</strong><small>{ar ? 'JPG أو PNG حتى 2 ميجابايت' : 'JPG or PNG up to 2 MB'}</small>{avatarError && <em>{avatarError}</em>}</div>
        <label aria-label={ar ? 'تغيير صورة الحساب' : 'Change profile photo'}><ImagePlus size={16} />{ar ? 'تغيير الصورة' : 'Change photo'}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={changeAvatar} aria-label={ar ? 'تغيير صورة الحساب' : 'Change profile photo'} /></label>
        {form.avatar && <button type="button" onClick={() => { update('avatar', ''); setAvatarError('') }} aria-label={ar ? 'حذف الصورة' : 'Remove photo'} title={ar ? 'حذف الصورة' : 'Remove photo'}><Trash2 size={16} /></button>}
      </div>
      <div className="customer-form-grid">
        <label>{ar ? 'الاسم الأول' : 'First name'}<input required autoComplete="given-name" value={form.firstName} onChange={(event) => update('firstName', event.target.value)} /></label>
        <label>{ar ? 'اسم العائلة' : 'Last name'}<input required autoComplete="family-name" value={form.lastName} onChange={(event) => update('lastName', event.target.value)} /></label>
        <label>{ar ? 'اسم المستخدم' : 'Username'}<input required dir="ltr" value={form.username} onChange={(event) => update('username', event.target.value.replace(/[^A-Za-z0-9_]/g, ''))} /></label>
        <label>{ar ? 'البريد الإلكتروني' : 'Email address'}<input required readOnly type="email" dir="ltr" value={form.email} /></label>
        <label>{ar ? 'الدولة' : 'Country'}<CountrySelect value={form.country} onChange={(code) => { const next = countries.find((country) => country.code === code) ?? defaultCountry; setForm((previous) => ({ ...previous, country: next.code, dialCode: next.dialCode })); setPhoneCountry(code); setSaved(false) }} locale={locale} /></label>
        <label>{ar ? 'رقم الهاتف' : 'Phone number'}<InternationalPhoneInput value={form.phone} onChange={(value) => { update('phone', value); setSaved(false) }} locale={locale} countryCode={phoneCountry} onCountryChange={setPhoneCountry} placeholder={ar ? 'رقم الهاتف' : 'Phone number'} /></label>
      </div>
    </section>
    {saveError && <p className="form-error" role="alert">{saveError}</p>}
    <div className="customer-profile-actions"><button type="submit" disabled={saving}>{saving ? (ar ? 'جارٍ الحفظ...' : 'Saving...') : (ar ? 'حفظ الملف الشخصي' : 'Save profile')}</button><button type="button" onClick={reset} disabled={saving}>{ar ? 'إلغاء التعديلات' : 'Discard changes'}</button></div>
  </form>
}

function SettingsSection() {
  const { locale, setLocale, currency, setCurrency } = useLocale()
  const ar = locale === 'ar'
  const current = useAccountProfile()
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
    setForm(current)
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
          <label>{ar ? 'اللغة المفضلة' : 'Preferred language'}<SharedSelect value={form.preferredLanguage} onChange={(next) => update('preferredLanguage', next as EnabledLocale)} locale={locale} options={ENABLED_LOCALES.map((value) => ({ value, label: LOCALE_LABELS[value] }))} /></label>
          <label>{ar ? 'عملة العرض' : 'Display currency'}<SharedSelect value={selectedCurrency} onChange={(next) => { setSelectedCurrency(next as typeof currency); setSaved(false) }} locale={locale} options={[{ value: 'USD', label: 'USD' }, { value: 'EUR', label: 'EUR' }, { value: 'EGP', label: 'EGP' }]} /></label>
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
  return <LocaleProvider><AccountShell section={section}>{section === 'overview' ? <OverviewSection /> : section === 'bookings' ? <BookingsSection /> : section === 'car-requests' ? <CarRequestsSection /> : section === 'favorites' ? <FavoritesSection /> : section === 'payments' ? <PaymentsSection /> : section === 'messages' ? <MessagesSection /> : section === 'settings' ? <SettingsSection /> : section === 'change-password' ? <ChangePasswordSection /> : <PersonalProfileSection />}</AccountShell></LocaleProvider>
}
