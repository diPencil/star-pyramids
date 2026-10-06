'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'
import {
  ArrowRight, ArrowLeft, Ban, Bell, CalendarDays, CarFront, Check, CheckCircle2, ChevronDown, ChevronRight, Compass,
  CircleDollarSign, Clock3, CreditCard, ExternalLink, Globe2, Heart, HelpCircle,
  CheckCheck, Download, Eye, EyeOff, FileText, FlaskConical, ImagePlus, KeyRound, Laptop, LayoutDashboard, LockKeyhole, LogOut, Mail, Menu,
  MessageCircle, PackageCheck, Paperclip, Pencil, Plus, ReceiptText, Search, Send,
  Settings2, ShieldCheck, ShoppingBag, ShoppingCart, Star, Ticket, Trash2, UserRound,
  Users, WalletCards, X,
} from 'lucide-react'
import { formatPrice, LocaleProvider, tx, useLocale, type Locale } from '@/components/locale'
import { catalogTours, findTour } from '@/data/tours'
import { countries, defaultCountry } from '@/data/countries'
import { localizeTourDuration, localizeTourLocation } from '@/lib/tour-format'
import { estimateCart, isValidPreferredDate, bookingActivityLabel, bookingPaymentStatusLabel, bookingStatusLabel, type Booking, type BookingStatus } from '@/lib/booking'
import { paymentActivityLabel, paymentStatusLabel, type Payment } from '@/lib/payment'
import { useCart } from '@/lib/cart'
import { useInquiries, useBrandSettings, useLiveCollection, useLiveTours, readImpersonation, stopImpersonation, type ImpersonatedCustomer } from '@/lib/admin-store'
import { cars } from '@/data/content'
import { carActivityLabel, carRequestStatusLabel, fleetVehicleTitle, type CarRequest, type CarRequestStatus } from '@/lib/car-request'
import { usePagination } from '@/components/admin/admin-pagination'
import { bookings as adminBookings, type BookingRow } from '@/components/admin/admin-data'
import {
  saveCustomerProfile, useCustomerFavorites,
  useCustomerProfile, type CustomerProfile,
} from '@/lib/customer-account'
import { clearMessageDraft, readMessageDraft, saveMessageDraft } from '@/lib/customer-account'
import {
  useCustomerNotifications, type CustomerNotification,
} from '@/lib/customer-notifications'
import {
  markCustomerChatRead, sendCustomerChatMessage, useCustomerChatMessages,
  type CustomerChatAttachment,
} from '@/lib/customer-chat'
import { whatsappHref } from '@/data/company'
import { CountrySelect } from '@/components/country-select'
import { InternationalPhoneInput } from '@/components/international-phone-input'
import { SharedSelect } from '@/components/shared-select'
import { WhatsAppGlyph } from '@/components/whatsapp-chat'
import { BookingPrintDocument } from '@/components/booking-print-document'
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

/**
 * Staff-preview mapping for the impersonated demo persona only. Real
 * customers always see database-backed bookings from
 * `/api/account/bookings` via `useCustomerBookings` below.
 */
function mapAdminBooking(booking: BookingRow): Booking {
  const match = matchCatalogTour(booking.tour)
  const perAdult = booking.guests > 0 ? Math.round(booking.total / booking.guests) : booking.total
  return {
    reference: booking.id,
    createdAt: booking.date,
    updatedAt: booking.date,
    status: booking.status === 'confirmed' ? 'confirmed' : booking.status === 'cancelled' ? 'cancelled' : 'pending',
    paymentStatus: booking.status === 'confirmed' ? 'paid' : 'pending',
    paymentMethod: 'card',
    subtotal: booking.total,
    discount: 0,
    total: booking.total,
    currency: 'USD',
    contact: { name: booking.customer, email: 'james.carter@example.com', phone: '+1 555 013 2400' },
    notes: '',
    lines: [{
      key: booking.id,
      tourSlug: match?.slug ?? '',
      title: booking.tour,
      image: match?.image ?? '/egypt-hero.png',
      date: booking.date,
      adults: booking.guests,
      children: 0,
      infants: 0,
      addons: [],
      addonTotal: 0,
      adultUnit: perAdult,
      childUnit: 0,
      infantUnit: 0,
      total: booking.total,
    }],
    activity: [],
  }
}

function matchCatalogTour(title: string) {
  const words = title.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter((w) => w.length > 3)
  let best: (typeof catalogTours)[number] | undefined
  let bestScore = 0
  for (const tour of catalogTours) {
    const haystack = `${tour.slug} ${tour.title}`.toLowerCase()
    const score = words.filter((word) => haystack.includes(word)).length
    if (score > bestScore) {
      bestScore = score
      best = tour
    }
  }
  return bestScore >= 2 ? best : undefined
}

async function apiBookingList(): Promise<Booking[]> {
  const res = await fetch('/api/account/bookings', { credentials: 'same-origin' })
  if (!res.ok) throw new Error('Could not load your bookings.')
  const data = (await res.json()) as { bookings?: Booking[] }
  if (!Array.isArray(data.bookings)) throw new Error('Could not load your bookings.')
  return data.bookings
}

async function apiBookingDetail(reference: string): Promise<Booking> {
  const res = await fetch(`/api/account/bookings/${encodeURIComponent(reference)}`, { credentials: 'same-origin' })
  const data = (await res.json()) as Booking & { error?: string }
  if (!res.ok) throw new Error(data.error || 'Booking not found.')
  return data
}

async function apiBookingCancel(reference: string): Promise<Booking> {
  const res = await fetch(`/api/account/bookings/${encodeURIComponent(reference)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ action: 'cancel' }),
  })
  const data = (await res.json()) as Booking & { error?: string }
  if (!res.ok) throw new Error(data.error || 'Could not cancel the booking.')
  return data
}

/** The signed-in customer's real bookings (database-backed). */
export function useCustomerBookings() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    let cancelled = false
    apiBookingList()
      .then((rows) => { if (!cancelled) { setBookings(rows); setLoading(false) } })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load your bookings.')
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [])
  return { bookings, loading, error }
}

export function useVisibleBookings() {
  const impersonated = useImpersonated()
  const { bookings } = useCustomerBookings()
  return useMemo(() => {
    if (!impersonated) return bookings
    return adminBookings.filter((booking) => booking.customer === impersonated.name).map(mapAdminBooking)
  }, [impersonated, bookings])
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
  { id: 'overview', href: '/account', Icon: LayoutDashboard, en: 'Overview', es: 'Resumen', it: 'Panoramica', ar: 'نظرة عامة' },
  { id: 'bookings', href: '/account/bookings', Icon: ShoppingBag, en: 'My bookings', es: 'Mis reservas', it: 'Le mie prenotazioni', ar: 'حجوزاتي' },
  { id: 'car-requests', href: '/account/car-requests', Icon: CarFront, en: 'Car Requests', es: 'Solicitudes de coche', it: 'Richieste auto', ar: 'طلبات السيارات' },
  { id: 'event-requests', href: '/account/event-requests', Icon: Ticket, en: 'Event Requests', es: 'Solicitudes de eventos', it: 'Richieste eventi', ar: 'طلبات الفعاليات' },
  { id: 'trip-requests', href: '/account/trip-requests', Icon: Compass, en: 'Trip Requests', es: 'Solicitudes de viaje', it: 'Richieste viaggio', ar: 'طلبات الرحلات' },
  { id: 'payments', href: '/account/payments', Icon: WalletCards, en: 'Payments', es: 'Pagos', it: 'Pagamenti', ar: 'المدفوعات' },
  { id: 'favorites', href: '/account/favorites', Icon: Heart, en: 'Saved trips', es: 'Viajes guardados', it: 'Viaggi salvati', ar: 'الرحلات المحفوظة' },
  { id: 'messages', href: '/account/messages', Icon: MessageCircle, en: 'Messages', es: 'Mensajes', it: 'Messaggi', ar: 'الرسائل' },
  { id: 'profile', href: '/account/profile', Icon: UserRound, en: 'Profile', es: 'Perfil', it: 'Profilo', ar: 'الملف الشخصي' },
  { id: 'settings', href: '/account/settings', Icon: Settings2, en: 'Settings', es: 'Ajustes', it: 'Impostazioni', ar: 'الإعدادات' },
] as const

const sectionHeadings: Record<AccountSection, { en: string; es: string; it: string; ar: string; subEn: string; subEs: string; subIt: string; subAr: string }> = {
  overview: { en: 'Your travel desk', es: 'Tu centro de viajes', it: 'Il tuo centro viaggi', ar: 'مكتب رحلتك', subEn: 'Everything you need before, during, and after your Egypt journey.', subEs: 'Todo lo que necesitas antes, durante y después de tu viaje a Egipto.', subIt: 'Tutto ciò che serve prima, durante e dopo il tuo viaggio in Egitto.', subAr: 'كل ما تحتاجه قبل رحلتك إلى مصر وأثناءها وبعدها.' },
  bookings: { en: 'Bookings', es: 'Reservas', it: 'Prenotazioni', ar: 'الحجوزات', subEn: 'Track requests, confirmations, travelers, and trip details.', subEs: 'Sigue solicitudes, confirmaciones, viajeros y detalles del viaje.', subIt: 'Segui richieste, conferme, viaggiatori e dettagli del viaggio.', subAr: 'تابع الطلبات والتأكيدات والمسافرين وتفاصيل الرحلات.' },
  'car-requests': { en: 'Car Requests', es: 'Solicitudes de coche', it: 'Richieste auto', ar: 'طلبات السيارات', subEn: 'Review and manage your saved vehicle requests.', subEs: 'Revisa y gestiona tus solicitudes de vehículos guardadas.', subIt: 'Rivedi e gestisci le tue richieste veicolo salvate.', subAr: 'راجع طلبات السيارات المحفوظة وأدرها بسهولة.' },
  'event-requests': { en: 'Event Requests', es: 'Solicitudes de eventos', it: 'Richieste eventi', ar: 'طلبات الفعاليات', subEn: 'Track your event attendance requests.', subEs: 'Sigue tus solicitudes de asistencia a eventos.', subIt: 'Segui le tue richieste di partecipazione agli eventi.', subAr: 'تابع طلبات حضور الفعاليات.' },
  'trip-requests': { en: 'Trip Requests', es: 'Solicitudes de viaje', it: 'Richieste viaggio', ar: 'طلبات الرحلات', subEn: 'Review your saved trip request or plan a new journey.', subEs: 'Revisa tu solicitud de viaje guardada o planifica una nueva.', subIt: 'Rivedi la tua richiesta di viaggio salvata oppure pianifica un nuovo viaggio.', subAr: 'راجع طلب رحلتك المحفوظ أو خطط لرحلة جديدة.' },
  favorites: { en: 'Saved trips', es: 'Viajes guardados', it: 'Viaggi salvati', ar: 'الرحلات المحفوظة', subEn: 'Keep ideas together until you are ready to book.', subEs: 'Guarda tus ideas juntas hasta que estés listo para reservar.', subIt: 'Tieni insieme le idee finché non sei pronto a prenotare.', subAr: 'اجمع أفكار رحلتك في مكان واحد لحين الحجز.' },
  payments: { en: 'Payments & receipts', es: 'Pagos y recibos', it: 'Pagamenti e ricevute', ar: 'المدفوعات والإيصالات', subEn: 'A clear record of payment status for every booking.', subEs: 'Un registro claro del estado de pago de cada reserva.', subIt: 'Un registro chiaro dello stato pagamenti di ogni prenotazione.', subAr: 'سجل واضح لحالة الدفع الخاصة بكل حجز.' },
  messages: { en: 'Messages', es: 'Mensajes', it: 'Messaggi', ar: 'الرسائل', subEn: 'Keep your questions and travel conversations connected to each trip.', subEs: 'Mantén tus preguntas y conversaciones de viaje vinculadas a cada viaje.', subIt: 'Tieni domande e conversazioni di viaggio collegate a ogni viaggio.', subAr: 'احتفظ بأسئلتك ومحادثات السفر مرتبطة بكل رحلة.' },
  profile: { en: 'Profile', es: 'Perfil', it: 'Profilo', ar: 'الملف الشخصي', subEn: 'Keep your identity and contact details accurate for every booking.', subEs: 'Mantén tu identidad y datos de contacto actualizados para cada reserva.', subIt: 'Mantieni identità e dati di contatto aggiornati per ogni prenotazione.', subAr: 'حدّث بياناتك الشخصية ووسائل التواصل المستخدمة في الحجوزات.' },
  settings: { en: 'Settings', es: 'Ajustes', it: 'Impostazioni', ar: 'الإعدادات', subEn: 'Control preferences, notifications, security, and privacy.', subEs: 'Controla preferencias, notificaciones, seguridad y privacidad.', subIt: 'Controlla preferenze, notifiche, sicurezza e privacy.', subAr: 'تحكم في التفضيلات والتنبيهات والأمان والخصوصية.' },
  'change-password': { en: 'Change password', es: 'Cambiar la contraseña', it: 'Cambia password', ar: 'تغيير كلمة المرور', subEn: 'Update your password without leaving your traveler account.', subEs: 'Actualiza tu contraseña sin salir de tu cuenta de viajero.', subIt: 'Aggiorna la password senza uscire dal tuo account viaggiatore.', subAr: 'حدّث كلمة المرور من داخل حساب المسافر.' },
}

const bookingStatusCopy: Record<BookingStatus, { en: string; es: string; it: string; ar: string }> = {
  pending: { en: 'Request received', es: 'Solicitud recibida', it: 'Richiesta ricevuta', ar: 'تم استلام الطلب' },
  confirmed: { en: 'Confirmed', es: 'Confirmada', it: 'Confermata', ar: 'مؤكد' },
  completed: { en: 'Completed', es: 'Completada', it: 'Completata', ar: 'مكتمل' },
  cancelled: { en: 'Cancelled', es: 'Cancelada', it: 'Cancellata', ar: 'ملغي' },
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
  const notifications = useCustomerNotifications()
  const cart = useCart()
  const [carRequestCount, setCarRequestCount] = useState(0)
  // Real car-request badge: count of the customer's database-backed
  // requests. Failures leave the badge hidden rather than faked.
  useEffect(() => {
    let cancelled = false
    fetch('/api/account/car-requests', { credentials: 'same-origin' })
      .then(async (res) => {
        if (!res.ok || cancelled) return
        const data = (await res.json()) as { requests?: unknown }
        if (!cancelled && Array.isArray(data.requests)) setCarRequestCount(data.requests.length)
      })
      .catch(() => undefined)
    return () => { cancelled = true }
  }, [])
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
    <button type="button" className="customer-dashboard-scrim" aria-label={tx(locale, { en: 'Close menu', es: 'Cerrar el menú', it: 'Chiudi il menu', ar: 'إغلاق القائمة' })} onClick={() => setMobileOpen(false)} />
    <aside className="customer-account-side">
      <Link href="/account" className="customer-dashboard-brand" onClick={() => setMobileOpen(false)}>
        <img src="/favicon.png" alt="" />
        <span><strong>STAR PYRAMIDS</strong><small>{tx(locale, { en: 'TRAVELER ACCOUNT', es: 'CUENTA DEL VIAJERO', it: 'ACCOUNT VIAGGIATORE', ar: 'حساب المسافر' })}</small></span>
      </Link>
        <div className="customer-profile-mini">
          <CustomerAvatar avatar={profile.avatar} initials={initials} className="customer-avatar" name={profile.fullName} />
          <div><strong>{profile.fullName}</strong><small>{profile.email}</small></div>
        </div>
        <nav aria-label={tx(locale, { en: 'Account navigation', es: 'Navegación de la cuenta', it: 'Navigazione account', ar: 'قائمة الحساب' })}>
          {sectionLinks.map(({ id, href, Icon, en, es, it, ar: arLabel }) => {
            const active = section === id || (section === 'change-password' && id === 'settings')
            return <Link key={id} href={href} onClick={() => setMobileOpen(false)} className={active ? 'active' : ''} aria-current={active ? 'page' : undefined}><Icon size={18} /><span>{tx(locale, { en, es, it, ar: arLabel })}</span>{id === 'bookings' && bookings.length > 0 && <b>{bookings.length}</b>}{id === 'car-requests' && carRequestCount > 0 && <b>{carRequestCount}</b>}{id === 'favorites' && favorites.slugs.length > 0 && <b>{favorites.slugs.length}</b>}{id === 'messages' && unreadMessages > 0 && <b>{unreadMessages}</b>}</Link>
          })}
        </nav>
        <div className="customer-side-summary">
          <ShoppingCart size={18} />
          <div><strong>{tx(locale, { en: 'Trip cart', es: 'Cesta de viajes', it: 'Carrello viaggi', ar: 'سلة الرحلات' })}</strong><small>{cart.lines ? (locale === 'es' ? `${cart.lines} viajes en espera` : locale === 'it' ? `${cart.lines} viaggi in attesa` : locale === 'ar' ? `${cart.lines} رحلات بانتظارك` : `${cart.lines} trip${cart.lines === 1 ? '' : 's'} waiting`) : (tx(locale, { en: 'Start by adding a trip', es: 'Empieza añadiendo un viaje', it: 'Inizia aggiungendo un viaggio', ar: 'ابدأ بإضافة رحلة' }))}</small></div>
          <Link href="/cart" aria-label={tx(locale, { en: 'Open cart', es: 'Abrir la cesta', it: 'Apri il carrello', ar: 'فتح السلة' })}><ChevronRight size={17} /></Link>
        </div>
        <button type="button" className="customer-signout" onClick={logout} disabled={loggingOut}><LogOut size={17} />{loggingOut ? (tx(locale, { en: 'Signing out...', es: 'Cerrando sesión…', it: 'Disconnessione…', ar: 'جارٍ الخروج...' })) : (tx(locale, { en: 'Sign out', es: 'Cerrar sesión', it: 'Esci', ar: 'تسجيل الخروج' }))}</button>
    </aside>

    <div className="customer-dashboard-main">
      <header className="customer-dashboard-topbar">
        <button type="button" className="customer-mobile-menu" onClick={() => setMobileOpen(true)} aria-label={tx(locale, { en: 'Open menu', es: 'Abrir el menú', it: 'Apri il menu', ar: 'فتح القائمة' })}><Menu size={20} /></button>
        <Link href="/account" className="customer-mobile-brand"><img src="/favicon.png" alt="" /><strong>STAR PYRAMIDS</strong></Link>
        <div className="customer-dashboard-search">
          <Search size={17} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={tx(locale, { en: 'Search trips and destinations...', es: 'Busca viajes y destinos…', it: 'Cerca viaggi e destinazioni…', ar: 'ابحث عن رحلة أو وجهة...' })} />
          {query && <button type="button" onClick={() => setQuery('')} aria-label={tx(locale, { en: 'Clear search', es: 'Borrar la búsqueda', it: 'Cancella la ricerca', ar: 'مسح البحث' })}><X size={15} /></button>}
          {query && <div className="customer-search-results">{searchResults.length ? searchResults.map((tour) => <Link key={tour.slug} href={`/egypt-tours/${tour.slug}`} onClick={() => setQuery('')}><img src={tour.image} alt="" /><span><strong>{tour.title}</strong><small>{locale === 'ar' ? localizeTourLocation(tour.location) : tour.location}</small></span><ArrowRight size={14} /></Link>) : <span>{tx(locale, { en: 'No matching trips', es: 'Sin viajes coincidentes', it: 'Nessun viaggio corrispondente', ar: 'لا توجد رحلات مطابقة' })}</span>}</div>}
        </div>
        <div className="customer-dashboard-actions">
          <button type="button" className="customer-top-language" onClick={() => { setLanguageOpen(true); setNotificationsOpen(false); setUserOpen(false) }} aria-label={tx(locale, { en: 'Choose language and currency', es: 'Elige idioma y moneda', it: 'Scegli lingua e valuta', ar: 'اختيار اللغة والعملة' })}><Globe2 size={18} /><span>{LOCALE_SHORT_LABELS[locale]}</span></button>
          {languageOpen && <LanguageModal locale={locale} currency={currency} onClose={() => setLanguageOpen(false)} onSelect={setLocale} onCurrency={setCurrency} />}
          <SharedSelect value={currency} onChange={(next) => setCurrency(next as 'USD' | 'EUR' | 'EGP')} locale={locale} label={tx(locale, { en: 'Currency', es: 'Moneda', it: 'Valuta', ar: 'العملة' })} options={[{ value: 'USD', label: 'USD' }, { value: 'EUR', label: 'EUR' }, { value: 'EGP', label: 'EGP' }]} />
          <Link href="/" className="customer-top-icon" aria-label={tx(locale, { en: 'Back to website', es: 'Volver al sitio web', it: 'Torna al sito', ar: 'العودة للموقع' })} title={tx(locale, { en: 'Back to website', es: 'Volver al sitio web', it: 'Torna al sito', ar: 'العودة للموقع' })}><ExternalLink size={18} /></Link>
          <Link href="/cart" className="customer-top-icon customer-cart-icon" aria-label={tx(locale, { en: 'Trip cart', es: 'Cesta de viajes', it: 'Carrello viaggi', ar: 'سلة الرحلات' })}><ShoppingCart size={18} />{cart.lines > 0 && <b>{cart.lines}</b>}</Link>
          <div className="customer-top-popover">
            <button type="button" className="customer-top-icon" onClick={() => { setNotificationsOpen((open) => !open); setUserOpen(false) }} aria-label={tx(locale, { en: 'Notifications', es: 'Notificaciones', it: 'Notifiche', ar: 'الإشعارات' })} aria-expanded={notificationsOpen}><Bell size={18} />{notifications.unreadCount > 0 && <i />}</button>
            {notificationsOpen && <NotificationPanel onClose={() => setNotificationsOpen(false)} />}
          </div>
          <div className="customer-top-popover customer-user-popover">
            <button type="button" className="customer-top-user" onClick={() => { setUserOpen((open) => !open); setNotificationsOpen(false) }} aria-expanded={userOpen}><CustomerAvatar avatar={profile.avatar} initials={initials} className="customer-top-avatar" name={profile.fullName} /><div><strong>{profile.fullName}</strong><small>{tx(locale, { en: 'Traveler', es: 'Viajero', it: 'Viaggiatore', ar: 'مسافر' })}</small></div><ChevronDown size={15} /></button>
            {userOpen && <div className="customer-user-menu"><Link href="/account/profile" onClick={() => setUserOpen(false)}><UserRound size={16} />{tx(locale, { en: 'Profile', es: 'Perfil', it: 'Profilo', ar: 'الملف الشخصي' })}</Link><Link href="/account/settings" onClick={() => setUserOpen(false)}><Settings2 size={16} />{tx(locale, { en: 'Settings', es: 'Ajustes', it: 'Impostazioni', ar: 'الإعدادات' })}</Link><button type="button" onClick={logout} disabled={loggingOut}><LogOut size={16} />{tx(locale, { en: 'Sign out', es: 'Cerrar sesión', it: 'Esci', ar: 'تسجيل الخروج' })}</button></div>}
          </div>
        </div>
      </header>

      <main className="customer-account">
        {impersonated && <div className="impersonate-banner" role="status">
          <div>
            <strong>{tx(locale, { en: 'Staff preview', es: 'Vista previa del personal', it: 'Anteprima staff', ar: 'معاينة الموظفين' })}</strong>
            <span>{tx(locale, { en: 'Viewing as', es: 'Viendo como', it: 'Visualizzazione come', ar: 'تشاهد الحساب باسم' })} <b>{impersonated.name}</b></span>
          </div>
          <button type="button" onClick={() => stopImpersonation()}><LogOut size={15} />{tx(locale, { en: 'Exit preview', es: 'Salir de la vista previa', it: 'Esci dall’anteprima', ar: 'إنهاء المعاينة' })}</button>
        </div>}
        <section className="customer-account-main">
        <p className="customer-demo-notice" role="note"><FlaskConical size={16} /><span><strong>{tx(locale, { en: 'Account connected', es: 'Cuenta conectada', it: 'Account collegato', ar: 'الحساب متصل' })}</strong>{tx(locale, { en: 'Your identity, profile, sign-in, bookings, payments, trip requests, car requests, event requests, and notifications are database-backed. Online card payment opens here once a provider is connected — messages remain preview data until their backend phase.', ar: 'هويتك وملفك الشخصي وتسجيل الدخول والحجوزات والمدفوعات وطلبات الرحلات وطلبات السيارات وطلبات الفعاليات والإشعارات مدعومة بقاعدة البيانات. ستظهر بوابة الدفع الإلكتروني هنا عند ربط مزود — تظل الرسائل بيانات معاينة حتى مرحلة الباك إند الخاصة بها.' })}</span></p>
        <header className="customer-account-head">
          <div><span>{tx(locale, { en: 'STAR PYRAMIDS account', es: 'Cuenta de STAR PYRAMIDS', it: 'Account STAR PYRAMIDS', ar: 'حساب STAR PYRAMIDS' })}</span><h1>{tx(locale, heading)}</h1><p>{tx(locale, { en: heading.subEn, es: heading.subEs, it: heading.subIt, ar: heading.subAr })}</p></div>
          <div className="customer-account-head-actions">{headLeading}<Link href="/trips" className="account-icon-action"><Search size={17} />{tx(locale, { en: 'Explore trips', es: 'Explorar viajes', it: 'Esplora i viaggi', ar: 'استكشف الرحلات' })}</Link><Link href="/contact" className="account-icon-action primary"><HelpCircle size={17} />{tx(locale, { en: 'Get help', es: 'Obtener ayuda', it: 'Richiedi assistenza', ar: 'اطلب مساعدة' })}</Link></div>
        </header>
        {children}
        </section>
      </main>
    </div>
  </div>
}

function notificationIcon(type: string) {
  if (type.startsWith('booking_')) return ShoppingBag
  if (type.startsWith('payment_')) return ReceiptText
  if (type.includes('request')) return FileText
  return Bell
}

function NotificationPanel({ onClose }: { onClose: () => void }) {
  const { locale } = useLocale()
  const router = useRouter()
  const { recent, unreadCount, loading, loadError, markRead, markAllRead, refresh } = useCustomerNotifications()
  const [markingAll, setMarkingAll] = useState(false)
  const dateLocale = locale === 'ar' ? 'ar-EG' : locale === 'es' ? 'es-ES' : locale === 'it' ? 'it-IT' : 'en-GB'
  const openItem = (item: CustomerNotification) => {
    if (!item.readAt) void markRead(item.id)
    onClose()
    if (item.href) router.push(item.href)
  }
  const readAll = () => {
    if (markingAll) return
    setMarkingAll(true)
    markAllRead().then(() => setMarkingAll(false))
  }
  return <div className="customer-notifications" role="dialog" aria-label={tx(locale, { en: 'Notifications', es: 'Notificaciones', it: 'Notifiche', ar: 'الإشعارات' })}>
    <header>
      <strong>{tx(locale, { en: 'Notifications', es: 'Notificaciones', it: 'Notifiche', ar: 'الإشعارات' })}</strong>
      <span className="customer-notifications-head-actions">
        {unreadCount > 0 && <small className="customer-notifications-count">{tx(locale, { en: `${unreadCount} unread`, es: `${unreadCount} sin leer`, it: `${unreadCount} da leggere`, ar: `${unreadCount} غير مقروء` })}</small>}
        {unreadCount > 0 && <button type="button" onClick={readAll} disabled={markingAll}>{markingAll ? (tx(locale, { en: 'Clearing…', es: 'Borrando…', it: 'Cancellazione…', ar: 'جارٍ المسح…' })) : (tx(locale, { en: 'Mark all read', es: 'Marcar todo como leído', it: 'Segna tutto come letto', ar: 'تعيين الكل كمقروء' }))}</button>}
      </span>
    </header>
    {loading
      ? <div className="customer-notifications-skeleton" role="status" aria-label={tx(locale, { en: 'Loading notifications', es: 'Cargando notificaciones', it: 'Caricamento notifiche', ar: 'جارٍ تحميل الإشعارات' })}><i /><i /><i /></div>
      : loadError && recent.length === 0
        ? <div className="customer-notifications-error"><span>{loadError}</span><button type="button" className="account-text-button" onClick={refresh}>{tx(locale, { en: 'Try again', es: 'Reintentar', it: 'Riprova', ar: 'حاول مجددًا' })}</button></div>
        : recent.length === 0
          ? <div className="customer-notifications-empty"><span><Bell size={20} /></span><strong>{tx(locale, { en: "You're all caught up", es: 'Estás al día', it: 'Sei aggiornato', ar: 'لا جديد لديك' })}</strong><small>{tx(locale, { en: 'Booking, payment, and request updates will appear here.', es: 'Las novedades de reservas, pagos y solicitudes aparecerán aquí.', it: 'Gli aggiornamenti di prenotazioni, pagamenti e richieste appariranno qui.', ar: 'ستظهر تحديثات الحجوزات والمدفوعات والطلبات هنا.' })}</small></div>
          : <div className="customer-notifications-list">{recent.map((item) => {
            const Icon = notificationIcon(item.type)
            const body = <><span className="customer-notification-icon"><Icon size={16} /></span><span><b>{item.title}</b><small>{item.message}</small><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString(dateLocale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</time></span>{!item.readAt && <i className="customer-notification-dot" />}</>
            const className = item.readAt ? '' : 'unread'
            return item.href
              ? <Link key={item.id} href={item.href} className={className} onClick={() => openItem(item)}>{body}</Link>
              : <button key={item.id} type="button" className={className} onClick={() => openItem(item)}>{body}</button>
          })}</div>}
  </div>
}

function Metric({ Icon, value, label, note, tone }: { Icon: typeof Star; value: string | number; label: string; note: string; tone: string }) {
  return <div className={`customer-metric ${tone}`}><span><Icon size={19} /></span><div><small>{label}</small><strong>{value}</strong><em>{note}</em></div></div>
}

function BookingStatus({ booking, locale }: { booking: Booking; locale: Locale }) {
  return <span className={`customer-status ${booking.status}`}>{booking.status === 'confirmed' || booking.status === 'completed' ? <CheckCircle2 size={13} /> : <Clock3 size={13} />}{bookingStatusLabel(booking.status, locale)}</span>
}

/** Prefer a valid stored line date, then a parseable creation date. Never throws. */
function displayBookingDate(booking: Booking, locale: Locale): string {
  const lineDate = booking.lines.find((line) => isValidPreferredDate(line.date))?.date
  if (lineDate) return lineDate
  const created = new Date(booking.createdAt)
  if (!Number.isNaN(created.getTime())) return created.toLocaleDateString(locale === 'ar' ? 'ar-EG' : locale === 'es' ? 'es-ES' : locale === 'it' ? 'it-IT' : 'en-GB')
  return booking.lines[0]?.date || '—'
}

/**
 * Honest payment semantics (Phase 2E): no gateway exists, so a booking is
 * unpaid until staff confirms payment in a later phase. Only an
 * explicitly stored method is ever named.
 */
function displayPaymentMethod(booking: Booking, locale: Locale): string {
  if (booking.paymentMethod === 'card') return tx(locale, { en: 'Card', es: 'Tarjeta', it: 'Carta', ar: 'بطاقة بنكية' })
  if (booking.paymentMethod === 'arrival') return tx(locale, { en: 'On arrival', es: 'A la llegada', it: 'All’arrivo', ar: 'عند الوصول' })
  return tx(locale, { en: 'To be confirmed', es: 'Por confirmar', it: 'Da confermare', ar: 'تُؤكد لاحقًا' })
}

function displayPaymentStatus(booking: Booking, locale: Locale): string {
  return bookingPaymentStatusLabel(booking.paymentStatus, locale)
}

function BookingCard({ booking }: { booking: Booking }) {
  const { locale, currency } = useLocale()

  const first = booking.lines[0]
  const travelers = booking.lines.reduce((sum, line) => sum + line.adults + line.children + line.infants, 0)
  return <article className="customer-booking-row">
    <Link href={`/account/bookings/detail?ref=${encodeURIComponent(booking.reference)}`}><img src={first?.image || '/egypt-hero.png'} alt="" /></Link>
    <div className="customer-booking-copy">
      <div className="customer-booking-top"><span>{booking.reference}</span><BookingStatus booking={booking} locale={locale} /></div>
      <h3><Link href={`/account/bookings/detail?ref=${encodeURIComponent(booking.reference)}`}>{first?.title || (tx(locale, { en: 'Custom journey', es: 'Viaje personalizado', it: 'Viaggio personalizzato', ar: 'رحلة مخصصة' }))}</Link></h3>
      <div className="customer-booking-meta"><span><CalendarDays size={14} />{displayBookingDate(booking, locale)}</span><span><Users size={14} />{travelers} {tx(locale, { en: 'travelers', es: 'viajeros', it: 'viaggiatori', ar: 'مسافرين' })}</span><span><PackageCheck size={14} />{booking.lines.length} {tx(locale, { en: 'trip items', es: 'elementos del viaje', it: 'voci di viaggio', ar: 'رحلات' })}</span></div>
    </div>
    <div className="customer-booking-total"><small>{tx(locale, { en: 'Total', es: 'Total', it: 'Totale', ar: 'الإجمالي' })}</small><strong>{formatPrice(booking.total, currency, locale)}</strong><span className="customer-booking-links"><Link href={`/account/bookings/detail?ref=${encodeURIComponent(booking.reference)}`}>{tx(locale, { en: 'View details', es: 'Ver detalles', it: 'Vedi dettagli', ar: 'عرض التفاصيل' })} <ArrowRight size={14} /></Link><Link href="/account/messages" onClick={() => saveMessageDraft({ reference: booking.reference, title: first?.title ?? '' })}>{tx(locale, { en: 'Ask about booking', es: 'Preguntar por la reserva', it: 'Chiedi info sulla prenotazione', ar: 'اسأل عن الحجز' })} <ArrowRight size={14} /></Link></span></div>
  </article>
}

function OverviewSection() {
  const { locale, currency } = useLocale()

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
      <div><span>{tx(locale, { en: 'Welcome back', es: 'Te damos la bienvenida', it: 'Bentornato', ar: 'أهلًا بعودتك' })}</span><h2>{displayName.split(' ')[0]}, {tx(locale, { en: 'let us keep your next journey moving.', es: 'sigamos preparando tu próximo viaje.', it: 'continuiamo a preparare il tuo prossimo viaggio.', ar: 'خلينا نجهز رحلتك القادمة.' })}</h2><p>{latestBooking ? (locale === 'es' ? `La última actualización de tu reserva está lista en ${latestBooking.reference}.` : locale === 'it' ? `L'ultimo aggiornamento della tua prenotazione è pronto in ${latestBooking.reference}.` : locale === 'ar' ? `آخر تحديث على الحجز ${latestBooking.reference}` : `Your latest booking update is ready under ${latestBooking.reference}.`) : (tx(locale, { en: 'Save a trip or add it to your cart and everything will stay organized here.', es: 'Guarda un viaje o añádelo a tu cesta y todo quedará organizado aquí.', it: 'Salva un viaggio o aggiungilo al carrello e tutto resterà organizzato qui.', ar: 'احفظ الرحلات أو أضفها للسلة وسيظهر كل شيء هنا.' }))}</p></div>
      <Link href={latestBooking ? '/account/bookings' : '/trips'}>{latestBooking ? (tx(locale, { en: 'Track booking', es: 'Seguir la reserva', it: 'Segui la prenotazione', ar: 'متابعة الحجز' })) : (tx(locale, { en: 'Find a trip', es: 'Buscar un viaje', it: 'Trova un viaggio', ar: 'ابحث عن رحلة' }))} <ArrowRight size={17} /></Link>
    </section>
    <div className="customer-metrics">
      <Metric Icon={ShoppingBag} value={bookings.length} label={tx(locale, { en: 'Bookings', es: 'Reservas', it: 'Prenotazioni', ar: 'الحجوزات' })} note={tx(locale, { en: 'All requests', es: 'Todas las solicitudes', it: 'Tutte le richieste', ar: 'كل الطلبات' })} tone="blue" />
      <Metric Icon={Heart} value={favorites.slugs.length} label={tx(locale, { en: 'Saved', es: 'Guardado', it: 'Salvato', ar: 'المحفوظة' })} note={tx(locale, { en: 'Trip ideas', es: 'Ideas de viaje', it: 'Idee di viaggio', ar: 'أفكار للرحلة' })} tone="orange" />
      <Metric Icon={ShoppingCart} value={cart.lines} label={tx(locale, { en: 'In cart', es: 'En la cesta', it: 'Nel carrello', ar: 'في السلة' })} note={cart.lines ? formatPrice(cartEstimate.subtotal, currency, locale) : (tx(locale, { en: 'Cart is empty', es: 'La cesta está vacía', it: 'Il carrello è vuoto', ar: 'السلة فارغة' }))} tone="green" />
      <Metric Icon={MessageCircle} value={inquiries.length + (chatMessages.length ? 1 : 0)} label={tx(locale, { en: 'Conversations', es: 'Conversaciones', it: 'Conversazioni', ar: 'المحادثات' })} note={chatMessages.length ? (tx(locale, { en: 'Active support chat', es: 'Chat de asistencia activa', it: 'Chat di assistenza attiva', ar: 'دعم مباشر نشط' })) : (tx(locale, { en: 'Recorded enquiries', es: 'Consultas registradas', it: 'Richieste registrate', ar: 'طلبات مسجلة' }))} tone="violet" />
    </div>
    <div className="customer-overview-grid">
      <section className="customer-account-block customer-span-2">
        <header><div><span>{tx(locale, { en: 'Current journey', es: 'Viaje actual', it: 'Viaggio in corso', ar: 'رحلتك الحالية' })}</span><h2>{latestBooking ? (tx(locale, { en: 'Latest booking', es: 'Última reserva', it: 'Ultima prenotazione', ar: 'آخر حجز' })) : (tx(locale, { en: 'Planning workspace', es: 'Espacio de planificación', it: 'Area di pianificazione', ar: 'مساحة التخطيط' }))}</h2></div><Link href={latestBooking ? '/account/bookings' : '/cart'}>{tx(locale, { en: 'View details', es: 'Ver detalles', it: 'Vedi dettagli', ar: 'عرض التفاصيل' })} <ArrowRight size={15} /></Link></header>
        {latestBooking ? <BookingCard booking={latestBooking} /> : cart.items.length ? <div className="customer-plan-list">{cart.items.slice(0, 3).map((item) => <div key={item.key}><img src={item.image} alt="" /><span><strong>{item.title}</strong><small>{item.date || (tx(locale, { en: 'Flexible date', es: 'Fecha flexible', it: 'Data flessibile', ar: 'موعد مرن' }))}</small></span><b>{formatPrice(item.total, currency, locale)}</b></div>)}<Link href="/cart" className="account-text-button">{tx(locale, { en: 'Review cart and continue', es: 'Revisar la cesta y continuar', it: 'Rivedi il carrello e continua', ar: 'مراجعة السلة وإكمال الحجز' })} <ArrowRight size={15} /></Link></div> : <EmptyState Icon={CalendarDays} title={tx(locale, { en: 'No active journey yet', es: 'Aún no hay ningún viaje activo', it: 'Ancora nessun viaggio attivo', ar: 'لا توجد رحلة نشطة بعد' })} copy={tx(locale, { en: 'Start with the trip catalogue or ask us to create a custom itinerary.', es: 'Empieza con el catálogo de viajes o pídenos un itinerario a medida.', it: 'Inizia dal catalogo viaggi oppure chiedici un itinerario su misura.', ar: 'ابدأ من كتالوج الرحلات أو اطلب برنامجًا مخصصًا.' })} href="/trips" action={tx(locale, { en: 'Explore trips', es: 'Explorar viajes', it: 'Esplora i viaggi', ar: 'استكشف الرحلات' })} />}
      </section>
      <SupportPanel />
      <section className="customer-account-block customer-span-2">
        <header><div><span>{tx(locale, { en: 'Your shortlist', es: 'Tus guardados', it: 'I tuoi salvati', ar: 'اختياراتك' })}</span><h2>{tx(locale, { en: 'Saved journeys', es: 'Viajes guardados', it: 'Viaggi salvati', ar: 'رحلات محفوظة' })}</h2></div><Link href="/account/favorites">{tx(locale, { en: 'View all', es: 'Ver todo', it: 'Vedi tutto', ar: 'عرض الكل' })} <ArrowRight size={15} /></Link></header>
        {savedTours.length ? <div className="customer-saved-strip">{savedTours.map((tour) => tour && <MiniTour key={tour.slug} tour={tour} />)}</div> : <div className="customer-inline-empty"><Heart size={20} /><span><strong>{tx(locale, { en: 'Your shortlist is ready', es: 'Tu lista ya está lista', it: 'La tua lista è pronta', ar: 'المفضلة جاهزة لاختياراتك' })}</strong><small>{tx(locale, { en: 'Save the trips you like and compare them here.', es: 'Guarda los viajes que te gusten y compáralos aquí.', it: 'Salva i viaggi che ti piacciono e confrontali qui.', ar: 'احفظ الرحلات التي تعجبك وقارن بينها هنا.' })}</small></span><Link href="/account/favorites">{tx(locale, { en: 'See suggestions', es: 'Ver sugerencias', it: 'Vedi i suggerimenti', ar: 'شاهد المقترحات' })}</Link></div>}
      </section>
      <QuickActions />
    </div>
  </>
}

function SupportPanel() {
  const { locale } = useLocale()

  const brand = useBrandSettings()
  return <aside className="customer-account-block customer-support-panel"><header><div><span>{tx(locale, { en: 'Trip support', es: 'Asistencia de viaje', it: 'Assistenza viaggio', ar: 'مساعدة الرحلة' })}</span><h2>{tx(locale, { en: 'Your team is close by', es: 'Tu equipo está cerca', it: 'Il tuo team è con te', ar: 'فريقنا قريب منك' })}</h2></div><span className="customer-online"><i />{tx(locale, { en: 'Available', es: 'Disponible', it: 'Disponibile', ar: 'متاح' })}</span></header><p>{tx(locale, { en: 'Connect a question to your booking or continue directly on WhatsApp.', es: 'Vincula tu pregunta a tu reserva o continúa directamente por WhatsApp.', it: 'Collega la domanda alla tua prenotazione oppure continua direttamente su WhatsApp.', ar: 'اربط سؤالك بالحجز أو تواصل معنا مباشرة عبر واتساب.' })}</p><div className="customer-advisor"><span>NS</span><div><strong>{tx(locale, { en: 'Nour, travel specialist', es: 'Nour, especialista en viajes', it: 'Nour, specialista di viaggio', ar: 'نور، خبيرة رحلات' })}</strong><small>{tx(locale, { en: 'Customer care team', es: 'Equipo de atención al cliente', it: 'Team assistenza clienti', ar: 'فريق خدمة العملاء' })}</small></div></div><div className="customer-support-actions"><Link href="/account/messages"><MessageCircle size={16} />{tx(locale, { en: 'Open messages', es: 'Abrir mensajes', it: 'Apri i messaggi', ar: 'افتح الرسائل' })}</Link><a href={whatsappHref(brand.whatsapp)} target="_blank" rel="noreferrer"><WhatsAppGlyph size={16} />WhatsApp</a></div></aside>
}

function QuickActions() {
  const { locale } = useLocale()

  const actions = [
    { href: '/account/trip-requests', Icon: Plus, en: 'Plan a custom trip', es: 'Planifica un viaje a medida', it: 'Pianifica un viaggio su misura', ar: 'خطط رحلة مخصصة' },
    { href: '/account/payments', Icon: ReceiptText, en: 'Payment records', es: 'Registros de pago', it: 'Registri pagamenti', ar: 'سجل المدفوعات' },
    { href: '/account/profile', Icon: UserRound, en: 'Update profile', es: 'Actualizar el perfil', it: 'Aggiorna il profilo', ar: 'تحديث الملف' },
  ]
  return <section className="customer-account-block customer-quick-actions"><header><div><span>{tx(locale, { en: 'Shortcuts', es: 'Accesos directos', it: 'Scorciatoie', ar: 'اختصارات' })}</span><h2>{tx(locale, { en: 'Quick actions', es: 'Acciones rápidas', it: 'Azioni rapide', ar: 'إجراءات سريعة' })}</h2></div></header>{actions.map(({ href, Icon, en, es, it, ar: arLabel }) => <Link key={href} href={href}><Icon size={17} /><span>{tx(locale, { en, es, it, ar: arLabel })}</span><ChevronRight size={15} /></Link>)}</section>
}

export function EmptyState({ Icon, title, copy, href, action }: { Icon: typeof CalendarDays; title: string; copy: string; href: string; action: string }) {
  return <div className="customer-empty"><span><Icon size={24} /></span><h3>{title}</h3><p>{copy}</p><Link href={href}>{action} <ArrowRight size={15} /></Link></div>
}

export function CustomerPagination({ page, pageCount, onPage, pageSize, onPageSize, from, to, total }: {
  page: number; pageCount: number; onPage: (page: number) => void; pageSize: number; onPageSize: (size: number) => void; from: number; to: number; total: number
}) {
  const { locale } = useLocale()

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
      <span className="customer-pagination-info">{locale === 'es' ? `Mostrando ${from}–${to} de ${total}` : locale === 'it' ? `Visualizzazione di ${from}–${to} su ${total}` : locale === 'ar' ? `عرض ${from}–${to} من ${total}` : `Showing ${from}–${to} of ${total}`}</span>
      <label className="customer-pagination-size">{tx(locale, { en: 'Rows:', es: 'Filas:', it: 'Righe:', ar: 'الصفوف:' })}
        <SharedSelect value={String(pageSize)} onChange={(next) => onPageSize(Number(next))} locale={locale} label={tx(locale, { en: 'Rows per page', es: 'Filas por página', it: 'Righe per pagina', ar: 'عدد الصفوف في الصفحة' })} options={[10, 20, 30, 50].map((n) => ({ value: String(n), label: String(n) }))} />
      </label>
    </div>
    <div className="customer-page-btns" role="navigation" aria-label={tx(locale, { en: 'Pagination', es: 'Paginación', it: 'Paginazione', ar: 'ترقيم الصفحات' })}>
      <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label={tx(locale, { en: 'Previous page', es: 'Página anterior', it: 'Pagina precedente', ar: 'الصفحة السابقة' })}>‹</button>
      {numbers.map((n, i) => n === '…' ? <span key={`gap-${i}`}>…</span> : (
        <button key={n} type="button" className={n === page ? 'active' : ''} aria-current={n === page ? 'page' : undefined} onClick={() => onPage(n)}>{n}</button>
      ))}
      <button type="button" disabled={page >= pageCount} onClick={() => onPage(page + 1)} aria-label={tx(locale, { en: 'Next page', es: 'Página siguiente', it: 'Pagina successiva', ar: 'الصفحة التالية' })}>›</button>
    </div>
  </div>
}

function MiniTour({ tour }: { tour: (typeof catalogTours)[number] }) {
  const { locale, currency } = useLocale()
  const favorites = useCustomerFavorites()

  const title = (locale === 'ar' ? tour.titleAr || undefined : undefined) ?? tour.title
  return <article className="customer-mini-tour"><Link href={`/egypt-tours/${tour.slug}`}><img src={tour.image} alt={title} /></Link><div><span>{locale === 'ar' ? localizeTourLocation(tour.location) : tour.location}</span><h3><Link href={`/egypt-tours/${tour.slug}`}>{title}</Link></h3><small>{locale === 'ar' ? localizeTourDuration(tour.duration) : tour.duration} · {formatPrice(tour.price, currency, locale)}</small></div><button type="button" onClick={() => favorites.toggle(tour.slug)} aria-label={tx(locale, { en: 'Remove from saved', es: 'Quitar de guardados', it: 'Rimuovi dai salvati', ar: 'إزالة من المحفوظات' })}><Heart size={17} fill={favorites.has(tour.slug) ? 'currentColor' : 'none'} /></button></article>
}

/**
 * Customer booking detail (Phase 2E). Database-backed record owned by
 * the signed-in customer: fetched from `/api/account/bookings/*`.
 * Cancel runs against the same API and is server-enforced. Staff-only
 * notes never reach this UI — the customer serializer excludes them.
 */
function BookingDetailSection({ reference, autoPrint = false }: { reference: string; autoPrint?: boolean }) {
  const { locale, currency } = useLocale()

  const impersonated = useImpersonated()
  const previewList = useVisibleBookings()
  const [booking, setBooking] = useState<Booking | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const [actionError, setActionError] = useState('')
  const [paying, setPaying] = useState(false)
  const [payInfo, setPayInfo] = useState('')

  useEffect(() => {
    // Staff preview shows the impersonated demo record; real customers
    // load their own database-backed booking.
    if (impersonated) {
      setBooking(previewList.find((item) => item.reference === reference) ?? null)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setLoadError('')
    apiBookingDetail(reference)
      .then((row) => { if (!cancelled) { setBooking(row); setLoading(false) } })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Booking not found.')
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [reference, impersonated, previewList])

  useEffect(() => {
    if (autoPrint && booking) {
      const timer = window.setTimeout(() => window.print(), 700)
      return () => window.clearTimeout(timer)
    }
  }, [autoPrint, booking])

  if (loading) {
    return <div className="customer-inline-empty" role="status"><Clock3 size={20} /><span><strong>{tx(locale, { en: 'Loading booking…', es: 'Cargando la reserva…', it: 'Caricamento prenotazione…', ar: 'جارٍ تحميل الحجز…' })}</strong></span></div>
  }

  if (!booking) {
    return <EmptyState Icon={ShoppingBag} title={tx(locale, { en: 'Booking not found', es: 'Reserva no encontrada', it: 'Prenotazione non trovata', ar: 'الحجز غير موجود' })} copy={loadError || (tx(locale, { en: 'It may have been cancelled or you are viewing a different account.', es: 'Es posible que se haya cancelado o que estés viendo otra cuenta.', it: 'Potrebbe essere stata cancellata o stai visualizzando un altro account.', ar: 'ربما تم إلغاؤه أو أنك تتصفح حسابا مختلفا.' }))} href="/account/bookings" action={tx(locale, { en: 'Back to bookings', es: 'Volver a las reservas', it: 'Torna alle prenotazioni', ar: 'عودة للحجوزات' })} />
  }

  const travelers = booking.lines.reduce((sum, line) => sum + line.adults + line.children + line.infants, 0)
  const linesTotal = booking.lines.reduce((sum, line) => sum + line.total, 0)
  const canCancel = !impersonated && (booking.status === 'pending' || booking.status === 'confirmed')
  // Pay now is offered only when the booking can still take money and
  // no payment attempt is currently active. Initiation records a real
  // PENDING payment — it never charges and never marks anything paid.
  const payState = booking.paymentSummary?.state ?? 'unpaid'
  const canPay = !impersonated && (booking.status === 'pending' || booking.status === 'confirmed') && (payState === 'unpaid' || payState === 'failed')
  const startPayment = () => {
    if (paying) return
    setPaying(true)
    setActionError('')
    setPayInfo('')
    apiPaymentInitiate(booking.reference)
      .then(() => apiBookingDetail(booking.reference))
      .then((saved) => {
        setBooking(saved)
        setPayInfo(tx(locale, { en: `Payment attempt recorded as pending (${saved.paymentSummary?.latestReference ?? 'see Payments'}). Online payment opens here once a provider is connected — nothing has been charged.`, ar: `تم تسجيل محاولة الدفع كمعلقة (${saved.paymentSummary?.latestReference ?? 'انظر المدفوعات'}). ستظهر بوابة الدفع هنا عند ربط مزود — لم يتم خصم أي مبلغ.` }))
      })
      .catch((err: unknown) => {
        setActionError(err instanceof Error ? err.message : (tx(locale, { en: 'Could not initiate the payment.', ar: 'تعذر بدء الدفع.' })))
      })
      .finally(() => setPaying(false))
  }
  const createdOn = displayBookingDate(booking, locale)
  const steps = [
    { done: true, label: tx(locale, { en: 'Received', es: 'Recibida', it: 'Ricevuta', ar: 'تم الاستلام' }), date: createdOn },
    { done: booking.status !== 'pending', label: tx(locale, { en: 'Confirmation', es: 'Confirmación', it: 'Conferma', ar: 'التأكيد' }), date: booking.status !== 'pending' ? createdOn : '—' },
    { done: booking.status === 'completed', label: tx(locale, { en: 'Trip completed', es: 'Viaje completado', it: 'Viaggio completado', ar: 'اكتمال الرحلة' }), date: booking.status === 'completed' ? createdOn : '—' },
    ...(booking.status === 'cancelled' ? [{ done: true, label: tx(locale, { en: 'Cancelled', es: 'Cancelada', it: 'Cancellata', ar: 'ملغي' }), date: '—' }] : []),
  ]

  return <>
    <section className="customer-account-block">
      <header><div><span>{booking.reference}</span><h2>{booking.lines[0]?.title || (tx(locale, { en: 'Booking details', es: 'Detalles de la reserva', it: 'Dettagli prenotazione', ar: 'تفاصيل الحجز' }))}</h2></div><span className="customer-booking-flags"><BookingStatus booking={booking} locale={locale} /></span></header>
      <div className="customer-detail-grid">
        <div><small>{tx(locale, { en: 'Travel date', es: 'Fecha del viaje', it: 'Data del viaggio', ar: 'تاريخ السفر' })}</small><strong>{booking.lines[0]?.date || createdOn}</strong></div>
        <div><small>{tx(locale, { en: 'Travelers', es: 'Viajeros', it: 'Viaggiatori', ar: 'المسافرون' })}</small><strong>{travelers}</strong></div>
        <div><small>{tx(locale, { en: 'Payment method', es: 'Método de pago', it: 'Metodo di pagamento', ar: 'طريقة الدفع' })}</small><strong>{displayPaymentMethod(booking, locale)}</strong></div>
        <div><small>{tx(locale, { en: 'Payment status', es: 'Estado del pago', it: 'Stato del pagamento', ar: 'حالة الدفع' })}</small><strong>{displayPaymentStatus(booking, locale)}{booking.paymentSummary?.latestReference ? (<> · <Link href={'/account/payments/detail?ref=' + encodeURIComponent(booking.paymentSummary.latestReference)}>{booking.paymentSummary.latestReference}</Link></>) : ''}</strong></div>
      </div>
      {payInfo && <p role="status" className="form-note">{payInfo}</p>}
      {actionError && <p role="alert" className="form-error">{actionError}</p>}
      <div className="customer-detail-actions">
        {canPay && <button type="button" className="account-icon-action primary" disabled={paying} onClick={startPayment}><CreditCard size={17} />{paying ? (tx(locale, { en: 'Starting payment…', ar: 'جارٍ بدء الدفع…' })) : (tx(locale, { en: 'Pay now', ar: 'ادفع الآن' }))}</button>}
        <Link href="/account/messages" className="account-icon-action" onClick={() => saveMessageDraft({ reference: booking.reference, title: booking.lines[0]?.title ?? '' })}><MessageCircle size={17} />{tx(locale, { en: 'Ask about booking', es: 'Preguntar por la reserva', it: 'Chiedi info sulla prenotazione', ar: 'اسأل عن الحجز' })}</Link>
        <button type="button" className="account-icon-action" onClick={() => window.print()}><ReceiptText size={17} />{tx(locale, { en: 'Print booking', es: 'Imprimir la reserva', it: 'Stampa la prenotazione', ar: 'طباعة الحجز' })}</button>
        {canCancel && <button type="button" className="account-icon-action danger" onClick={() => setCancelling(true)}><X size={17} />{tx(locale, { en: 'Request cancellation', es: 'Solicitar cancelación', it: 'Richiedi cancellazione', ar: 'طلب الإلغاء' })}</button>}
      </div>
    </section>

    <section className="customer-account-block">
      <header><div><span>{booking.lines.length} {tx(locale, { en: 'items', es: 'elementos', it: 'voci', ar: 'بنود' })}</span><h2>{tx(locale, { en: 'Trip details', es: 'Detalles del viaje', it: 'Dettagli del viaggio', ar: 'تفاصيل الرحلات' })}</h2></div></header>
      {booking.lines.map((line) => (
        <article key={line.key} className="customer-booking-row">
          <Link href={line.tourSlug ? `/egypt-tours/${line.tourSlug}` : '/trips'}><img src={line.image || '/egypt-hero.png'} alt="" /></Link>
          <div className="customer-booking-copy">
            <div className="customer-booking-top"><span>{line.date || (tx(locale, { en: 'Flexible date', es: 'Fecha flexible', it: 'Data flessibile', ar: 'موعد مرن' }))}</span></div>
            <h3>{line.tourSlug ? <Link href={`/egypt-tours/${line.tourSlug}`}>{line.title}</Link> : line.title}</h3>
            <div className="customer-booking-meta">
              <span><Users size={14} />{line.adults} {tx(locale, { en: 'adults', es: 'adultos', it: 'adulti', ar: 'بالغين' })}</span>
              {line.children > 0 && <span>{line.children} {tx(locale, { en: 'children', es: 'niños', it: 'bambini', ar: 'أطفال' })}</span>}
              {line.infants > 0 && <span>{line.infants} {tx(locale, { en: 'infants', es: 'bebés', it: 'neonati', ar: 'رضع' })}</span>}
            </div>
            <div className="customer-booking-meta"><span>{tx(locale, { en: 'Adult', es: 'Adulto', it: 'Adulto', ar: 'البالغ' })}: {formatPrice(line.adultUnit, currency, locale)}</span>{line.children > 0 && <span>{tx(locale, { en: 'Child', es: 'Niño', it: 'Bambino', ar: 'الطفل' })}: {formatPrice(line.childUnit, currency, locale)}</span>}</div>
            {line.addons.length > 0 && <div className="customer-booking-meta"><span><Plus size={14} />{line.addons.join(' · ')}</span></div>}
          </div>
          <div className="customer-booking-total"><small>{tx(locale, { en: 'Line total', es: 'Total de la línea', it: 'Totale voce', ar: 'إجمالي البند' })}</small><strong>{formatPrice(line.total, currency, locale)}</strong></div>
        </article>
      ))}
      <div className="customer-payment-total-row"><span>{tx(locale, { en: 'Lines total', es: 'Total de líneas', it: 'Totale voci', ar: 'إجمالي البنود' })}</span><strong>{formatPrice(linesTotal, currency, locale)}</strong></div>
      <div className="customer-payment-total-row grand"><span>{tx(locale, { en: 'Grand total', es: 'Total general', it: 'Totale generale', ar: 'الإجمالي' })}</span><strong>{formatPrice(booking.total, currency, locale)}</strong></div>
    </section>

    <section className="customer-account-block">
      <header><div><span>{tx(locale, { en: 'Contact', es: 'Contacto', it: 'Contatto', ar: 'التواصل' })}</span><h2>{tx(locale, { en: 'Traveler details', es: 'Datos del viajero', it: 'Dati del viaggiatore', ar: 'بيانات المسافر' })}</h2></div></header>
      <div className="customer-detail-grid">
        <div><small>{tx(locale, { en: 'Name', es: 'Nombre', it: 'Nome', ar: 'الاسم' })}</small><strong>{booking.contact.name}</strong></div>
        <div><small>{tx(locale, { en: 'Email', es: 'Correo electrónico', it: 'Email', ar: 'البريد' })}</small><strong>{booking.contact.email || '—'}</strong></div>
        <div><small>{tx(locale, { en: 'Phone', es: 'Teléfono', it: 'Telefono', ar: 'الهاتف' })}</small><strong>{booking.contact.phone || '—'}</strong></div>
        {booking.notes ? <div><small>{tx(locale, { en: 'Notes', es: 'Notas', it: 'Note', ar: 'ملاحظات' })}</small><strong>{booking.notes}</strong></div> : null}
      </div>
    </section>

    {booking.activity.length > 0 && (
      <section className="customer-activity" aria-label={tx(locale, { en: 'Booking activity', es: 'Actividad de la reserva', it: 'Attività prenotazione', ar: 'سجل الحجز' })}>
        <h3>{tx(locale, { en: 'Activity', es: 'Actividad', it: 'Attività', ar: 'سجل الحجز' })}</h3>
        <ul>{booking.activity.map((a, i) => <li key={`${a.at}-${i}`}><span>{new Date(a.at).toLocaleString(locale === 'ar' ? 'ar-EG' : locale === 'es' ? 'es-ES' : locale === 'it' ? 'it-IT' : 'en-US')}</span><strong>{bookingActivityLabel(a.action, locale)}</strong>{a.note && <small>{a.note}</small>}</li>)}</ul>
      </section>
    )}

    <section className="customer-account-block">
      <header><div><span>{tx(locale, { en: 'Tracking', es: 'Seguimiento', it: 'Monitoraggio', ar: 'التتبع' })}</span><h2>{tx(locale, { en: 'Booking timeline', es: 'Cronología de la reserva', it: 'Cronologia prenotazione', ar: 'مراحل الحجز' })}</h2></div></header>
      <ol className="customer-timeline">
        {steps.map((step) => (
          <li key={step.label} className={step.done ? 'done' : ''}><span /><div><strong>{step.label}</strong><small>{step.date}</small></div></li>
        ))}
      </ol>
    </section>
    <CustomerConfirmDialog
      open={cancelling}
      onClose={() => setCancelling(false)}
      onConfirm={() => {
        setCancelling(false)
        setActionError('')
        apiBookingCancel(booking.reference)
          .then((saved) => setBooking(saved))
          .catch((err: unknown) => {
            setActionError(err instanceof Error ? err.message : (tx(locale, { en: 'Could not cancel the booking.', es: 'No se pudo cancelar la reserva.', it: 'Impossibile cancellare la prenotazione.', ar: 'تعذر إلغاء الحجز.' })))
          })
      }}
      title={tx(locale, { en: 'Cancel this booking?', es: '¿Cancelar esta reserva?', it: 'Cancellare questa prenotazione?', ar: 'إلغاء هذا الحجز؟' })}
      copy={tx(locale, { en: 'This booking will remain in your history with a Cancelled status.', es: 'Esta reserva quedará en tu historial como cancelada.', it: 'Questa prenotazione resterà nella cronologia come cancellata.', ar: 'سيبقى هذا الحجز في سجلك بحالة ملغي.' })}
      confirmLabel={tx(locale, { en: 'Cancel booking', es: 'Cancelar la reserva', it: 'Cancella prenotazione', ar: 'إلغاء الحجز' })}
      cancelLabel={tx(locale, { en: 'Keep booking', es: 'Mantener la reserva', it: 'Mantieni prenotazione', ar: 'أبقِ الحجز' })}
    />
    {/* Print-only professional booking document (same DB-backed view). */}
    <div className="booking-print-area" aria-hidden="true"><BookingPrintDocument booking={booking} /></div>
  </>
}

export function BookingDetailPage({ reference, autoPrint = false }: { reference: string; autoPrint?: boolean }) {
  return <LocaleProvider><AccountShell section="bookings"><BookingDetailSection reference={reference} autoPrint={autoPrint} /></AccountShell></LocaleProvider>
}

function BookingTableRow({ booking, index }: { booking: Booking; index: number }) {
  const { locale, currency } = useLocale()

  const first = booking.lines[0]
  const travelers = booking.lines.reduce((sum, line) => sum + line.adults + line.children + line.infants, 0)
  const detailHref = '/account/bookings/detail?ref=' + encodeURIComponent(booking.reference)
  return <tr>
    <td className="customer-row-number">{index}</td>
    <td><span className="customer-trip-cell"><Link href={detailHref}><img src={first?.image || '/egypt-hero.png'} alt="" /></Link><span><strong><Link href={detailHref}>{first?.title || (tx(locale, { en: 'Custom journey', es: 'Viaje personalizado', it: 'Viaggio personalizzato', ar: 'رحلة مخصصة' }))}</Link></strong><small>{booking.reference} · {booking.lines.length} {tx(locale, { en: 'items', es: 'elementos', it: 'voci', ar: 'بنود' })}</small></span></span></td>
    <td>{displayBookingDate(booking, locale)}</td>
    <td>{travelers}</td>
    <td><strong>{formatPrice(booking.total, currency, locale)}</strong></td>
    <td><BookingStatus booking={booking} locale={locale} /></td>
    <td><span className="customer-table-actions"><Link href={detailHref} aria-label={tx(locale, { en: 'View details', es: 'Ver detalles', it: 'Vedi dettagli', ar: 'عرض التفاصيل' })} title={tx(locale, { en: 'View details', es: 'Ver detalles', it: 'Vedi dettagli', ar: 'عرض التفاصيل' })}><Eye size={16} /></Link><Link href="/account/messages" onClick={() => saveMessageDraft({ reference: booking.reference, title: first?.title ?? '' })} aria-label={tx(locale, { en: 'Ask about booking', es: 'Preguntar por la reserva', it: 'Chiedi info sulla prenotazione', ar: 'اسأل عن الحجز' })} title={tx(locale, { en: 'Ask about booking', es: 'Preguntar por la reserva', it: 'Chiedi info sulla prenotazione', ar: 'اسأل عن الحجز' })}><MessageCircle size={16} /></Link></span></td>
  </tr>
}

/**
 * Customer bookings (Phase 2E). Database-backed records owned by the
 * signed-in customer, loaded from `/api/account/bookings`. Staff-only
 * notes never reach this UI — the customer serializer excludes them.
 */
function BookingsSection() {
  const { locale } = useLocale()

  const impersonated = useImpersonated()
  const { bookings: mine, loading, error } = useCustomerBookings()
  const preview = useVisibleBookings()
  const bookings = impersonated ? preview : mine
  const [filter, setFilter] = useState<'all' | BookingStatus>('all')
  const visible = filter === 'all' ? bookings : bookings.filter((booking) => booking.status === filter)
  const paging = usePagination(visible)
  if (!impersonated && loading) {
    return <section className="customer-account-block customer-full-block"><div className="customer-empty" role="status"><h3>{tx(locale, { en: 'Loading your bookings…', es: 'Cargando tus reservas…', it: 'Caricamento prenotazioni…', ar: 'جارٍ تحميل حجوزاتك…' })}</h3></div></section>
  }
  if (!impersonated && error && !bookings.length) {
    return <section className="customer-account-block customer-full-block"><div className="customer-empty"><h3>{tx(locale, { en: 'Could not load bookings', es: 'No se pudieron cargar las reservas', it: 'Impossibile caricare le prenotazioni', ar: 'تعذر تحميل الحجوزات' })}</h3><p>{error}</p></div></section>
  }
  return <section className="customer-account-block customer-full-block"><div className="customer-filterbar"><div role="tablist" aria-label={tx(locale, { en: 'Filter bookings', es: 'Filtrar reservas', it: 'Filtra prenotazioni', ar: 'فلترة الحجوزات' })}>{(['all', 'pending', 'confirmed', 'completed', 'cancelled'] as const).map((status) => <button type="button" key={status} className={filter === status ? 'active' : ''} onClick={() => setFilter(status)}>{status === 'all' ? (tx(locale, { en: 'All', es: 'Todos', it: 'Tutti', ar: 'الكل' })) : tx(locale, bookingStatusCopy[status])}</button>)}</div><Link href="/trips"><Plus size={16} />{tx(locale, { en: 'Book a trip', es: 'Reservar un viaje', it: 'Prenota un viaggio', ar: 'حجز رحلة' })}</Link></div>{visible.length ? <><div className="customer-table-wrap"><table className="customer-table"><thead><tr><th>#</th><th>{tx(locale, { en: 'Trip', es: 'Viaje', it: 'Viaggio', ar: 'الرحلة' })}</th><th>{tx(locale, { en: 'Date', es: 'Fecha', it: 'Data', ar: 'التاريخ' })}</th><th>{tx(locale, { en: 'Travelers', es: 'Viajeros', it: 'Viaggiatori', ar: 'المسافرون' })}</th><th>{tx(locale, { en: 'Total', es: 'Total', it: 'Totale', ar: 'الإجمالي' })}</th><th>{tx(locale, { en: 'Status', es: 'Estado', it: 'Stato', ar: 'الحالة' })}</th><th></th></tr></thead><tbody>{paging.pageRows.map((booking, index) => <BookingTableRow key={booking.reference} booking={booking} index={paging.from + index} />)}</tbody></table></div><CustomerPagination page={paging.page} pageCount={paging.pageCount} onPage={paging.setPage} pageSize={paging.pageSize} onPageSize={paging.setPageSize} from={paging.from} to={paging.to} total={paging.total} /></> : <EmptyState Icon={ShoppingBag} title={tx(locale, { en: 'No bookings in this view', es: 'Sin reservas en esta vista', it: 'Nessuna prenotazione in questa vista', ar: 'لا توجد حجوزات في هذه الحالة' })} copy={tx(locale, { en: 'Any booking created at checkout will appear here automatically.', es: 'Cualquier reserva creada al finalizar la compra aparecerá aquí automáticamente.', it: 'Qualsiasi prenotazione creata al checkout apparirà qui automaticamente.', ar: 'أي حجز تنشئه من صفحة الدفع سيظهر هنا تلقائيًا.' })} href="/trips" action={tx(locale, { en: 'Browse trips', es: 'Explorar viajes', it: 'Sfoglia i viaggi', ar: 'تصفح الرحلات' })} />}</section>
}

/**
 * Customer car requests (Phase 2C). Database-backed records owned by the
 * signed-in customer: list, detail, edit (via /rent-car/request?edit=…),
 * and cancel run against `/api/account/car-requests/*`. Staff-only notes
 * never reach this UI — the customer serializer excludes them entirely.
 */
function carRequestVehicleTitle(liveCars: { slug: string; title: string }[], slug: string): string {
  return liveCars.find((car) => car.slug === slug)?.title ?? slug
}

function carTripLabel(tripType: string, locale: Locale): string {
  if (tripType === 'One Way') return tx(locale, { en: 'One Way', es: 'Solo ida', it: 'Solo andata', ar: 'ذهاب فقط' })
  if (tripType === 'Round Trip') return tx(locale, { en: 'Round Trip', es: 'Ida y vuelta', it: 'Andata e ritorno', ar: 'ذهاب وعودة' })
  return tx(locale, { en: 'Not set', es: 'Sin definir', it: 'Non impostato', ar: 'لم يحدد' })
}

/** Customer-friendly display date only (e.g. "27 Sep 2026"). Stored ISO is never modified. */
function formatCarDate(iso: string, locale: Locale): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso
  const parsed = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return iso
  if (locale === 'ar') return parsed.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', year: 'numeric' })
  if (locale === 'es') return parsed.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
  if (locale === 'it') return parsed.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${parsed.getDate()} ${months[parsed.getMonth()]} ${parsed.getFullYear()}`
}

function passengerCountLabel(count: number, locale: Locale): string {
  if (locale === 'es') return count === 1 ? '1 pasajero' : `${count} pasajeros`
  if (locale === 'it') return count === 1 ? '1 passeggero' : `${count} passeggeri`
  if (locale !== 'ar') return count === 1 ? '1 passenger' : `${count} passengers`
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
          <button type="button" className="language-close" onClick={onClose} aria-label={tx(locale, { en: 'Close dialog', es: 'Cerrar el diálogo', it: 'Chiudi la finestra', ar: 'إغلاق الحوار' })}><X size={18} /></button>
        </div>
        <p style={{ margin: '12px 0 0', color: '#667085', fontSize: 13, lineHeight: 1.7 }}>{copy}</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap', marginTop: 18 }}>
          <button type="button" className="account-icon-action" onClick={onClose}>{cancelLabel ?? (tx(locale, { en: 'Keep it', es: 'Mantener', it: 'Mantieni', ar: 'تراجع' }))}</button>
          {confirmLabel && <button ref={confirmRef} type="button" className="account-icon-action danger" onClick={onConfirm}>{confirmLabel}</button>}
        </div>
      </div>
    </div>
  )
}

function CarStatusBadge({ status }: { status: CarRequestStatus }) {
  const { locale } = useLocale()

  const tone = status === 'new' ? 'request_received' : status === 'reviewing' ? 'reviewing' : status === 'confirmed' ? 'confirmed' : 'cancelled'
  return <span className={`customer-status ${tone}`}>{carRequestStatusLabel(status, locale)}</span>
}

async function apiCarList(): Promise<CarRequest[]> {
  const res = await fetch('/api/account/car-requests', { credentials: 'same-origin' })
  if (!res.ok) throw new Error('Could not load your car requests.')
  const data = (await res.json()) as { requests?: CarRequest[] }
  if (!Array.isArray(data.requests)) throw new Error('Could not load your car requests.')
  return data.requests
}

async function apiCarDetail(reference: string): Promise<CarRequest> {
  const res = await fetch(`/api/account/car-requests/${encodeURIComponent(reference)}`, { credentials: 'same-origin' })
  const data = (await res.json()) as CarRequest & { error?: string }
  if (!res.ok) throw new Error(data.error || 'Car request not found.')
  return data
}

async function apiCarCancel(reference: string): Promise<CarRequest> {
  const res = await fetch(`/api/account/car-requests/${encodeURIComponent(reference)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ action: 'cancel' }),
  })
  const data = (await res.json()) as CarRequest & { error?: string }
  if (!res.ok) throw new Error(data.error || 'Could not cancel the request.')
  return data
}

function CarRequestsSection() {
  const { locale } = useLocale()

  const liveCars = useLiveCollection('cars', cars)
  const [requests, setRequests] = useState<CarRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [cancellingRef, setCancellingRef] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | CarRequestStatus>('all')

  // Load the customer's real requests once.
  useEffect(() => {
    let cancelled = false
    apiCarList()
      .then((rows) => { if (!cancelled) { setRequests(rows); setLoading(false) } })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : 'Could not load your car requests.')
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [])

  const visible = requests.filter((r) => filter === 'all' || r.status === filter)
  const paging = usePagination(visible)

  if (loading) {
    return <section className="customer-account-block customer-full-block"><div className="customer-empty" role="status"><h3>{tx(locale, { en: 'Loading your requests…', es: 'Cargando tus solicitudes…', it: 'Caricamento richieste…', ar: 'جارٍ تحميل طلباتك…' })}</h3></div></section>
  }

  if (loadError && !requests.length) {
    return (
      <section className="customer-account-block customer-full-block">
        <div className="customer-empty">
          <h3>{tx(locale, { en: 'Could not load requests', es: 'No se pudieron cargar las solicitudes', it: 'Impossibile caricare le richieste', ar: 'تعذر تحميل الطلبات' })}</h3>
          <p>{loadError}</p>
          <button type="button" className="account-icon-action" onClick={() => {
            setLoading(true)
            setLoadError('')
            apiCarList()
              .then((rows) => { setRequests(rows); setLoading(false) })
              .catch((error: unknown) => {
                setLoadError(error instanceof Error ? error.message : 'Could not load your car requests.')
                setLoading(false)
              })
          }}>{tx(locale, { en: 'Retry', es: 'Reintentar', it: 'Riprova', ar: 'إعادة المحاولة' })}</button>
        </div>
      </section>
    )
  }

  if (!requests.length) {
    return <section className="customer-account-block customer-full-block"><EmptyState Icon={CarFront} title={tx(locale, { en: 'No car requests yet', es: 'Aún no hay solicitudes de coche', it: 'Ancora nessuna richiesta auto', ar: 'لا توجد طلبات سيارات بعد' })} copy={tx(locale, { en: 'Plan your transfer or vehicle request and it will appear here.', es: 'Planifica tu traslado o solicitud de vehículo y aparecerá aquí.', it: 'Pianifica il tuo transfer o la richiesta auto e apparirà qui.', ar: 'ابدأ طلب سيارة أو وسيلة انتقال وسيظهر هنا.' })} href="/rent-car" action={tx(locale, { en: 'Browse rental cars', es: 'Ver coches de alquiler', it: 'Sfoglia le auto a noleggio', ar: 'استكشف السيارات' })} /></section>
  }

  const tabs = [
    { id: 'all', en: 'All', es: 'Todos', it: 'Tutti', ar: 'الكل' },
    { id: 'new', en: 'New', es: 'Nueva', it: 'Nuova', ar: 'جديد' },
    { id: 'reviewing', en: 'Reviewing', es: 'En revisión', it: 'In revisione', ar: 'قيد المراجعة' },
    { id: 'confirmed', en: 'Confirmed', es: 'Confirmada', it: 'Confermata', ar: 'مؤكد' },
    { id: 'cancelled', en: 'Cancelled', es: 'Cancelada', it: 'Cancellata', ar: 'ملغي' },
  ] as const
  const viewLabel = tx(locale, { en: 'View request', es: 'Ver la solicitud', it: 'Vedi richiesta', ar: 'عرض الطلب' })
  return <>
    <section className="customer-account-block customer-full-block">
      {loadError && (
        <div style={{ padding: '18px 18px 0' }}>
          <p className="form-error" role="alert">{loadError}</p>
        </div>
      )}
      <div className="customer-filterbar"><div role="tablist" aria-label={tx(locale, { en: 'Filter car requests', es: 'Filtrar solicitudes de coche', it: 'Filtra richieste auto', ar: 'فلترة طلبات السيارات' })}>{tabs.map((tab) => <button type="button" key={tab.id} className={filter === tab.id ? 'active' : ''} onClick={() => setFilter(tab.id)}>{tx(locale, tab)}</button>)}</div><Link href="/rent-car"><Plus size={16} />{tx(locale, { en: 'Request a car', es: 'Solicitar un coche', it: 'Richiedi un’auto', ar: 'طلب سيارة' })}</Link></div>
      {paging.pageRows.length ? <><div className="customer-table-wrap"><table className="customer-table">
        <thead><tr><th>#</th><th>{tx(locale, { en: 'Vehicle', es: 'Vehículo', it: 'Veicolo', ar: 'السيارة' })}</th><th>{tx(locale, { en: 'Route', es: 'Ruta', it: 'Percorso', ar: 'المسار' })}</th><th>{tx(locale, { en: 'Dates', es: 'Fechas', it: 'Date', ar: 'التواريخ' })}</th><th>{tx(locale, { en: 'Passengers', es: 'Pasajeros', it: 'Passeggeri', ar: 'المسافرون' })}</th><th>{tx(locale, { en: 'Status', es: 'Estado', it: 'Stato', ar: 'الحالة' })}</th><th></th></tr></thead>
        <tbody>{paging.pageRows.map((item, index) => {
          const detailHref = `/account/car-requests/detail?ref=${encodeURIComponent(item.reference)}`
          const editable = item.status === 'new' || item.status === 'reviewing'
          const vehicleTitle = carRequestVehicleTitle(liveCars, item.vehicleSlug)
          const vehicleImage = liveCars.find((car) => car.slug === item.vehicleSlug)?.image || '/egypt-hero.png'
          const showReturn = item.tripType === 'Round Trip' && item.preferredReturnDate !== ''
          return <tr key={item.reference}>
            <td className="customer-row-number">{paging.from + index}</td>
            <td><span className="customer-trip-cell"><img src={vehicleImage} alt="" /><span><strong><Link href={detailHref}>{vehicleTitle}</Link></strong><small><span dir="ltr">{item.reference}</span> · {carTripLabel(item.tripType, locale)}</small></span></span></td>
            <td><span dir="ltr">{item.pickup} → {item.dropoff}</span></td>
            <td><span dir="ltr">{formatCarDate(item.preferredPickupDate, locale)}</span>{showReturn && <><br /><small style={{ color: '#667283' }}><span dir="ltr">{formatCarDate(item.preferredReturnDate, locale)}</span></small></>}</td>
            <td>{passengerCountLabel(item.passengers, locale)}</td>
            <td><CarStatusBadge status={item.status} /></td>
            <td><span className="customer-table-actions">
              <Link href={detailHref} aria-label={viewLabel} title={viewLabel}><Eye size={16} /></Link>
              {editable && <Link href={`/rent-car/request?edit=${encodeURIComponent(item.reference)}`} aria-label={tx(locale, { en: 'Edit request', es: 'Editar la solicitud', it: 'Modifica richiesta', ar: 'تعديل الطلب' })} title={tx(locale, { en: 'Edit request', es: 'Editar la solicitud', it: 'Modifica richiesta', ar: 'تعديل الطلب' })}><Pencil size={16} /></Link>}
              {editable && <button type="button" className="danger" onClick={() => setCancellingRef(item.reference)} aria-label={tx(locale, { en: 'Cancel request', es: 'Cancelar la solicitud', it: 'Cancella richiesta', ar: 'إلغاء الطلب' })} title={tx(locale, { en: 'Cancel request', es: 'Cancelar la solicitud', it: 'Cancella richiesta', ar: 'إلغاء الطلب' })}><X size={16} /></button>}
            </span></td>
          </tr>
        })}</tbody>
      </table></div>
      <CustomerPagination page={paging.page} pageCount={paging.pageCount} onPage={paging.setPage} pageSize={paging.pageSize} onPageSize={paging.setPageSize} from={paging.from} to={paging.to} total={paging.total} />
      </> : <div className="customer-empty"><span><CarFront size={24} /></span><h3>{tx(locale, { en: 'No requests in this view', es: 'Sin solicitudes en esta vista', it: 'Nessuna richiesta in questa vista', ar: 'لا توجد طلبات في هذا العرض' })}</h3><p>{tx(locale, { en: 'Try a different filter above.', es: 'Prueba con otro filtro.', it: 'Prova un altro filtro.', ar: 'جرب فلترًا مختلفًا من الأعلى.' })}</p><button type="button" className="account-icon-action" onClick={() => setFilter('all')}>{tx(locale, { en: 'Show all', es: 'Mostrar todo', it: 'Mostra tutto', ar: 'عرض الكل' })}</button></div>}
      <div style={{ padding: '14px 18px 18px' }}>
        <p className="car-request-notice" role="note"><Clock3 size={15} /><span>{tx(locale, { en: 'Our team follows up on your request and will contact you by email with updates.', es: 'Nuestro equipo da seguimiento a tu solicitud y te contactará por correo electrónico con las novedades.', it: 'Il nostro team segue la tua richiesta e ti contatterà via email con gli aggiornamenti.', ar: 'يتابع فريقنا طلبك وسيتواصل معك على بريدك عند وجود تحديث.' })}</span></p>
      </div>
    </section>
    <CustomerConfirmDialog
      open={cancellingRef !== null}
      onClose={() => setCancellingRef(null)}
      onConfirm={() => {
        const ref = cancellingRef
        setCancellingRef(null)
        if (!ref) return
        apiCarCancel(ref)
          .then((saved) => {
            setLoadError('')
            setRequests((prev) => prev.map((r) => (r.reference === saved.reference ? saved : r)))
          })
          .catch((error: unknown) => {
            setLoadError(error instanceof Error ? error.message : 'Could not cancel the request.')
          })
      }}
      title={tx(locale, { en: 'Cancel this car request?', es: '¿Cancelar esta solicitud de coche?', it: 'Cancellare questa richiesta auto?', ar: 'إلغاء طلب السيارة؟' })}
      copy={tx(locale, { en: 'This request will remain in your history with a Cancelled status.', es: 'Esta solicitud quedará en tu historial como cancelada.', it: 'Questa richiesta resterà nella cronologia come cancellata.', ar: 'سيبقى هذا الطلب في سجلك بحالة ملغي.' })}
      confirmLabel={tx(locale, { en: 'Cancel request', es: 'Cancelar la solicitud', it: 'Cancella richiesta', ar: 'إلغاء الطلب' })}
      cancelLabel={tx(locale, { en: 'Keep request', es: 'Mantener la solicitud', it: 'Mantieni richiesta', ar: 'أبقِ الطلب' })}
    />
  </>
}

function CarRequestDetailSection({ reference }: { reference: string }) {
  const { locale } = useLocale()

  const liveCars = useLiveCollection('cars', cars)
  const [item, setItem] = useState<CarRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [cancelling, setCancelling] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    apiCarDetail(reference)
      .then((record) => { if (!cancelled) { setItem(record); setLoading(false) } })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Car request not found.')
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [reference])

  if (loading) {
    return (
      <div className="customer-inline-empty" role="status">
        <Clock3 size={20} />
        <span><strong>{tx(locale, { en: 'Loading request…', es: 'Cargando la solicitud…', it: 'Caricamento richiesta…', ar: 'جارٍ تحميل الطلب…' })}</strong></span>
      </div>
    )
  }

  if (!item) {
    return (
      <div className="customer-inline-empty">
        <Clock3 size={20} />
        <span>
          <strong>{tx(locale, { en: 'Car request not found', es: 'Solicitud de coche no encontrada', it: 'Richiesta auto non trovata', ar: 'طلب السيارة غير موجود' })}</strong>
          <small>{error || (tx(locale, { en: 'It may have been removed or belong to a different account.', es: 'Es posible que se haya eliminado o que pertenezca a otra cuenta.', it: 'Potrebbe essere stata rimossa o appartenere a un altro account.', ar: 'ربما تم حذفه أو أنه يخص حسابًا آخر.' }))}</small>
        </span>
        <Link href="/account/car-requests">{tx(locale, { en: 'Back to car requests', es: 'Volver a las solicitudes de coche', it: 'Torna alle richieste auto', ar: 'عودة لطلبات السيارات' })}</Link>
      </div>
    )
  }

  const editable = item.status === 'new' || item.status === 'reviewing'
  const vehicleTitle = carRequestVehicleTitle(liveCars, item.vehicleSlug)
  const assignedTitle = item.assignedVehicleSlug ? carRequestVehicleTitle(liveCars, item.assignedVehicleSlug) : ''
  return <>
    <section className="customer-account-block">
      <header><div><span>{tx(locale, { en: 'Car request', es: 'Solicitud de coche', it: 'Richiesta auto', ar: 'طلب سيارة' })}</span><h2>{vehicleTitle}</h2></div><CarStatusBadge status={item.status} /></header>
      <div className="customer-detail-grid">
        <div><small>{tx(locale, { en: 'Reference', es: 'Referencia', it: 'Riferimento', ar: 'المرجع' })}</small><strong dir="ltr">{item.reference}</strong></div>
        <div><small>{tx(locale, { en: 'Created', es: 'Creada', it: 'Creata', ar: 'أُنشئ في' })}</small><strong>{new Date(item.createdAt).toLocaleString(locale === 'ar' ? 'ar-EG' : locale === 'es' ? 'es-ES' : locale === 'it' ? 'it-IT' : 'en-US')}</strong></div>
        <div><small>{tx(locale, { en: 'Updated', es: 'Actualizada', it: 'Aggiornata', ar: 'آخر تحديث' })}</small><strong>{new Date(item.updatedAt).toLocaleString(locale === 'ar' ? 'ar-EG' : locale === 'es' ? 'es-ES' : locale === 'it' ? 'it-IT' : 'en-US')}</strong></div>
        <div><small>{tx(locale, { en: 'Requested vehicle', es: 'Vehículo solicitado', it: 'Veicolo richiesto', ar: 'السيارة المطلوبة' })}</small><strong>{vehicleTitle}</strong></div>
        <div><small>{tx(locale, { en: 'Trip type', es: 'Tipo de viaje', it: 'Tipo di viaggio', ar: 'النوع' })}</small><strong>{carTripLabel(item.tripType, locale)}</strong></div>
        <div><small>{tx(locale, { en: 'Passengers', es: 'Pasajeros', it: 'Passeggeri', ar: 'الركاب' })}</small><strong>{item.passengers}</strong></div>
        {assignedTitle !== '' && <div><small>{tx(locale, { en: 'Assigned vehicle', es: 'Vehículo asignado', it: 'Veicolo assegnato', ar: 'المركبة المخصصة' })}</small><strong>{assignedTitle}</strong></div>}
      </div>
    </section>

    <section className="customer-account-block">
      <header><div><span>{tx(locale, { en: 'Route', es: 'Ruta', it: 'Percorso', ar: 'المسار' })}</span><h2>{tx(locale, { en: 'Journey', es: 'Trayecto', it: 'Viaggio', ar: 'الرحلة' })}</h2></div></header>
      <div className="customer-detail-grid">
        <div><small>{tx(locale, { en: 'Pickup', es: 'Recogida', it: 'Prelievo', ar: 'نقطة الانطلاق' })}</small><strong>{item.pickup}</strong></div>
        <div><small>{tx(locale, { en: 'Drop-off', es: 'Destino', it: 'Destinazione', ar: 'الوجهة' })}</small><strong>{item.dropoff}</strong></div>
        <div><small>{tx(locale, { en: 'Pick-up date', es: 'Fecha de recogida', it: 'Data di prelievo', ar: 'تاريخ الانطلاق' })}</small><strong dir="ltr">{formatCarDate(item.preferredPickupDate, locale)}</strong></div>
        <div><small>{tx(locale, { en: 'Return date', es: 'Fecha de regreso', it: 'Data di ritorno', ar: 'تاريخ العودة' })}</small><strong dir="ltr">{item.tripType === 'Round Trip' && item.preferredReturnDate ? formatCarDate(item.preferredReturnDate, locale) : '—'}</strong></div>
      </div>
    </section>

    <section className="customer-account-block">
      <header><div><span>{tx(locale, { en: 'Contact', es: 'Contacto', it: 'Contatto', ar: 'التواصل' })}</span><h2>{tx(locale, { en: 'Contact details', es: 'Datos de contacto', it: 'Dati di contatto', ar: 'بيانات التواصل' })}</h2></div></header>
      <div className="customer-detail-grid">
        <div><small>{tx(locale, { en: 'Full name', es: 'Nombre completo', it: 'Nome completo', ar: 'الاسم الكامل' })}</small><strong>{item.contact.name}</strong></div>
        <div><small>{tx(locale, { en: 'Email', es: 'Correo electrónico', it: 'Email', ar: 'البريد الإلكتروني' })}</small><strong dir="ltr">{item.contact.email}</strong></div>
        <div><small>{tx(locale, { en: 'Phone', es: 'Teléfono', it: 'Telefono', ar: 'رقم الهاتف' })}</small><strong dir="ltr">{item.contact.phone}</strong></div>
      </div>
    </section>

    <section className="customer-account-block">
      <header><div><span>{tx(locale, { en: 'Additional', es: 'Adicional', it: 'Aggiuntivo', ar: 'إضافي' })}</span><h2>{tx(locale, { en: 'Additional request', es: 'Solicitud adicional', it: 'Richiesta aggiuntiva', ar: 'طلب إضافي' })}</h2></div></header>
      {item.notes !== '' ? <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{item.notes}</p> : <p style={{ margin: 0, color: '#667085', fontSize: 12 }}>{tx(locale, { en: 'No additional notes.', es: 'Sin notas adicionales.', it: 'Nessuna nota aggiuntiva.', ar: 'لا توجد ملاحظات إضافية.' })}</p>}
    </section>

    {item.activity.length > 0 && (
      <section className="customer-activity" aria-label={tx(locale, { en: 'Request activity', es: 'Actividad de la solicitud', it: 'Attività richiesta', ar: 'سجل الطلب' })}>
        <h3>{tx(locale, { en: 'Activity', es: 'Actividad', it: 'Attività', ar: 'سجل الطلب' })}</h3>
        <ul>{item.activity.map((a, i) => <li key={`${a.at}-${i}`}><span>{new Date(a.at).toLocaleString(locale === 'ar' ? 'ar-EG' : locale === 'es' ? 'es-ES' : locale === 'it' ? 'it-IT' : 'en-US')}</span><strong>{carActivityLabel(a.action, locale)}</strong>{a.note && <small>{a.action === 'Assigned vehicle updated' ? fleetVehicleTitle(liveCars, a.note) : a.note}</small>}</li>)}</ul>
      </section>
    )}

    <section className="customer-account-block">
      <header><div><span>{tx(locale, { en: 'State', es: 'Estado', it: 'Stato', ar: 'الحالة' })}</span><h2>{tx(locale, { en: 'Request state', es: 'Estado de la solicitud', it: 'Stato della richiesta', ar: 'حالة الطلب' })}</h2></div></header>
      <p style={{ margin: '0 0 8px', fontSize: 13, lineHeight: 1.7 }}>{tx(locale, { en: 'Our team follows up on your request and will contact you by email with updates.', es: 'Nuestro equipo da seguimiento a tu solicitud y te contactará por correo electrónico con las novedades.', it: 'Il nostro team segue la tua richiesta e ti contatterà via email con gli aggiornamenti.', ar: 'يتابع فريقنا طلبك وسيتواصل معك على بريدك عند وجود تحديث.' })}</p>
      <p style={{ margin: 0, color: '#667085', fontSize: 12, lineHeight: 1.7 }}>{tx(locale, { en: 'Contact details shown are a historical snapshot of this request.', es: 'Los datos de contacto mostrados son una instantánea histórica de esta solicitud.', it: 'I dati di contatto mostrati sono un’istantanea storica di questa richiesta.', ar: 'بيانات التواصل المعروضة لقطة تاريخية لهذا الطلب.' })}</p>
      <div className="customer-detail-actions">
        <Link href="/account/car-requests" className="account-icon-action">{tx(locale, { en: 'Back to list', es: 'Volver a la lista', it: 'Torna all’elenco', ar: 'عودة للقائمة' })}</Link>
        {editable && <Link href={`/rent-car/request?edit=${encodeURIComponent(item.reference)}`} className="account-icon-action"><Pencil size={16} />{tx(locale, { en: 'Edit request', es: 'Editar la solicitud', it: 'Modifica richiesta', ar: 'تعديل الطلب' })}</Link>}
        {editable && <button type="button" className="account-icon-action danger" onClick={() => setCancelling(true)}><X size={16} />{tx(locale, { en: 'Cancel request', es: 'Cancelar la solicitud', it: 'Cancella richiesta', ar: 'إلغاء الطلب' })}</button>}
      </div>
    </section>
    <CustomerConfirmDialog
      open={cancelling}
      onClose={() => setCancelling(false)}
      onConfirm={() => {
        setCancelling(false)
        apiCarCancel(item.reference)
          .then((saved) => setItem(saved))
          .catch((err: unknown) => {
            setError(err instanceof Error ? err.message : 'Could not cancel the request.')
          })
      }}
      title={tx(locale, { en: 'Cancel this car request?', es: '¿Cancelar esta solicitud de coche?', it: 'Cancellare questa richiesta auto?', ar: 'إلغاء طلب السيارة؟' })}
      copy={tx(locale, { en: 'This request will remain in your history with a Cancelled status.', es: 'Esta solicitud quedará en tu historial como cancelada.', it: 'Questa richiesta resterà nella cronologia come cancellata.', ar: 'سيبقى هذا الطلب في سجلك بحالة ملغي.' })}
      confirmLabel={tx(locale, { en: 'Cancel request', es: 'Cancelar la solicitud', it: 'Cancella richiesta', ar: 'إلغاء الطلب' })}
      cancelLabel={tx(locale, { en: 'Keep request', es: 'Mantener la solicitud', it: 'Mantieni richiesta', ar: 'أبقِ الطلب' })}
    />
  </>
}

export function CarRequestDetailPage({ reference }: { reference: string }) {
  return <LocaleProvider><CarRequestDetailHeader reference={reference} /></LocaleProvider>
}

function CarRequestDetailHeader({ reference }: { reference: string }) {
  const { locale } = useLocale()

  return (
    <AccountShell
      section="car-requests"
      headLeading={<Link href="/account/car-requests" className="account-icon-action">{locale === 'ar' ? <ArrowRight size={16} /> : <ArrowLeft size={16} />}{tx(locale, { en: 'Back to car requests', es: 'Volver a las solicitudes de coche', it: 'Torna alle richieste auto', ar: 'عودة لطلبات السيارات' })}</Link>}
    ><CarRequestDetailSection reference={reference} /></AccountShell>
  )
}

function FavoritesSection() {
  const { locale } = useLocale()

  const favorites = useCustomerFavorites()
  const liveTours = useLiveTours(catalogTours)
  const saved = favorites.slugs.map((slug) => liveTours.find((tour) => tour.slug === slug)).filter((tour) => Boolean(tour))
  const recommendations = liveTours.filter((tour) => !favorites.has(tour.slug)).slice(0, 6)
  const savedPaging = usePagination(saved)
  if (favorites.loading) {
    return <div className="customer-inline-empty" role="status"><Clock3 size={20} /><span><strong>{tx(locale, { en: 'Loading saved trips…', es: 'Cargando los viajes guardados…', it: 'Caricamento viaggi salvati…', ar: 'جارٍ تحميل الرحلات المحفوظة…' })}</strong></span></div>
  }
  return <div className="customer-favorites-page">{saved.length > 0 && <section className="customer-account-block"><header><div><span>{tx(locale, { en: 'Your shortlist', es: 'Tus guardados', it: 'I tuoi salvati', ar: 'قائمتك' })}</span><h2>{tx(locale, { en: 'Saved for comparison', es: 'Guardados para comparar', it: 'Salvati per confrontare', ar: 'محفوظة للمقارنة' })}</h2></div><small>{saved.length} {tx(locale, { en: 'trips', es: 'viajes', it: 'viaggi', ar: 'رحلات' })}</small></header><div className="customer-saved-grid">{savedPaging.pageRows.map((tour) => tour && <MiniTour key={tour.slug} tour={tour} />)}</div><CustomerPagination page={savedPaging.page} pageCount={savedPaging.pageCount} onPage={savedPaging.setPage} pageSize={savedPaging.pageSize} onPageSize={savedPaging.setPageSize} from={savedPaging.from} to={savedPaging.to} total={savedPaging.total} /></section>}<section className="customer-account-block"><header><div><span>{saved.length ? (tx(locale, { en: 'More ideas', es: 'Más ideas', it: 'Altre idee', ar: 'أفكار إضافية' })) : (tx(locale, { en: 'Start your shortlist', es: 'Empieza tu lista', it: 'Inizia la tua lista', ar: 'ابدأ قائمتك' }))}</span><h2>{tx(locale, { en: 'Trips you may like', es: 'Viajes que te pueden gustar', it: 'Viaggi che potrebbero piacerti', ar: 'رحلات قد تعجبك' })}</h2></div></header><div className="customer-saved-grid">{recommendations.map((tour) => <MiniTour key={tour.slug} tour={tour} />)}</div></section></div>
}

async function apiPaymentList(): Promise<Payment[]> {
  const res = await fetch('/api/account/payments', { credentials: 'same-origin' })
  if (!res.ok) throw new Error('Could not load your payments.')
  const data = (await res.json()) as { payments?: Payment[] }
  if (!Array.isArray(data.payments)) throw new Error('Could not load your payments.')
  return data.payments
}

async function apiPaymentInitiate(bookingReference: string): Promise<Payment> {
  const res = await fetch('/api/account/payments', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ bookingReference }),
  })
  const data = (await res.json()) as Payment & { error?: string }
  if (!res.ok) throw new Error(data.error || 'Could not initiate the payment.')
  return data
}

/**
 * Customer payments (Phase 2F-A). Real database-backed payment
 * records from `/api/account/payments` — never booking-derived
 * previews. Initiation creates a PENDING record awaiting provider
 * handoff; no gateway exists yet, so no card form is ever shown.
 */
function PaymentsSection() {
  const { locale, currency } = useLocale()

  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [filter, setFilter] = useState<'all' | Payment['status']>('all')
  useEffect(() => {
    let cancelled = false
    apiPaymentList()
      .then((rows) => { if (!cancelled) { setPayments(rows); setLoading(false) } })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Could not load your payments.')
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [])
  const visible = filter === 'all' ? payments : payments.filter((payment) => payment.status === filter)
  const collected = payments.filter((payment) => payment.status === 'paid' || payment.status === 'partially_refunded' || payment.status === 'refunded').reduce((sum, payment) => sum + payment.amountPaid, 0)
  const awaiting = payments.filter((payment) => payment.status === 'pending' || payment.status === 'processing').reduce((sum, payment) => sum + payment.amount, 0)
  const paging = usePagination(visible)
  return <><div className="customer-payment-summary"><Metric Icon={CheckCircle2} value={formatPrice(collected, currency, locale)} label={tx(locale, { en: 'Paid', es: 'Pagado', it: 'Pagato', ar: 'تم دفعه' })} note={tx(locale, { en: 'Confirmed payments', es: 'Pagos confirmados', it: 'Pagamenti confermati', ar: 'مدفوعات مؤكدة' })} tone="green" /><Metric Icon={Clock3} value={formatPrice(awaiting, currency, locale)} label={tx(locale, { en: 'Unpaid', es: 'Sin pagar', it: 'Non pagato', ar: 'غير مدفوع' })} note={tx(locale, { en: 'No charge is made online', es: 'No se realiza ningún cargo en línea', it: 'Nessun addebito online', ar: 'لا يتم الخصم عبر الإنترنت' })} tone="orange" /><Metric Icon={ReceiptText} value={payments.length} label={tx(locale, { en: 'Records', es: 'Registros', it: 'Registrazioni', ar: 'السجلات' })} note={tx(locale, { en: 'Real payment attempts', es: 'Intentos de pago reales', it: 'Tentativi di pagamento reali', ar: 'محاولات دفع حقيقية' })} tone="blue" /></div><section className="customer-account-block customer-full-block"><header><div><span>{tx(locale, { en: 'Payment history', es: 'Historial de pagos', it: 'Cronologia pagamenti', ar: 'السجل المالي' })}</span><h2>{tx(locale, { en: 'Payments and payment status', es: 'Pagos y estado de pagos', it: 'Pagamenti e stato pagamenti', ar: 'المدفوعات وحالتها' })}</h2></div><ShieldCheck size={20} /></header><div className="customer-filterbar"><div role="tablist" aria-label={tx(locale, { en: 'Filter payments', es: 'Filtrar pagos', it: 'Filtra pagamenti', ar: 'فلترة المدفوعات' })}>{(['all', 'pending', 'processing', 'paid', 'failed', 'cancelled', 'refunded', 'partially_refunded'] as const).map((status) => <button type="button" key={status} className={filter === status ? 'active' : ''} onClick={() => setFilter(status)}>{status === 'all' ? (tx(locale, { en: 'All', es: 'Todos', it: 'Tutti', ar: 'الكل' })) : paymentStatusLabel(status, locale)}</button>)}</div><Link href="/trips"><Plus size={16} />{tx(locale, { en: 'Book a trip', es: 'Reservar un viaje', it: 'Prenota un viaggio', ar: 'احجز رحلة' })}</Link></div>{loading ? <div className="customer-inline-empty" role="status"><Clock3 size={20} /><span><strong>{tx(locale, { en: 'Loading payments…', es: 'Cargando los pagos…', it: 'Caricamento pagamenti…', ar: 'جارٍ تحميل المدفوعات…' })}</strong></span></div>
      : loadError && !payments.length ? <EmptyState Icon={ReceiptText} title={tx(locale, { en: 'Could not load payments', es: 'No se pudieron cargar los pagos', it: 'Impossibile caricare i pagamenti', ar: 'تعذر تحميل المدفوعات' })} copy={loadError} href="/account/bookings" action={tx(locale, { en: 'Back to bookings', es: 'Volver a las reservas', it: 'Torna alle prenotazioni', ar: 'عودة للحجوزات' })} />
      : visible.length ? <><div className="customer-table-wrap"><table className="customer-table">
        <thead><tr><th>#</th><th>{tx(locale, { en: 'Reference', es: 'Referencia', it: 'Riferimento', ar: 'المرجع' })}</th><th>{tx(locale, { en: 'Booking', es: 'Reserva', it: 'Prenotazione', ar: 'الحجز' })}</th><th>{tx(locale, { en: 'Initiated', es: 'Iniciado', it: 'Avviato', ar: 'تاريخ الإنشاء' })}</th><th>{tx(locale, { en: 'Status', es: 'Estado', it: 'Stato', ar: 'الحالة' })}</th><th>{tx(locale, { en: 'Amount', es: 'Importe', it: 'Importo', ar: 'المبلغ' })}</th><th></th></tr></thead>
        <tbody>{paging.pageRows.map((payment, index) => (
          <tr key={payment.reference}>
            <td className="customer-row-number">{paging.from + index}</td>
            <td><strong>{payment.reference}</strong></td>
            <td><Link href={'/account/bookings/detail?ref=' + encodeURIComponent(payment.bookingReference)}>{payment.bookingReference}</Link></td>
            <td>{new Date(payment.initiatedAt).toLocaleDateString(locale === 'ar' ? 'ar-EG' : locale === 'es' ? 'es-ES' : locale === 'it' ? 'it-IT' : 'en-GB')}</td>
            <td><span className={`customer-payment-state ${payment.status}`}>{paymentStatusLabel(payment.status, locale)}</span></td>
            <td><strong>{formatPrice(payment.amount, currency, locale)}</strong></td>
            <td><span className="customer-table-actions">
              <Link href={'/account/payments/detail?ref=' + encodeURIComponent(payment.reference)} aria-label={tx(locale, { en: 'View payment', es: 'Ver el pago', it: 'Vedi pagamento', ar: 'عرض الدفع' })} title={tx(locale, { en: 'View payment', es: 'Ver el pago', it: 'Vedi pagamento', ar: 'عرض الدفع' })}><Eye size={16} /></Link>
            </span></td>
          </tr>
        ))}</tbody>
      </table></div><CustomerPagination page={paging.page} pageCount={paging.pageCount} onPage={paging.setPage} pageSize={paging.pageSize} onPageSize={paging.setPageSize} from={paging.from} to={paging.to} total={paging.total} /></> : <EmptyState Icon={ReceiptText} title={payments.length ? (tx(locale, { en: 'No records in this view', es: 'Sin registros en esta vista', it: 'Nessuna registrazione in questa vista', ar: 'لا توجد سجلات في هذه الحالة' })) : (tx(locale, { en: 'No payment records yet', es: 'Aún no hay registros de pago', it: 'Ancora nessuna registrazione di pagamento', ar: 'لا توجد مدفوعات بعد' }))} copy={payments.length ? (tx(locale, { en: 'Try a different status from the filter above.', es: 'Prueba con otro estado del filtro.', it: 'Prova un altro stato dal filtro qui sopra.', ar: 'جرب حالة مختلفة من الفلتر بالأعلى.' })) : (tx(locale, { en: 'Payment attempts will appear here once you start one from a booking.', es: 'Los intentos de pago aparecerán aquí cuando inicies uno desde una reserva.', it: 'I tentativi di pagamento appariranno qui dopo averne avviato uno da una prenotazione.', ar: 'ستظهر محاولات الدفع هنا بمجرد بدء واحدة من الحجز.' }))} href="/account/bookings" action={tx(locale, { en: 'View my bookings', es: 'Ver mis reservas', it: 'Vedi le mie prenotazioni', ar: 'عرض حجوزاتي' })} />}</section></>
}

async function apiPaymentDetail(reference: string): Promise<Payment> {
  const res = await fetch(`/api/account/payments/${encodeURIComponent(reference)}`, { credentials: 'same-origin' })
  const data = (await res.json()) as Payment & { error?: string }
  if (!res.ok) throw new Error(data.error || 'Payment not found.')
  return data
}

/**
 * Customer payment detail (Phase 2F-A). Database-backed record owned
 * by the signed-in customer, fetched from `/api/account/payments/*`.
 * Shows the real payment lifecycle state honestly: a pending payment
 * means nothing has been charged and no provider is connected yet.
 * Internal payment events never reach this UI — the customer
 * serializer excludes them.
 */
function PaymentDetailSection({ reference }: { reference: string }) {
  const { locale, currency } = useLocale()

  const [payment, setPayment] = useState<Payment | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError('')
    apiPaymentDetail(reference)
      .then((row) => { if (!cancelled) { setPayment(row); setLoading(false) } })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Payment not found.')
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [reference])

  if (loading) {
    return <div className="customer-inline-empty" role="status"><Clock3 size={20} /><span><strong>{tx(locale, { en: 'Loading payment…', ar: 'جارٍ تحميل الدفع…' })}</strong></span></div>
  }

  if (!payment) {
    return <EmptyState Icon={ReceiptText} title={tx(locale, { en: 'Payment not found', ar: 'الدفع غير موجود' })} copy={loadError || (tx(locale, { en: 'It may belong to a different account.', ar: 'ربما يتبع حسابًا مختلفًا.' }))} href="/account/payments" action={tx(locale, { en: 'Back to payments', ar: 'عودة للمدفوعات' })} />
  }

  const fmtDateTime = (iso: string | null) => (iso ? new Date(iso).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US') : '—')
  const isPending = payment.status === 'pending' || payment.status === 'processing'

  return <>
    <section className="customer-account-block">
      <header><div><span>{payment.reference}</span><h2>{tx(locale, { en: 'Payment details', ar: 'تفاصيل الدفع' })}</h2></div><span className={`customer-payment-state ${payment.status}`}>{paymentStatusLabel(payment.status, locale)}</span></header>
      <div className="customer-detail-grid">
        <div><small>{tx(locale, { en: 'Amount due', ar: 'المبلغ المستحق' })}</small><strong>{formatPrice(payment.amount, currency, locale)}</strong></div>
        <div><small>{tx(locale, { en: 'Amount paid', ar: 'المدفوع' })}</small><strong>{formatPrice(payment.amountPaid, currency, locale)}</strong></div>
        <div><small>{tx(locale, { en: 'Payment status', ar: 'حالة الدفع' })}</small><strong>{paymentStatusLabel(payment.status, locale)}</strong></div>
        <div><small>{tx(locale, { en: 'Related booking', ar: 'الحجز المرتبط' })}</small><strong><Link href={'/account/bookings/detail?ref=' + encodeURIComponent(payment.bookingReference)}>{payment.bookingReference}</Link></strong></div>
        <div><small>{tx(locale, { en: 'Initiated', ar: 'تاريخ الإنشاء' })}</small><strong>{fmtDateTime(payment.initiatedAt)}</strong></div>
        {payment.amountRefunded > 0 && <div><small>{tx(locale, { en: 'Amount refunded', ar: 'المسترد' })}</small><strong>{formatPrice(payment.amountRefunded, currency, locale)}</strong></div>}
        {payment.paidAt && <div><small>{tx(locale, { en: 'Paid on', ar: 'تاريخ الدفع' })}</small><strong>{fmtDateTime(payment.paidAt)}</strong></div>}
        {payment.failedAt && <div><small>{tx(locale, { en: 'Failed on', ar: 'تاريخ الفشل' })}</small><strong>{fmtDateTime(payment.failedAt)}</strong></div>}
        {payment.cancelledAt && <div><small>{tx(locale, { en: 'Cancelled on', ar: 'تاريخ الإلغاء' })}</small><strong>{fmtDateTime(payment.cancelledAt)}</strong></div>}
        {payment.refundedAt && <div><small>{tx(locale, { en: 'Refunded on', ar: 'تاريخ الاسترداد' })}</small><strong>{fmtDateTime(payment.refundedAt)}</strong></div>}
        <div><small>{tx(locale, { en: 'Payment method', ar: 'طريقة الدفع' })}</small><strong>{payment.provider === 'pending' ? (tx(locale, { en: 'Online payment — coming soon', ar: 'الدفع الإلكتروني — قريبًا' })) : payment.provider}{payment.providerPaymentId ? ` · ${payment.providerPaymentId}` : ''}</strong></div>
      </div>
      {isPending && <p role="status" className="form-note">{tx(locale, { en: `This payment is pending: ${formatPrice(payment.amount, currency, locale)} is awaiting payment. Nothing has been charged — the online provider handoff is not connected yet.`, ar: `هذا الدفع معلق: مبلغ ${formatPrice(payment.amount, currency, locale)} بانتظار الدفع. لم يتم خصم أي مبلغ — ربط مزود الدفع الإلكتروني غير متاح بعد.` })}</p>}
      <div className="customer-detail-actions">
        <Link href={'/account/bookings/detail?ref=' + encodeURIComponent(payment.bookingReference)} className="account-icon-action"><Eye size={16} />{tx(locale, { en: 'View related booking', ar: 'عرض الحجز المرتبط' })}</Link>
        <Link href="/account/payments" className="account-icon-action"><ArrowLeft size={16} />{tx(locale, { en: 'Back to payments', ar: 'عودة للمدفوعات' })}</Link>
      </div>
    </section>

    {payment.events.length > 0 && (
      <section className="customer-activity" aria-label={tx(locale, { en: 'Payment activity', ar: 'سجل الدفع' })}>
        <h3>{tx(locale, { en: 'Activity', ar: 'السجل' })}</h3>
        <ul>{payment.events.map((e, i) => <li key={`${e.at}-${i}`}><span>{new Date(e.at).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US')}</span><strong>{paymentActivityLabel(e.action, locale)}</strong>{e.note && <small>{e.note}</small>}</li>)}</ul>
      </section>
    )}
  </>
}

export function PaymentDetailPage({ reference }: { reference: string }) {
  return <LocaleProvider><AccountShell section="payments"><PaymentDetailSection reference={reference} /></AccountShell></LocaleProvider>
}

function MessagesSection() {
  const { locale } = useLocale()

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
      setDraft(locale === 'es' ? `Hola, tengo una pregunta sobre la reserva ${pending.reference}${pending.title ? ` (${pending.title})` : ''}: ` : locale === 'it' ? `Ciao, ho una domanda sulla prenotazione ${pending.reference}${pending.title ? ` (${pending.title})` : ''}: ` : locale === 'ar' ? `مرحبا، عندي سؤال عن الحجز ${pending.reference}${pending.title ? ` (${pending.title})` : ''}: ` : `Hi, I have a question about booking ${pending.reference}${pending.title ? ` (${pending.title})` : ''}: `)
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
      setFileError(tx(locale, { en: 'Attachments must be smaller than 1.5 MB.', es: 'Los adjuntos deben ser menores de 1,5 MB.', it: 'Gli allegati devono essere inferiori a 1,5 MB.', ar: 'الحد الأقصى للمرفق 1.5 ميجابايت.' }))
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
        <div><strong>{tx(locale, { en: 'STAR PYRAMIDS travel team', es: 'Equipo de viajes de STAR PYRAMIDS', it: 'Team viaggi STAR PYRAMIDS', ar: 'فريق رحلات STAR PYRAMIDS' })}</strong><small><i />{tx(locale, { en: 'Account and booking support', es: 'Asistencia con tu cuenta y reservas', it: 'Assistenza account e prenotazioni', ar: 'دعم حسابك وحجوزاتك' })}</small></div>
        <span className="customer-chat-channel"><MessageCircle size={14} />{tx(locale, { en: 'Account chat', es: 'Chat de la cuenta', it: 'Chat account', ar: 'محادثة الحساب' })}</span>
      </header>

      <div className="customer-chat-body" ref={bodyRef} aria-live="polite">
        {!messages.length && <div className="customer-chat-welcome"><span><MessageCircle size={25} /></span><h2>{locale === 'es' ? `Hola ${profile.fullName.split(' ')[0]}` : locale === 'it' ? `Ciao ${profile.fullName.split(' ')[0]}` : locale === 'ar' ? `أهلًا ${profile.fullName.split(' ')[0]}` : `Hi ${profile.fullName.split(' ')[0]}`}</h2><p>{tx(locale, { en: 'Ask about a booking, pricing, or trip details. The team reply will stay here in this conversation.', es: 'Pregunta por una reserva, precios o detalles del viaje. La respuesta del equipo quedará aquí, en esta conversación.', it: 'Chiedi info su una prenotazione, prezzi o dettagli del viaggio. La risposta del team resterà qui in questa conversazione.', ar: 'اكتب سؤالك عن الحجز أو الأسعار أو تفاصيل رحلتك، وسيظهر الرد هنا في نفس المحادثة.' })}</p><div>{(locale === 'es' ? ['Quiero seguir mi reserva', 'Quiero cambiar la fecha de mi viaje', 'Tengo una pregunta sobre un pago'] : locale === 'it' ? ['Voglio seguire la mia prenotazione', 'Voglio cambiare la data del viaggio', 'Ho una domanda su un pagamento'] : locale === 'ar' ? ['أريد متابعة حجزي', 'أحتاج تعديل موعد الرحلة', 'لدي سؤال عن الدفع'] : ['Track my booking', 'Change my travel date', 'I have a payment question']).map((prompt) => <button type="button" key={prompt} onClick={() => setDraft(prompt)}>{prompt}</button>)}</div></div>}
        {messages.map((message) => <div key={message.id} className={`customer-chat-row ${message.sender}`}>
          {message.sender === 'agent' && <span className="customer-chat-bubble-avatar"><img src="/favicon.png" alt="" /></span>}
          <div>
            <span className="customer-chat-bubble">
              {message.text && <p>{message.text}</p>}
              {message.attachment && <a href={message.attachment.url} download={message.attachment.name}><FileText size={17} /><span><strong>{message.attachment.name}</strong><small>{Math.max(1, Math.round(message.attachment.size / 1024))} KB</small></span></a>}
            </span>
            <small className="customer-chat-time">{new Date(message.createdAt).toLocaleTimeString(locale === 'ar' ? 'ar-EG' : locale === 'es' ? 'es-ES' : locale === 'it' ? 'it-IT' : 'en-GB', { hour: '2-digit', minute: '2-digit' })}{message.sender === 'customer' && <CheckCheck size={13} aria-label={message.readByAdmin ? (tx(locale, { en: 'Seen', es: 'Visto', it: 'Visualizzato', ar: 'مقروءة' })) : (tx(locale, { en: 'Sent', es: 'Enviado', it: 'Inviato', ar: 'تم الإرسال' }))} />}</small>
          </div>
        </div>)}
      </div>

      {attachment && <div className="customer-chat-attachment"><FileText size={17} /><span><strong>{attachment.name}</strong><small>{Math.max(1, Math.round(attachment.size / 1024))} KB</small></span><button type="button" onClick={() => setAttachment(undefined)} aria-label={tx(locale, { en: 'Remove attachment', es: 'Quitar el adjunto', it: 'Rimuovi allegato', ar: 'إزالة المرفق' })}><X size={15} /></button></div>}
      {fileError && <p className="customer-chat-error">{fileError}</p>}
      <form className="customer-chat-composer" onSubmit={(event) => { event.preventDefault(); send() }}>
        <label title={tx(locale, { en: 'Attach file', es: 'Adjuntar archivo', it: 'Allega file', ar: 'إرفاق ملف' })}><Paperclip size={18} /><input type="file" accept="image/*,.pdf,.doc,.docx" onChange={chooseAttachment} disabled={Boolean(impersonated)} /></label>
        <textarea rows={1} value={draft} disabled={Boolean(impersonated)} onChange={(event) => setDraft(event.target.value)} onKeyDown={keyDown} placeholder={impersonated ? (tx(locale, { en: 'Sending is disabled during staff preview', es: 'El envío está desactivado durante la vista previa del personal', it: 'Invio disabilitato durante l’anteprima staff', ar: 'الإرسال متوقف أثناء معاينة الموظفين' })) : (tx(locale, { en: 'Write a message...', es: 'Escribe un mensaje…', it: 'Scrivi un messaggio…', ar: 'اكتب رسالتك...' }))} />
        <button type="submit" disabled={Boolean(impersonated) || (!draft.trim() && !attachment)} aria-label={tx(locale, { en: 'Send message', es: 'Enviar mensaje', it: 'Invia messaggio', ar: 'إرسال الرسالة' })}><Send size={18} /></button>
      </form>
    </section>

    <aside className="customer-chat-context">
      <section className="customer-account-block">
        <header><div><span>{tx(locale, { en: 'Conversation context', es: 'Contexto de la conversación', it: 'Contesto conversazione', ar: 'عن المحادثة' })}</span><h2>{tx(locale, { en: 'Trip support', es: 'Asistencia de viaje', it: 'Assistenza viaggio', ar: 'مساعدة الرحلة' })}</h2></div><ShieldCheck size={19} /></header>
        <div className="customer-chat-profile"><CustomerAvatar avatar={profile.avatar} initials={profile.fullName.slice(0, 2).toUpperCase()} className="customer-profile-avatar" name={profile.fullName} /><div><strong>{profile.fullName}</strong><small>{profile.email}</small></div></div>
        {latestBooking ? <Link href="/account/bookings" className="customer-chat-booking"><span><ShoppingBag size={16} /></span><div><small>{tx(locale, { en: 'Latest booking', es: 'Última reserva', it: 'Ultima prenotazione', ar: 'الحجز المرتبط' })}</small><strong>{latestBooking.reference}</strong></div><ChevronRight size={16} /></Link> : <Link href="/trips" className="customer-chat-booking"><span><Plus size={16} /></span><div><small>{tx(locale, { en: 'No current booking', es: 'Sin reserva actual', it: 'Nessuna prenotazione attiva', ar: 'لا يوجد حجز حالي' })}</small><strong>{tx(locale, { en: 'Explore trips', es: 'Explorar viajes', it: 'Esplora i viaggi', ar: 'استكشف الرحلات' })}</strong></div><ChevronRight size={16} /></Link>}
        <dl className="customer-chat-summary"><div><dt>{tx(locale, { en: 'Chat messages', es: 'Mensajes del chat', it: 'Messaggi chat', ar: 'رسائل المحادثة' })}</dt><dd>{messages.length}</dd></div><div><dt>{tx(locale, { en: 'Previous enquiries', es: 'Consultas anteriores', it: 'Richieste precedenti', ar: 'استفسارات سابقة' })}</dt><dd>{inquiries.length}</dd></div></dl>
      </section>
      <section className="customer-account-block customer-chat-alternative"><span><WhatsAppGlyph size={20} /></span><h2>{tx(locale, { en: 'Prefer WhatsApp?', es: '¿Prefieres WhatsApp?', it: 'Preferisci WhatsApp?', ar: 'تحتاج واتساب؟' })}</h2><p>{tx(locale, { en: 'Use the official number when you need another channel.', es: 'Usa el número oficial cuando necesites otro canal.', it: 'Usa il numero ufficiale se ti serve un altro canale.', ar: 'استخدم الرقم الرسمي إذا احتجت قناة بديلة.' })}</p><a href={whatsappHref(brand.whatsapp)} target="_blank" rel="noreferrer">WhatsApp <ArrowRight size={15} /></a><small>{brand.whatsapp}</small></section>
    </aside>
  </div>
}


function PersonalProfileSection() {
  const router = useRouter()
  const { locale } = useLocale()

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
      setAvatarError(tx(locale, { en: 'Choose an image smaller than 2 MB.', es: 'Elige una imagen de menos de 2 MB.', it: 'Scegli un’immagine inferiore a 2 MB.', ar: 'اختر صورة بحجم أقل من 2 ميجابايت.' }))
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
        setSaveError(data.error || (tx(locale, { en: 'Could not save your profile.', es: 'No se pudo guardar tu perfil.', it: 'Impossibile salvare il profilo.', ar: 'تعذر حفظ الملف الشخصي.' })))
        return
      }
      saveCustomerProfile(form)
      setSaved(true)
      router.refresh()
    } catch {
      setSaveError(tx(locale, { en: 'Could not save your profile.', es: 'No se pudo guardar tu perfil.', it: 'Impossibile salvare il profilo.', ar: 'تعذر حفظ الملف الشخصي.' }))
    } finally {
      setSaving(false)
    }
  }
  const displayName = `${form.firstName} ${form.lastName}`.trim()
  const initials = [form.firstName, form.lastName].filter(Boolean).map((part) => part[0]).join('').toUpperCase() || 'SP'
  const [phoneCountry, setPhoneCountry] = useState(defaultCountry.code)

  return <form className="customer-profile-form customer-profile-only" onSubmit={submit}>
    <section className="customer-account-block">
      <header><div><span>{tx(locale, { en: 'Personal details', es: 'Datos personales', it: 'Dati personali', ar: 'البيانات الشخصية' })}</span><h2>{tx(locale, { en: 'Account information', es: 'Información de la cuenta', it: 'Informazioni account', ar: 'معلومات الحساب' })}</h2></div>{saved && <span className="customer-saved-notice"><Check size={14} />{tx(locale, { en: 'Saved', es: 'Guardado', it: 'Salvato', ar: 'تم الحفظ' })}</span>}</header>
      <div className="customer-avatar-editor">
        <CustomerAvatar avatar={form.avatar} initials={initials} className="customer-profile-avatar" name={displayName} />
        <div><strong>{tx(locale, { en: 'Profile photo', es: 'Foto de perfil', it: 'Foto profilo', ar: 'صورة الحساب' })}</strong><small>{tx(locale, { en: 'JPG or PNG up to 2 MB', es: 'JPG o PNG de hasta 2 MB', it: 'JPG o PNG fino a 2 MB', ar: 'JPG أو PNG حتى 2 ميجابايت' })}</small>{avatarError && <em>{avatarError}</em>}</div>
        <label aria-label={tx(locale, { en: 'Change profile photo', es: 'Cambiar la foto de perfil', it: 'Cambia la foto profilo', ar: 'تغيير صورة الحساب' })}><ImagePlus size={16} />{tx(locale, { en: 'Change photo', es: 'Cambiar foto', it: 'Cambia foto', ar: 'تغيير الصورة' })}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={changeAvatar} aria-label={tx(locale, { en: 'Change profile photo', es: 'Cambiar la foto de perfil', it: 'Cambia la foto profilo', ar: 'تغيير صورة الحساب' })} /></label>
        {form.avatar && <button type="button" onClick={() => { update('avatar', ''); setAvatarError('') }} aria-label={tx(locale, { en: 'Remove photo', es: 'Quitar la foto', it: 'Rimuovi foto', ar: 'حذف الصورة' })} title={tx(locale, { en: 'Remove photo', es: 'Quitar la foto', it: 'Rimuovi foto', ar: 'حذف الصورة' })}><Trash2 size={16} /></button>}
      </div>
      <div className="customer-form-grid">
        <label>{tx(locale, { en: 'First name', es: 'Nombre', it: 'Nome', ar: 'الاسم الأول' })}<input required autoComplete="given-name" value={form.firstName} onChange={(event) => update('firstName', event.target.value)} /></label>
        <label>{tx(locale, { en: 'Last name', es: 'Apellidos', it: 'Cognome', ar: 'اسم العائلة' })}<input required autoComplete="family-name" value={form.lastName} onChange={(event) => update('lastName', event.target.value)} /></label>
        <label>{tx(locale, { en: 'Username', es: 'Nombre de usuario', it: 'Nome utente', ar: 'اسم المستخدم' })}<input required dir="ltr" value={form.username} onChange={(event) => update('username', event.target.value.replace(/[^A-Za-z0-9_]/g, ''))} /></label>
        <label>{tx(locale, { en: 'Email address', es: 'Correo electrónico', it: 'Indirizzo email', ar: 'البريد الإلكتروني' })}<input required readOnly type="email" dir="ltr" value={form.email} /></label>
        <label>{tx(locale, { en: 'Country', es: 'País', it: 'Paese', ar: 'الدولة' })}<CountrySelect value={form.country} onChange={(code) => { const next = countries.find((country) => country.code === code) ?? defaultCountry; setForm((previous) => ({ ...previous, country: next.code, dialCode: next.dialCode })); setPhoneCountry(code); setSaved(false) }} locale={locale} /></label>
        <label>{tx(locale, { en: 'Phone number', es: 'Número de teléfono', it: 'Numero di telefono', ar: 'رقم الهاتف' })}<InternationalPhoneInput value={form.phone} onChange={(value) => { update('phone', value); setSaved(false) }} locale={locale} countryCode={phoneCountry} onCountryChange={setPhoneCountry} placeholder={tx(locale, { en: 'Phone number', es: 'Número de teléfono', it: 'Numero di telefono', ar: 'رقم الهاتف' })} /></label>
      </div>
    </section>
    {saveError && <p className="form-error" role="alert">{saveError}</p>}
    <div className="customer-profile-actions"><button type="submit" disabled={saving}>{saving ? (tx(locale, { en: 'Saving...', es: 'Guardando…', it: 'Salvataggio…', ar: 'جارٍ الحفظ...' })) : (tx(locale, { en: 'Save profile', es: 'Guardar perfil', it: 'Salva profilo', ar: 'حفظ الملف الشخصي' }))}</button><button type="button" onClick={reset} disabled={saving}>{tx(locale, { en: 'Discard changes', es: 'Descartar cambios', it: 'Annulla modifiche', ar: 'إلغاء التعديلات' })}</button></div>
  </form>
}

function SettingsSection() {
  const { locale, setLocale, currency, setCurrency } = useLocale()

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
        <header><div><span>{tx(locale, { en: 'Preferences', es: 'Preferencias', it: 'Preferenze', ar: 'التفضيلات' })}</span><h2>{tx(locale, { en: 'Language & currency', es: 'Idioma y moneda', it: 'Lingua e valuta', ar: 'اللغة والعملة' })}</h2></div><Globe2 size={19} /></header>
        <div className="customer-settings-selects">
          <label>{tx(locale, { en: 'Preferred language', es: 'Idioma preferido', it: 'Lingua preferita', ar: 'اللغة المفضلة' })}<SharedSelect value={form.preferredLanguage} onChange={(next) => update('preferredLanguage', next as EnabledLocale)} locale={locale} options={ENABLED_LOCALES.map((value) => ({ value, label: LOCALE_LABELS[value] }))} /></label>
          <label>{tx(locale, { en: 'Display currency', es: 'Moneda de visualización', it: 'Valuta di visualizzazione', ar: 'عملة العرض' })}<SharedSelect value={selectedCurrency} onChange={(next) => { setSelectedCurrency(next as typeof currency); setSaved(false) }} locale={locale} options={[{ value: 'USD', label: 'USD' }, { value: 'EUR', label: 'EUR' }, { value: 'EGP', label: 'EGP' }]} /></label>
        </div>
      </section>
      <section className="customer-account-block">
        <header><div><span>{tx(locale, { en: 'Notifications', es: 'Notificaciones', it: 'Notifiche', ar: 'التنبيهات' })}</span><h2>{tx(locale, { en: 'How we keep you updated', es: 'Cómo te mantenemos al día', it: 'Come ti teniamo aggiornato', ar: 'كيف نبقيك على اطلاع' })}</h2></div><Bell size={19} /></header>
        <label className="customer-switch-row"><span><strong>{tx(locale, { en: 'Booking updates', es: 'Actualizaciones de reservas', it: 'Aggiornamenti prenotazioni', ar: 'تحديثات الحجوزات' })}</strong><small>{tx(locale, { en: 'Confirmations, schedule changes, and pickup details.', es: 'Confirmaciones, cambios de horario y datos de recogida.', it: 'Conferme, cambi di programma e dettagli del prelievo.', ar: 'التأكيدات وتغييرات المواعيد وتفاصيل الاستلام.' })}</small></span><input type="checkbox" checked={form.bookingUpdates} onChange={(event) => update('bookingUpdates', event.target.checked)} /></label>
        <label className="customer-switch-row"><span><strong>{tx(locale, { en: 'Trip reminders', es: 'Recordatorios de viaje', it: 'Promemoria viaggio', ar: 'تذكيرات الرحلة' })}</strong><small>{tx(locale, { en: 'Timely reminders for departures and required documents.', es: 'Recordatorios puntuales de salidas y documentos necesarios.', it: 'Promemoria puntuali per partenze e documenti richiesti.', ar: 'تذكيرات قبل الرحلة بالمواعيد والمستندات المهمة.' })}</small></span><input type="checkbox" checked={form.tripReminders} onChange={(event) => update('tripReminders', event.target.checked)} /></label>
        <label className="customer-switch-row"><span><strong>{tx(locale, { en: 'Payment & receipt updates', es: 'Actualizaciones de pagos y recibos', it: 'Aggiornamenti pagamenti e ricevute', ar: 'تحديثات الدفع والإيصالات' })}</strong><small>{tx(locale, { en: 'Payment status, confirmations, and new receipts.', es: 'Estado de pagos, confirmaciones y nuevos recibos.', it: 'Stato pagamenti, conferme e nuove ricevute.', ar: 'حالة الدفع والتأكيدات والإيصالات الجديدة.' })}</small></span><input type="checkbox" checked={form.paymentUpdates} onChange={(event) => update('paymentUpdates', event.target.checked)} /></label>
        <label className="customer-switch-row"><span><strong>{tx(locale, { en: 'Messages & support replies', es: 'Mensajes y respuestas de asistencia', it: 'Messaggi e risposte dell’assistenza', ar: 'ردود الرسائل والدعم' })}</strong><small>{tx(locale, { en: 'Notify me when the travel team sends a new reply.', es: 'Avísame cuando el equipo de viajes envíe una respuesta.', it: 'Avvisami quando il team viaggi invia una nuova risposta.', ar: 'تنبيه عند وصول رد جديد من فريق الرحلات.' })}</small></span><input type="checkbox" checked={form.messageReplies} onChange={(event) => update('messageReplies', event.target.checked)} /></label>
        <label className="customer-switch-row"><span><strong>{tx(locale, { en: 'Cart reminders', es: 'Recordatorios de la cesta', it: 'Promemoria carrello', ar: 'تذكيرات السلة' })}</strong><small>{tx(locale, { en: 'Remind me about trips waiting in my cart.', es: 'Recuérdame los viajes que esperan en mi cesta.', it: 'Ricordami i viaggi in attesa nel carrello.', ar: 'ذكّرني بالرحلات التي لم أكمل حجزها.' })}</small></span><input type="checkbox" checked={form.cartReminders} onChange={(event) => update('cartReminders', event.target.checked)} /></label>
        <label className="customer-switch-row"><span><strong>{tx(locale, { en: 'Saved trip updates', es: 'Actualizaciones de viajes guardados', it: 'Aggiornamenti viaggi salvati', ar: 'تحديثات الرحلات المحفوظة' })}</strong><small>{tx(locale, { en: 'Changes or offers related to trips I saved.', es: 'Cambios u ofertas relacionados con mis viajes guardados.', it: 'Modifiche o offerte relative ai viaggi salvati.', ar: 'تغييرات أو عروض تخص الرحلات التي حفظتها.' })}</small></span><input type="checkbox" checked={form.savedTripUpdates} onChange={(event) => update('savedTripUpdates', event.target.checked)} /></label>
        <label className="customer-switch-row"><span><strong>{tx(locale, { en: 'SMS updates', es: 'Actualizaciones por SMS', it: 'Aggiornamenti SMS', ar: 'رسائل SMS' })}</strong><small>{tx(locale, { en: 'Urgent travel updates sent to your saved phone number.', es: 'Avisos urgentes de viaje enviados a tu número guardado.', it: 'Aggiornamenti urgenti inviati al tuo numero salvato.', ar: 'تنبيهات عاجلة على رقم الهاتف المسجل.' })}</small></span><input type="checkbox" checked={form.smsUpdates} onChange={(event) => update('smsUpdates', event.target.checked)} /></label>
        <label className="customer-switch-row"><span><strong>{tx(locale, { en: 'Travel inspiration and offers', es: 'Inspiración de viaje y ofertas', it: 'Ispirazioni di viaggio e offerte', ar: 'أفكار وعروض السفر' })}</strong><small>{tx(locale, { en: 'Optional emails you can turn off at any time.', es: 'Correos opcionales que puedes desactivar cuando quieras.', it: 'Email facoltative che puoi disattivare in qualsiasi momento.', ar: 'رسائل اختيارية يمكنك إيقافها في أي وقت.' })}</small></span><input type="checkbox" checked={form.marketingEmails} onChange={(event) => update('marketingEmails', event.target.checked)} /></label>
        <label className="customer-switch-row customer-required-notification"><span><strong>{tx(locale, { en: 'Security alerts', es: 'Alertas de seguridad', it: 'Avvisi di sicurezza', ar: 'تنبيهات الأمان' })}</strong><small>{tx(locale, { en: 'New sign-ins, password changes, and important account activity.', es: 'Nuevos inicios de sesión, cambios de contraseña y actividad importante.', it: 'Nuovi accessi, cambi password e attività importanti.', ar: 'تسجيل دخول جديد وتغييرات كلمة المرور والنشاط المهم.' })}</small><em>{tx(locale, { en: 'Required for account security', es: 'Obligatorio para la seguridad', it: 'Obbligatorio per la sicurezza', ar: 'مطلوبة لحماية الحساب' })}</em></span><input type="checkbox" checked={form.securityAlerts} disabled readOnly /></label>
      </section>
    </div>
    <div className="customer-settings-column">
      <section className="customer-account-block">
        <header><div><span>{tx(locale, { en: 'Access & security', es: 'Acceso y seguridad', it: 'Accesso e sicurezza', ar: 'الدخول والأمان' })}</span><h2>{tx(locale, { en: 'Protect your account', es: 'Protege tu cuenta', it: 'Proteggi il tuo account', ar: 'حماية الحساب' })}</h2></div><LockKeyhole size={19} /></header>
        <div className="customer-settings-list">
          <div><span className="customer-setting-icon"><KeyRound size={17} /></span><div><strong>{tx(locale, { en: 'Password', es: 'Contraseña', it: 'Password', ar: 'كلمة المرور' })}</strong><small>{tx(locale, { en: 'Change your password inside your account.', es: 'Cambia tu contraseña desde tu cuenta.', it: 'Cambia la password dal tuo account.', ar: 'غيّر كلمة المرور من داخل حسابك.' })}</small></div><Link href="/account/change-password">{tx(locale, { en: 'Change', es: 'Cambiar', it: 'Cambia', ar: 'تغيير' })}</Link></div>
          <div><span className="customer-provider google">G</span><div><strong>Google</strong><small>{tx(locale, { en: 'Available after backend OAuth is connected.', es: 'Disponible cuando se conecte OAuth en el backend.', it: 'Disponibile dopo il collegamento OAuth di backend.', ar: 'سيعمل بعد ربط OAuth بالباك.' })}</small></div><span className="customer-backend-state">{tx(locale, { en: 'Backend required', es: 'Requiere backend', it: 'Backend richiesto', ar: 'يحتاج باك' })}</span></div>
          <div><span className="customer-provider facebook">f</span><div><strong>Facebook</strong><small>{tx(locale, { en: 'Available after backend OAuth is connected.', es: 'Disponible cuando se conecte OAuth en el backend.', it: 'Disponibile dopo il collegamento OAuth di backend.', ar: 'سيعمل بعد ربط OAuth بالباك.' })}</small></div><span className="customer-backend-state">{tx(locale, { en: 'Backend required', es: 'Requiere backend', it: 'Backend richiesto', ar: 'يحتاج باك' })}</span></div>
          <div><span className="customer-setting-icon"><Laptop size={17} /></span><div><strong>{tx(locale, { en: 'Sessions & devices', es: 'Sesiones y dispositivos', it: 'Sessioni e dispositivi', ar: 'الجلسات والأجهزة' })}</strong><small>{tx(locale, { en: 'Review signed-in devices and end a session.', es: 'Revisa los dispositivos conectados y cierra sesiones.', it: 'Rivedi i dispositivi collegati e termina una sessione.', ar: 'راجع الأجهزة المسجل منها الدخول وأنهِ أي جلسة.' })}</small></div><button type="button" disabled>{tx(locale, { en: 'Backend required', es: 'Requiere backend', it: 'Backend richiesto', ar: 'يحتاج باك' })}</button></div>
        </div>
      </section>
      <section className="customer-account-block">
        <header><div><span>{tx(locale, { en: 'Privacy & data', es: 'Privacidad y datos', it: 'Privacy e dati', ar: 'الخصوصية والبيانات' })}</span><h2>{tx(locale, { en: 'Your account data', es: 'Tus datos', it: 'I tuoi dati', ar: 'بيانات حسابك' })}</h2></div><ShieldCheck size={19} /></header>
        <div className="customer-settings-list">
          <div><span className="customer-setting-icon"><Download size={17} /></span><div><strong>{tx(locale, { en: 'Download account data', es: 'Descargar datos de la cuenta', it: 'Scarica i dati account', ar: 'تنزيل بيانات الحساب' })}</strong><small>{tx(locale, { en: 'Request a copy of your profile, bookings, and messages.', es: 'Solicita una copia de tu perfil, reservas y mensajes.', it: 'Richiedi una copia di profilo, prenotazioni e messaggi.', ar: 'اطلب نسخة من بياناتك وحجوزاتك ورسائلك.' })}</small></div><button type="button" disabled>{tx(locale, { en: 'Backend required', es: 'Requiere backend', it: 'Backend richiesto', ar: 'يحتاج باك' })}</button></div>
          <div className="danger"><span className="customer-setting-icon"><Trash2 size={17} /></span><div><strong>{tx(locale, { en: 'Delete account', es: 'Eliminar cuenta', it: 'Elimina account', ar: 'حذف الحساب' })}</strong><small>{tx(locale, { en: 'Identity confirmation is required before deletion.', es: 'Se requiere confirmar tu identidad antes de eliminar.', it: 'È richiesta la conferma dell’identità prima dell’eliminazione.', ar: 'يتطلب تأكيد الهوية قبل إرسال طلب الحذف.' })}</small></div><button type="button" disabled>{tx(locale, { en: 'Backend required', es: 'Requiere backend', it: 'Backend richiesto', ar: 'يحتاج باك' })}</button></div>
        </div>
      </section>
    </div>
    <div className="customer-profile-actions">{saved && <span className="customer-saved-notice"><Check size={14} />{tx(locale, { en: 'Saved', es: 'Guardado', it: 'Salvato', ar: 'تم الحفظ' })}</span>}<button type="submit">{tx(locale, { en: 'Save settings', es: 'Guardar ajustes', it: 'Salva impostazioni', ar: 'حفظ الإعدادات' })}</button><button type="button" onClick={reset}>{tx(locale, { en: 'Discard changes', es: 'Descartar cambios', it: 'Annulla modifiche', ar: 'إلغاء التعديلات' })}</button></div>
  </form>
}

function ChangePasswordSection() {
  const { locale } = useLocale()

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
      <header><div><span>{tx(locale, { en: 'Access & security', es: 'Acceso y seguridad', it: 'Accesso e sicurezza', ar: 'الدخول والأمان' })}</span><h2>{tx(locale, { en: 'Create a new password', es: 'Crea una contraseña nueva', it: 'Crea una nuova password', ar: 'أنشئ كلمة مرور جديدة' })}</h2></div><LockKeyhole size={19} /></header>
      <div className="customer-password-fields">
        <label>{tx(locale, { en: 'Current password', es: 'Contraseña actual', it: 'Password attuale', ar: 'كلمة المرور الحالية' })}<span><input required type={showCurrent ? 'text' : 'password'} autoComplete="current-password" value={currentPassword} onChange={(event) => { setCurrentPassword(event.target.value); setSubmitted(false) }} /><button type="button" onClick={() => setShowCurrent((visible) => !visible)} aria-label={showCurrent ? (tx(locale, { en: 'Hide password', es: 'Ocultar la contraseña', it: 'Nascondi password', ar: 'إخفاء كلمة المرور' })) : (tx(locale, { en: 'Show password', es: 'Mostrar la contraseña', it: 'Mostra password', ar: 'إظهار كلمة المرور' }))}>{showCurrent ? <EyeOff size={17} /> : <Eye size={17} />}</button></span></label>
        <label>{tx(locale, { en: 'New password', es: 'Contraseña nueva', it: 'Nuova password', ar: 'كلمة المرور الجديدة' })}<span><input required type={showNew ? 'text' : 'password'} autoComplete="new-password" value={newPassword} onChange={(event) => { setNewPassword(event.target.value); setSubmitted(false) }} /><button type="button" onClick={() => setShowNew((visible) => !visible)} aria-label={showNew ? (tx(locale, { en: 'Hide password', es: 'Ocultar la contraseña', it: 'Nascondi password', ar: 'إخفاء كلمة المرور' })) : (tx(locale, { en: 'Show password', es: 'Mostrar la contraseña', it: 'Mostra password', ar: 'إظهار كلمة المرور' }))}>{showNew ? <EyeOff size={17} /> : <Eye size={17} />}</button></span></label>
        <label>{tx(locale, { en: 'Confirm new password', es: 'Confirma la contraseña nueva', it: 'Conferma la nuova password', ar: 'تأكيد كلمة المرور الجديدة' })}<span><input required type={showNew ? 'text' : 'password'} autoComplete="new-password" value={confirmPassword} onChange={(event) => { setConfirmPassword(event.target.value); setSubmitted(false) }} /></span></label>
      </div>
      <div className="customer-password-rules" aria-live="polite">
        <span className={newPassword.length >= 8 ? 'valid' : ''}><Check size={14} />{tx(locale, { en: 'At least 8 characters', es: 'Al menos 8 caracteres', it: 'Almeno 8 caratteri', ar: '8 أحرف على الأقل' })}</span>
        <span className={/[A-Z]/.test(newPassword) ? 'valid' : ''}><Check size={14} />{tx(locale, { en: 'One uppercase letter', es: 'Una mayúscula', it: 'Una lettera maiuscola', ar: 'حرف إنجليزي كبير' })}</span>
        <span className={/[0-9]/.test(newPassword) ? 'valid' : ''}><Check size={14} />{tx(locale, { en: 'One number', es: 'Al menos un número', it: 'Almeno un numero', ar: 'رقم واحد على الأقل' })}</span>
        <span className={matches ? 'valid' : ''}><Check size={14} />{tx(locale, { en: 'Passwords match', es: 'Las contraseñas coinciden', it: 'Le password coincidono', ar: 'كلمتا المرور متطابقتان' })}</span>
      </div>
      {submitted && <div className="customer-password-ready"><CheckCircle2 size={17} /><div><strong>{tx(locale, { en: 'Password change is ready', es: 'El cambio de contraseña está listo', it: 'Modifica password pronta', ar: 'النموذج جاهز' })}</strong><small>{tx(locale, { en: 'The actual update will work after backend verification is connected.', es: 'La actualización real funcionará cuando se conecte la verificación del backend.', it: 'L’aggiornamento effettivo sarà attivo dopo il collegamento della verifica di backend.', ar: 'سيتم تنفيذ التغيير الفعلي بعد ربط التحقق بالباك.' })}</small></div></div>}
      <div className="customer-password-actions"><Link href="/account/settings">{tx(locale, { en: 'Back to settings', es: 'Volver a los ajustes', it: 'Torna alle impostazioni', ar: 'العودة للإعدادات' })}</Link><button type="submit" disabled={!canSubmit}>{tx(locale, { en: 'Update password', es: 'Actualizar la contraseña', it: 'Aggiorna password', ar: 'تحديث كلمة المرور' })}</button></div>
    </form>
    <aside className="customer-account-block customer-password-help"><span><ShieldCheck size={20} /></span><h2>{tx(locale, { en: 'Keep your account secure', es: 'Mantén segura tu cuenta', it: 'Mantieni sicuro il tuo account', ar: 'حافظ على أمان حسابك' })}</h2><p>{tx(locale, { en: 'Use a password you do not use elsewhere and never share it with anyone.', es: 'Usa una contraseña que no utilices en ningún otro sitio y no la compartas con nadie.', it: 'Usa una password che non usi altrove e non condividerla mai.', ar: 'استخدم كلمة مرور لا تستخدمها في أي حساب آخر، ولا تشاركها مع أي شخص.' })}</p><small>{tx(locale, { en: 'STAR PYRAMIDS staff will never ask for your password.', es: 'El equipo de STAR PYRAMIDS nunca te pedirá tu contraseña.', it: 'Lo staff di STAR PYRAMIDS non ti chiederà mai la password.', ar: 'لن يطلب فريق STAR PYRAMIDS كلمة مرورك.' })}</small></aside>
  </div>
}

export function CustomerAccountPage({ section = 'overview' }: { section?: AccountSection }) {
  return <LocaleProvider><AccountShell section={section}>{section === 'overview' ? <OverviewSection /> : section === 'bookings' ? <BookingsSection /> : section === 'car-requests' ? <CarRequestsSection /> : section === 'favorites' ? <FavoritesSection /> : section === 'payments' ? <PaymentsSection /> : section === 'messages' ? <MessagesSection /> : section === 'settings' ? <SettingsSection /> : section === 'change-password' ? <ChangePasswordSection /> : <PersonalProfileSection />}</AccountShell></LocaleProvider>
}
