'use client'

import { useVisibleBookings } from "../bookings/booking-sections"
import { NotificationPanel } from "./account-notifications"
import { CustomerAvatar } from "./account-ui"
import { useImpersonated, useAccountProfile, useVisibleInquiries } from "./account-hooks"
import { BrandMark } from "@/components/branding/brand-mark"
import { CURRENCY_OPTIONS, type Currency } from "@/lib/payments/currency"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { ArrowRight, Bell, CarFront, ChevronDown, ChevronRight, Compass, ExternalLink, Globe2, Heart, HelpCircle, LayoutDashboard, LogOut, Menu, MessageCircle, Search, Settings2, ShoppingBag, ShoppingCart, Ticket, UserRound, WalletCards, X } from "lucide-react"
import { tx, useLocale } from "@/components/locale"
import { catalogTours } from "@/data/tours"
import { localizeTourLocation } from "@/lib/tours/tour-format"
import { useCart } from "@/lib/booking/cart"
import { stopImpersonation } from "@/lib/admin-store"
import { useDbTours } from "@/lib/tours/tours-client"
import { useCustomerFavorites } from "@/lib/account/customer-account"
import { useCustomerNotifications } from "@/lib/account/customer-notifications"
import { useSupportChat } from "@/lib/support/support-chat"
import { SharedSelect } from "@/components/shared/forms/shared-select"
import { LanguageModal } from "@/components/shared/language-selector"
import { LOCALE_SHORT_LABELS } from "@/lib/i18n/locale-config"
import { useMobileDrawer } from "@/lib/ui/use-mobile-drawer"

export type AccountSection = 'overview' | 'bookings' | 'car-requests' | 'event-requests' | 'trip-requests' | 'favorites' | 'payments' | 'messages' | 'profile' | 'settings' | 'change-password'

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
  const supportChat = useSupportChat()
  const unreadMessages = supportChat.unreadCount
  const favorites = useCustomerFavorites({ accountOnly: true })
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
  const liveTours = useDbTours(catalogTours, { includeNew: true })
  const heading = sectionHeadings[section]
  const initials = profile.fullName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'SP'
  // Never render an empty identity block: fall back to the signed-in email and
  // finally a neutral label rather than an empty heading.
  const displayFullName = profile.fullName.trim() || profile.email.trim() || 'Your account'
  const [mobileOpen, setMobileOpen] = useState(false)
  const sidebarRef = useRef<HTMLElement>(null)
  const menuTriggerRef = useRef<HTMLButtonElement>(null)
  const mobileDrawer = useMobileDrawer({ open: mobileOpen, onClose: () => setMobileOpen(false), panel: sidebarRef, trigger: menuTriggerRef, query: '(max-width: 900px)' })
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
  const exitPreview = async () => {
    if (loggingOut) return
    setLoggingOut(true)
    await stopImpersonation()
    router.replace('/admin')
    router.refresh()
  }

  return <div className={`customer-dashboard section-${section} ${mobileOpen ? 'menu-open' : ''}`}>
    <button type="button" className="customer-dashboard-scrim" tabIndex={-1} aria-hidden="true" aria-label={tx(locale, { en: 'Close menu', es: 'Cerrar el menú', it: 'Chiudi il menu', ar: 'إغلاق القائمة' })} onClick={() => setMobileOpen(false)} />
    <aside ref={sidebarRef} id="customer-mobile-menu" className="customer-account-side" inert={mobileDrawer && !mobileOpen ? true : undefined} role={mobileDrawer && mobileOpen ? 'dialog' : undefined} aria-modal={mobileDrawer && mobileOpen ? true : undefined} aria-label={tx(locale, { en: 'Account navigation', es: 'Navegación de la cuenta', it: 'Navigazione account', ar: 'قائمة الحساب' })}>
      <button type="button" className="customer-drawer-close" onClick={() => setMobileOpen(false)} aria-label={tx(locale, { en: 'Close menu', es: 'Cerrar el menú', it: 'Chiudi il menu', ar: 'إغلاق القائمة' })}><X size={20}/></button>
      <Link href="/account" className="customer-dashboard-brand" onClick={() => setMobileOpen(false)}>
        <BrandMark alt="" />
        <span><strong>STAR PYRAMIDS</strong><small>{tx(locale, { en: 'TRAVELER ACCOUNT', es: 'CUENTA DEL VIAJERO', it: 'ACCOUNT VIAGGIATORE', ar: 'حساب المسافر' })}</small></span>
      </Link>
        <div className="customer-profile-mini">
          <CustomerAvatar avatar={profile.avatar} initials={initials} className="customer-avatar" name={profile.fullName} />
          <div><strong>{displayFullName}</strong><small>{profile.email}</small></div>
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
        <Link href="/" className="customer-drawer-website" onClick={() => setMobileOpen(false)}><ExternalLink size={18}/>{tx(locale, { en: 'Back to website', es: 'Volver al sitio web', it: 'Torna al sito', ar: 'العودة للموقع' })}</Link>
        <button type="button" className="customer-signout" onClick={impersonated ? exitPreview : logout} disabled={loggingOut}><LogOut size={17} />{impersonated ? tx(locale, { en: 'Exit preview', es: 'Salir de la vista previa', it: 'Esci dall’anteprima', ar: 'إنهاء المعاينة' }) : loggingOut ? (tx(locale, { en: 'Signing out...', es: 'Cerrando sesión…', it: 'Disconnessione…', ar: 'جارٍ الخروج...' })) : (tx(locale, { en: 'Sign out', es: 'Cerrar sesión', it: 'Esci', ar: 'تسجيل الخروج' }))}</button>
    </aside>

    <div className="customer-dashboard-main" inert={mobileDrawer && mobileOpen ? true : undefined}>
      <header className="customer-dashboard-topbar">
        <button ref={menuTriggerRef} type="button" className="customer-mobile-menu" onClick={() => setMobileOpen(true)} aria-expanded={mobileOpen} aria-controls="customer-mobile-menu" aria-label={tx(locale, { en: 'Open menu', es: 'Abrir el menú', it: 'Apri il menu', ar: 'فتح القائمة' })}><Menu size={20} /></button>
        <Link href="/account" className="customer-mobile-brand"><BrandMark alt="" /><strong>STAR PYRAMIDS</strong></Link>
        <div className="customer-dashboard-search">
          <Search size={17} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={tx(locale, { en: 'Search trips and destinations...', es: 'Busca viajes y destinos…', it: 'Cerca viaggi e destinazioni…', ar: 'ابحث عن رحلة أو وجهة...' })} />
          {query && <button type="button" onClick={() => setQuery('')} aria-label={tx(locale, { en: 'Clear search', es: 'Borrar la búsqueda', it: 'Cancella la ricerca', ar: 'مسح البحث' })}><X size={15} /></button>}
          {query && <div className="customer-search-results">{searchResults.length ? searchResults.map((tour) => <Link key={tour.slug} href={`/egypt-tours/${tour.slug}`} onClick={() => setQuery('')}><img src={tour.image} alt="" /><span><strong>{tour.title}</strong><small>{locale === 'ar' ? localizeTourLocation(tour.location) : tour.location}</small></span><ArrowRight size={14} /></Link>) : <span>{tx(locale, { en: 'No matching trips', es: 'Sin viajes coincidentes', it: 'Nessun viaggio corrispondente', ar: 'لا توجد رحلات مطابقة' })}</span>}</div>}
        </div>
        <div className="customer-dashboard-actions">
          <button type="button" className="customer-top-language" onClick={() => { setLanguageOpen(true); setNotificationsOpen(false); setUserOpen(false) }} aria-label={tx(locale, { en: 'Choose language and currency', es: 'Elige idioma y moneda', it: 'Scegli lingua e valuta', ar: 'اختيار اللغة والعملة' })}><Globe2 size={18} /><span>{LOCALE_SHORT_LABELS[locale]}</span></button>
          {languageOpen && <LanguageModal locale={locale} currency={currency} onClose={() => setLanguageOpen(false)} onSelect={setLocale} onCurrency={setCurrency} />}
          <SharedSelect value={currency} onChange={(next) => setCurrency(next as Currency)} locale={locale} label={tx(locale, { en: 'Currency', es: 'Moneda', it: 'Valuta', ar: 'العملة' })} options={CURRENCY_OPTIONS} />
          <Link href="/" className="customer-top-icon" aria-label={tx(locale, { en: 'Back to website', es: 'Volver al sitio web', it: 'Torna al sito', ar: 'العودة للموقع' })} title={tx(locale, { en: 'Back to website', es: 'Volver al sitio web', it: 'Torna al sito', ar: 'العودة للموقع' })}><ExternalLink size={18} /></Link>
          <Link href="/cart" className="customer-top-icon customer-cart-icon" aria-label={tx(locale, { en: 'Trip cart', es: 'Cesta de viajes', it: 'Carrello viaggi', ar: 'سلة الرحلات' })}><ShoppingCart size={18} />{cart.lines > 0 && <b>{cart.lines}</b>}</Link>
          <div className="customer-top-popover">
            <button type="button" className="customer-top-icon" onClick={() => { setNotificationsOpen((open) => !open); setUserOpen(false) }} aria-label={tx(locale, { en: 'Notifications', es: 'Notificaciones', it: 'Notifiche', ar: 'الإشعارات' })} aria-expanded={notificationsOpen}><Bell size={18} />{notifications.unreadCount > 0 && <i />}</button>
          </div>
          <div className="customer-top-popover customer-user-popover">
            <button type="button" className="customer-top-user" onClick={() => { setUserOpen((open) => !open); setNotificationsOpen(false) }} aria-expanded={userOpen}><CustomerAvatar avatar={profile.avatar} initials={initials} className="customer-top-avatar" name={displayFullName} /><div><strong>{displayFullName}</strong><small>{tx(locale, { en: 'Traveler', es: 'Viajero', it: 'Viaggiatore', ar: 'مسافر' })}</small></div><ChevronDown size={15} /></button>
            {userOpen && <div className="customer-user-menu"><Link href="/account/profile" onClick={() => setUserOpen(false)}><UserRound size={16} />{tx(locale, { en: 'Profile', es: 'Perfil', it: 'Profilo', ar: 'الملف الشخصي' })}</Link><Link href="/account/settings" onClick={() => setUserOpen(false)}><Settings2 size={16} />{tx(locale, { en: 'Settings', es: 'Ajustes', it: 'Impostazioni', ar: 'الإعدادات' })}</Link><button type="button" onClick={impersonated ? exitPreview : logout} disabled={loggingOut}><LogOut size={16} />{impersonated ? tx(locale, { en: 'Exit preview', es: 'Salir de la vista previa', it: 'Esci dall’anteprima', ar: 'إنهاء المعاينة' }) : tx(locale, { en: 'Sign out', es: 'Cerrar sesión', it: 'Esci', ar: 'تسجيل الخروج' })}</button></div>}
          </div>
          {notificationsOpen && <NotificationPanel onClose={() => setNotificationsOpen(false)} />}
        </div>
      </header>

      <main className="customer-account">
        {impersonated && <div className="impersonate-banner" role="status">
          <div>
            <strong>{tx(locale, { en: 'Staff preview', es: 'Vista previa del personal', it: 'Anteprima staff', ar: 'معاينة الموظفين' })}</strong>
            <span>{tx(locale, { en: 'Viewing as', es: 'Viendo como', it: 'Visualizzazione come', ar: 'تشاهد الحساب باسم' })} <b>{impersonated.name}</b></span>
          </div>
          <button type="button" onClick={() => void exitPreview()} disabled={loggingOut}><LogOut size={15} />{tx(locale, { en: 'Exit preview', es: 'Salir de la vista previa', it: 'Esci dall’anteprima', ar: 'إنهاء المعاينة' })}</button>
        </div>}
        <section className="customer-account-main">
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
