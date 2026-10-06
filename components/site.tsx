'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useRef, useState, type MouseEvent as CardMouseEvent } from 'react'
import { ChevronDown, Globe2, Heart, Menu, Search, Share2, ShoppingCart, X, ArrowRight, ArrowUp, Check, MapPin, Clock3, Users, CarFront, Mail, Phone, Star, Sun, Ship, Anchor, Package, Ticket, BadgePercent, Accessibility, BadgeCheck, Gift, Bell, Sparkles, UserRound, LayoutDashboard } from 'lucide-react'
import { blogs, cars, destinations, events, faqs, offers, siteImages, policies, findBlog, findCar, findDestination, findEvent, findOffer } from '@/data/content'
import { assignableOneDayTours, getCruiseTypeBySlug, getMultiDayToursForCategory, getOneDayToursForDestination, getPublishedMultiDayCategories, getPublishedOneDayDestinations, getToursByCategory, multiDayCategories, seasonalTours, tourCategories, tourImages } from '@/data/tours'
import { matchPriceBand, parseTourListingQuery, tourListingSorts, tourPriceBands, type TourListingQuery } from '@/lib/query'
import { localizeTourDuration, localizeTourLocation } from '@/lib/tour-format'
import { COMPANY_ADDRESS, phoneHref, whatsappHref } from '@/data/company'
import { useBrandSettings } from '@/lib/admin-store'
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

const baseCopy = { en: { search:'Find places and things to do', signIn:'Sign in', dashboard:'Dashboard', account:'Account', home:'Home', tours:'Egypt Tours', rent:'Rent Car', about:'About Us', contact:'Contact Us', blogs:'Blogs', events:'Events', offer:'Special Offer', make:'Make Your Trip', language:'AR - EGP', switch:'العربية', promo:'Book any package tour and enjoy a FREE tour experience included along with it.' }, ar: { search:'ابحث عن الأماكن والأنشطة', signIn:'تسجيل الدخول', dashboard:'لوحة التحكم', account:'حسابي', home:'الرئيسية', tours:'جولات مصر', rent:'تأجير السيارات', about:'من نحن', contact:'اتصل بنا', blogs:'المدونة', events:'الفعاليات', offer:'عروض خاصة', make:'خطط رحلتك', language:'EN - USD', switch:'English', promo:'احجز أي برنامج سياحي واستمتع بتجربة مجانية مشمولة معه.' } } as const
// ES/IT carry full header/nav chrome copy; catalogue content falls back to English.
const copy = { ...baseCopy,
es: { ...baseCopy.en, search: 'Busca lugares y actividades', signIn: 'Iniciar sesión', dashboard: 'Panel', account: 'Cuenta', home: 'Inicio', tours: 'Circuitos por Egipto', rent: 'Alquiler de coches', about: 'Quiénes somos', contact: 'Contáctanos', blogs: 'Blog', events: 'Eventos', offer: 'Oferta especial', make: 'Crea tu viaje', language: 'ES - EUR', switch: 'Español', promo: 'Reserva cualquier paquete y disfruta de una experiencia gratuita incluida.' },
  it: { ...baseCopy.en, search: 'Cerca luoghi e attività', signIn: 'Accedi', dashboard: 'Dashboard', account: 'Account', home: 'Home', tours: 'Tour in Egitto', rent: 'Noleggio auto', about: 'Chi siamo', contact: 'Contattaci', blogs: 'Blog', events: 'Eventi', offer: 'Offerta speciale', make: 'Crea il tuo viaggio', language: 'IT - EUR', switch: 'Italiano', promo: 'Prenota un pacchetto viaggio e goditi un’esperienza gratuita inclusa.' },
} as const

const baseExtra = {
  en: { promo2: 'Limited-time savings on top-rated Egypt tours. Grab your deal before it ends!', viewPackages: 'View Packages', viewOffers: 'View Offers', cat1: 'One Day Tours', cat2: 'Multi Days Tours', cat3: 'Nile Cruises', cat4: 'Shore Excursion', liveChat: 'Live Chat', modalTitle: 'Language and Currency', curTitle: 'Currency', regTitle: 'Region and Language', footerTag: 'We would be happy to help you discover Egypt.', footerLinks: 'STAR PYRAMIDS Links', contactInfo: 'Contact Info', address: COMPANY_ADDRESS, rights: 'All rights reserved to STAR PYRAMIDS company, Egypt ©2026', poweredBy: 'Powered by', tabMake: 'Make Your Trip', tabFind: 'Find your trip', tabRent: 'Rent Car', privacy: 'Privacy and Cookies', terms: 'Terms and Conditions', qWhen: 'When will you be traveling?', qExact: 'Have An Exact Time', qApprox: 'Have An Approximate Time', qUnsure: 'Not Sure Yet', fFrom: 'From', fTo: 'To', fFromPh: 'Select the start date of the trip', fToPh: 'Select the end date of the trip', makeTripBtn: 'Make Trip', qWhat: 'What are you looking for?', k1: 'One Day', k2: 'Multi Days', k3: 'Nile Cruise', k4: 'Shore', wWhere: 'Where?', wWherePh: 'Choose your favorite place in Egypt', wLong: 'How Long?', wLongPh: 'How many days do you stay in Egypt', searchBtn: 'Search', qType: 'Type of Trip?', tOne: 'One Way', tRound: 'Round Trip', cHolder: 'Car Holder', cHolderPh: 'Choose Pick-Up Location', cDrop: 'Drop Off Location', cDropPh: 'Choose Drop-Off Location', cDate: 'Pick Up Date and time', cDatePh: 'Choose the time and date for Pick Up', sendReq: 'Send Request', helpTitle: 'Need help to finding your trip?', helpSub: 'Share a few details and our team will contact you.', helpName: 'Full Name', helpNat: 'Nationality', helpPhone: 'Phone', helpBtn: 'Contact Now', helpDoneT: 'We got your details!', helpDoneP1: 'Thank you', helpDoneP2: '. Our travel team will contact you shortly.', contactTitle: 'Contact Us', contactSub: 'Call Us, Write Us, Or Knock on Our Door', addrT: 'Our Address', emailT: 'Email Address', formT: 'Connect with Us Today', sendMsg: 'Send a Message', msgPh: 'How can we help?', faqTeaser: 'Frequently Asked Questions', seeMore: 'See more', needHelp: 'Need Our Help?', footExplore: 'Explore', footCompany: 'Company', certBadge: 'Travelife Certified', guideLink: 'Egypt Travel Guide', faqsLink: 'FAQs', accessLink: 'Accessible Travel', accessNote: '5% discount on all our tour packages for guests requiring accessibility assistance.', readMoreBtn: 'Read More', callUs: 'Call us' },
  ar: { promo2: 'وفّر لفترة محدودة على أفضل جولات مصر. احجز قبل انتهاء العرض!', viewPackages: 'شاهد الباقات', viewOffers: 'شاهد العروض', cat1: 'رحلات اليوم الواحد', cat2: 'رحلات متعددة الأيام', cat3: 'رحلات النيل', cat4: 'رحلات الشواطئ', liveChat: 'محادثة مباشرة', modalTitle: 'اللغة والعملة', curTitle: 'العملة', regTitle: 'المنطقة واللغة', footerTag: 'سعداء بمساعدتك في اكتشاف مصر.', footerLinks: 'روابط ستار بيراميدز', contactInfo: 'معلومات التواصل', address: COMPANY_ADDRESS, rights: 'جميع الحقوق محفوظة لشركة ستار بيراميدز، مصر ©2026', poweredBy: 'مدعوم من', tabMake: 'خطط رحلتك', tabFind: 'اعثر على رحلتك', tabRent: 'استأجر سيارة', privacy: 'الخصوصية وملفات الارتباط', terms: 'الشروط والأحكام', qWhen: 'متى ستسافر؟', qExact: 'لدي وقت محدد', qApprox: 'لدي وقت تقريبي', qUnsure: 'لست متأكداً بعد', fFrom: 'من', fTo: 'إلى', fFromPh: 'اختر تاريخ بداية الرحلة', fToPh: 'اختر تاريخ نهاية الرحلة', makeTripBtn: 'خطط الرحلة', qWhat: 'عن ماذا تبحث؟', k1: 'يوم واحد', k2: 'أيام متعددة', k3: 'رحلة نيلية', k4: 'شاطئية', wWhere: 'أين؟', wWherePh: 'اختر مكانك المفضل في مصر', wLong: 'كم المدة؟', wLongPh: 'كم يوماً ستبقى في مصر', searchBtn: 'بحث', qType: 'نوع الرحلة؟', tOne: 'ذهاب فقط', tRound: 'ذهاب وعودة', cHolder: 'مكان الاستلام', cHolderPh: 'اختر مكان الاستلام', cDrop: 'مكان التسليم', cDropPh: 'اختر مكان التسليم', cDate: 'تاريخ ووقت الاستلام', cDatePh: 'اختر وقت وتاريخ الاستلام', sendReq: 'إرسال الطلب', helpTitle: 'محتاج مساعدة في رحلتك؟', helpSub: 'سيب بياناتك وفريقنا هيتواصل معاك.', helpName: 'الاسم بالكامل', helpNat: 'الجنسية', helpPhone: 'الهاتف', helpBtn: 'تواصل الآن', helpDoneT: 'وصلتنا بياناتك!', helpDoneP1: 'شكراً', helpDoneP2: '. فريق السفر هيتواصل معاك قريباً.', contactTitle: 'اتصل بنا', contactSub: 'كلمنا، راسلنا، أو زورنا', addrT: 'عنوانا', emailT: 'البريد الإلكتروني', formT: 'تواصل معنا اليوم', sendMsg: 'إرسال رسالة', msgPh: 'إزاي نقدر نساعدك؟', faqTeaser: 'الأسئلة الشائعة', seeMore: 'شاهد المزيد', needHelp: 'محتاج مساعدة؟', footExplore: 'استكشف', footCompany: 'الشركة', certBadge: 'معتمد ترافل لايف', guideLink: 'دليل السفر', faqsLink: 'الأسئلة الشائعة', accessLink: 'سفر ميسّر', accessNote: 'خصم 5% على كل باقات الرحلات لضيوفنا من ذوي الاحتياجات الخاصة.', readMoreBtn: 'اقرأ المزيد', callUs: 'اتصل بنا' },
} as const

export const extra = { ...baseExtra,
es: { ...baseExtra.en, promo2: 'Ahorra por tiempo limitado en los mejores circuitos de Egipto. ¡Aprovecha antes de que termine!', viewPackages: 'Ver paquetes', viewOffers: 'Ver ofertas', cat1: 'Circuitos de un día', cat2: 'Viajes de varios días', cat3: 'Cruceros por el Nilo', cat4: 'Excursión en tierra', liveChat: 'Chat en vivo', modalTitle: 'Idioma y moneda', curTitle: 'Moneda', regTitle: 'Región e idioma', footerTag: 'Estaremos encantados de ayudarte a descubrir Egipto.', footerLinks: 'Enlaces de STAR PYRAMIDS', contactInfo: 'Contacto', rights: 'Todos los derechos reservados a STAR PYRAMIDS, Egipto ©2026', poweredBy: 'Con la tecnología de', tabMake: 'Crea tu viaje', tabFind: 'Busca tu viaje', tabRent: 'Alquila un coche', privacy: 'Privacidad y cookies', terms: 'Términos y condiciones', qWhen: '¿Cuándo viajarás?', qExact: 'Tengo fecha exacta', qApprox: 'Tengo fecha aproximada', qUnsure: 'Aún no lo sé', fFrom: 'Desde', fTo: 'Hasta', fFromPh: 'Elige la fecha de inicio del viaje', fToPh: 'Elige la fecha de fin del viaje', makeTripBtn: 'Crear viaje', qWhat: '¿Qué buscas?', k1: 'Un día', k2: 'Varios días', k3: 'Crucero por el Nilo', k4: 'Costa', wWhere: '¿Dónde?', wWherePh: 'Elige tu lugar favorito de Egipto', wLong: '¿Cuánto tiempo?', wLongPh: '¿Cuántos días estarás en Egipto?', searchBtn: 'Buscar', qType: '¿Tipo de viaje?', tOne: 'Solo ida', tRound: 'Ida y vuelta', cHolder: 'Titular del coche', cHolderPh: 'Elige el lugar de recogida', cDrop: 'Lugar de devolución', cDropPh: 'Elige el lugar de devolución', cDate: 'Fecha y hora de recogida', cDatePh: 'Elige la fecha y hora de recogida', sendReq: 'Enviar solicitud', helpTitle: '¿Necesitas ayuda para encontrar tu viaje?', helpSub: 'Comparte algunos datos y nuestro equipo te contactará.', helpName: 'Nombre completo', helpNat: 'Nacionalidad', helpPhone: 'Teléfono', helpBtn: 'Contactar ahora', helpDoneT: '¡Recibimos tus datos!', helpDoneP1: 'Gracias', helpDoneP2: '. Nuestro equipo de viajes te contactará pronto.', contactTitle: 'Contáctanos', contactSub: 'Llámanos, escríbenos o visítanos', addrT: 'Nuestra dirección', emailT: 'Correo electrónico', formT: 'Conecta con nosotros hoy', sendMsg: 'Enviar mensaje', msgPh: '¿Cómo podemos ayudarte?', faqTeaser: 'Preguntas frecuentes', seeMore: 'Ver más', needHelp: '¿Necesitas ayuda?', footExplore: 'Explorar', footCompany: 'Empresa', certBadge: 'Certificado Travelife', guideLink: 'Guía de viaje de Egipto', faqsLink: 'Preguntas frecuentes', accessLink: 'Viajes accesibles', accessNote: '5% de descuento en todos nuestros paquetes para huéspedes que necesiten asistencia de accesibilidad.', readMoreBtn: 'Leer más', callUs: 'Llámanos' },
  it: { ...baseExtra.en, promo2: 'Risparmia per un periodo limitato sui migliori tour in Egitto. Approfittane prima che finisca!', viewPackages: 'Vedi i pacchetti', viewOffers: 'Vedi le offerte', cat1: 'Tour di un giorno', cat2: 'Viaggi di più giorni', cat3: 'Crociere sul Nilo', cat4: 'Escursione a terra', liveChat: 'Chat dal vivo', modalTitle: 'Lingua e valuta', curTitle: 'Valuta', regTitle: 'Regione e lingua', footerTag: 'Saremo felici di aiutarti a scoprire l’Egitto.', footerLinks: 'Link di STAR PYRAMIDS', contactInfo: 'Contatti', rights: 'Tutti i diritti riservati a STAR PYRAMIDS, Egitto ©2026', poweredBy: 'Offerto da', tabMake: 'Crea il tuo viaggio', tabFind: 'Trova il tuo viaggio', tabRent: 'Noleggia un’auto', privacy: 'Privacy e cookie', terms: 'Termini e condizioni', qWhen: 'Quando viaggerai?', qExact: 'Ho una data esatta', qApprox: 'Ho una data approssimativa', qUnsure: 'Non lo so ancora', fFrom: 'Da', fTo: 'A', fFromPh: 'Scegli la data di inizio del viaggio', fToPh: 'Scegli la data di fine del viaggio', makeTripBtn: 'Crea viaggio', qWhat: 'Cosa cerchi?', k1: 'Un giorno', k2: 'Più giorni', k3: 'Crociera sul Nilo', k4: 'Costa', wWhere: 'Dove?', wWherePh: 'Scegli il tuo luogo preferito in Egitto', wLong: 'Quanto tempo?', wLongPh: 'Quanti giorni resterai in Egitto?', searchBtn: 'Cerca', qType: 'Tipo di viaggio?', tOne: 'Solo andata', tRound: 'Andata e ritorno', cHolder: 'Intestatario auto', cHolderPh: 'Scegli il luogo di ritiro', cDrop: 'Luogo di riconsegna', cDropPh: 'Scegli il luogo di riconsegna', cDate: 'Data e ora di ritiro', cDatePh: 'Scegli data e ora di ritiro', sendReq: 'Invia richiesta', helpTitle: 'Hai bisogno di aiuto per trovare il tuo viaggio?', helpSub: 'Condividi alcuni dettagli e il nostro team ti contatterà.', helpName: 'Nome completo', helpNat: 'Nazionalità', helpPhone: 'Telefono', helpBtn: 'Contattaci ora', helpDoneT: 'Abbiamo ricevuto i tuoi dati!', helpDoneP1: 'Grazie', helpDoneP2: '. Il nostro team di viaggio ti contatterà a breve.', contactTitle: 'Contattaci', contactSub: 'Chiamaci, scrivici o vieni a trovarci', addrT: 'Il nostro indirizzo', emailT: 'Indirizzo email', formT: 'Contattaci oggi', sendMsg: 'Invia messaggio', msgPh: 'Come possiamo aiutarti?', faqTeaser: 'Domande frequenti', seeMore: 'Vedi di più', needHelp: 'Hai bisogno di aiuto?', footExplore: 'Esplora', footCompany: 'Azienda', certBadge: 'Certificato Travelife', guideLink: 'Guida di viaggio in Egitto', faqsLink: 'Domande frequenti', accessLink: 'Viaggi accessibili', accessNote: 'Sconto del 5% su tutti i nostri pacchetti per gli ospiti che necessitano di assistenza per l’accessibilità.', readMoreBtn: 'Leggi di più', callUs: 'Chiamaci' },
} as const



export function Logo(){const brand=useBrandSettings(); return <Link href="/" className="brand-logo" aria-label="STAR PYRAMIDS Tours Egypt"><img className="brand-img" src={brand.logo || '/logo.png'} alt="STAR PYRAMIDS Tours Egypt"/></Link>}

const MARKETING_NOTIF_KEY = 'sp-marketing-notifications-v1';

type MarketingNotifItem = {
  id: string;
  type: 'offer' | 'tour' | 'promo' | 'car';
  title: string;
  desc: string;
  time: string;
  href: string;
  unread: boolean;
};

function getMarketingItems(locale: Locale): MarketingNotifItem[] {
  return [
    {
      id: '1',
      type: 'offer',
      title: tx(locale, { en: 'Special Offer: 20% OFF Luxury Nile Cruises Luxor & Aswan', es: 'Oferta exclusiva: 20% de descuento en cruceros por el Nilo Luxor y Asuán', it: 'Offerta esclusiva: 20% di sconto sulle crociere sul Nilo Luxor e Assuan', ar: 'عرض حصري: خصم 20% على كروز النيل الأقصر وأسوان' }),
      desc: tx(locale, { en: 'Book your 5-star cruise now and enjoy all-inclusive stay & private guide', es: 'Reserva tu crucero 5 estrellas y disfruta de estancia todo incluido y guía privado', it: 'Prenota ora la tua crociera 5 stelle con soggiorno all-inclusive e guida privata', ar: 'احجز رحلتك البحرية الآن واستمتع بإقامة 5 نجوم شاملة كلياً' }),
      time: tx(locale, { en: '15m ago', es: 'hace 15 min', it: '15 min fa', ar: 'منذ 15 دقيقة' }),
      href: '/special-offers',
      unread: true,
    },
    {
      id: '2',
      type: 'tour',
      title: tx(locale, { en: 'New Tour: White Desert & Bahariya Oasis 3-Day Safari', es: 'Nuevo circuito: safari de 3 días por el Desierto Blanco y el oasis de Bahariya', it: 'Nuovo tour: safari di 3 giorni nel Deserto Bianco e nell\'oasi di Bahariya', ar: 'رحلة جديدة: مغامرة سفاري الصحراء البيضاء والواحات 3 أيام' }),
      desc: tx(locale, { en: 'Discover magical landscapes and luxury stargazing camping in Egypt', es: 'Descubre paisajes mágicos y acampada de lujo bajo las estrellas en Egipto', it: 'Scopri paesaggi magici e campeggio di lusso sotto le stelle in Egitto', ar: 'اكتشف رمال مصر الساحرة والتخييم تحت النجوم مع مرشد خبير' }),
      time: tx(locale, { en: '2h ago', es: 'hace 2 h', it: '2 ore fa', ar: 'منذ ساعتين' }),
      href: '/egypt-tours/multi-days-tours',
      unread: true,
    },
    {
      id: '3',
      type: 'promo',
      title: tx(locale, { en: 'Exclusive Promo Code: STAR2026', es: 'Código de descuento exclusivo: STAR2026', it: 'Codice sconto esclusivo: STAR2026', ar: 'كود خصم حصري: STAR2026' }),
      desc: tx(locale, { en: 'Save extra 5% on all tour packages when booking this week', es: 'Ahorra un 5% extra en todos los paquetes al reservar esta semana', it: 'Risparmia un ulteriore 5% su tutti i pacchetti prenotando questa settimana', ar: 'وفّر 5% إضافية عند حجز أي باقة سياحية هذا الأسبوع' }),
      time: tx(locale, { en: '1d ago', es: 'hace 1 día', it: '1 giorno fa', ar: 'منذ يوم' }),
      href: '/special-offers',
      unread: false,
    },
    {
      id: '4',
      type: 'car',
      title: tx(locale, { en: 'Updated Car Rental & VIP Airport Transfers', es: 'Nueva flota de alquiler y traslados VIP al aeropuerto', it: 'Nuova flotta a noleggio e trasferimenti VIP per l\'aeroporto', ar: 'تحديث أسطول سيارات الليموزين وتوصيل المطار' }),
      desc: tx(locale, { en: 'New premium fleet available with private chauffeur at best rates', es: 'Nueva flota premium con chófer privado al mejor precio', it: 'Nuova flotta premium con autista privato alle migliori tariffe', ar: 'أحدث موديلات السيارات مع سائق خاص بأفضل الأسعار' }),
      time: tx(locale, { en: '2d ago', es: 'hace 2 días', it: '2 giorni fa', ar: 'منذ يومين' }),
      href: '/rent-car',
      unread: false,
    },
  ];
}

function loadReadIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(MARKETING_NOTIF_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === 'string'));
  } catch {
    return new Set();
  }
}

function saveReadIds(ids: Set<string>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(MARKETING_NOTIF_KEY, JSON.stringify([...ids]));
  } catch {
    // storage full or unavailable — non-critical
  }
}

function NotificationDropdown({ locale, onClose, onUnreadCountChange }: { locale: Locale; onClose: () => void; onUnreadCountChange: (count: number) => void }) {

  const [items, setItems] = useState<MarketingNotifItem[]>(() => {
    const readIds = loadReadIds();
    return getMarketingItems(locale).map(item => ({
      ...item,
      unread: item.unread && !readIds.has(item.id),
    }));
  });

  const unreadCount = items.filter(i => i.unread).length;

  useEffect(() => {
    onUnreadCountChange(unreadCount);
  }, [unreadCount, onUnreadCountChange]);

  const markAllRead = () => {
    setItems(prev => prev.map(i => ({ ...i, unread: false })));
    const readIds = loadReadIds();
    items.forEach(i => readIds.add(i.id));
    saveReadIds(readIds);
  };

  const markItemRead = (id: string) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, unread: false } : i));
    const readIds = loadReadIds();
    readIds.add(id);
    saveReadIds(readIds);
  };

  return (
    <div className="notif-dropdown" role="dialog" aria-label="Notifications" onClick={e => e.stopPropagation()}>
      <div className="notif-head">
        <div className="notif-head-title">
          <h4>{tx(locale, { en: 'Notifications & Offers', es: 'Notificaciones y ofertas', it: 'Notifiche e offerte', ar: 'الإشعارات والعروض' })}</h4>
          {unreadCount > 0 && <span className="notif-count-badge">{unreadCount} {tx(locale, { en: 'new', es: 'nuevas', it: 'nuove', ar: 'جديد' })}</span>}
        </div>
        {unreadCount > 0 && (
          <button type="button" className="notif-mark-read" onClick={markAllRead}>
            {tx(locale, { en: 'Mark all read', es: 'Marcar todo como leído', it: 'Segna tutto come letto', ar: 'تعيين الكل كمقروء' })}
          </button>
        )}
      </div>
      <div className="notif-list">
        {items.map(item => (
          <Link
            key={item.id}
            href={item.href}
            onClick={() => {
              markItemRead(item.id);
              onClose();
            }}
            className={`notif-item ${item.unread ? 'unread' : ''}`}
          >
            <div className={`notif-icon-bubble ${item.type}`}>
              {item.type === 'offer' ? <BadgePercent size={18} /> : item.type === 'tour' ? <Sparkles size={18} /> : item.type === 'promo' ? <Gift size={18} /> : <CarFront size={18} />}
            </div>
            <div className="notif-content">
              <strong>{item.title}</strong>
              <p>{item.desc}</p>
              <span className="notif-time">{item.time}</span>
            </div>
            {item.unread && <span className="notif-unread-dot" />}
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

export function Header() {
  const [menu, setMenu] = useState(false)
  const { user: headerUser, loading: headerUserLoading } = useCurrentUser()
  const [toursOpen, setToursOpen] = useState(false)
  const [stickyToursOpen, setStickyToursOpen] = useState(false)
  const [companyOpen, setCompanyOpen] = useState(false)
  const [languageOpen, setLanguageOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [marketingUnreadCount, setMarketingUnreadCount] = useState(0)
  const [query, setQuery] = useState('')
  const [promoIdx, setPromoIdx] = useState(0)
  const [scrolled, setScrolled] = useState(false)
  const promoHold = useRef(false)
  const primaryHeaderRef = useRef<HTMLElement>(null)
  const router = useRouter()
  const pathname = usePathname()
  const { locale, setLocale, currency, setCurrency } = useLocale()
  const { lines: cartLines } = useCart()
  const t = copy[locale]
  const ex = extra[locale]
  const cartLabel = tx(locale, { en: `Trip cart, ${cartLines} ${cartLines === 1 ? 'trip' : 'trips'}`, es: `Carrito de viajes, ${cartLines} ${cartLines === 1 ? 'viaje' : 'viajes'}`, it: `Carrello viaggi, ${cartLines} ${cartLines === 1 ? 'viaggio' : 'viaggi'}`, ar: `سلة الرحلات، ${cartLines} ${cartLines === 1 ? 'رحلة' : 'رحلات'}` })

  useEffect(() => {
    setMenu(false)
    setToursOpen(false)
    setStickyToursOpen(false)
    setCompanyOpen(false)
    setNotifOpen(false)
  }, [pathname])

  useEffect(() => {
    const onDocumentClick = (event: globalThis.MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('.nav-dropdown')) {
        setToursOpen(false)
        setStickyToursOpen(false)
        setCompanyOpen(false)
      }
      if (!target.closest('.notif-wrapper')) setNotifOpen(false)
    }
    document.addEventListener('click', onDocumentClick)
    return () => document.removeEventListener('click', onDocumentClick)
  }, [])

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (!promoHold.current) setPromoIdx((index) => (index + 1) % 2)
    }, 5000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    let frame = 0
    const syncScrollState = () => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => setScrolled(window.scrollY > 130))
    }
    syncScrollState()
    window.addEventListener('scroll', syncScrollState, { passive: true })
    window.addEventListener('pageshow', syncScrollState)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('scroll', syncScrollState)
      window.removeEventListener('pageshow', syncScrollState)
    }
  }, [])

  const tourLinks = [
    [tx(locale, { en: 'All Trips', es: 'Todos los viajes', it: 'Tutti i viaggi', ar: 'كل الرحلات' }), '/trips'],
    [ex.cat1, '/egypt-tours/one-day-tours'],
    [ex.cat2, '/egypt-tours/multi-days-tours'],
    [ex.cat3, '/egypt-tours/nile-cruises'],
    [ex.cat4, '/egypt-tours/shore-excursions'],
  ] as const
  const mobileLinks = [[t.home, '/'], [t.tours, '/trips'], [t.rent, '/rent-car'], [t.events, '/events'], [t.about, '/about'], [t.contact, '/contact'], [t.blogs, '/blogs']] as const
  const promos = [
    { text: t.promo, href: '/special-offers', label: ex.viewPackages, icons: <><Ticket size={26}/><BadgePercent size={26}/></> },
    { text: ex.promo2, href: '/special-offers', label: ex.viewOffers, icons: <><Star size={26}/><BadgePercent size={26}/></> },
  ]

  return <>
    <header ref={primaryHeaderRef} suppressHydrationWarning className="site-header">
      <div className="header-top container">
        <button type="button" className="mobile-menu" onClick={() => setMenu((value) => !value)} aria-label={tx(locale, { en: 'Open menu', es: 'Abrir el menú', it: 'Apri il menu', ar: 'فتح القائمة' })} aria-expanded={menu}>{menu ? <X/> : <Menu/>}</button>
        <Logo/>
        <form className="site-search" role="search" onSubmit={(event) => { event.preventDefault(); router.push('/search?q=' + encodeURIComponent(query)) }}>
          <Search size={19}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.search} aria-label={t.search}/>
        </form>
        <div className="header-actions">
          <LanguageToggle label={LOCALE_SHORT_LABELS[locale] + ' - ' + currency} onOpen={() => setLanguageOpen(true)}/>
          <div className="notif-wrapper">
            <button type="button" className={`icon-btn notif-btn ${notifOpen ? 'active' : ''}`} onClick={() => setNotifOpen((value) => !value)} aria-label={tx(locale, { en: 'Notifications', es: 'Notificaciones', it: 'Notifiche', ar: 'الإشعارات' })} aria-expanded={notifOpen}><Bell size={18}/>{marketingUnreadCount > 0 && <span className="notif-badge-pulse"/>}</button>
            {notifOpen && <NotificationDropdown locale={locale} onClose={() => setNotifOpen(false)} onUnreadCountChange={setMarketingUnreadCount}/>}
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
          <nav aria-label={tx(locale, { en: 'Primary navigation', es: 'Navegación principal', it: 'Navigazione principale', ar: 'القائمة الرئيسية' })}>
            <Link href="/">{t.home}</Link>
            <div className="nav-dropdown"><button type="button" onClick={() => setToursOpen((value) => !value)} aria-expanded={toursOpen}>{t.tours} <ChevronDown size={14}/></button>{toursOpen && <div className="tour-menu">{tourLinks.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}</div>}</div>
            <Link href="/rent-car">{t.rent}</Link><Link href="/about">{t.about}</Link><Link href="/contact">{t.contact}</Link><Link href="/blogs">{t.blogs}</Link><Link href="/events">{t.events}</Link><Link className="special-link" href="/special-offers">{t.offer}</Link>
          </nav>
          <div className="nav-right-actions"><Link className="make-trip-link" href="/make-your-trip">{t.make}</Link><HeaderAuthAction user={headerUser} loading={headerUserLoading} signInLabel={t.signIn} dashboardLabel={t.dashboard} accountLabel={t.account} /></div>
        </div>
      </div>

      {languageOpen && <LanguageModal locale={locale} currency={currency} onClose={() => setLanguageOpen(false)} onSelect={setLocale} onCurrency={setCurrency}/>}
      {menu && <nav className="mobile-nav" aria-label={tx(locale, { en: 'Mobile navigation', es: 'Navegación móvil', it: 'Navigazione mobile', ar: 'قائمة الموبايل' })}>{mobileLinks.map(([label, href]) => <Link key={href} href={href} onClick={() => setMenu(false)}>{label}</Link>)}<HeaderAuthAction mobile user={headerUser} loading={headerUserLoading} signInLabel={t.signIn} dashboardLabel={t.dashboard} accountLabel={t.account} onNavigate={() => setMenu(false)} /></nav>}
    </header>

    <div className={`sticky-nav-bar${scrolled ? ' is-visible' : ''}`} aria-hidden={!scrolled}>
      <div className="container sticky-nav-inner">
        <Logo/>
        <nav aria-label={tx(locale, { en: 'Sticky navigation', es: 'Navegación fija', it: 'Navigazione fissa', ar: 'القائمة العائمة' })}>
          <Link href="/">{t.home}</Link>
          <div className="nav-dropdown"><button type="button" onClick={() => { setStickyToursOpen((value) => !value); setCompanyOpen(false) }} aria-expanded={stickyToursOpen}>{t.tours} <ChevronDown size={14}/></button>{stickyToursOpen && <div className="tour-menu">{tourLinks.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}</div>}</div>
          <Link href="/rent-car">{t.rent}</Link>
          <Link href="/events">{t.events}</Link>
          <div className="nav-dropdown sticky-company"><button type="button" onClick={() => { setCompanyOpen((value) => !value); setStickyToursOpen(false) }} aria-expanded={companyOpen}>{tx(locale, { en: 'About Company', es: 'Sobre la empresa', it: 'Sull’azienda', ar: 'عن الشركة' })} <ChevronDown size={14}/></button>{companyOpen && <div className="tour-menu"><Link href="/about">{t.about}</Link><Link href="/contact">{t.contact}</Link><Link href="/blogs">{t.blogs}</Link></div>}</div>
          <Link className="special-link" href="/special-offers">{t.offer}</Link>
        </nav>
        <div className="sticky-nav-actions">
          <Link className={`icon-btn header-cart sticky-cart${cartLines > 0 ? ' has-items' : ''}`} href="/cart" aria-label={cartLabel}>
            <ShoppingCart size={16}/>
            {cartLines > 0 && <span className="cart-count-badge" aria-hidden="true">{cartLines > 9 ? '9+' : cartLines}</span>}
          </Link>
          <Link className="make-trip-link" href="/make-your-trip">{t.make}</Link><HeaderAuthAction user={headerUser} loading={headerUserLoading} signInLabel={t.signIn} dashboardLabel={t.dashboard} accountLabel={t.account} />
        </div>
      </div>
    </div>

    <div className="promo" aria-live="polite" onMouseEnter={() => { promoHold.current = true }} onMouseLeave={() => { promoHold.current = false }}>
      <span className="promo-icons" key={'pi' + promoIdx}>{promos[promoIdx].icons}</span><strong key={'pt' + promoIdx} className="promo-swap">{promos[promoIdx].text}</strong><Link key={'pl' + promoIdx} href={promos[promoIdx].href} className="promo-swap">{promos[promoIdx].label}</Link><span className="promo-dots">{promos.map((_, index) => <button key={index} type="button" className={index === promoIdx ? 'active' : ''} aria-label={'Show announcement ' + (index + 1)} aria-current={index === promoIdx} onClick={() => setPromoIdx(index)}/>)}</span>
    </div>
  </>
}

function LegacyHeader(){const [menu,setMenu]=useState(false); const [open,setOpen]=useState(false); const [stickyOpen,setStickyOpen]=useState(false); const [languageOpen,setLanguageOpen]=useState(false); const [notifOpen,setNotifOpen]=useState(false); const [marketingUnreadCount,setMarketingUnreadCount]=useState(0); const {locale,setLocale,currency,setCurrency}=useLocale(); const [query,setQuery]=useState(''); const router=useRouter(); const pathname=usePathname(); const [promoIdx,setPromoIdx]=useState(0); const promoHold=useRef(false); const [scrolled,setScrolled]=useState(false); useEffect(()=>{setOpen(false); setStickyOpen(false); setMenu(false); setNotifOpen(false);},[pathname]); useEffect(()=>{const onDocClick=(e:MouseEvent)=>{const target=e.target as HTMLElement; if(!target.closest('.nav-dropdown')){setOpen(false); setStickyOpen(false);} if(!target.closest('.notif-wrapper')){setNotifOpen(false);}}; document.addEventListener('click',onDocClick); return ()=>document.removeEventListener('click',onDocClick);},[]); useEffect(()=>{const id=setInterval(()=>{if(!promoHold.current) setPromoIdx((i)=>(i+1)%2);},5000); return ()=>clearInterval(id);},[]); useEffect(()=>{const onScroll=()=>setScrolled(window.scrollY>130); onScroll(); window.addEventListener('scroll',onScroll,{passive:true}); return ()=>window.removeEventListener('scroll',onScroll);},[]); const t=copy[locale]; const ex=extra[locale]; const promos=[{text:t.promo,href:'/special-offers',label:ex.viewPackages,icons:<><Ticket size={26}/><BadgePercent size={26}/></>},{text:ex.promo2,href:'/special-offers',label:ex.viewOffers,icons:<><Star size={26}/><BadgePercent size={26}/></>}]; return <><header suppressHydrationWarning className="site-header"><div className="header-top container"><button className="mobile-menu" onClick={()=>setMenu(!menu)} aria-label="Open menu">{menu?<X/>:<Menu/>}</button><Logo/><form className="site-search" role="search" onSubmit={(e)=>{e.preventDefault();router.push('/search?q='+encodeURIComponent(query))}}><Search size={19}/><input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder={t.search} aria-label="Search places and things to do"/></form><div className="header-actions"><LanguageToggle label={tx(locale, { en: 'EN', es: 'ES', it: 'IT', ar: 'AR' })+' - '+currency} onOpen={()=>setLanguageOpen(true)}/><div className="notif-wrapper"><button type="button" className={`icon-btn notif-btn ${notifOpen?'active':''}`} onClick={()=>setNotifOpen(!notifOpen)} aria-label="Notifications" aria-expanded={notifOpen}><Bell size={18}/><span className="notif-badge-pulse"/></button>{notifOpen&&<NotificationDropdown locale={locale} onClose={()=>setNotifOpen(false)} onUnreadCountChange={setMarketingUnreadCount}/>}</div><Link className="icon-btn" href="/account/bookings" aria-label="My bookings"><ShoppingCart size={18}/></Link><div className="header-socials"><HeaderSocials /></div></div></div><div className="header-nav"><div className="container header-nav-inner"><nav><Link href="/">{t.home}</Link><div className="nav-dropdown"><button onClick={()=>setOpen(!open)}>{t.tours} <ChevronDown size={14}/></button>{open&&<div className="tour-menu"><Link href="/trips">{tx(locale, { en: 'All Trips', es: 'Todos los viajes', it: 'Tutti i viaggi', ar: 'كل الرحلات' })}</Link><Link href="/egypt-tours/one-day-tours">{ex.cat1}</Link><Link href="/egypt-tours/multi-days-tours">{ex.cat2}</Link><Link href="/egypt-tours/nile-cruises">{ex.cat3}</Link><Link href="/egypt-tours/shore-excursions">{ex.cat4}</Link></div>}</div><Link href="/rent-car">{t.rent}</Link><Link href="/about">{t.about}</Link><Link href="/contact">{t.contact}</Link><Link href="/blogs">{t.blogs}</Link><Link href="/events">{t.events}</Link><Link className="special-link" href="/special-offers">{t.offer}</Link></nav><div className="nav-right-actions"><Link className="make-trip-link" href="/make-your-trip">{t.make}</Link><Link className="outline-btn" href="/login">{t.signIn}</Link></div></div></div>{languageOpen&&<LanguageModal locale={locale} currency={currency} onClose={()=>setLanguageOpen(false)} onSelect={setLocale} onCurrency={setCurrency}/>} {menu&&<div className="mobile-nav">{[[t.home,'/'],[t.tours,'/trips'],[t.rent,'/rent-car'],[t.about,'/about'],[t.contact,'/contact'],[t.blogs,'/blogs'],[t.events,'/events']].map(([label,href])=><Link key={label} href={href} onClick={()=>setMenu(false)}>{label}</Link>)}</div>}</header><div className={'sticky-nav-bar'+(scrolled?' is-visible':'')} aria-hidden={!scrolled}><div className="container sticky-nav-inner"><Logo/><nav><Link href="/">{t.home}</Link><div className="nav-dropdown"><button onClick={()=>setStickyOpen(!stickyOpen)}>{t.tours} <ChevronDown size={14}/></button>{stickyOpen&&<div className="tour-menu"><Link href="/trips">{tx(locale, { en: 'All Trips', es: 'Todos los viajes', it: 'Tutti i viaggi', ar: 'كل الرحلات' })}</Link><Link href="/egypt-tours/one-day-tours">{ex.cat1}</Link><Link href="/egypt-tours/multi-days-tours">{ex.cat2}</Link><Link href="/egypt-tours/nile-cruises">{ex.cat3}</Link><Link href="/egypt-tours/shore-excursions">{ex.cat4}</Link></div>}</div><Link href="/rent-car">{t.rent}</Link><Link href="/about">{t.about}</Link><Link href="/contact">{t.contact}</Link><Link href="/blogs">{t.blogs}</Link><Link href="/events">{t.events}</Link><Link className="special-link" href="/special-offers">{t.offer}</Link></nav><div className="sticky-nav-actions"><Link className="make-trip-link" href="/make-your-trip">{t.make}</Link><Link className="outline-btn" href="/login">{t.signIn}</Link></div></div></div><div className="promo" aria-live="polite" onMouseEnter={()=>{promoHold.current=true;}} onMouseLeave={()=>{promoHold.current=false;}}><span className="promo-icons" key={'pi'+promoIdx}>{promos[promoIdx].icons}</span><strong key={'pt'+promoIdx} className="promo-swap">{promos[promoIdx].text}</strong><Link key={'pl'+promoIdx} href={promos[promoIdx].href} className="promo-swap">{promos[promoIdx].label}</Link><span className="promo-dots">{promos.map((_,i)=><button key={i} type="button" className={i===promoIdx?'active':''} aria-label={'Show announcement '+(i+1)} aria-current={i===promoIdx} onClick={()=>setPromoIdx(i)}/>)}</span></div></>}

export function Footer(){const {locale}=useLocale(); const ex=extra[locale]; const brand=useBrandSettings(); const footerTag=locale === 'ar' ? (brand.aboutAr || ex.footerTag) : (brand.aboutEn || ex.footerTag); const t=copy[locale]; return <footer><div className="container footer-grid"><div className="foot-brand"><Logo/><p>{footerTag}</p><span className="cert-badge"><Gift size={14}/><span>{ex.certBadge}</span></span><div className="socials foot-socials"><FooterSocials /></div><div className="socials" style={{display:'none'}}><a href="https://www.facebook.com/" target="_blank" rel="noreferrer" aria-label="Facebook" style={{display:'inline-block',marginRight:14}}>f</a><a href="https://www.instagram.com/" target="_blank" rel="noreferrer" aria-label="Instagram" style={{display:'inline-block',marginRight:14}}>◎</a><a href="https://www.youtube.com/" target="_blank" rel="noreferrer" aria-label="YouTube" style={{display:'inline-block',marginRight:14}}>◉</a><a href="https://www.tiktok.com/" target="_blank" rel="noreferrer" aria-label="TikTok" style={{display:'inline-block'}}>♪</a></div></div><div><h3>{ex.footExplore}</h3><Link href="/">{t.home}</Link><Link href="/trips">{tx(locale, { en: 'All Trips', es: 'Todos los viajes', it: 'Tutti i viaggi', ar: 'كل الرحلات' })}</Link><Link href="/egypt-tours/one-day-tours">{ex.cat1}</Link><Link href="/egypt-tours/multi-days-tours">{ex.cat2}</Link><Link href="/egypt-tours/nile-cruises">{ex.cat3}</Link><Link href="/egypt-tours/shore-excursions">{ex.cat4}</Link><Link href="/special-offers">{t.offer}</Link></div><div><h3>{ex.footCompany}</h3><Link href="/rent-car">{t.rent}</Link><Link href="/about">{t.about}</Link><Link href="/contact">{t.contact}</Link><Link href="/egypt-travel-guide">{ex.guideLink}</Link><Link href="/faq">{ex.faqsLink}</Link><Link href="/events">{t.events}</Link><Link href="/accessible-travel">{ex.accessLink}</Link></div><div><h3>{ex.contactInfo}</h3><div className="foot-contact"><a href={phoneHref(brand.phone)} aria-label={tx(locale, { en: 'Call STAR PYRAMIDS', es: 'Llama a STAR PYRAMIDS', it: 'Chiama STAR PYRAMIDS', ar: 'اتصل بستار بيراميدز' })}><Phone size={15}/><span>{brand.phone}</span></a><a href={whatsappHref(brand.whatsapp)} target="_blank" rel="noreferrer" aria-label={tx(locale, { en: 'Chat with STAR PYRAMIDS on WhatsApp', es: 'Habla con STAR PYRAMIDS por WhatsApp', it: 'Chatta con STAR PYRAMIDS su WhatsApp', ar: 'راسل ستار بيراميدز على واتساب' })}><svg className="wa-ic" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg><span>{brand.whatsapp}</span></a><a href={`mailto:${brand.email}`}><Mail size={15}/><span>{brand.email}</span></a><span className="foot-addr"><MapPin size={15}/><span>{brand.address}</span></span></div></div></div><div className="container copyright">{ex.rights} <span className="powered-by">| {ex.poweredBy} <a href="https://panel.dipencil.com" target="_blank" rel="noreferrer" aria-label="Dipencil"><img src="https://panel.dipencil.com/pencil-logo.png" alt="Dipencil" loading="lazy"/></a></span> <span><Link href="/privacy">{ex.privacy}</Link>　<Link href="/terms">{ex.terms}</Link></span></div></footer>}

function DynamicFooter() {
  const { locale } = useLocale()
  const ex = extra[locale]
  const t = copy[locale]
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
        <Link href="/trips">{tx(locale, { en: 'All Trips', es: 'Todos los viajes', it: 'Tutti i viaggi', ar: 'كل الرحلات' })}</Link>
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
      <span><Link href="/privacy">{ex.privacy}</Link>　<Link href="/terms">{ex.terms}</Link></span>
    </div>
  </footer>
}

export function SupportWidgets(){const [active,setActive]=useState<'live'|'wa'|null>(null); return <div className="support-widgets"><LiveChatWidget open={active==='live'} onOpen={()=>setActive('live')} onClose={()=>setActive((a)=>a==='live'?null:a)}/><WhatsAppWidget open={active==='wa'} onOpen={()=>setActive('wa')} onClose={()=>setActive((a)=>a==='wa'?null:a)}/></div>}

function AccessStrip(){const {locale}=useLocale(); const ex=extra[locale]; const [show,setShow]=useState(true); if(!show) return null; return <div className="access-strip"><Accessibility size={20}/><p>{ex.accessNote}</p><Link href="/accessible-travel">{ex.readMoreBtn}</Link><button type="button" onClick={()=>setShow(false)} aria-label="Dismiss">×</button></div>}

function ScrollTop(){const [show,setShow]=useState(false); useEffect(()=>{const onScroll=()=>setShow(window.scrollY>500); onScroll(); window.addEventListener('scroll',onScroll,{passive:true}); return ()=>window.removeEventListener('scroll',onScroll);},[]); const goTop=()=>{const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches; window.scrollTo({top:0,behavior:reduced?'auto':'smooth'});}; return <button type="button" className={'scroll-top'+(show?' show':'')} onClick={goTop} aria-label="Scroll to top"><ArrowUp size={20}/></button>}

export function SiteShell({children}:{children:React.ReactNode}){return <LocaleProvider><Header/>{children}<AccessStrip/><SupportWidgets/><ScrollTop/><DynamicFooter/></LocaleProvider>}

export function FilterField({label,placeholder,date=false,value,onChange,options}:{label:string;placeholder:string;date?:boolean;value?:string;onChange?:(v:string)=>void;options?:readonly (string|{value:string;label:string})[]}){const fieldStyle={border:0,outline:0,background:'transparent',width:'100%',font:'inherit',color:'inherit',minHeight:'auto'} as const; const {locale:ffLocale}=useLocale(); return <label className="filter-field"><span>{label}</span><div>{options?<SharedSelect value={value??''} onChange={(next)=>onChange?.(next)} locale={ffLocale} label={label} options={[{value:'',label:placeholder},...options.map((o)=>typeof o==='string'?{value:o,label:o}:{value:o.value,label:o.label})]} />:date?<DateInput aria-label={label} value={value??''} onChange={(e)=>onChange?.(e.target.value)} hideNativeIndicator style={fieldStyle}/>:value!==undefined?<input aria-label={label} value={value} onChange={(e)=>onChange?.(e.target.value)} placeholder={placeholder} style={fieldStyle}/>:<>{placeholder}<ChevronDown size={17}/></>}</div></label>}

export function HeroField({title,placeholder,value,onChange,options,date=false}:{title:string;placeholder:string;value:string;onChange:(v:string)=>void;options?:string[];date?:boolean}){const control={width:'100%',border:0,outline:0,background:'transparent',fontSize:15,fontFamily:'inherit',color:value?'#1d1f1f':'#a7a7a7',padding:0,minHeight:28} as const; const {locale:hfLocale}=useLocale(); return <label className="hero-field"><span className="hero-field-title">{title}</span>{options?<span className="hero-field-control"><SharedSelect value={value} onChange={onChange} locale={hfLocale} label={title} options={[{value:'',label:placeholder},...options.map((o)=>({value:o,label:o}))]} /></span>:<span className="hero-field-control">{date?<DateInput aria-label={title} value={value} onChange={(e)=>onChange(e.target.value)} placeholder={placeholder} placeholderMode hideNativeIndicator style={control}/>:<input aria-label={title} value={value} onChange={(e)=>onChange(e.target.value)} placeholder={placeholder} style={control}/>}{!date&&<ChevronDown size={20}/>}</span>}</label>}

export function TripSearchEngine(){const [tab,setTab]=useState('Make Your Trip'); const [trip,setTrip]=useState('exact'); const [from,setFrom]=useState(''); const [to,setTo]=useState(''); const [where,setWhere]=useState(''); const [howLong,setHowLong]=useState(''); const [tripKind,setTripKind]=useState(''); const [tripType,setTripType]=useState('One Way'); const [pickup,setPickup]=useState(''); const [dropoff,setDropoff]=useState(''); const [pickupDate,setPickupDate]=useState(''); const router=useRouter(); const tabNames=['Make Your Trip','Find your trip','Rent Car']; const {locale:tl}=useLocale(); const ex=extra[tl]; const tabIndex=Math.max(0,tabNames.indexOf(tab)); const rtl=typeof document!=='undefined'&&document.documentElement.dir==='rtl'; return <div className="search-wrap"><div className="search-tabs" role="tablist" aria-label="Trip search"><span className="seg-indicator" aria-hidden="true" style={{transform:`translateX(${(rtl?-1:1)*tabIndex*100}%)`}}/>{tabNames.map(t=><button key={t} type="button" role="tab" aria-selected={tab===t} className={tab===t?'active':''} onClick={()=>setTab(t)}>{[ex.tabMake,ex.tabFind,ex.tabRent][tabNames.indexOf(t)]}</button>)}</div><div className="search-panel"><div className="search-panel-body" key={tab} role="tabpanel">{tab==='Make Your Trip'&&<><div className="trip-question"><strong>{ex.qWhen}</strong>{[['exact',ex.qExact],['approx',ex.qApprox],['unsure',ex.qUnsure]].map(([v,l])=><button key={v} type="button" className={trip===v?'selected-radio':''} aria-pressed={trip===v} onClick={()=>setTrip(v)}><i className={trip===v?'checked':''}/>{l}</button>)}</div><div className="field-grid cols-2"><HeroField title={ex.fFrom} placeholder={ex.fFromPh} date value={from} onChange={setFrom}/><HeroField title={ex.fTo} placeholder={ex.fToPh} date value={to} onChange={setTo}/><Link className="primary-btn" href={`/make-your-trip${from||to?`?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`:''}`}>{ex.makeTripBtn} <ArrowRight size={18}/></Link></div></>}{tab==='Find your trip'&&<><div className="trip-question"><strong>{ex.qWhat}</strong>{[['one-day-tours',ex.k1],['multi-days-tours',ex.k2],['nile-cruises',ex.k3],['shore-excursions',ex.k4]].map(([v,l])=><button key={v} type="button" className={tripKind===v?'selected-radio':''} aria-pressed={tripKind===v} onClick={()=>setTripKind(tripKind===v?'':v)}><i className={tripKind===v?'checked':''}/>{l}</button>)}</div><div className="field-grid cols-2"><HeroField title={ex.wWhere} placeholder={ex.wWherePh} value={where} onChange={setWhere} options={destinations.map(d=>d.title)}/><HeroField title={ex.wLong} placeholder={ex.wLongPh} value={howLong} onChange={setHowLong} options={['1 day','2-3 days','4-7 days','8+ days']}/><button type="button" className="primary-btn" onClick={()=>{if(tripKind)router.push('/egypt-tours/'+tripKind);else router.push('/search?q='+encodeURIComponent([where,howLong].filter(Boolean).join(' ')||'Egypt'))}}>{ex.searchBtn} <ArrowRight size={18}/></button></div></>}{tab==='Rent Car'&&<><div className="trip-question"><strong>{ex.qType}</strong>{[['One Way',ex.tOne],['Round Trip',ex.tRound]].map(([v,l])=><button key={v} type="button" className={tripType===v?'selected-radio':''} aria-pressed={tripType===v} onClick={()=>setTripType(v)}><i className={tripType===v?'checked':''}/>{l}</button>)}</div><div className="field-grid cols-3"><HeroField title={ex.cHolder} placeholder={ex.cHolderPh} value={pickup} onChange={setPickup}/><HeroField title={ex.cDrop} placeholder={ex.cDropPh} value={dropoff} onChange={setDropoff}/><HeroField title={ex.cDate} placeholder={ex.cDatePh} date value={pickupDate} onChange={setPickupDate}/><button type="button" className="primary-btn" onClick={()=>router.push(`/rent-car/request?pickup=${encodeURIComponent(pickup)}&dropoff=${encodeURIComponent(dropoff)}&type=${encodeURIComponent(tripType)}&date=${encodeURIComponent(pickupDate)}`)}>{ex.sendReq} <ArrowRight size={18}/></button></div></>}</div></div></div>}

export function CardGallery({ images: imgs, title, href, children }: { images: readonly string[]; title: string; href: string; children?: React.ReactNode }){const [idx,setIdx]=useState(0); const scrub=(e:CardMouseEvent<HTMLDivElement>)=>{const r=e.currentTarget.getBoundingClientRect(); setIdx(Math.min(imgs.length-1,Math.max(0,Math.floor((e.clientX-r.left)/r.width*imgs.length))));}; return <div className="card-gallery" onMouseMove={scrub} onMouseLeave={()=>setIdx(0)}><Link href={href} aria-label={title} className="tour-gallery-link">{imgs.map((src,i)=><img key={src+i} src={src} alt={i===0?title:''} aria-hidden={i!==0} className={i===idx?'on':''}/>)}</Link>{children}<div className="tour-dots" role="tablist" aria-label="Photos">{imgs.map((_,i)=><button key={i} type="button" role="tab" aria-selected={i===idx} aria-label={'Show photo '+(i+1)} className={i===idx?'active':''} onClick={()=>setIdx(i)}/>)}</div></div>}

export function TourCard({ tour, variant = 'multi' }: { tour: Tour; variant?: TourVariant }) {
  const [copied, setCopied] = useState(false)
  const favorites = useCustomerFavorites()
  const { currency, locale: plc } = useLocale()
  const href = `/egypt-tours/${tour.slug}`
  const title = pickLocaleText(plc, { en: tour.title, ar: tour.titleAr })
  const saved = favorites.has(tour.slug)
  const cruiseTypeInfo = variant === 'cruise' && tour.cruiseType ? getCruiseTypeBySlug(tour.cruiseType) : undefined
  let offset = 0
  for (const ch of tour.slug) offset = (offset + ch.charCodeAt(0)) % images.length
  const gallery = tour.gallery ?? [tour.image, ...images.slice(offset), ...images.slice(0, offset)].filter((src, index, all) => all.indexOf(src) === index).slice(0, 5)

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

  return <article className={`tour-card ${variant}`}>
    <div className="tour-image">
      <CardGallery images={gallery} title={title} href={href}>
        <button type="button" className="tour-fav" aria-label={saved ? tx(plc, { en: 'Remove from saved', es: 'Quitar de guardados', it: 'Rimuovi dai salvati', ar: 'إزالة من المحفوظات' }) : tx(plc, { en: 'Save tour', es: 'Guardar el viaje', it: 'Salva il viaggio', ar: 'حفظ الرحلة' })} aria-pressed={saved} onClick={() => favorites.toggle(tour.slug)}><Heart size={17} fill={saved ? '#f7951d' : 'none'} color={saved ? '#f7951d' : '#1f2937'} strokeWidth={2} /></button>
        <button type="button" className="tour-share" aria-label={copied ? tx(plc, { en: 'Link copied', es: 'Enlace copiado', it: 'Link copiato', ar: 'تم نسخ الرابط' }) : tx(plc, { en: 'Share tour', es: 'Compartir el viaje', it: 'Condividi il viaggio', ar: 'مشاركة الرحلة' })} onClick={share}>{copied ? <Check size={17} color="#1d4ed8" /> : <Share2 size={17} color="#1f2937" />}</button>
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

export function PageShowcaseHero({ image, eyebrow, title, intro, primaryLabel, primaryHref, secondaryLabel, secondaryHref, railLabel, railTitle, railHref, railMeta, statsLabel, stats }: PageShowcaseHeroProps) {
  return <section className="events-page-hero tour-category-page-hero">
    <img src={image} alt="" />
    <div className="events-page-hero-shade" />
    <div className="container events-page-hero-content">
      <div className="events-page-hero-copy">
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{intro}</p>
        <div className="events-page-hero-actions">
          <a href={primaryHref} className="primary-btn">{primaryLabel} <ArrowRight size={17}/></a>
          <Link href={secondaryHref} className="events-hero-link">{secondaryLabel} <ArrowRight size={16}/></Link>
        </div>
      </div>
      <div className="events-hero-rail">
        <Link href={railHref} className="events-next-event">
          <span>{railLabel}</span>
          <strong>{railTitle}</strong>
          <small>{railMeta.map(({ Icon, label }, index) => <span className="showcase-hero-meta" key={`${label}-${index}`}>{index > 0 && <i aria-hidden="true"/>}<Icon size={14}/>{label}</span>)}</small>
        </Link>
        <div className="events-hero-stats" aria-label={statsLabel}>
          {stats.map((stat) => <span key={stat.label}><b>{stat.value}</b>{stat.label}</span>)}
        </div>
      </div>
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

function OneDayToursRegionsContent(){const {locale:dl}=useLocale(); const set=tourCategories['one-day-tours']; const meta=catMeta.day;  const catTitle=pickLocaleText(dl, { en: set.title, ar: categoryCopy['one-day-tours'].titleAr }); const catIntro=pickLocaleText(dl, { en: set.intro, ar: categoryCopy['one-day-tours'].introAr }); const catEyebrow=dl === 'ar' ? meta.eyebrowAr : meta.eyebrow; const liveDestinations=useDbDestinations(destinations);const liveTours=useDbTours(oneDayTourBase);const regions=getPublishedOneDayDestinations(liveDestinations).map((d)=>({slug:d.slug,title:dl==='ar'?(d.nameAr??d.title):d.title,copy:dl==='ar'?(d.copyAr??d.copy):d.copy,items:getOneDayToursForDestination(liveTours,d.slug)})).filter((r)=>r.items.length>0); const total=regions.reduce((n,r)=>n+r.items.length,0); const featured=regions.flatMap((region)=>region.items)[0]??liveTours[0]; return <><TourCategoryHero image={featured.image} eyebrow={catEyebrow} title={catTitle} intro={catIntro} primaryLabel={tx(dl, { en: 'Explore day tours', es: 'Explora los circuitos de un día', it: 'Esplora i tour di un giorno', ar: 'استكشف رحلات اليوم الواحد' })} primaryHref="#one-day-regions" featuredLabel={tx(dl, { en: 'Featured day tour', es: 'Circuito destacado de un día', it: 'Tour di un giorno in evidenza', ar: 'رحلة يوم مميزة' })} featuredTitle={pickLocaleText(dl, { en: featured.title, ar: featured.titleAr })} featuredHref={`/egypt-tours/${featured.slug}`} featuredLocation={dl === 'ar' ? localizeTourLocation(featured.location) : featured.location} featuredDuration={dl === 'ar' ? localizeTourDuration(featured.duration) : featured.duration} statsLabel={tx(dl, { en: 'One-day tours summary', es: 'Resumen de circuitos de un día', it: 'Riepilogo dei tour di un giorno', ar: 'ملخص رحلات اليوم الواحد' })} stats={[{value:total,label:tx(dl, { en: 'Tours available', es: 'Circuitos disponibles', it: 'Tour disponibili', ar: 'رحلات متاحة' })},{value:regions.length,label:tx(dl, { en: 'Egypt destinations', es: 'Destinos egipcios', it: 'Destinazioni egiziane', ar: 'وجهات مصرية' })}]}/><Breadcrumb items={[tx(dl, { en: 'Egypt Tours', es: 'Circuitos por Egipto', it: 'Tour in Egitto', ar: 'جولات مصر' }), catTitle]}/><main id="one-day-regions" className="listing-page container"><nav className="category-pills region-nav" aria-label={tx(dl, { en: 'Governorates', es: 'Gobernaciones', it: 'Governatorati', ar: 'المحافظات' })}>{regions.map(r=><a key={r.slug} href={'#'+r.slug}>{r.title}</a>)}</nav><p className="region-count">{tx(dl, { en: 'Browse', es: 'Explora', it: 'Sfoglia', ar: 'تصفح' })} <strong>{total}</strong> {tx(dl, { en: 'one-day tours across', es: 'circuitos de un día en', it: 'tour di un giorno in', ar: 'رحلة يوم واحد في' })} <strong>{regions.length}</strong> {tx(dl, { en: 'governorates', es: 'gobernaciones', it: 'governatorati', ar: 'محافظات' })}</p>{regions.map(r=><section key={r.slug} id={r.slug} className="region-block" aria-label={r.title}><div className="region-head"><div><span className="eyebrow">{catTitle}</span><h2>{r.title}</h2><p>{r.copy}</p></div><div className="region-badge-wrap"><span className="region-badge">{r.items.length} {tx(dl, { en: 'tours', es: 'circuitos', it: 'tour', ar: 'رحلات' })}</span><Link href={`/egypt-tours/one-day-tours/${r.slug}`} className="region-see-more">{tx(dl, { en: 'See more', es: 'Ver más', it: 'Vedi di più', ar: 'شاهد الكل' })} <ArrowRight size={14}/></Link></div></div><div className="compact-tour-grid region-tours">{r.items.slice(0,4).map(t=><TourCard key={t.slug} tour={t} variant='day'/>)}</div></section>)}<HelpCTA/></main></>}

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
      <div className={`cat-hero ${variant}`}>
        <span className="cat-hero-ic" aria-hidden="true"><HeroIcon size={34}/></span>
        <div>
          <span className="eyebrow">{tx(locale, { en: meta.eyebrow, es: isCruise ? 'Navega por el Nilo' : (eyebrowEs[meta.eyebrow] ?? meta.eyebrow), it: isCruise ? 'Naviga sul Nilo' : (eyebrowIt[meta.eyebrow] ?? meta.eyebrow), ar: isCruise ? 'أبحر في النيل' : meta.eyebrowAr })}</span>
          <h1>{regionTitle}</h1>
          <p>{pickLocaleText(locale, { en: region.copy, ar: region.copyAr })}</p>
          <div className="cat-feats">{(isCruise ? [{ Icon: Ship, text: featLabel(locale, 'Nile itineraries', 'مسارات نيلية') }, { Icon: Users, text: featLabel(locale, 'Cruise options', 'خيارات متعددة') }] : meta.feats.map((feature, index) => ({ Icon: feature.Icon, text: featLabel(locale, feature.text, meta.featsAr[index]?.text ?? feature.text) }))).map((feature) => <span key={feature.text}><feature.Icon size={14}/>{feature.text}</span>)}</div>
        </div>
      </div>
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
  return <><TourCategoryHero image={featured.image} eyebrow={catEyebrow} title={catTitle} intro={catIntro} primaryLabel={tx(dl, { en: 'Explore multi-day journeys', es: 'Explora los viajes de varios días', it: 'Esplora i viaggi di più giorni', ar: 'استكشف رحلات متعددة الأيام' })} primaryHref="#multi-day-categories" featuredLabel={tx(dl, { en: 'Featured journey', es: 'Viaje destacado', it: 'Viaggio in evidenza', ar: 'رحلة مميزة' })} featuredTitle={pickLocaleText(dl, { en: featured.title, ar: featured.titleAr })} featuredHref={`/egypt-tours/${featured.slug}`} featuredLocation={dl === 'ar' ? localizeTourLocation(featured.location) : featured.location} featuredDuration={dl === 'ar' ? localizeTourDuration(featured.duration) : featured.duration} statsLabel={tx(dl, { en: 'Multi-day tours summary', es: 'Resumen de viajes de varios días', it: 'Riepilogo dei viaggi di più giorni', ar: 'ملخص رحلات متعددة الأيام' })} stats={[{value:total,label:tx(dl, { en: 'Journeys available', es: 'Viajes disponibles', it: 'Viaggi disponibili', ar: 'رحلات متاحة' })},{value:entries.length,label:tx(dl, { en: 'Travel categories', es: 'Categorías de viaje', it: 'Categorie di viaggio', ar: 'فئات سفر' })}]}/><Breadcrumb items={[tx(dl, { en: 'Egypt Tours', es: 'Circuitos por Egipto', it: 'Tour in Egitto', ar: 'جولات مصر' }), catTitle]}/><main id="multi-day-categories" className="listing-page container"><nav className="category-pills region-nav" aria-label={tx(dl, { en: 'Travel categories', es: 'Categorías de viaje', it: 'Categorie di viaggio', ar: 'فئات السفر' })}>{entries.map(({category})=><a key={category.slug} href={'#'+category.slug}>{dl==='ar'?category.nameAr:category.name}</a>)}</nav><p className="region-count">{tx(dl, { en: 'Browse', es: 'Explora', it: 'Sfoglia', ar: 'تصفح' })} <strong>{total}</strong> {tx(dl, { en: 'multi-day journeys across', es: 'viajes de varios días en', it: 'viaggi di più giorni in', ar: 'رحلة متعددة الأيام في' })} <strong>{entries.length}</strong> {tx(dl, { en: 'travel categories', es: 'categorías de viaje', it: 'categorie di viaggio', ar: 'فئات سفر' })}</p>{entries.map(({category,tours})=><section key={category.slug} id={category.slug} className="region-block" aria-label={dl==='ar'?category.nameAr:category.name}><div className="region-head"><div><span className="eyebrow">{catTitle}</span><h2>{dl==='ar'?category.nameAr:category.name}</h2><p>{dl==='ar'?category.copyAr:category.copy}</p></div><div className="region-badge-wrap"><span className="region-badge">{tours.length} {tx(dl, { en: 'tours', es: 'viajes', it: 'viaggi', ar: 'رحلات' })}</span><Link href={`/egypt-tours/multi-days-tours/${category.slug}`} className="region-see-more">{tx(dl, { en: 'See more', es: 'Ver más', it: 'Vedi di più', ar: 'شاهد المزيد' })} <ArrowRight size={14}/></Link></div></div><div className="compact-tour-grid region-tours">{tours.slice(0,4).map(t=><TourCard key={t.slug} tour={t} variant='multi'/>)}</div></section>)}<HelpCTA/></main></>
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

export function CategoryFilter({destination,duration,price,destinationOptions,durationOptions,appliedCount,onDestination,onDuration,onPrice,onSearch,onReset}:{destination:string;duration:string;price:string;destinationOptions:readonly string[];durationOptions:readonly string[];appliedCount:number;onDestination:(v:string)=>void;onDuration:(v:string)=>void;onPrice:(v:string)=>void;onSearch:()=>void;onReset:()=>void}){const {currency,locale:fl}=useLocale(); const lo=formatPrice(200,currency,fl); const hi=formatPrice(400,currency,fl); const bandLabel=(id:string)=>tx(fl, { en: id==='under-200' ? `Under ${lo}` : id==='200-400' ? `${lo} - ${hi}` : `Over ${hi}`, es: id==='under-200' ? `Menos de ${lo}` : id==='200-400' ? `${lo} - ${hi}` : `Más de ${hi}`, it: id==='under-200' ? `Meno di ${lo}` : id==='200-400' ? `${lo} - ${hi}` : `Più di ${hi}`, ar: id==='under-200' ? `أقل من ${lo}` : id==='200-400' ? `${lo} - ${hi}` : `أكثر من ${hi}` }); return <div className="category-filter"><div className="filter-grid"><label className="filter-field"><span>{tx(fl, { en: 'Destination', es: 'Destino', it: 'Destinazione', ar: 'الوجهة' })}</span><SharedSelect value={destination} onChange={onDestination} locale={fl} options={[{value:'',label:tx(fl, { en: 'All destinations', es: 'Todos los destinos', it: 'Tutte le destinazioni', ar: 'كل الوجهات' })},...destinationOptions.map((d)=>({value:d,label:d}))]} /></label><label className="filter-field"><span>{tx(fl, { en: 'Duration', es: 'Duración', it: 'Durata', ar: 'المدة' })}</span><SharedSelect value={duration} onChange={onDuration} locale={fl} options={[{value:'',label:tx(fl, { en: 'Any duration', es: 'Cualquier duración', it: 'Qualsiasi durata', ar: 'أي مدة' })},...durationOptions.map((d)=>({value:d,label:d}))]} /></label><label className="filter-field"><span>{tx(fl, { en: 'Price', es: 'Precio', it: 'Prezzo', ar: 'السعر' })}</span><SharedSelect value={price} onChange={onPrice} locale={fl} options={[{value:'',label:tx(fl, { en: 'Any price', es: 'Cualquier precio', it: 'Qualsiasi prezzo', ar: 'أي سعر' })},...tourPriceBands.filter((band)=>band.id!=='').map((band)=>({value:band.id,label:bandLabel(band.id)}))]} /></label><button type="button" className="primary-btn" onClick={onSearch}>{tx(fl, { en: 'Search', es: 'Buscar', it: 'Cerca', ar: 'بحث' })}</button></div><div className="filter-footer"><span>{appliedCount>0?tx(fl, { en: `${appliedCount} filter${appliedCount===1?'':'s'} applied`, es: `${appliedCount} filtros aplicados`, it: `${appliedCount} filtri applicati`, ar: `${appliedCount} فلاتر مفعلة` }):tx(fl, { en: 'Showing all tours', es: 'Mostrando todos los viajes', it: 'Visualizzati tutti i viaggi', ar: 'عرض كل الرحلات' })}</span><button type="button" onClick={onReset}>{tx(fl, { en: 'Reset Filters', es: 'Borrar filtros', it: 'Cancella i filtri', ar: 'مسح الفلاتر' })}</button></div></div>}

export function TourListing({slug}:{slug:TourCategory}){return <SiteShell><Suspense><TourListingInner slug={slug}/></Suspense></SiteShell>}

function TourListingInner({slug}:{slug:TourCategory}){const set=tourCategories[slug]; const variant=set.variant; const meta=catMeta[variant]; const {locale:tl}=useLocale(); const catTitle=pickLocaleText(tl, { en: set.title, ar: categoryCopy[slug].titleAr }); const catIntro=pickLocaleText(tl, { en: set.intro, ar: categoryCopy[slug].introAr }); const catEyebrow=tx(tl, { en: meta.eyebrow, es: eyebrowEs[meta.eyebrow] ?? meta.eyebrow, it: eyebrowIt[meta.eyebrow] ?? meta.eyebrow, ar: meta.eyebrowAr }); const sortLabel=(o:string)=>tx(tl, { en: o, es: o==='Price: low to high' ? 'Precio: de menor a mayor' : o==='Price: high to low' ? 'Precio: de mayor a menor' : 'Recomendados', it: o==='Price: low to high' ? 'Prezzo: dal più basso' : o==='Price: high to low' ? 'Prezzo: dal più alto' : 'Consigliati', ar: o==='Price: low to high' ? 'السعر: من الأقل' : o==='Price: high to low' ? 'السعر: من الأعلى' : 'الموصى بها' }); const allTours=useDbTours(getToursByCategory(slug)); const featured=allTours[0]; const destinationOptions=Array.from(new Set(allTours.map((tour)=>tour.location))); const durationOptions=Array.from(new Set(allTours.map((tour)=>tour.duration))); const searchParams=useSearchParams(); const router=useRouter(); const pathname=usePathname(); const query=parseTourListingQuery(searchParams,destinationOptions,durationOptions); const [destination,setDestination]=useState(query.destination); const [duration,setDuration]=useState(query.duration); const [price,setPrice]=useState(query.price); useEffect(()=>{setDestination(query.destination);setDuration(query.duration);setPrice(query.price)},[query.destination,query.duration,query.price]); const perPage=6; const go=(next:TourListingQuery)=>{const params=new URLSearchParams(); if(next.destination)params.set('destination',next.destination); if(next.duration)params.set('duration',next.duration); if(next.price)params.set('price',next.price); if(next.sort!=='Recommended')params.set('sort',next.sort); if(next.page>1)params.set('page',String(next.page)); const qs=params.toString(); router.replace(pathname+(qs?`?${qs}`:''),{scroll:false})}; const applyFilters=()=>go({destination,duration,price,sort:query.sort,page:1}); const resetFilters=()=>{setDestination('');setDuration('');setPrice('');go({destination:'',duration:'',price:'',sort:query.sort,page:1})}; const appliedCount=[query.destination,query.duration,query.price].filter(Boolean).length; const filtered=allTours.filter((t)=>(!query.destination||t.location===query.destination)&&(!query.duration||t.duration===query.duration)&&matchPriceBand(t.price,query.price)); const sorted=[...filtered].sort((a,b)=>query.sort==='Price: low to high'?(a.price-b.price||(a.slug<b.slug?-1:1)):query.sort==='Price: high to low'?(b.price-a.price||(a.slug<b.slug?-1:1)):0); const totalPages=Math.max(1,Math.ceil(sorted.length/perPage)); const safePage=Math.min(Math.max(1,query.page),totalPages); const paged=sorted.slice((safePage-1)*perPage,safePage*perPage); const isShore=slug==='shore-excursions'; return <><TourCategoryHero image={featured.image} eyebrow={catEyebrow} title={catTitle} intro={catIntro} primaryLabel={isShore ? tx(tl, { en: 'Explore shore excursions', es: 'Explora las excursiones en tierra', it: 'Esplora le escursioni a terra', ar: 'استكشف رحلات الموانئ' }) : tx(tl, { en: 'Explore journeys', es: 'Explora los viajes', it: 'Esplora i viaggi', ar: 'استكشف الباقات' })} primaryHref="#tour-listing" featuredLabel={isShore ? tx(tl, { en: 'Featured shore excursion', es: 'Excursión en tierra destacada', it: 'Escursione a terra in evidenza', ar: 'رحلة ميناء مميزة' }) : tx(tl, { en: 'Featured journey', es: 'Viaje destacado', it: 'Viaggio in evidenza', ar: 'باقة مميزة' })} featuredTitle={pickLocaleText(tl, { en: featured.title, ar: featured.titleAr })} featuredHref={`/egypt-tours/${featured.slug}`} featuredLocation={tl === 'ar' ? localizeTourLocation(featured.location) : featured.location} featuredDuration={tl === 'ar' ? localizeTourDuration(featured.duration) : featured.duration} statsLabel={tx(tl, { en: 'Tours summary', es: 'Resumen de viajes', it: 'Riepilogo dei viaggi', ar: 'ملخص الرحلات' })} stats={[{value:allTours.length,label:isShore ? tx(tl, { en: 'Shore excursions', es: 'Excursiones en tierra', it: 'Escursioni a terra', ar: 'رحلات موانئ' }) : tx(tl, { en: 'Journeys available', es: 'Viajes disponibles', it: 'Viaggi disponibili', ar: 'باقات متاحة' })},{value:destinationOptions.length,label:isShore ? tx(tl, { en: 'Ports & destinations', es: 'Puertos y destinos', it: 'Porti e destinazioni', ar: 'موانئ ووجهات' }) : tx(tl, { en: 'Egypt destinations', es: 'Destinos egipcios', it: 'Destinazioni egiziane', ar: 'وجهات مصرية' })}]}/><Breadcrumb items={[tx(tl, { en: 'Egypt Tours', es: 'Circuitos por Egipto', it: 'Tour in Egitto', ar: 'جولات مصر' }), catTitle]}/><main id="tour-listing" className="listing-page container"><CategoryFilter destination={destination} duration={duration} price={price} destinationOptions={destinationOptions} durationOptions={durationOptions} appliedCount={appliedCount} onDestination={setDestination} onDuration={setDuration} onPrice={setPrice} onSearch={applyFilters} onReset={resetFilters}/><div className="results-bar"><strong role="status">{tx(tl, { en: `${sorted.length} tour${sorted.length===1?'':'s'} found`, es: `${sorted.length} recorridos disponibles`, it: `${sorted.length} tour disponibili`, ar: `${sorted.length} رحلات متاحة` })}</strong><SharedSelect value={query.sort} onChange={(o)=>go({...query,sort:o as TourListingQuery['sort'],page:1})} locale={tl} label={tx(tl, { en: 'Sort by', es: 'Ordenar por', it: 'Ordina per', ar: 'ترتيب حسب' })} options={tourListingSorts.map((o)=>({value:o,label:sortLabel(o)}))} /></div>{paged.length?<div className="listing-grid">{paged.map(t=><TourCard key={t.slug} tour={t} variant={variant}/>)}</div>:<div className="account-empty"><h3>{tx(tl, { en: 'No tours match your filters.', es: 'Ningún viaje coincide con tus filtros.', it: 'Nessun viaggio corrisponde ai tuoi filtri.', ar: 'لا توجد رحلات تطابق الفلاتر.' })}</h3><p>{tx(tl, { en: 'Try a different destination or reset the filters to see everything.', es: 'Prueba otro destino o borra los filtros para verlo todo.', it: 'Prova un’altra destinazione o cancella i filtri per vedere tutto.', ar: 'جرّب وجهة مختلفة أو امسح الفلاتر لعرض كل الرحلات.' })}</p><button type="button" className="primary-btn" onClick={resetFilters}>{tx(tl, { en: 'Reset Filters', es: 'Borrar filtros', it: 'Cancella i filtri', ar: 'مسح الفلاتر' })}</button></div>}<nav className="pagination" aria-label={tx(tl, { en: 'Tour listing pages', es: 'Páginas de viajes', it: 'Pagine dei viaggi', ar: 'صفحات الرحلات' })}><button type="button" onClick={()=>go({...query,page:Math.max(1,safePage-1)})} aria-label={tx(tl, { en: 'Previous page', es: 'Página anterior', it: 'Pagina precedente', ar: 'الصفحة السابقة' })} disabled={safePage<=1} style={safePage<=1?{opacity:.5}:undefined}>{tx(tl, { en: '‹ Back', es: '‹ Atrás', it: '‹ Indietro', ar: '› السابق' })}</button>{Array.from({length:totalPages},(_,i)=>safePage===i+1?<b key={i+1} aria-current="page">{i+1}</b>:<button key={i+1} type="button" aria-label={tx(tl, { en: `Go to page ${i+1}`, es: `Ve a la página ${i+1}`, it: `Vai alla pagina ${i+1}`, ar: `انتقل إلى صفحة ${i+1}` })} onClick={()=>go({...query,page:i+1})}>{i+1}</button>)}<button type="button" onClick={()=>go({...query,page:Math.min(totalPages,safePage+1)})} aria-label={tx(tl, { en: 'Next page', es: 'Página siguiente', it: 'Pagina successiva', ar: 'الصفحة التالية' })} disabled={safePage>=totalPages} style={safePage>=totalPages?{opacity:.5}:undefined}>{tx(tl, { en: 'Next ›', es: 'Siguiente ›', it: 'Avanti ›', ar: 'التالي ‹' })}</button></nav></main><HelpCTA/></>}

export function HelpCTA(){const {locale:hc}=useLocale(); const ex=extra[hc]; const [sent,setSent]=useState(false); const [name,setName]=useState(''); const [countryCode,setCountryCode]=useState(defaultCountry.code); const [phone,setPhone]=useState(''); if(sent) return <section className="help container"><h2>{ex.helpDoneT}</h2><p>{ex.helpDoneP1}{name?` ${name}`:''}{ex.helpDoneP2}</p></section>; return <section className="help container"><h2>{ex.helpTitle}</h2><p>{ex.helpSub}</p><div><form style={{display:'contents'}} onSubmit={(e)=>{e.preventDefault();setSent(true)}}><input placeholder={ex.helpName} required value={name} onChange={(e)=>setName(e.target.value)} aria-label={ex.helpName}/><CountrySelect value={countryCode} onChange={setCountryCode} locale={hc} label={ex.helpNat} /><InternationalPhoneInput required value={phone} onChange={setPhone} locale={hc} countryCode={countryCode} onCountryChange={setCountryCode} placeholder={ex.helpPhone}/><button className="primary-btn" type="submit">{ex.helpBtn}</button></form></div></section>}

export function HomePage(){return <SiteShell><main><section className="hero"><img src="/egypt-hero.png" alt="Egyptian temple and desert"/><div className="hero-overlay"/><div className="hero-copy"><span>Get started your</span><h1>Exciting Journey With Us</h1></div><TripSearchEngine/></section><section className="stats container">{[['+100K','Happy customers'],['+50','Years of experience'],['+60','Total destinations'],['5.0','Rating in Tripadvisor']].map(([a,b])=><div key={b}><b>{a}</b><span>{b}</span></div>)}</section><section className="section container"><Heading title="Explore Egypt's Top Tours" copy="From the Pyramids to the Nile - find your perfect adventure."/><div className="tour-grid">{seasonalTours.map(t=><TourCard key={t.slug} tour={t}/>)}</div></section><section className="section pale"><div className="container"><Heading title="Popular Destination" copy="Every corner of Egypt has a story waiting for you."/><div className="destination-grid">{['Pyramids & Giza','White Desert','Nile Valley','Red Sea','Luxor Temples','Cairo Markets'].map((x,i)=><article className="destination" key={x}><img src={images[(i+1)%images.length]} alt={x}/><div><small>Explore now</small><h3>{x}</h3></div></article>)}</div></div></section><section className="section how"><div className="container"><Heading title="How it works?" copy="Only three steps away from Egypt."/><div className="steps">{['Finding Trip','Booking','Enjoy'].map((x,i)=><div key={x}><b>{i+1}</b><h3>{x}</h3><p>Start your journey</p></div>)}</div></div></section><section className="section container"><Heading title="Highlights of Egypt" copy="Discover the most important landmarks in Egypt."/><div className="highlight-row">{['Aswan Tours','Hurghada Tours','Sharm El Sheikh Tours','Dahab Tours'].map((x,i)=><div key={x}><img src={images[i%images.length]} alt={x}/><strong>{x}</strong></div>)}</div></section><HelpCTA/></main></SiteShell>}
