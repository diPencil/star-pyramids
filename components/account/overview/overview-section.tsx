'use client'

// 'use client' is required here: the access token is read from the router
// rather than passed as a prop, so the credential never enters the
// server-rendered payload that ships in the HTML.
import Link from "next/link";
import { ArrowRight, CalendarDays, Heart, MessageCircle, ShoppingBag, ShoppingCart } from "lucide-react";
import { formatPrice, tx, useLocale } from "@/components/locale";
import { catalogTours } from "@/data/tours";
import { useCart } from "@/lib/booking/cart";
import { useCartCatalogue } from "@/lib/booking/cart-catalogue";
import { useDbTours } from "@/lib/tours/tours-client";
import { useCustomerFavorites } from "@/lib/account/customer-account";
import { useSupportChat } from "@/lib/support/support-chat";
import { useAuthenticatedUser } from "@/components/authenticated-user";
import { useAccountProfile, useImpersonated, useVisibleInquiries } from "../shared/account-hooks"
import { useCustomerBookings, BookingCard } from "../bookings/booking-sections"
import { Metric, EmptyState, SupportPanel, QuickActions } from "../shared/account-ui"
import { MiniTour } from "../favorites/favorites-section"


function AccountCompletionNotice() {
  const user = useAuthenticatedUser()
  const { locale } = useLocale()
  if (!user || !user.roles.includes('CUSTOMER') || [user.firstName,user.lastName,user.username,user.countryCode,user.phone].every(value => typeof value === 'string' && value.trim())) return null
  return <p role="status" className="co-payment-note"><Link href="/account/profile">{tx(locale,{en:'Complete your account profile to make the most of your bookings and offers. Your current booking remains available.',es:'Completa el perfil para aprovechar tus reservas y ofertas. Tu reserva actual sigue disponible.',it:'Completa il profilo per sfruttare al meglio prenotazioni e offerte. La prenotazione attuale resta disponibile.'})}</Link></p>
}

function OverviewSection() {
  const { locale, currency } = useLocale()

  const profile = useAccountProfile()
  const impersonated = useImpersonated()
  const displayName = impersonated ? impersonated.name : profile.fullName
  const { bookings, loading: bookingsLoading, error: bookingsError } = useCustomerBookings()
  const favorites = useCustomerFavorites({ accountOnly: true })
  const inquiries = useVisibleInquiries()
  const supportThread = useSupportChat()
  const hasSupportThread = supportThread.conversation !== null || supportThread.messages.length > 0
  const cart = useCart()
  const cartCatalogue = useCartCatalogue(cart.items)
  const cartEstimate = cartCatalogue.estimate
  const latestBooking = bookings[0]
  const liveTours = useDbTours(catalogTours, { includeNew: true })
  const savedTours = favorites.slugs.map((slug) => liveTours.find((tour) => tour.slug === slug)).filter((tour) => Boolean(tour)).slice(0, 3)

  return <>
    {!impersonated && <AccountCompletionNotice/>}
    <section className="customer-welcome-band">
      <div><span>{tx(locale, { en: 'Welcome back', es: 'Te damos la bienvenida', it: 'Bentornato', ar: 'أهلًا بعودتك' })}</span><h2>{displayName.split(' ')[0]}, {tx(locale, { en: 'let us keep your next journey moving.', es: 'sigamos preparando tu próximo viaje.', it: 'continuiamo a preparare il tuo prossimo viaggio.', ar: 'خلينا نجهز رحلتك القادمة.' })}</h2><p>{latestBooking ? (locale === 'es' ? `La última actualización de tu reserva está lista en ${latestBooking.reference}.` : locale === 'it' ? `L'ultimo aggiornamento della tua prenotazione è pronto in ${latestBooking.reference}.` : locale === 'ar' ? `آخر تحديث على الحجز ${latestBooking.reference}` : `Your latest booking update is ready under ${latestBooking.reference}.`) : (tx(locale, { en: 'Save a trip or add it to your cart and everything will stay organized here.', es: 'Guarda un viaje o añádelo a tu cesta y todo quedará organizado aquí.', it: 'Salva un viaggio o aggiungilo al carrello e tutto resterà organizzato qui.', ar: 'احفظ الرحلات أو أضفها للسلة وسيظهر كل شيء هنا.' }))}</p></div>
      <Link href={latestBooking ? '/account/bookings' : '/trips'}>{latestBooking ? (tx(locale, { en: 'Track booking', es: 'Seguir la reserva', it: 'Segui la prenotazione', ar: 'متابعة الحجز' })) : (tx(locale, { en: 'Find a trip', es: 'Buscar un viaje', it: 'Trova un viaggio', ar: 'ابحث عن رحلة' }))} <ArrowRight size={17} /></Link>
    </section>
    <div className="customer-metrics">
      <Metric Icon={ShoppingBag} value={bookingsLoading ? '…' : bookingsError ? '—' : bookings.length} label={tx(locale, { en: 'Bookings', es: 'Reservas', it: 'Prenotazioni', ar: 'الحجوزات' })} note={tx(locale, { en: 'All requests', es: 'Todas las solicitudes', it: 'Tutte le richieste', ar: 'كل الطلبات' })} tone="blue" />
      <Metric Icon={Heart} value={favorites.loading ? '…' : favorites.error ? '—' : favorites.slugs.length} label={tx(locale, { en: 'Saved', es: 'Guardado', it: 'Salvato', ar: 'المحفوظة' })} note={tx(locale, { en: 'Trip ideas', es: 'Ideas de viaje', it: 'Idee di viaggio', ar: 'أفكار للرحلة' })} tone="orange" />
      <Metric Icon={ShoppingCart} value={cart.lines} label={tx(locale, { en: 'In cart', es: 'En la cesta', it: 'Nel carrello', ar: 'في السلة' })} note={cart.lines ? cartCatalogue.ready ? formatPrice(cartEstimate.subtotal, currency, locale) : tx(locale, { en: 'Check your cart for current prices', es: 'Consulta los precios actuales en tu carrito', it: 'Controlla i prezzi attuali nel carrello' }) : (tx(locale, { en: 'Cart is empty', es: 'La cesta está vacía', it: 'Il carrello è vuoto', ar: 'السلة فارغة' }))} tone="green" />
      <Metric Icon={MessageCircle} value={inquiries.length + (hasSupportThread ? 1 : 0)} label={tx(locale, { en: 'Conversations', es: 'Conversaciones', it: 'Conversazioni', ar: 'المحادثات' })} note={hasSupportThread ? (tx(locale, { en: 'Active support chat', es: 'Chat de asistencia activa', it: 'Chat di assistenza attiva', ar: 'دعم مباشر نشط' })) : (tx(locale, { en: 'Recorded enquiries', es: 'Consultas registradas', it: 'Richieste registrate', ar: 'طلبات مسجلة' }))} tone="violet" />
    </div>
    <div className="customer-overview-grid">
      <section className="customer-account-block customer-span-2">
        <header><div><span>{tx(locale, { en: 'Current journey', es: 'Viaje actual', it: 'Viaggio in corso', ar: 'رحلتك الحالية' })}</span><h2>{latestBooking ? (tx(locale, { en: 'Latest booking', es: 'Última reserva', it: 'Ultima prenotazione', ar: 'آخر حجز' })) : (tx(locale, { en: 'Planning workspace', es: 'Espacio de planificación', it: 'Area di pianificazione', ar: 'مساحة التخطيط' }))}</h2></div><Link href={latestBooking ? '/account/bookings' : '/cart'}>{tx(locale, { en: 'View details', es: 'Ver detalles', it: 'Vedi dettagli', ar: 'عرض التفاصيل' })} <ArrowRight size={15} /></Link></header>
        {bookingsLoading ? <p role="status">{tx(locale, { en: 'Loading your bookings…', es: 'Cargando tus reservas…', it: 'Caricamento prenotazioni…' })}</p> : bookingsError ? <p role="alert">{tx(locale, { en: 'Could not load bookings. Open Bookings to try again.', es: 'No se pudieron cargar las reservas. Abre Reservas para intentarlo de nuevo.', it: 'Impossibile caricare le prenotazioni. Apri Prenotazioni per riprovare.' })}</p> : latestBooking ? <BookingCard booking={latestBooking} /> : cart.items.length ? <div className="customer-plan-list">{cart.items.slice(0, 3).map((item) => <div key={item.key}><img src={item.image} alt="" /><span><strong>{item.title}</strong><small>{item.date || (tx(locale, { en: 'Flexible date', es: 'Fecha flexible', it: 'Data flessibile', ar: 'موعد مرن' }))}</small></span><b>{formatPrice(item.total, currency, locale)}</b></div>)}<Link href="/cart" className="account-text-button">{tx(locale, { en: 'Review cart and continue', es: 'Revisar la cesta y continuar', it: 'Rivedi il carrello e continua', ar: 'مراجعة السلة وإكمال الحجز' })} <ArrowRight size={15} /></Link></div> : <EmptyState Icon={CalendarDays} title={tx(locale, { en: 'No active journey yet', es: 'Aún no hay ningún viaje activo', it: 'Ancora nessun viaggio attivo', ar: 'لا توجد رحلة نشطة بعد' })} copy={tx(locale, { en: 'Start with the trip catalogue or ask us to create a custom itinerary.', es: 'Empieza con el catálogo de viajes o pídenos un itinerario a medida.', it: 'Inizia dal catalogo viaggi oppure chiedici un itinerario su misura.', ar: 'ابدأ من كتالوج الرحلات أو اطلب برنامجًا مخصصًا.' })} href="/trips" action={tx(locale, { en: 'Explore trips', es: 'Explorar viajes', it: 'Esplora i viaggi', ar: 'استكشف الرحلات' })} />}
      </section>
      <SupportPanel />
      <section className="customer-account-block customer-span-2">
        <header><div><span>{tx(locale, { en: 'Your shortlist', es: 'Tus guardados', it: 'I tuoi salvati', ar: 'اختياراتك' })}</span><h2>{tx(locale, { en: 'Saved journeys', es: 'Viajes guardados', it: 'Viaggi salvati', ar: 'رحلات محفوظة' })}</h2></div><Link href="/account/favorites">{tx(locale, { en: 'View all', es: 'Ver todo', it: 'Vedi tutto', ar: 'عرض الكل' })} <ArrowRight size={15} /></Link></header>
        {favorites.loading ? <p role="status">{tx(locale, { en: 'Loading saved trips…', es: 'Cargando los viajes guardados…', it: 'Caricamento viaggi salvati…' })}</p> : favorites.error ? <p role="alert">{tx(locale, { en: 'Could not load saved trips. Open Saved to try again.', es: 'No se pudieron cargar los viajes guardados. Abre Guardados para intentarlo de nuevo.', it: 'Impossibile caricare i viaggi salvati. Apri Salvati per riprovare.' })}</p> : savedTours.length ? <div className="customer-saved-strip">{savedTours.map((tour) => tour && <MiniTour key={tour.slug} tour={tour} />)}</div> : <div className="customer-inline-empty"><Heart size={20} /><span><strong>{tx(locale, { en: 'Your shortlist is ready', es: 'Tu lista ya está lista', it: 'La tua lista è pronta', ar: 'المفضلة جاهزة لاختياراتك' })}</strong><small>{tx(locale, { en: 'Save the trips you like and compare them here.', es: 'Guarda los viajes que te gusten y compáralos aquí.', it: 'Salva i viaggi che ti piacciono e confrontali qui.', ar: 'احفظ الرحلات التي تعجبك وقارن بينها هنا.' })}</small></span><Link href="/account/favorites">{tx(locale, { en: 'See suggestions', es: 'Ver sugerencias', it: 'Vedi i suggerimenti', ar: 'شاهد المقترحات' })}</Link></div>}
      </section>
      <QuickActions />
    </div>
  </>
}

export { OverviewSection }
