'use client'

import Image from 'next/image'
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

const baseCopy = { en: { search:'Find places and things to do', signIn:'Sign in', dashboard:'Dashboard', account:'Account', home:'Home', tours:'Egypt Tours', rent:'Rent Car', about:'About Us', contact:'Contact Us', blogs:'Blogs', events:'Events', offer:'Special Offer', make:'Make Your Trip', language:'AR - EGP', switch:'Ø§Ù„Ø¹Ø±Ø¨ÙŠØ©', promo:'Book any package tour and enjoy a FREE tour experience included along with it.' }, ar: { search:'Ø§Ø¨Ø­Ø« Ø¹Ù† Ø§Ù„Ø£Ù…Ø§ÙƒÙ† ÙˆØ§Ù„Ø£Ù†Ø´Ø·Ø©', signIn:'ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø¯Ø®ÙˆÙ„', dashboard:'Ù„ÙˆØ­Ø© Ø§Ù„ØªØ­ÙƒÙ…', account:'Ø­Ø³Ø§Ø¨ÙŠ', home:'Ø§Ù„Ø±Ø¦ÙŠØ³ÙŠØ©', tours:'Ø¬ÙˆÙ„Ø§Øª Ù…ØµØ±', rent:'ØªØ£Ø¬ÙŠØ± Ø§Ù„Ø³ÙŠØ§Ø±Ø§Øª', about:'Ù…Ù† Ù†Ø­Ù†', contact:'Ø§ØªØµÙ„ Ø¨Ù†Ø§', blogs:'Ø§Ù„Ù…Ø¯ÙˆÙ†Ø©', events:'Ø§Ù„ÙØ¹Ø§Ù„ÙŠØ§Øª', offer:'Ø¹Ø±ÙˆØ¶ Ø®Ø§ØµØ©', make:'Ø®Ø·Ø· Ø±Ø­Ù„ØªÙƒ', language:'EN - USD', switch:'English', promo:'Ø§Ø­Ø¬Ø² Ø£ÙŠ Ø¨Ø±Ù†Ø§Ù…Ø¬ Ø³ÙŠØ§Ø­ÙŠ ÙˆØ§Ø³ØªÙ…ØªØ¹ Ø¨ØªØ¬Ø±Ø¨Ø© Ù…Ø¬Ø§Ù†ÙŠØ© Ù…Ø´Ù…ÙˆÙ„Ø© Ù…Ø¹Ù‡.' } } as const
// ES/IT carry full header/nav chrome copy; catalogue content falls back to English.
const copy = { ...baseCopy,
es: { ...baseCopy.en, search: 'Busca lugares y actividades', signIn: 'Iniciar sesiÃ³n', dashboard: 'Panel', account: 'Cuenta', home: 'Inicio', tours: 'Circuitos por Egipto', rent: 'Alquiler de coches', about: 'QuiÃ©nes somos', contact: 'ContÃ¡ctanos', blogs: 'Blog', events: 'Eventos', offer: 'Oferta especial', make: 'Crea tu viaje', language: 'ES - EUR', switch: 'EspaÃ±ol', promo: 'Reserva cualquier paquete y disfruta de una experiencia gratuita incluida.' },
  it: { ...baseCopy.en, search: 'Cerca luoghi e attivitÃ ', signIn: 'Accedi', dashboard: 'Dashboard', account: 'Account', home: 'Home', tours: 'Tour in Egitto', rent: 'Noleggio auto', about: 'Chi siamo', contact: 'Contattaci', blogs: 'Blog', events: 'Eventi', offer: 'Offerta speciale', make: 'Crea il tuo viaggio', language: 'IT - EUR', switch: 'Italiano', promo: 'Prenota un pacchetto viaggio e goditi unâ€™esperienza gratuita inclusa.' },
} as const

const baseExtra = {
  en: { promo2: 'Limited-time savings on top-rated Egypt tours. Grab your deal before it ends!', viewPackages: 'View Packages', viewOffers: 'View Offers', cat1: 'One Day Tours', cat2: 'Multi Days Tours', cat3: 'Nile Cruises', cat4: 'Shore Excursion', liveChat: 'Live Chat', modalTitle: 'Language and Currency', curTitle: 'Currency', regTitle: 'Region and Language', footerTag: 'We would be happy to help you discover Egypt.', footerLinks: 'STAR PYRAMIDS Links', contactInfo: 'Contact Info', address: COMPANY_ADDRESS, rights: 'All rights reserved to STAR PYRAMIDS company, Egypt Â©2026', poweredBy: 'Powered by', tabMake: 'Make Your Trip', tabFind: 'Find your trip', tabRent: 'Rent Car', privacy: 'Privacy and Cookies', terms: 'Terms and Conditions', qWhen: 'When will you be traveling?', qExact: 'Have An Exact Time', qApprox: 'Have An Approximate Time', qUnsure: 'Not Sure Yet', fFrom: 'From', fTo: 'To', fFromPh: 'Select the start date of the trip', fToPh: 'Select the end date of the trip', makeTripBtn: 'Make Trip', qWhat: 'What are you looking for?', k1: 'One Day', k2: 'Multi Days', k3: 'Nile Cruise', k4: 'Shore', wWhere: 'Where?', wWherePh: 'Choose your favorite place in Egypt', wLong: 'How Long?', wLongPh: 'How many days do you stay in Egypt', searchBtn: 'Search', qType: 'Type of Trip?', tOne: 'One Way', tRound: 'Round Trip', cHolder: 'Car Holder', cHolderPh: 'Choose Pick-Up Location', cDrop: 'Drop Off Location', cDropPh: 'Choose Drop-Off Location', cDate: 'Pick Up Date and time', cDatePh: 'Choose the time and date for Pick Up', sendReq: 'Send Request', helpTitle: 'Need help to finding your trip?', helpSub: 'Share a few details and our team will contact you.', helpName: 'Full Name', helpNat: 'Nationality', helpPhone: 'Phone', helpBtn: 'Contact Now', helpDoneT: 'We got your details!', helpDoneP1: 'Thank you', helpDoneP2: '. Our travel team will contact you shortly.', contactTitle: 'Contact Us', contactSub: 'Call Us, Write Us, Or Knock on Our Door', addrT: 'Our Address', emailT: 'Email Address', resetFilters: 'Reset filters', searchHint: 'Select a trip type or enter a destination to begin', formT: 'Connect with Us Today', sendMsg: 'Send a Message', msgPh: 'How can we help?', faqTeaser: 'Frequently Asked Questions', seeMore: 'See more', needHelp: 'Need Our Help?', footExplore: 'Explore', footCompany: 'Company', certBadge: 'Travelife Certified', guideLink: 'Egypt Travel Guide', faqsLink: 'FAQs', accessLink: 'Accessible Travel', accessNote: '5% discount on all our tour packages for guests requiring accessibility assistance.', readMoreBtn: 'Read More', callUs: 'Call us' },
  ar: { promo2: 'ÙˆÙÙ‘Ø± Ù„ÙØªØ±Ø© Ù…Ø­Ø¯ÙˆØ¯Ø© Ø¹Ù„Ù‰ Ø£ÙØ¶Ù„ Ø¬ÙˆÙ„Ø§Øª Ù…ØµØ±. Ø§Ø­Ø¬Ø² Ù‚Ø¨Ù„ Ø§Ù†ØªÙ‡Ø§Ø¡ Ø§Ù„Ø¹Ø±Ø¶!', viewPackages: 'Ø´Ø§Ù‡Ø¯ Ø§Ù„Ø¨Ø§Ù‚Ø§Øª', viewOffers: 'Ø´Ø§Ù‡Ø¯ Ø§Ù„Ø¹Ø±ÙˆØ¶', cat1: 'Ø±Ø­Ù„Ø§Øª Ø§Ù„ÙŠÙˆÙ… Ø§Ù„ÙˆØ§Ø­Ø¯', cat2: 'Ø±Ø­Ù„Ø§Øª Ù…ØªØ¹Ø¯Ø¯Ø© Ø§Ù„Ø£ÙŠØ§Ù…', cat3: 'Ø±Ø­Ù„Ø§Øª Ø§Ù„Ù†ÙŠÙ„', cat4: 'Ø±Ø­Ù„Ø§Øª Ø§Ù„Ø´ÙˆØ§Ø·Ø¦', liveChat: 'Ù…Ø­Ø§Ø¯Ø«Ø© Ù…Ø¨Ø§Ø´Ø±Ø©', modalTitle: 'Ø§Ù„Ù„ØºØ© ÙˆØ§Ù„Ø¹Ù…Ù„Ø©', curTitle: 'Ø§Ù„Ø¹Ù…Ù„Ø©', regTitle: 'Ø§Ù„Ù…Ù†Ø·Ù‚Ø© ÙˆØ§Ù„Ù„ØºØ©', footerTag: 'Ø³Ø¹Ø¯Ø§Ø¡ Ø¨Ù…Ø³Ø§Ø¹Ø¯ØªÙƒ ÙÙŠ Ø§ÙƒØªØ´Ø§Ù Ù…ØµØ±.', footerLinks: 'Ø±ÙˆØ§Ø¨Ø· Ø³ØªØ§Ø± Ø¨ÙŠØ±Ø§Ù…ÙŠØ¯Ø²', contactInfo: 'Ù…Ø¹Ù„ÙˆÙ…Ø§Øª Ø§Ù„ØªÙˆØ§ØµÙ„', address: COMPANY_ADDRESS, rights: 'Ø¬Ù…ÙŠØ¹ Ø§Ù„Ø­Ù‚ÙˆÙ‚ Ù…Ø­ÙÙˆØ¸Ø© Ù„Ø´Ø±ÙƒØ© Ø³ØªØ§Ø± Ø¨ÙŠØ±Ø§Ù…ÙŠØ¯Ø²ØŒ Ù…ØµØ± Â©2026', poweredBy: 'Ù…Ø¯Ø¹ÙˆÙ… Ù…Ù†', tabMake: 'Ø®Ø·Ø· Ø±Ø­Ù„ØªÙƒ', tabFind: 'Ø§Ø¹Ø«Ø± Ø¹Ù„Ù‰ Ø±Ø­Ù„ØªÙƒ', tabRent: 'Ø§Ø³ØªØ£Ø¬Ø± Ø³ÙŠØ§Ø±Ø©', privacy: 'Ø§Ù„Ø®ØµÙˆØµÙŠØ© ÙˆÙ…Ù„ÙØ§Øª Ø§Ù„Ø§Ø±ØªØ¨Ø§Ø·', terms: 'Ø§Ù„Ø´Ø±ÙˆØ· ÙˆØ§Ù„Ø£Ø­ÙƒØ§Ù…', qWhen: 'Ù…ØªÙ‰ Ø³ØªØ³Ø§ÙØ±ØŸ', qExact: 'Ù„Ø¯ÙŠ ÙˆÙ‚Øª Ù…Ø­Ø¯Ø¯', qApprox: 'Ù„Ø¯ÙŠ ÙˆÙ‚Øª ØªÙ‚Ø±ÙŠØ¨ÙŠ', qUnsure: 'Ù„Ø³Øª Ù…ØªØ£ÙƒØ¯Ø§Ù‹ Ø¨Ø¹Ø¯', fFrom: 'Ù…Ù†', fTo: 'Ø¥Ù„Ù‰', fFromPh: 'Ø§Ø®ØªØ± ØªØ§Ø±ÙŠØ® Ø¨Ø¯Ø§ÙŠØ© Ø§Ù„Ø±Ø­Ù„Ø©', fToPh: 'Ø§Ø®ØªØ± ØªØ§Ø±ÙŠØ® Ù†Ù‡Ø§ÙŠØ© Ø§Ù„Ø±Ø­Ù„Ø©', makeTripBtn: 'Ø®Ø·Ø· Ø§Ù„Ø±Ø­Ù„Ø©', qWhat: 'Ø¹Ù† Ù…Ø§Ø°Ø§ ØªØ¨Ø­Ø«ØŸ', k1: 'ÙŠÙˆÙ… ÙˆØ§Ø­Ø¯', k2: 'Ø£ÙŠØ§Ù… Ù…ØªØ¹Ø¯Ø¯Ø©', k3: 'Ø±Ø­Ù„Ø© Ù†ÙŠÙ„ÙŠØ©', k4: 'Ø´Ø§Ø·Ø¦ÙŠØ©', wWhere: 'Ø£ÙŠÙ†ØŸ', wWherePh: 'Ø§Ø®ØªØ± Ù…ÙƒØ§Ù†Ùƒ Ø§Ù„Ù…ÙØ¶Ù„ ÙÙŠ Ù…ØµØ±', wLong: 'ÙƒÙ… Ø§Ù„Ù…Ø¯Ø©ØŸ', wLongPh: 'ÙƒÙ… ÙŠÙˆÙ…Ø§Ù‹ Ø³ØªØ¨Ù‚Ù‰ ÙÙŠ Ù…ØµØ±', searchBtn: 'Ø¨Ø­Ø«', qType: 'Ù†ÙˆØ¹ Ø§Ù„Ø±Ø­Ù„Ø©ØŸ', tOne: 'Ø°Ù‡Ø§Ø¨ ÙÙ‚Ø·', tRound: 'Ø°Ù‡Ø§Ø¨ ÙˆØ¹ÙˆØ¯Ø©', cHolder: 'Ù…ÙƒØ§Ù† Ø§Ù„Ø§Ø³ØªÙ„Ø§Ù…', cHolderPh: 'Ø§Ø®ØªØ± Ù…ÙƒØ§Ù† Ø§Ù„Ø§Ø³ØªÙ„Ø§Ù…', cDrop: 'Ù…ÙƒØ§Ù† Ø§Ù„ØªØ³Ù„ÙŠÙ…', cDropPh: 'Ø§Ø®ØªØ± Ù…ÙƒØ§Ù† Ø§Ù„ØªØ³Ù„ÙŠÙ…', cDate: 'ØªØ§Ø±ÙŠØ® ÙˆÙˆÙ‚Øª Ø§Ù„Ø§Ø³ØªÙ„Ø§Ù…', cDatePh: 'Ø§Ø®ØªØ± ÙˆÙ‚Øª ÙˆØªØ§Ø±ÙŠØ® Ø§Ù„Ø§Ø³ØªÙ„Ø§Ù…', sendReq: 'Ø¥Ø±Ø³Ø§Ù„ Ø§Ù„Ø·Ù„Ø¨', helpTitle: 'Ù…Ø­ØªØ§Ø¬ Ù…Ø³Ø§Ø¹Ø¯Ø© ÙÙŠ Ø±Ø­Ù„ØªÙƒØŸ', helpSub: 'Ø³ÙŠØ¨ Ø¨ÙŠØ§Ù†Ø§ØªÙƒ ÙˆÙØ±ÙŠÙ‚Ù†Ø§ Ù‡ÙŠØªÙˆØ§ØµÙ„ Ù…Ø¹Ø§Ùƒ.', helpName: 'Ø§Ù„Ø§Ø³Ù… Ø¨Ø§Ù„ÙƒØ§Ù…Ù„', helpNat: 'Ø§Ù„Ø¬Ù†Ø³ÙŠØ©', helpPhone: 'Ø§Ù„Ù‡Ø§ØªÙ', helpBtn: 'ØªÙˆØ§ØµÙ„ Ø§Ù„Ø¢Ù†', helpDoneT: 'ÙˆØµÙ„ØªÙ†Ø§ Ø¨ÙŠØ§Ù†Ø§ØªÙƒ!', helpDoneP1: 'Ø´ÙƒØ±Ø§Ù‹', helpDoneP2: '. ÙØ±ÙŠÙ‚ Ø§Ù„Ø³ÙØ± Ù‡ÙŠØªÙˆØ§ØµÙ„ Ù…Ø¹Ø§Ùƒ Ù‚Ø±ÙŠØ¨Ø§Ù‹.', contactTitle: 'Ø§ØªØµÙ„ Ø¨Ù†Ø§', contactSub: 'ÙƒÙ„Ù…Ù†Ø§ØŒ Ø±Ø§Ø³Ù„Ù†Ø§ØŒ Ø£Ùˆ Ø²ÙˆØ±Ù†Ø§', addrT: 'Ø¹Ù†ÙˆØ§Ù†Ø§', emailT: 'Ø§Ù„Ø¨Ø±ÙŠØ¯ Ø§Ù„Ø¥Ù„ÙƒØªØ±ÙˆÙ†ÙŠ', formT: 'ØªÙˆØ§ØµÙ„ Ù…Ø¹Ù†Ø§ Ø§Ù„ÙŠÙˆÙ…', sendMsg: 'Ø¥Ø±Ø³Ø§Ù„ Ø±Ø³Ø§Ù„Ø©', msgPh: 'Ø¥Ø²Ø§ÙŠ Ù†Ù‚Ø¯Ø± Ù†Ø³Ø§Ø¹Ø¯ÙƒØŸ', faqTeaser: 'Ø§Ù„Ø£Ø³Ø¦Ù„Ø© Ø§Ù„Ø´Ø§Ø¦Ø¹Ø©', seeMore: 'Ø´Ø§Ù‡Ø¯ Ø§Ù„Ù…Ø²ÙŠØ¯', needHelp: 'Ù…Ø­ØªØ§Ø¬ Ù…Ø³Ø§Ø¹Ø¯Ø©ØŸ', footExplore: 'Ø§Ø³ØªÙƒØ´Ù', footCompany: 'Ø§Ù„Ø´Ø±ÙƒØ©', certBadge: 'Ù…Ø¹ØªÙ…Ø¯ ØªØ±Ø§ÙÙ„ Ù„Ø§ÙŠÙ', guideLink: 'Ø¯Ù„ÙŠÙ„ Ø§Ù„Ø³ÙØ±', faqsLink: 'Ø§Ù„Ø£Ø³Ø¦Ù„Ø© Ø§Ù„Ø´Ø§Ø¦Ø¹Ø©', accessLink: 'Ø³ÙØ± Ù…ÙŠØ³Ù‘Ø±', accessNote: 'Ø®ØµÙ… 5% Ø¹Ù„Ù‰ ÙƒÙ„ Ø¨Ø§Ù‚Ø§Øª Ø§Ù„Ø±Ø­Ù„Ø§Øª Ù„Ø¶ÙŠÙˆÙÙ†Ø§ Ù…Ù† Ø°ÙˆÙŠ Ø§Ù„Ø§Ø­ØªÙŠØ§Ø¬Ø§Øª Ø§Ù„Ø®Ø§ØµØ©.', readMoreBtn: 'Ø§Ù‚Ø±Ø£ Ø§Ù„Ù…Ø²ÙŠØ¯', callUs: 'اتصل بنا', resetFilters: 'إعادة تعيين الفلاتر', searchHint: 'اختر نوع الرحلة أو أدخل وجهة للبدء' },
} as const

export const extra = { ...baseExtra,
es: { ...baseExtra.en, promo2: 'Ahorra por tiempo limitado en los mejores circuitos de Egipto. Â¡Aprovecha antes de que termine!', viewPackages: 'Ver paquetes', viewOffers: 'Ver ofertas', cat1: 'Circuitos de un dÃ­a', cat2: 'Viajes de varios dÃ­as', cat3: 'Cruceros por el Nilo', cat4: 'ExcursiÃ³n en tierra', liveChat: 'Chat en vivo', modalTitle: 'Idioma y moneda', curTitle: 'Moneda', regTitle: 'RegiÃ³n e idioma', footerTag: 'Estaremos encantados de ayudarte a descubrir Egipto.', footerLinks: 'Enlaces de STAR PYRAMIDS', contactInfo: 'Contacto', rights: 'Todos los derechos reservados a STAR PYRAMIDS, Egipto Â©2026', poweredBy: 'Con la tecnologÃ­a de', tabMake: 'Crea tu viaje', tabFind: 'Busca tu viaje', tabRent: 'Alquila un coche', privacy: 'Privacidad y cookies', terms: 'TÃ©rminos y condiciones', qWhen: 'Â¿CuÃ¡ndo viajarÃ¡s?', qExact: 'Tengo fecha exacta', qApprox: 'Tengo fecha aproximada', qUnsure: 'AÃºn no lo sÃ©', fFrom: 'Desde', fTo: 'Hasta', fFromPh: 'Elige la fecha de inicio del viaje', fToPh: 'Elige la fecha de fin del viaje', makeTripBtn: 'Crear viaje', qWhat: 'Â¿QuÃ© buscas?', k1: 'Un dÃ­a', k2: 'Varios dÃ­as', k3: 'Crucero por el Nilo', k4: 'Costa', wWhere: 'Â¿DÃ³nde?', wWherePh: 'Elige tu lugar favorito de Egipto', wLong: 'Â¿CuÃ¡nto tiempo?', wLongPh: 'Â¿CuÃ¡ntos dÃ­as estarÃ¡s en Egipto?', searchBtn: 'Buscar', qType: 'Â¿Tipo de viaje?', tOne: 'Solo ida', tRound: 'Ida y vuelta', cHolder: 'Titular del coche', cHolderPh: 'Elige el lugar de recogida', cDrop: 'Lugar de devoluciÃ³n', cDropPh: 'Elige el lugar de devoluciÃ³n', cDate: 'Fecha y hora de recogida', cDatePh: 'Elige la fecha y hora de recogida', sendReq: 'Enviar solicitud', helpTitle: 'Â¿Necesitas ayuda para encontrar tu viaje?', helpSub: 'Comparte algunos datos y nuestro equipo te contactarÃ¡.', helpName: 'Nombre completo', helpNat: 'Nacionalidad', helpPhone: 'TelÃ©fono', helpBtn: 'Contactar ahora', helpDoneT: 'Â¡Recibimos tus datos!', helpDoneP1: 'Gracias', helpDoneP2: '. Nuestro equipo de viajes te contactarÃ¡ pronto.', contactTitle: 'ContÃ¡ctanos', contactSub: 'LlÃ¡manos, escrÃ­benos o visÃ­tanos', addrT: 'Nuestra direcciÃ³n', emailT: 'Correo electrÃ³nico', formT: 'Conecta con nosotros hoy', sendMsg: 'Enviar mensaje', msgPh: 'Â¿CÃ³mo podemos ayudarte?', faqTeaser: 'Preguntas frecuentes', seeMore: 'Ver mÃ¡s', needHelp: 'Â¿Necesitas ayuda?', footExplore: 'Explorar', footCompany: 'Empresa', certBadge: 'Certificado Travelife', guideLink: 'GuÃ­a de viaje de Egipto', faqsLink: 'Preguntas frecuentes', accessLink: 'Viajes accesibles', accessNote: '5% de descuento en todos nuestros paquetes para huÃ©spedes que necesiten asistencia de accesibilidad.', readMoreBtn: 'Leer mÃ¡s', callUs: 'LlÃ¡manos' },
  it: { ...baseExtra.en, promo2: 'Risparmia per un periodo limitato sui migliori tour in Egitto. Approfittane prima che finisca!', viewPackages: 'Vedi i pacchetti', viewOffers: 'Vedi le offerte', cat1: 'Tour di un giorno', cat2: 'Viaggi di piÃ¹ giorni', cat3: 'Crociere sul Nilo', cat4: 'Escursione a terra', liveChat: 'Chat dal vivo', modalTitle: 'Lingua e valuta', curTitle: 'Valuta', regTitle: 'Regione e lingua', footerTag: 'Saremo felici di aiutarti a scoprire lâ€™Egitto.', footerLinks: 'Link di STAR PYRAMIDS', contactInfo: 'Contatti', rights: 'Tutti i diritti riservati a STAR PYRAMIDS, Egitto Â©2026', poweredBy: 'Offerto da', tabMake: 'Crea il tuo viaggio', tabFind: 'Trova il tuo viaggio', tabRent: 'Noleggia unâ€™auto', privacy: 'Privacy e cookie', terms: 'Termini e condizioni', qWhen: 'Quando viaggerai?', qExact: 'Ho una data esatta', qApprox: 'Ho una data approssimativa', qUnsure: 'Non lo so ancora', fFrom: 'Da', fTo: 'A', fFromPh: 'Scegli la data di inizio del viaggio', fToPh: 'Scegli la data di fine del viaggio', makeTripBtn: 'Crea viaggio', qWhat: 'Cosa cerchi?', k1: 'Un giorno', k2: 'PiÃ¹ giorni', k3: 'Crociera sul Nilo', k4: 'Costa', wWhere: 'Dove?', wWherePh: 'Scegli il tuo luogo preferito in Egitto', wLong: 'Quanto tempo?', wLongPh: 'Quanti giorni resterai in Egitto?', searchBtn: 'Cerca', qType: 'Tipo di viaggio?', tOne: 'Solo andata', tRound: 'Andata e ritorno', cHolder: 'Intestatario auto', cHolderPh: 'Scegli il luogo di ritiro', cDrop: 'Luogo di riconsegna', cDropPh: 'Scegli il luogo di riconsegna', cDate: 'Data e ora di ritiro', cDatePh: 'Scegli data e ora di ritiro', sendReq: 'Invia richiesta', helpTitle: 'Hai bisogno di aiuto per trovare il tuo viaggio?', helpSub: 'Condividi alcuni dettagli e il nostro team ti contatterÃ .', helpName: 'Nome completo', helpNat: 'NazionalitÃ ', helpPhone: 'Telefono', helpBtn: 'Contattaci ora', helpDoneT: 'Abbiamo ricevuto i tuoi dati!', helpDoneP1: 'Grazie', helpDoneP2: '. Il nostro team di viaggio ti contatterÃ  a breve.', contactTitle: 'Contattaci', contactSub: 'Chiamaci, scrivici o vieni a trovarci', addrT: 'Il nostro indirizzo', emailT: 'Indirizzo email', formT: 'Contattaci oggi', sendMsg: 'Invia messaggio', msgPh: 'Come possiamo aiutarti?', faqTeaser: 'Domande frequenti', seeMore: 'Vedi di piÃ¹', needHelp: 'Hai bisogno di aiuto?', footExplore: 'Esplora', footCompany: 'Azienda', certBadge: 'Certificato Travelife', guideLink: 'Guida di viaggio in Egitto', faqsLink: 'Domande frequenti', accessLink: 'Viaggi accessibili', accessNote: 'Sconto del 5% su tutti i nostri pacchetti per gli ospiti che necessitano di assistenza per lâ€™accessibilitÃ .', readMoreBtn: 'Leggi di piÃ¹', callUs: 'Chiamaci' },
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
      title: tx(locale, { en: 'Special Offer: 20% OFF Luxury Nile Cruises Luxor & Aswan', es: 'Oferta exclusiva: 20% de descuento en cruceros por el Nilo Luxor y AsuÃ¡n', it: 'Offerta esclusiva: 20% di sconto sulle crociere sul Nilo Luxor e Assuan', ar: 'Ø¹Ø±Ø¶ Ø­ØµØ±ÙŠ: Ø®ØµÙ… 20% Ø¹Ù„Ù‰ ÙƒØ±ÙˆØ² Ø§Ù„Ù†ÙŠÙ„ Ø§Ù„Ø£Ù‚ØµØ± ÙˆØ£Ø³ÙˆØ§Ù†' }),
      desc: tx(locale, { en: 'Book your 5-star cruise now and enjoy all-inclusive stay & private guide', es: 'Reserva tu crucero 5 estrellas y disfruta de estancia todo incluido y guÃ­a privado', it: 'Prenota ora la tua crociera 5 stelle con soggiorno all-inclusive e guida privata', ar: 'Ø§Ø­Ø¬Ø² Ø±Ø­Ù„ØªÙƒ Ø§Ù„Ø¨Ø­Ø±ÙŠØ© Ø§Ù„Ø¢Ù† ÙˆØ§Ø³ØªÙ…ØªØ¹ Ø¨Ø¥Ù‚Ø§Ù…Ø© 5 Ù†Ø¬ÙˆÙ… Ø´Ø§Ù…Ù„Ø© ÙƒÙ„ÙŠØ§Ù‹' }),
      time: tx(locale, { en: '15m ago', es: 'hace 15 min', it: '15 min fa', ar: 'Ù…Ù†Ø° 15 Ø¯Ù‚ÙŠÙ‚Ø©' }),
      href: '/special-offers',
      unread: true,
    },
    {
      id: '2',
      type: 'tour',
      title: tx(locale, { en: 'New Tour: White Desert & Bahariya Oasis 3-Day Safari', es: 'Nuevo circuito: safari de 3 dÃ­as por el Desierto Blanco y el oasis de Bahariya', it: 'Nuovo tour: safari di 3 giorni nel Deserto Bianco e nell\'oasi di Bahariya', ar: 'Ø±Ø­Ù„Ø© Ø¬Ø¯ÙŠØ¯Ø©: Ù…ØºØ§Ù…Ø±Ø© Ø³ÙØ§Ø±ÙŠ Ø§Ù„ØµØ­Ø±Ø§Ø¡ Ø§Ù„Ø¨ÙŠØ¶Ø§Ø¡ ÙˆØ§Ù„ÙˆØ§Ø­Ø§Øª 3 Ø£ÙŠØ§Ù…' }),
      desc: tx(locale, { en: 'Discover magical landscapes and luxury stargazing camping in Egypt', es: 'Descubre paisajes mÃ¡gicos y acampada de lujo bajo las estrellas en Egipto', it: 'Scopri paesaggi magici e campeggio di lusso sotto le stelle in Egitto', ar: 'Ø§ÙƒØªØ´Ù Ø±Ù…Ø§Ù„ Ù…ØµØ± Ø§Ù„Ø³Ø§Ø­Ø±Ø© ÙˆØ§Ù„ØªØ®ÙŠÙŠÙ… ØªØ­Øª Ø§Ù„Ù†Ø¬ÙˆÙ… Ù…Ø¹ Ù…Ø±Ø´Ø¯ Ø®Ø¨ÙŠØ±' }),
      time: tx(locale, { en: '2h ago', es: 'hace 2 h', it: '2 ore fa', ar: 'Ù…Ù†Ø° Ø³Ø§Ø¹ØªÙŠÙ†' }),
      href: '/egypt-tours/multi-days-tours',
      unread: true,
    },
    {
      id: '3',
      type: 'promo',
      title: tx(locale, { en: 'Exclusive Promo Code: STAR2026', es: 'CÃ³digo de descuento exclusivo: STAR2026', it: 'Codice sconto esclusivo: STAR2026', ar: 'ÙƒÙˆØ¯ Ø®ØµÙ… Ø­ØµØ±ÙŠ: STAR2026' }),
      desc: tx(locale, { en: 'Save extra 5% on all tour packages when booking this week', es: 'Ahorra un 5% extra en todos los paquetes al reservar esta semana', it: 'Risparmia un ulteriore 5% su tutti i pacchetti prenotando questa settimana', ar: 'ÙˆÙÙ‘Ø± 5% Ø¥Ø¶Ø§ÙÙŠØ© Ø¹Ù†Ø¯ Ø­Ø¬Ø² Ø£ÙŠ Ø¨Ø§Ù‚Ø© Ø³ÙŠØ§Ø­ÙŠØ© Ù‡Ø°Ø§ Ø§Ù„Ø£Ø³Ø¨ÙˆØ¹' }),
      time: tx(locale, { en: '1d ago', es: 'hace 1 dÃ­a', it: '1 giorno fa', ar: 'Ù…Ù†Ø° ÙŠÙˆÙ…' }),
      href: '/special-offers',
      unread: false,
    },
    {
      id: '4',
      type: 'car',
      title: tx(locale, { en: 'Updated Car Rental & VIP Airport Transfers', es: 'Nueva flota de alquiler y traslados VIP al aeropuerto', it: 'Nuova flotta a noleggio e trasferimenti VIP per l\'aeroporto', ar: 'ØªØ­Ø¯ÙŠØ« Ø£Ø³Ø·ÙˆÙ„ Ø³ÙŠØ§Ø±Ø§Øª Ø§Ù„Ù„ÙŠÙ…ÙˆØ²ÙŠÙ† ÙˆØªÙˆØµÙŠÙ„ Ø§Ù„Ù…Ø·Ø§Ø±' }),
      desc: tx(locale, { en: 'New premium fleet available with private chauffeur at best rates', es: 'Nueva flota premium con chÃ³fer privado al mejor precio', it: 'Nuova flotta premium con autista privato alle migliori tariffe', ar: 'Ø£Ø­Ø¯Ø« Ù…ÙˆØ¯ÙŠÙ„Ø§Øª Ø§Ù„Ø³ÙŠØ§Ø±Ø§Øª Ù…Ø¹ Ø³Ø§Ø¦Ù‚ Ø®Ø§Øµ Ø¨Ø£ÙØ¶Ù„ Ø§Ù„Ø£Ø³Ø¹Ø§Ø±' }),
      time: tx(locale, { en: '2d ago', es: 'hace 2 dÃ­as', it: '2 giorni fa', ar: 'Ù…Ù†Ø° ÙŠÙˆÙ…ÙŠÙ†' }),
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
    // storage full or unavailable â€” non-critical
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
          <h4>{tx(locale, { en: 'Notifications & Offers', es: 'Notificaciones y ofertas', it: 'Notifiche e offerte', ar: 'Ø§Ù„Ø¥Ø´Ø¹Ø§Ø±Ø§Øª ÙˆØ§Ù„Ø¹Ø±ÙˆØ¶' })}</h4>
          {unreadCount > 0 && <span className="notif-count-badge">{unreadCount} {tx(locale, { en: 'new', es: 'nuevas', it: 'nuove', ar: 'Ø¬Ø¯ÙŠØ¯' })}</span>}
        </div>
        {unreadCount > 0 && (
          <button type="button" className="notif-mark-read" onClick={markAllRead}>
            {tx(locale, { en: 'Mark all read', es: 'Marcar todo como leÃ­do', it: 'Segna tutto come letto', ar: 'ØªØ¹ÙŠÙŠÙ† Ø§Ù„ÙƒÙ„ ÙƒÙ…Ù‚Ø±ÙˆØ¡' })}
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
          {tx(locale, { en: 'View all special offers â†’', es: 'Ver todas las ofertas especiales â†’', it: 'Vedi tutte le offerte speciali â†’', ar: 'Ø¹Ø±Ø¶ Ø¬Ù…ÙŠØ¹ Ø§Ù„Ø¹Ø±ÙˆØ¶ Ø§Ù„Ø®Ø§ØµØ© â†' })}
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
      label: COMPANY_LABELS[locale] ?? COMPANY_LABELS.en,
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
  const [menu, setMenu] = useState(false)
  const { user: headerUser, loading: headerUserLoading } = useCurrentUser()
  const [toursOpen, setToursOpen] = useState(false)
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
  const activeNav = useActiveNav(pathname)
  const { locale, setLocale, currency, setCurrency } = useLocale()
  const { lines: cartLines } = useCart()
  const t = copy[locale]
  const ex = extra[locale]
  const cartLabel = tx(locale, { en: `Trip cart, ${cartLines} ${cartLines === 1 ? 'trip' : 'trips'}`, es: `Carrito de viajes, ${cartLines} ${cartLines === 1 ? 'viaje' : 'viajes'}`, it: `Carrello viaggi, ${cartLines} ${cartLines === 1 ? 'viaggio' : 'viaggi'}`, ar: `Ø³Ù„Ø© Ø§Ù„Ø±Ø­Ù„Ø§ØªØŒ ${cartLines} ${cartLines === 1 ? 'Ø±Ø­Ù„Ø©' : 'Ø±Ø­Ù„Ø§Øª'}` })

  useEffect(() => {
    setMenu(false)
    setToursOpen(false)
    setCompanyOpen(false)
    setNotifOpen(false)
  }, [pathname])

  useEffect(() => {
    const onDocumentClick = (event: globalThis.MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('.nav-dropdown') && !target.closest('.mobile-nav')) {
        setToursOpen(false)
        setCompanyOpen(false)
      }
      if (!target.closest('.notif-wrapper')) setNotifOpen(false)
      if (!target.closest('.mobile-nav') && !target.closest('.mobile-menu')) setMenu(false)
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
    const interval = window.setInterval(() => {
      if (!promoHold.current) setPromoIdx((index) => (index + 1) % 2)
    }, 5000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    const syncScrollState = () => {
      const next = window.scrollY > 130
      setScrolled((prev) => {
        if (prev !== next) {
          setToursOpen(false)
          setCompanyOpen(false)
          setMenu(false)
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

  const tourLinks = [
    [tx(locale, { en: 'All Trips', es: 'Todos los viajes', it: 'Tutti i viaggi', ar: 'ÙƒÙ„ Ø§Ù„Ø±Ø­Ù„Ø§Øª' }), '/trips'],
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

  const navConfig = getNavConfig(t, ex, locale)

  return <>
    <header ref={primaryHeaderRef} suppressHydrationWarning className="site-header">
      <div className="header-top container">
        <button type="button" className="mobile-menu" onClick={() => setMenu((value) => !value)} aria-label={tx(locale, { en: 'Open menu', es: 'Abrir el menÃº', it: 'Apri il menu', ar: 'ÙØªØ­ Ø§Ù„Ù‚Ø§Ø¦Ù…Ø©' })} aria-expanded={menu}>{menu ? <X/> : <Menu/>}</button>
        <Logo/>
        <form className="site-search" role="search" onSubmit={(event) => { event.preventDefault(); router.push('/search?q=' + encodeURIComponent(query)) }}>
          <Search size={19}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.search} aria-label={t.search}/>
        </form>
        <div className="header-actions">
          <LanguageToggle label={LOCALE_SHORT_LABELS[locale] + ' - ' + currency} onOpen={() => setLanguageOpen(true)}/>
          <div className="notif-wrapper">
            <button type="button" className={`icon-btn notif-btn ${notifOpen ? 'active' : ''}`} onClick={() => setNotifOpen((value) => !value)} aria-label={tx(locale, { en: 'Notifications', es: 'Notificaciones', it: 'Notifiche', ar: 'Ø§Ù„Ø¥Ø´Ø¹Ø§Ø±Ø§Øª' })} aria-expanded={notifOpen}><Bell size={18}/>{marketingUnreadCount > 0 && <span className="notif-badge-pulse"/>}</button>
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
          <nav aria-label={tx(locale, { en: 'Primary navigation', es: 'NavegaciÃ³n principal', it: 'Navigazione principale', ar: 'Ø§Ù„Ù‚Ø§Ø¦Ù…Ø© Ø§Ù„Ø±Ø¦ÙŠØ³ÙŠØ©' })}>
            <NavLinks nav={navConfig} activeKey={activeNav} pathname={pathname} idPrefix="primary-nav" onToursOpen={() => setToursOpen((value) => !value)} toursOpen={toursOpen} onCompanyOpen={() => setCompanyOpen((value) => !value)} companyOpen={companyOpen} tourLinks={tourLinks} t={t} ex={ex} />
          </nav>
          <div className="nav-right-actions"><Link className={`make-trip-link${activeNav === 'make' ? ' active' : ''}`} href="/make-your-trip">{t.make}</Link><HeaderAuthAction user={headerUser} loading={headerUserLoading} signInLabel={t.signIn} dashboardLabel={t.dashboard} accountLabel={t.account} /></div>
        </div>
      </div>

      {languageOpen && <LanguageModal locale={locale} currency={currency} onClose={() => setLanguageOpen(false)} onSelect={setLocale} onCurrency={setCurrency}/>}
      {menu && <nav className="mobile-nav" aria-label={tx(locale, { en: 'Mobile navigation', es: 'Navegación móvil', it: 'Navigazione mobile', ar: 'قائمة الموبايل' })}>{mobileLinks.map(([label, href]) => <Link key={href} href={href} onClick={() => setMenu(false)}>{label}</Link>)}<HeaderAuthAction mobile user={headerUser} loading={headerUserLoading} signInLabel={t.signIn} dashboardLabel={t.dashboard} accountLabel={t.account} onNavigate={() => setMenu(false)} /></nav>}
    </header>
    <div className={scrolled ? 'compact-sticky-header is-open' : 'compact-sticky-header'} aria-hidden={!scrolled}>
      <div className="container compact-sticky-inner">
        <Logo/>
        <nav aria-label={tx(locale, { en: 'Sticky navigation', es: 'Navegación fija', it: 'Navigazione fissa', ar: 'القائمة العائمة' })}>
          <NavLinks nav={navConfig} activeKey={activeNav} pathname={pathname} idPrefix="compact-nav" onToursOpen={() => setToursOpen((value) => !value)} toursOpen={toursOpen} onCompanyOpen={() => setCompanyOpen((value) => !value)} companyOpen={companyOpen} tourLinks={tourLinks} t={t} ex={ex} />
        </nav>
        <div className="compact-sticky-actions">
          <Link className={`icon-btn header-cart${cartLines > 0 ? ' has-items' : ''}`} href="/cart" aria-label={cartLabel}>
            <ShoppingCart size={16}/>
            {cartLines > 0 && <span className="cart-count-badge" aria-hidden="true">{cartLines > 9 ? '9+' : cartLines}</span>}
          </Link>
          <Link className={`make-trip-link${activeNav === 'make' ? ' active' : ''}`} href="/make-your-trip">{t.make}</Link>
          <HeaderAuthAction user={headerUser} loading={headerUserLoading} signInLabel={t.signIn} dashboardLabel={t.dashboard} accountLabel={t.account} />
        </div>
      </div>
    </div>


    <div className="promo" aria-live="polite" onMouseEnter={() => { promoHold.current = true }} onMouseLeave={() => { promoHold.current = false }}>
      <span className="promo-icons" key={'pi' + promoIdx}>{promos[promoIdx].icons}</span><strong key={'pt' + promoIdx} className="promo-swap">{promos[promoIdx].text}</strong><Link key={'pl' + promoIdx} href={promos[promoIdx].href} className="promo-swap">{promos[promoIdx].label}</Link><span className="promo-dots">{promos.map((_, index) => <button key={index} type="button" className={index === promoIdx ? 'active' : ''} aria-label={'Show announcement ' + (index + 1)} aria-current={index === promoIdx} onClick={() => setPromoIdx(index)}/>)}</span>
    </div>
  </>
}



export function SupportWidgets(){const [active,setActive]=useState<'live'|'wa'|null>(null); return <div className="support-widgets"><LiveChatWidget open={active==='live'} onOpen={()=>setActive('live')} onClose={()=>setActive((a)=>a==='live'?null:a)}/><WhatsAppWidget open={active==='wa'} onOpen={()=>setActive('wa')} onClose={()=>setActive((a)=>a==='wa'?null:a)}/></div>}

function AccessStrip(){const {locale}=useLocale(); const ex=extra[locale]; const [show,setShow]=useState(true); if(!show) return null; return <div className="access-strip"><Accessibility size={20}/><p>{ex.accessNote}</p><Link href="/accessible-travel">{ex.readMoreBtn}</Link><button type="button" onClick={()=>setShow(false)} aria-label="Dismiss">×</button></div>}

function ScrollTop(){const [show,setShow]=useState(false); useEffect(()=>{const onScroll=()=>setShow(window.scrollY>500); onScroll(); window.addEventListener('scroll',onScroll,{passive:true}); return ()=>window.removeEventListener('scroll',onScroll);},[]); const goTop=()=>{const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches; window.scrollTo({top:0,behavior:reduced?'auto':'smooth'});}; return <button type="button" className={'scroll-top'+(show?' show':'')} onClick={goTop} aria-label="Scroll to top"><ArrowUp size={20}/></button>}

export function SiteShell({children, initialLocale}:{children:React.ReactNode; initialLocale?: Locale}){return <LocaleProvider initialLocale={initialLocale}><Header/>{children}<AccessStrip/><SupportWidgets/><ScrollTop/><DynamicFooter/></LocaleProvider>}


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
              <div className="trip-question">
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
            priority={i === 0}
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
  const cruiseTypeInfo = variant === 'cruise' && tour.cruiseType ? getCruiseTypeBySlug(tour.cruiseType) : undefined
  let offset = 0
  for (const ch of tour.slug) offset = (offset + ch.charCodeAt(0)) % images.length
  const gallery = (tour.gallery && tour.gallery.length > 0) ? tour.gallery : [tour.image, ...images.slice(offset), ...images.slice(0, offset)].filter((src, index, all) => all.indexOf(src) === index).slice(0, 5)

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
        <button type="button" className="tour-fav" aria-label={saved ? tx(plc, { en: 'Remove from saved', es: 'Quitar de guardados', it: 'Rimuovi dai salvati', ar: 'Ø¥Ø²Ø§Ù„Ø© Ù…Ù† Ø§Ù„Ù…Ø­ÙÙˆØ¸Ø§Øª' }) : tx(plc, { en: 'Save tour', es: 'Guardar el viaje', it: 'Salva il viaggio', ar: 'Ø­ÙØ¸ Ø§Ù„Ø±Ø­Ù„Ø©' })} aria-pressed={saved} onClick={() => favorites.toggle(tour.slug)}><Heart size={17} fill={saved ? '#f7951d' : 'none'} color={saved ? '#f7951d' : '#1f2937'} strokeWidth={2} /></button>
        <button type="button" className="tour-share" aria-label={copied ? tx(plc, { en: 'Link copied', es: 'Enlace copiado', it: 'Link copiato', ar: 'ØªÙ… Ù†Ø³Ø® Ø§Ù„Ø±Ø§Ø¨Ø·' }) : tx(plc, { en: 'Share tour', es: 'Compartir el viaje', it: 'Condividi il viaggio', ar: 'Ù…Ø´Ø§Ø±ÙƒØ© Ø§Ù„Ø±Ø­Ù„Ø©' })} onClick={share}>{copied ? <Check size={17} color="#1d4ed8" /> : <Share2 size={17} color="#1f2937" />}</button>
      </CardGallery>
    </div>
    <div className="tour-body">
      {cruiseTypeInfo ? <div className="meta cruise-meta"><span className="cities-pill">◉ {plc === 'ar' ? localizeTourLocation(tour.location) : tour.location}</span><em>{plc === 'ar' ? cruiseTypeInfo.titleAr : cruiseTypeInfo.titleEn}</em></div> : <div className="meta">◉ {plc === 'ar' ? localizeTourLocation(tour.location) : tour.location} <em>{tour.travelStyle ?? 'Classic'}</em></div>}
      <h3><Link href={href}>{title}</Link></h3>
      <div className="tour-bottom"><div><small>{tx(plc, { en: 'Start From', es: 'Desde', it: 'Da', ar: 'ÙŠØ¨Ø¯Ø£ Ù…Ù†' })}</small><strong>{formatPrice(tour.price, currency, plc)}</strong></div><span>{variant === 'day' ? <Clock3 size={12} /> : variant === 'cruise' ? <Ship size={12} /> : variant === 'shore' ? <Anchor size={12} /> : null}{plc === 'ar' ? localizeTourDuration(tour.duration) : tour.duration}</span></div>
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
    <Image src={image} alt="" fill priority sizes="100vw" className="hero-bg-img" />
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

function OneDayToursRegionsContent(){const {locale:dl}=useLocale(); const set=tourCategories['one-day-tours']; const meta=catMeta.day;  const catTitle=pickLocaleText(dl, { en: set.title, ar: categoryCopy['one-day-tours'].titleAr }); const catIntro=pickLocaleText(dl, { en: set.intro, ar: categoryCopy['one-day-tours'].introAr }); const catEyebrow=dl === 'ar' ? meta.eyebrowAr : meta.eyebrow; const liveDestinations=useDbDestinations(destinations);const liveTours=useDbTours(oneDayTourBase);const regions=getPublishedOneDayDestinations(liveDestinations).map((d)=>({slug:d.slug,title:dl==='ar'?(d.nameAr??d.title):d.title,copy:dl==='ar'?(d.copyAr??d.copy):d.copy,items:getOneDayToursForDestination(liveTours,d.slug)})).filter((r)=>r.items.length>0); const total=regions.reduce((n,r)=>n+r.items.length,0); const featured=regions.flatMap((region)=>region.items)[0]??liveTours[0]; return <><TourCategoryHero image={featured.image} eyebrow={catEyebrow} title={catTitle} intro={catIntro} primaryLabel={tx(dl, { en: 'Explore day tours', es: 'Explora los circuitos de un dÃ­a', it: 'Esplora i tour di un giorno', ar: 'Ø§Ø³ØªÙƒØ´Ù Ø±Ø­Ù„Ø§Øª Ø§Ù„ÙŠÙˆÙ… Ø§Ù„ÙˆØ§Ø­Ø¯' })} primaryHref="#one-day-regions" featuredLabel={tx(dl, { en: 'Featured day tour', es: 'Circuito destacado de un dÃ­a', it: 'Tour di un giorno in evidenza', ar: 'Ø±Ø­Ù„Ø© ÙŠÙˆÙ… Ù…Ù…ÙŠØ²Ø©' })} featuredTitle={pickLocaleText(dl, { en: featured.title, ar: featured.titleAr })} featuredHref={`/egypt-tours/${featured.slug}`} featuredLocation={dl === 'ar' ? localizeTourLocation(featured.location) : featured.location} featuredDuration={dl === 'ar' ? localizeTourDuration(featured.duration) : featured.duration} statsLabel={tx(dl, { en: 'One-day tours summary', es: 'Resumen de circuitos de un dÃ­a', it: 'Riepilogo dei tour di un giorno', ar: 'Ù…Ù„Ø®Øµ Ø±Ø­Ù„Ø§Øª Ø§Ù„ÙŠÙˆÙ… Ø§Ù„ÙˆØ§Ø­Ø¯' })} stats={[{value:total,label:tx(dl, { en: 'Tours available', es: 'Circuitos disponibles', it: 'Tour disponibili', ar: 'Ø±Ø­Ù„Ø§Øª Ù…ØªØ§Ø­Ø©' })},{value:regions.length,label:tx(dl, { en: 'Egypt destinations', es: 'Destinos egipcios', it: 'Destinazioni egiziane', ar: 'ÙˆØ¬Ù‡Ø§Øª Ù…ØµØ±ÙŠØ©' })}]}/><Breadcrumb items={[tx(dl, { en: 'Egypt Tours', es: 'Circuitos por Egipto', it: 'Tour in Egitto', ar: 'Ø¬ÙˆÙ„Ø§Øª Ù…ØµØ±' }), catTitle]}/><main id="one-day-regions" className="listing-page container"><nav className="category-pills region-nav" aria-label={tx(dl, { en: 'Governorates', es: 'Gobernaciones', it: 'Governatorati', ar: 'Ø§Ù„Ù…Ø­Ø§ÙØ¸Ø§Øª' })}>{regions.map(r=><a key={r.slug} href={'#'+r.slug}>{r.title}</a>)}</nav><p className="region-count">{tx(dl, { en: 'Browse', es: 'Explora', it: 'Sfoglia', ar: 'ØªØµÙØ­' })} <strong>{total}</strong> {tx(dl, { en: 'one-day tours across', es: 'circuitos de un dÃ­a en', it: 'tour di un giorno in', ar: 'Ø±Ø­Ù„Ø© ÙŠÙˆÙ… ÙˆØ§Ø­Ø¯ ÙÙŠ' })} <strong>{regions.length}</strong> {tx(dl, { en: 'governorates', es: 'gobernaciones', it: 'governatorati', ar: 'Ù…Ø­Ø§ÙØ¸Ø§Øª' })}</p>{regions.map(r=><section key={r.slug} id={r.slug} className="region-block" aria-label={r.title}><div className="region-head"><div><span className="eyebrow">{catTitle}</span><h2>{r.title}</h2><p>{r.copy}</p></div><div className="region-badge-wrap"><span className="region-badge">{r.items.length} {tx(dl, { en: 'tours', es: 'circuitos', it: 'tour', ar: 'Ø±Ø­Ù„Ø§Øª' })}</span><Link href={`/egypt-tours/one-day-tours/${r.slug}`} className="region-see-more">{tx(dl, { en: 'See more', es: 'Ver mÃ¡s', it: 'Vedi di piÃ¹', ar: 'Ø´Ø§Ù‡Ø¯ Ø§Ù„ÙƒÙ„' })} <ArrowRight size={14}/></Link></div></div><div className="compact-tour-grid region-tours">{r.items.slice(0,4).map(t=><TourCard key={t.slug} tour={t} variant='day'/>)}</div></section>)}<HelpCTA/></main></>}

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
    <Breadcrumb items={[tx(locale, { en: 'Egypt Tours', es: 'Circuitos por Egipto', it: 'Tour in Egitto', ar: 'Ø¬ÙˆÙ„Ø§Øª Ù…ØµØ±' }), pickLocaleText(locale, { en: set.title, ar: categoryCopy[category].titleAr }), regionTitle]}/>
    <main className="listing-page container">
      <div className={`cat-hero ${variant}`}>
        <span className="cat-hero-ic" aria-hidden="true"><HeroIcon size={34}/></span>
        <div>
          <span className="eyebrow">{tx(locale, { en: meta.eyebrow, es: isCruise ? 'Navega por el Nilo' : (eyebrowEs[meta.eyebrow] ?? meta.eyebrow), it: isCruise ? 'Naviga sul Nilo' : (eyebrowIt[meta.eyebrow] ?? meta.eyebrow), ar: isCruise ? 'Ø£Ø¨Ø­Ø± ÙÙŠ Ø§Ù„Ù†ÙŠÙ„' : meta.eyebrowAr })}</span>
          <h1>{regionTitle}</h1>
          <p>{pickLocaleText(locale, { en: region.copy, ar: region.copyAr })}</p>
          <div className="cat-feats">{(isCruise ? [{ Icon: Ship, text: featLabel(locale, 'Nile itineraries', 'Ù…Ø³Ø§Ø±Ø§Øª Ù†ÙŠÙ„ÙŠØ©') }, { Icon: Users, text: featLabel(locale, 'Cruise options', 'Ø®ÙŠØ§Ø±Ø§Øª Ù…ØªØ¹Ø¯Ø¯Ø©') }] : meta.feats.map((feature, index) => ({ Icon: feature.Icon, text: featLabel(locale, feature.text, meta.featsAr[index]?.text ?? feature.text) }))).map((feature) => <span key={feature.text}><feature.Icon size={14}/>{feature.text}</span>)}</div>
        </div>
      </div>
      <div className="results-bar"><span>{tx(locale, { en: 'Showing', es: 'Mostrando', it: 'Visualizzati', ar: 'Ø¹Ø±Ø¶' })} <strong>{paged.length}</strong> {tx(locale, { en: 'of', es: 'de', it: 'di', ar: 'Ù…Ù†' })} <strong>{filteredTours.length}</strong> {tx(locale, { en: 'tours', es: 'recorridos', it: 'tour', ar: 'Ø±Ø­Ù„Ø©' })}</span></div>
      {durationOptions.length > 1 && <nav className="category-pills" aria-label={tx(locale, { en: 'Filter by duration', es: 'Filtrar por duraciÃ³n', it: 'Filtra per durata', ar: 'ØªØµÙÙŠØ© Ø­Ø³Ø¨ Ø§Ù„Ù…Ø¯Ø©' })}>
        {['', ...durationOptions].map((duration) => <button key={duration || 'all'} type="button" className={durFilter === duration ? 'active' : ''} aria-pressed={durFilter === duration} onClick={() => setDuration(duration)}>{duration ? (locale === 'ar' ? localizeTourDuration(duration) : duration) : tx(locale, { en: 'All', es: 'Todo', it: 'Tutto', ar: 'Ø§Ù„ÙƒÙ„' })}</button>)}
      </nav>}
      {paged.length ? <div className="compact-tour-grid region-tours">{paged.map((tour) => <TourCard key={tour.slug} tour={tour} variant={variant}/>)}</div> : <p className="region-count">{tx(locale, { en: 'No tours available at the moment.', es: 'No hay viajes disponibles por el momento.', it: 'Nessun viaggio disponibile al momento.', ar: 'Ù„Ø§ ØªÙˆØ¬Ø¯ Ø±Ø­Ù„Ø§Øª Ø­Ø§Ù„ÙŠØ§Ù‹' })}</p>}
      {totalPages > 1 && <nav className="pagination" aria-label={tx(locale, { en: 'Pagination', es: 'PaginaciÃ³n', it: 'Paginazione', ar: 'ØµÙØ­Ø§Øª Ø§Ù„Ø±Ø­Ù„Ø§Øª' })}>
        <Link href={makeHref(safePage - 1)} className={safePage <= 1 ? 'disabled' : ''} aria-disabled={safePage <= 1} onClick={(event) => { if (safePage <= 1) event.preventDefault() }}><ArrowRight size={14} style={{ transform: 'rotate(180deg)' }}/> {tx(locale, { en: 'Previous', es: 'Anterior', it: 'Precedente', ar: 'Ø§Ù„Ø³Ø§Ø¨Ù‚' })}</Link>
        {Array.from({ length: totalPages }, (_, index) => index + 1).map((number) => <Link key={number} href={makeHref(number)} className={number === safePage ? 'active' : ''} aria-current={number === safePage ? 'page' : undefined}>{number}</Link>)}
        <Link href={makeHref(safePage + 1)} className={safePage >= totalPages ? 'disabled' : ''} aria-disabled={safePage >= totalPages} onClick={(event) => { if (safePage >= totalPages) event.preventDefault() }}>{tx(locale, { en: 'Next', es: 'Siguiente', it: 'Avanti', ar: 'Ø§Ù„ØªØ§Ù„ÙŠ' })} <ArrowRight size={14}/></Link>
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
  return <><TourCategoryHero image={featured.image} eyebrow={catEyebrow} title={catTitle} intro={catIntro} primaryLabel={tx(dl, { en: 'Explore multi-day journeys', es: 'Explora los viajes de varios dÃ­as', it: 'Esplora i viaggi di piÃ¹ giorni', ar: 'Ø§Ø³ØªÙƒØ´Ù Ø±Ø­Ù„Ø§Øª Ù…ØªØ¹Ø¯Ø¯Ø© Ø§Ù„Ø£ÙŠØ§Ù…' })} primaryHref="#multi-day-categories" featuredLabel={tx(dl, { en: 'Featured journey', es: 'Viaje destacado', it: 'Viaggio in evidenza', ar: 'Ø±Ø­Ù„Ø© Ù…Ù…ÙŠØ²Ø©' })} featuredTitle={pickLocaleText(dl, { en: featured.title, ar: featured.titleAr })} featuredHref={`/egypt-tours/${featured.slug}`} featuredLocation={dl === 'ar' ? localizeTourLocation(featured.location) : featured.location} featuredDuration={dl === 'ar' ? localizeTourDuration(featured.duration) : featured.duration} statsLabel={tx(dl, { en: 'Multi-day tours summary', es: 'Resumen de viajes de varios dÃ­as', it: 'Riepilogo dei viaggi di piÃ¹ giorni', ar: 'Ù…Ù„Ø®Øµ Ø±Ø­Ù„Ø§Øª Ù…ØªØ¹Ø¯Ø¯Ø© Ø§Ù„Ø£ÙŠØ§Ù…' })} stats={[{value:total,label:tx(dl, { en: 'Journeys available', es: 'Viajes disponibles', it: 'Viaggi disponibili', ar: 'Ø±Ø­Ù„Ø§Øª Ù…ØªØ§Ø­Ø©' })},{value:entries.length,label:tx(dl, { en: 'Travel categories', es: 'CategorÃ­as de viaje', it: 'Categorie di viaggio', ar: 'ÙØ¦Ø§Øª Ø³ÙØ±' })}]}/><Breadcrumb items={[tx(dl, { en: 'Egypt Tours', es: 'Circuitos por Egipto', it: 'Tour in Egitto', ar: 'Ø¬ÙˆÙ„Ø§Øª Ù…ØµØ±' }), catTitle]}/><main id="multi-day-categories" className="listing-page container"><nav className="category-pills region-nav" aria-label={tx(dl, { en: 'Travel categories', es: 'CategorÃ­as de viaje', it: 'Categorie di viaggio', ar: 'ÙØ¦Ø§Øª Ø§Ù„Ø³ÙØ±' })}>{entries.map(({category})=><a key={category.slug} href={'#'+category.slug}>{dl==='ar'?category.nameAr:category.name}</a>)}</nav><p className="region-count">{tx(dl, { en: 'Browse', es: 'Explora', it: 'Sfoglia', ar: 'ØªØµÙØ­' })} <strong>{total}</strong> {tx(dl, { en: 'multi-day journeys across', es: 'viajes de varios dÃ­as en', it: 'viaggi di piÃ¹ giorni in', ar: 'Ø±Ø­Ù„Ø© Ù…ØªØ¹Ø¯Ø¯Ø© Ø§Ù„Ø£ÙŠØ§Ù… ÙÙŠ' })} <strong>{entries.length}</strong> {tx(dl, { en: 'travel categories', es: 'categorÃ­as de viaje', it: 'categorie di viaggio', ar: 'ÙØ¦Ø§Øª Ø³ÙØ±' })}</p>{entries.map(({category,tours})=><section key={category.slug} id={category.slug} className="region-block" aria-label={dl==='ar'?category.nameAr:category.name}><div className="region-head"><div><span className="eyebrow">{catTitle}</span><h2>{dl==='ar'?category.nameAr:category.name}</h2><p>{dl==='ar'?category.copyAr:category.copy}</p></div><div className="region-badge-wrap"><span className="region-badge">{tours.length} {tx(dl, { en: 'tours', es: 'viajes', it: 'viaggi', ar: 'Ø±Ø­Ù„Ø§Øª' })}</span><Link href={`/egypt-tours/multi-days-tours/${category.slug}`} className="region-see-more">{tx(dl, { en: 'See more', es: 'Ver mÃ¡s', it: 'Vedi di piÃ¹', ar: 'Ø´Ø§Ù‡Ø¯ Ø§Ù„Ù…Ø²ÙŠØ¯' })} <ArrowRight size={14}/></Link></div></div><div className="compact-tour-grid region-tours">{tours.slice(0,4).map(t=><TourCard key={t.slug} tour={t} variant='multi'/>)}</div></section>)}<HelpCTA/></main></>
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
  const sortLabel = (o: string) => tx(locale, { en: o, es: o === 'Price: low to high' ? 'Precio: de menor a mayor' : o === 'Price: high to low' ? 'Precio: de mayor a menor' : 'Recomendados', it: o === 'Price: low to high' ? 'Prezzo: dal piÃ¹ basso' : o === 'Price: high to low' ? 'Prezzo: dal piÃ¹ alto' : 'Consigliati', ar: o === 'Price: low to high' ? 'Ø§Ù„Ø³Ø¹Ø±: Ù…Ù† Ø§Ù„Ø£Ù‚Ù„' : o === 'Price: high to low' ? 'Ø§Ù„Ø³Ø¹Ø±: Ù…Ù† Ø§Ù„Ø£Ø¹Ù„Ù‰' : 'Ø§Ù„Ù…ÙˆØµÙ‰ Ø¨Ù‡Ø§' })
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
    <Breadcrumb items={[tx(locale, { en: 'Egypt Tours', es: 'Circuitos por Egipto', it: 'Tour in Egitto', ar: 'Ø¬ÙˆÙ„Ø§Øª Ù…ØµØ±' }), parentTitle, categoryTitle]}/>{category && category.image ? <div className="mdc-cover"><img src={category.image} alt={categoryTitle}/></div> : null}
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
      {!category || !category.active ? <div className="account-empty"><h3>{tx(locale, { en: 'Category not found.', es: 'CategorÃ­a no encontrada.', it: 'Categoria non trovata.', ar: 'Ø§Ù„ÙØ¦Ø© ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯Ø©.' })}</h3><p>{tx(locale, { en: 'The category you are looking for is not available right now.', es: 'La categorÃ­a que buscas no estÃ¡ disponible ahora mismo.', it: 'La categoria che cerchi non Ã¨ disponibile al momento.', ar: 'Ø§Ù„ÙØ¦Ø© Ø§Ù„ØªÙŠ ØªØ¨Ø­Ø« Ø¹Ù†Ù‡Ø§ ØºÙŠØ± Ù…ØªØ§Ø­Ø© Ø­Ø§Ù„ÙŠØ§.' })}</p><Link href="/egypt-tours/multi-days-tours" className="primary-btn">{tx(locale, { en: 'Multi day tours', es: 'Viajes de varios dÃ­as', it: 'Viaggi di piÃ¹ giorni', ar: 'Ø±Ø­Ù„Ø§Øª Ù…ØªØ¹Ø¯Ø¯Ø© Ø§Ù„Ø£ÙŠØ§Ù…' })}</Link></div> : tours.length ? <>
        <CategoryFilter destination={destination} duration={duration} price={price} destinationOptions={destinationOptions} durationOptions={durationOptions} appliedCount={appliedCount} onDestination={setDestination} onDuration={setDuration} onPrice={setPrice} onSearch={applyFilters} onReset={resetFilters}/>
        <div className="results-bar"><strong role="status">{tx(locale, { en: `${sorted.length} tour${sorted.length === 1 ? '' : 's'} found`, es: `${sorted.length} recorridos disponibles`, it: `${sorted.length} tour disponibili`, ar: `${sorted.length} Ø±Ø­Ù„Ø§Øª Ù…ØªØ§Ø­Ø©` })}</strong><SharedSelect value={query.sort} onChange={(o) => go({ ...query, sort: o as TourListingQuery['sort'], page: 1 })} locale={locale} label={tx(locale, { en: 'Sort by', es: 'Ordenar por', it: 'Ordina per', ar: 'ØªØ±ØªÙŠØ¨ Ø­Ø³Ø¨' })} options={tourListingSorts.map((o) => ({ value: o, label: sortLabel(o) }))} /></div>
        {paged.length ? <div className="listing-grid">{paged.map(t => <TourCard key={t.slug} tour={t} variant={variant}/>)}</div> : <div className="account-empty"><h3>{tx(locale, { en: 'No tours match your filters.', es: 'NingÃºn viaje coincide con tus filtros.', it: 'Nessun viaggio corrisponde ai tuoi filtri.', ar: 'Ù„Ø§ ØªÙˆØ¬Ø¯ Ø±Ø­Ù„Ø§Øª ØªØ·Ø§Ø¨Ù‚ Ø§Ù„ÙÙ„Ø§ØªØ±.' })}</h3><p>{tx(locale, { en: 'Try a different destination or reset the filters to see everything.', es: 'Prueba otro destino o restablece los filtros para verlo todo.', it: 'Prova unâ€™altra destinazione o reimposta i filtri per vedere tutto.', ar: 'Ø¬Ø±Ù‘Ø¨ ÙˆØ¬Ù‡Ø© Ù…Ø®ØªÙ„ÙØ© Ø£Ùˆ Ø£Ø¹Ø¯ Ø¶Ø¨Ø· Ø§Ù„ÙÙ„Ø§ØªØ± Ù„Ø±Ø¤ÙŠØ© ÙƒÙ„ Ø´ÙŠØ¡.' })}</p><button type="button" className="primary-btn" onClick={resetFilters}>{tx(locale, { en: 'Reset Filters', es: 'Borrar filtros', it: 'Cancella i filtri', ar: 'Ø¥Ø¹Ø§Ø¯Ø© Ø¶Ø¨Ø· Ø§Ù„ÙÙ„Ø§ØªØ±' })}</button></div>}
        <nav className="pagination" aria-label={tx(locale, { en: 'Tour listing pages', es: 'PÃ¡ginas de viajes', it: 'Pagine dei viaggi', ar: 'ØµÙØ­Ø§Øª Ø§Ù„Ø±Ø­Ù„Ø§Øª' })}><button type="button" onClick={() => go({ ...query, page: Math.max(1, safePage - 1) })} aria-label={tx(locale, { en: 'Previous page', es: 'PÃ¡gina anterior', it: 'Pagina precedente', ar: 'Ø§Ù„ØµÙØ­Ø© Ø§Ù„Ø³Ø§Ø¨Ù‚Ø©' })} disabled={safePage <= 1} style={safePage <= 1 ? { opacity: .5 } : undefined}>{tx(locale, { en: 'â€¹ Back', es: 'â€¹ AtrÃ¡s', it: 'â€¹ Indietro', ar: 'â€¹ Ø§Ù„Ø³Ø§Ø¨Ù‚' })}</button>{Array.from({ length: totalPages }, (_, i) => safePage === i + 1 ? <b key={i + 1} aria-current="page">{i + 1}</b> : <button key={i + 1} type="button" aria-label={tx(locale, { en: `Go to page ${i + 1}`, es: `Ve a la pÃ¡gina ${i + 1}`, it: `Vai alla pagina ${i + 1}`, ar: `Ø§Ù†ØªÙ‚Ù„ Ø¥Ù„Ù‰ Ø§Ù„ØµÙØ­Ø© ${i + 1}` })} onClick={() => go({ ...query, page: i + 1 })}>{i + 1}</button>)}<button type="button" onClick={() => go({ ...query, page: Math.min(totalPages, safePage + 1) })} aria-label={tx(locale, { en: 'Next page', es: 'PÃ¡gina siguiente', it: 'Pagina successiva', ar: 'Ø§Ù„ØµÙØ­Ø© Ø§Ù„ØªØ§Ù„ÙŠØ©' })} disabled={safePage >= totalPages} style={safePage >= totalPages ? { opacity: .5 } : undefined}>{tx(locale, { en: 'Next â€º', es: 'Siguiente â€º', it: 'Avanti â€º', ar: 'Ø§Ù„ØªØ§Ù„ÙŠ â€º' })}</button></nav>
      </> : <div className="account-empty"><h3>{tx(locale, { en: 'No journeys in this category yet.', es: 'AÃºn no hay viajes en esta categorÃ­a.', it: 'Non ci sono ancora viaggi in questa categoria.', ar: 'Ù„Ø§ ØªÙˆØ¬Ø¯ Ø±Ø­Ù„Ø§Øª ÙÙŠ Ù‡Ø°Ù‡ Ø§Ù„ÙØ¦Ø© Ø¨Ø¹Ø¯.' })}</h3><p>{tx(locale, { en: 'New journeys are added regularly â€” check back soon.', es: 'AÃ±adimos viajes nuevos con frecuencia; vuelve pronto.', it: 'Aggiungiamo regolarmente nuovi viaggi; torna presto.', ar: 'Ù†Ø¶ÙŠÙ Ø±Ø­Ù„Ø§Øª Ø¬Ø¯ÙŠØ¯Ø© Ø¨Ø§Ø³ØªÙ…Ø±Ø§Ø± â€” Ø¹Ø§ÙˆØ¯ Ø§Ù„Ø²ÙŠØ§Ø±Ø© Ù‚Ø±ÙŠØ¨Ø§Ù‹.' })}</p></div>}
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
      <Breadcrumb items={[tx(locale, { en: 'Egypt Tours', es: 'Circuitos por Egipto', it: 'Tour in Egitto', ar: 'Ø¬ÙˆÙ„Ø§Øª Ù…ØµØ±' }), parentTitle]} />
      <main className="listing-page container"><div className="account-empty"><h3>{tx(locale, { en: 'Destination not found.', es: 'Destino no encontrado.', it: 'Destinazione non trovata.', ar: 'Ø§Ù„ÙˆØ¬Ù‡Ø© ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯Ø©.' })}</h3><p>{tx(locale, { en: 'The destination you are looking for is not available right now.', es: 'El destino que buscas no estÃ¡ disponible ahora mismo.', it: 'La destinazione che cerchi non Ã¨ disponibile al momento.', ar: 'Ø§Ù„ÙˆØ¬Ù‡Ø© Ø§Ù„ØªÙŠ ØªØ¨Ø­Ø« Ø¹Ù†Ù‡Ø§ ØºÙŠØ± Ù…ØªØ§Ø­Ø© Ø­Ø§Ù„ÙŠØ§.' })}</p><Link href="/egypt-tours/one-day-tours" className="primary-btn">{tx(locale, { en: 'One day tours', es: 'Circuitos de un dÃ­a', it: 'Tour di un giorno', ar: 'Ø±Ø­Ù„Ø§Øª Ø§Ù„ÙŠÙˆÙ… Ø§Ù„ÙˆØ§Ø­Ø¯' })}</Link></div></main>
    </>
  }
  const destTitle = pickLocaleText(locale, { en: destination.title, ar: destination.nameAr })
  const destDesc = pickLocaleText(locale, { en: destination.copy, ar: destination.copyAr })
  return <>
    <Breadcrumb items={[tx(locale, { en: 'Egypt Tours', es: 'Circuitos por Egipto', it: 'Tour in Egitto', ar: 'Ø¬ÙˆÙ„Ø§Øª Ù…ØµØ±' }), parentTitle, destTitle]} />
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
      <div className="results-bar"><span>{tx(locale, { en: 'Showing', es: 'Mostrando', it: 'Visualizzati', ar: 'Ø¹Ø±Ø¶' })} <strong>{paged.length}</strong> {tx(locale, { en: 'of', es: 'de', it: 'di', ar: 'Ù…Ù†' })} <strong>{tours.length}</strong> {tx(locale, { en: 'tours', es: 'recorridos', it: 'tour', ar: 'Ø±Ø­Ù„Ø©' })}</span></div>
      {paged.length ? <div className="compact-tour-grid region-tours">{paged.map((tour) => <TourCard key={tour.slug} tour={tour} variant={variant} />)}</div> : <p className="region-count">{tx(locale, { en: 'No tours available at the moment.', es: 'No hay viajes disponibles por el momento.', it: 'Nessun viaggio disponibile al momento.', ar: 'Ù„Ø§ ØªÙˆØ¬Ø¯ Ø±Ø­Ù„Ø§Øª Ø­Ø§Ù„ÙŠØ§Ù‹' })}</p>}
      {totalPages > 1 && <nav className="pagination" aria-label={tx(locale, { en: 'Pagination', es: 'PaginaciÃ³n', it: 'Paginazione', ar: 'ØµÙØ­Ø§Øª Ø§Ù„Ø±Ø­Ù„Ø§Øª' })}>
        <Link href={makeHref(safePage - 1)} className={safePage <= 1 ? 'disabled' : ''} aria-disabled={safePage <= 1} onClick={(event) => { if (safePage <= 1) event.preventDefault() }}><ArrowRight size={14} style={{ transform: 'rotate(180deg)' }} /> {tx(locale, { en: 'Previous', es: 'Anterior', it: 'Precedente', ar: 'Ø§Ù„Ø³Ø§Ø¨Ù‚' })}</Link>
        {Array.from({ length: totalPages }, (_, index) => index + 1).map((number) => <Link key={number} href={makeHref(number)} className={number === safePage ? 'active' : ''} aria-current={number === safePage ? 'page' : undefined}>{number}</Link>)}
        <Link href={makeHref(safePage + 1)} className={safePage >= totalPages ? 'disabled' : ''} aria-disabled={safePage >= totalPages} onClick={(event) => { if (safePage >= totalPages) event.preventDefault() }}>{tx(locale, { en: 'Next', es: 'Siguiente', it: 'Avanti', ar: 'Ø§Ù„ØªØ§Ù„ÙŠ' })} <ArrowRight size={14} /></Link>
      </nav>}
    </main>
  </>
}

export function MultiDayToursCategories(){return <SiteShell><MultiDayToursCategoriesContent/></SiteShell>}
export const catMeta: Record<TourVariant, { eyebrow: string; eyebrowAr: string; HeroIcon: typeof Sun; feats: { Icon: typeof Sun; text: string }[]; featsAr: { Icon: typeof Sun; text: string }[] }> = {
  multi: { eyebrow: 'Take your time', eyebrowAr: 'Ø®Ø° ÙˆÙ‚ØªÙƒ', HeroIcon: Package, feats: [{ Icon: MapPin, text: 'Multi-city routes' }, { Icon: Users, text: 'Private groups' }], featsAr: [{ Icon: MapPin, text: 'Ù…Ø³Ø§Ø±Ø§Øª Ù…ØªØ¹Ø¯Ø¯Ø© Ø§Ù„Ù…Ø¯Ù†' }, { Icon: Users, text: 'Ù…Ø¬Ù…ÙˆØ¹Ø§Øª Ø®Ø§ØµØ©' }] },
  day: { eyebrow: 'One day, zero rush', eyebrowAr: 'ÙŠÙˆÙ… ÙˆØ§Ø­Ø¯ Ø¨Ø¯ÙˆÙ† Ø§Ø³ØªØ¹Ø¬Ø§Ù„', HeroIcon: Sun, feats: [{ Icon: Clock3, text: 'Hours, not days' }, { Icon: MapPin, text: 'Single city' }], featsAr: [{ Icon: Clock3, text: 'Ø³Ø§Ø¹Ø§Øª Ù„Ø§ Ø£ÙŠØ§Ù…' }, { Icon: MapPin, text: 'Ù…Ø¯ÙŠÙ†Ø© ÙˆØ§Ø­Ø¯Ø©' }] },
  cruise: { eyebrow: 'Sail in style', eyebrowAr: 'Ø£Ø¨Ø­Ø± Ø¨Ø£Ù†Ø§Ù‚Ø©', HeroIcon: Ship, feats: [{ Icon: Star, text: '5-star decks' }, { Icon: Users, text: 'Full board' }], featsAr: [{ Icon: Star, text: 'Ø£Ø¬Ù†Ø­Ø© 5 Ù†Ø¬ÙˆÙ…' }, { Icon: Users, text: 'Ø¥Ù‚Ø§Ù…Ø© Ø´Ø§Ù…Ù„Ø©' }] },
  shore: { eyebrow: 'From port to wonders', eyebrowAr: 'Ù…Ù† Ø§Ù„Ù…ÙŠÙ†Ø§Ø¡ Ø¥Ù„Ù‰ Ø§Ù„Ø¹Ø¬Ø§Ø¦Ø¨', HeroIcon: Anchor, feats: [{ Icon: Anchor, text: 'Port pickup' }, { Icon: Clock3, text: 'Back on time' }], featsAr: [{ Icon: Anchor, text: 'Ø§Ø³ØªÙ„Ø§Ù… Ù…Ù† Ø§Ù„Ù…ÙŠÙ†Ø§Ø¡' }, { Icon: Clock3, text: 'Ø¹ÙˆØ¯Ø© ÙÙŠ Ø§Ù„Ù…ÙˆØ¹Ø¯' }] },
}

export const categoryCopy: Record<TourCategory, { titleAr: string; introAr: string }> = {
  'one-day-tours': { titleAr: 'Ø±Ø­Ù„Ø§Øª Ø§Ù„ÙŠÙˆÙ… Ø§Ù„ÙˆØ§Ø­Ø¯', introAr: 'Ø§ÙƒØªØ´Ù Ø£Ø¹Ø¸Ù… ÙƒÙ†ÙˆØ² Ù…ØµØ± ÙÙŠ ÙŠÙˆÙ… ÙˆØ§Ø­Ø¯ Ù„Ø§ ÙŠÙÙ†Ø³Ù‰.' },
  'multi-days-tours': { titleAr: 'Ø±Ø­Ù„Ø§Øª Ù…ØªØ¹Ø¯Ø¯Ø© Ø§Ù„Ø£ÙŠØ§Ù…', introAr: 'Ø®Ø° ÙˆÙ‚ØªÙƒ ÙˆØ§Ø³ØªÙ…ØªØ¹ Ø¨Ù…ØµØ± Ø£Ø¨Ø¹Ø¯ Ù…Ù† Ø§Ù„Ù…Ø¹Ø§Ù„Ù….' },
  'nile-cruises': { titleAr: 'ÙƒØ±ÙˆØ² Ø§Ù„Ù†ÙŠÙ„', introAr: 'Ø£Ø¨Ø­Ø± Ø¨ÙŠÙ† Ø§Ù„Ù…Ø¹Ø§Ø¨Ø¯ Ø§Ù„Ù‚Ø¯ÙŠÙ…Ø© Ø¨Ø±Ø§Ø­Ø© ÙˆØ®Ø¯Ù…Ø© ÙˆÙ…Ù†Ø§Ø¸Ø± Ù„Ø§ ØªÙÙ†Ø³Ù‰.' },
  'shore-excursions': { titleAr: 'Ø±Ø­Ù„Ø§Øª Ø§Ù„Ø´ÙˆØ§Ø·Ø¦', introAr: 'Ø§Ø³ØªØºÙ„ ÙƒÙ„ Ù…ÙŠÙ†Ø§Ø¡ Ù…Ø¹ Ø±Ø­Ù„Ø§Øª Ø´Ø§Ø·Ø¦ÙŠØ© Ù…Ø®Ø·Ø·Ø© Ø¨Ø®Ø¨Ø±Ø©.' },
}
const eyebrowEs: Record<string, string> = { 'Take your time': 'TÃ³mate tu tiempo', 'One day, zero rush': 'Un dÃ­a sin prisas', 'Sail in style': 'Navega con estilo', 'From port to wonders': 'Del puerto a las maravillas' }
const eyebrowIt: Record<string, string> = { 'Take your time': 'Prenditi il tuo tempo', 'One day, zero rush': 'Un giorno senza fretta', 'Sail in style': 'Naviga con stile', 'From port to wonders': 'Dal porto alle meraviglie' }
const featEs: Record<string, string> = { 'Multi-city routes': 'Rutas por varias ciudades', 'Private groups': 'Grupos privados', 'Hours, not days': 'Horas, no dÃ­as', 'Single city': 'Una sola ciudad', '5-star decks': 'Cubiertas de 5 estrellas', 'Full board': 'PensiÃ³n completa', 'Port pickup': 'Recogida en el puerto', 'Back on time': 'Regreso a tiempo', 'Nile itineraries': 'Itinerarios por el Nilo', 'Cruise options': 'Opciones de crucero' }
const featIt: Record<string, string> = { 'Multi-city routes': 'Itinerari multi-cittÃ ', 'Private groups': 'Gruppi privati', 'Hours, not days': 'Ore, non giorni', 'Single city': 'Una sola cittÃ ', '5-star decks': 'Ponti a 5 stelle', 'Full board': 'Pensione completa', 'Port pickup': 'Prelievo al porto', 'Back on time': 'Rientro in orario', 'Nile itineraries': 'Itinerari sul Nilo', 'Cruise options': 'Opzioni di crociera' }
function featLabel(locale: Locale, text: string, arText: string) { return tx(locale, { en: text, es: featEs[text] ?? text, it: featIt[text] ?? text, ar: arText }) }

const crumbNames: Record<string, { ar: string; es: string; it: string }> = {'Egypt Tours': { ar: 'Ø¬ÙˆÙ„Ø§Øª Ù…ØµØ±', es: 'Circuitos por Egipto', it: 'Tour in Egitto' }, 'Nile Cruises': { ar: 'Ø±Ø­Ù„Ø§Øª Ø§Ù„Ù†ÙŠÙ„', es: 'Cruceros por el Nilo', it: 'Crociere sul Nilo' }, Trips: { ar: 'ÙƒÙ„ Ø§Ù„Ø±Ø­Ù„Ø§Øª', es: 'Viajes', it: 'Viaggi' }}
export function Breadcrumb({items}:{items:string[]}){const {locale}=useLocale(); return <div className="breadcrumb"><div className="container"><Link href="/">{tx(locale, { en: 'Home', es: 'Inicio', it: 'Home', ar: 'الرئيسية' })}</Link>{items.map(i=><span key={i}>› {tx(locale, { en: i, es: crumbNames[i]?.es, it: crumbNames[i]?.it, ar: crumbNames[i]?.ar })}</span>)}</div></div>}

export function Heading({title,copy}:{title:string;copy?:string}){return <div className="section-heading"><h1>{title}</h1>{copy&&<p>{copy}</p>}</div>}

export type TourFilters={destination:string;duration:string;price:string}

export function CategoryFilter({destination,duration,price,destinationOptions,durationOptions,appliedCount,onDestination,onDuration,onPrice,onSearch,onReset}:{destination:string;duration:string;price:string;destinationOptions:readonly string[];durationOptions:readonly string[];appliedCount:number;onDestination:(v:string)=>void;onDuration:(v:string)=>void;onPrice:(v:string)=>void;onSearch:()=>void;onReset:()=>void}){const {currency,locale:fl}=useLocale(); const lo=formatPrice(200,currency,fl); const hi=formatPrice(400,currency,fl); const bandLabel=(id:string)=>tx(fl, { en: id==='under-200' ? `Under ${lo}` : id==='200-400' ? `${lo} - ${hi}` : `Over ${hi}`, es: id==='under-200' ? `Menos de ${lo}` : id==='200-400' ? `${lo} - ${hi}` : `MÃ¡s de ${hi}`, it: id==='under-200' ? `Meno di ${lo}` : id==='200-400' ? `${lo} - ${hi}` : `PiÃ¹ di ${hi}`, ar: id==='under-200' ? `Ø£Ù‚Ù„ Ù…Ù† ${lo}` : id==='200-400' ? `${lo} - ${hi}` : `Ø£ÙƒØ«Ø± Ù…Ù† ${hi}` }); const rtl=typeof document!=='undefined'&&document.documentElement.dir==='rtl'; return <div className="category-filter"><div className="filter-wrapper" dir={rtl ? 'rtl' : 'ltr'}><div className="filter-grid"><label className="filter-field"><span>{tx(fl, { en: 'Destination', es: 'Destino', it: 'Destinazione', ar: 'Ø§Ù„ÙˆØ¬Ù‡Ø©' })}</span><SharedSelect value={destination} onChange={onDestination} locale={fl} options={[{value:'',label:tx(fl, { en: 'All destinations', es: 'Todos los destinos', it: 'Tutte le destinazioni', ar: 'ÙƒÙ„ Ø§Ù„ÙˆØ¬Ù‡Ø§Øª' })},...destinationOptions.map((d)=>({value:d,label:d}))]} /></label><label className="filter-field"><span>{tx(fl, { en: 'Duration', es: 'DuraciÃ³n', it: 'Durata', ar: 'Ø§Ù„Ù…Ø¯Ø©' })}</span><SharedSelect value={duration} onChange={onDuration} locale={fl} options={[{value:'',label:tx(fl, { en: 'Any duration', es: 'Cualquier duraciÃ³n', it: 'Qualsiasi durata', ar: 'Ø£ÙŠ Ù…Ø¯Ø©' })},...durationOptions.map((d)=>({value:d,label:d}))]} /></label><label className="filter-field"><span>{tx(fl, { en: 'Price', es: 'Precio', it: 'Prezzo', ar: 'Ø§Ù„Ø³Ø¹Ø±' })}</span><SharedSelect value={price} onChange={onPrice} locale={fl} options={[{value:'',label:tx(fl, { en: 'Any price', es: 'Cualquier precio', it: 'Qualsiasi prezzo', ar: 'Ø£ÙŠ Ø³Ø¹Ø±' })},...tourPriceBands.filter((band)=>band.id!=='').map((band)=>({value:band.id,label:bandLabel(band.id)}))]} /></label></div><div className="filter-actions">{appliedCount>0?<div className="applied-count">{tx(fl, { en: `${appliedCount} filter${appliedCount!==1?'s':''} applied`, es: `${appliedCount} filtro${appliedCount!==1?'s':''} aplicado`, it: `${appliedCount} filtro${appliedCount!==1?'i':''} applicati`, ar: `${appliedCount} فلتر${appliedCount!==1?'s':''} مطبق` })}</div>:null}<button type="button" className="reset-btn" onClick={onReset}>{tx(fl, { en: 'Reset Filters', es: 'Borrar filtros', it: 'Cancella i filtri', ar: 'إعادة ضبط الفلاتر' })}</button><button type="button" className="primary-btn search-btn" onClick={onSearch}>{tx(fl, { en: 'Search', es: 'Buscar', it: 'Cerca', ar: 'بحث' })}</button></div></div></div>}

export function TourListing({slug}:{slug:TourCategory}){return <SiteShell><Suspense><TourListingInner slug={slug}/></Suspense></SiteShell>}

function TourListingInner({slug}:{slug:TourCategory}){const set=tourCategories[slug]; const variant=set.variant; const meta=catMeta[variant]; const {locale:tl}=useLocale(); const catTitle=pickLocaleText(tl, { en: set.title, ar: categoryCopy[slug].titleAr }); const catIntro=pickLocaleText(tl, { en: set.intro, ar: categoryCopy[slug].introAr }); const catEyebrow=tx(tl, { en: meta.eyebrow, es: eyebrowEs[meta.eyebrow] ?? meta.eyebrow, it: eyebrowIt[meta.eyebrow] ?? meta.eyebrow, ar: meta.eyebrowAr }); const sortLabel=(o:string)=>tx(tl, { en: o, es: o==='Price: low to high' ? 'Precio: de menor a mayor' : o==='Price: high to low' ? 'Precio: de mayor a menor' : 'Recomendados', it: o==='Price: low to high' ? 'Prezzo: dal piÃ¹ basso' : o==='Price: high to low' ? 'Prezzo: dal piÃ¹ alto' : 'Consigliati', ar: o==='Price: low to high' ? 'Ø§Ù„Ø³Ø¹Ø±: Ù…Ù† Ø§Ù„Ø£Ù‚Ù„' : o==='Price: high to low' ? 'Ø§Ù„Ø³Ø¹Ø±: Ù…Ù† Ø§Ù„Ø£Ø¹Ù„Ù‰' : 'Ø§Ù„Ù…ÙˆØµÙ‰ Ø¨Ù‡Ø§' }); const allTours=useDbTours(getToursByCategory(slug)); const featured=allTours[0]; const destinationOptions=Array.from(new Set(allTours.map((tour)=>tour.location))); const durationOptions=Array.from(new Set(allTours.map((tour)=>tour.duration))); const searchParams=useSearchParams(); const router=useRouter(); const pathname=usePathname(); const query=parseTourListingQuery(searchParams,destinationOptions,durationOptions); const [destination,setDestination]=useState(query.destination); const [duration,setDuration]=useState(query.duration); const [price,setPrice]=useState(query.price); useEffect(()=>{setDestination(query.destination);setDuration(query.duration);setPrice(query.price)},[query.destination,query.duration,query.price]); const perPage=6; const go=(next:TourListingQuery)=>{const params=new URLSearchParams(); if(next.destination)params.set('destination',next.destination); if(next.duration)params.set('duration',next.duration); if(next.price)params.set('price',next.price); if(next.sort!=='Recommended')params.set('sort',next.sort); if(next.page>1)params.set('page',String(next.page)); const qs=params.toString(); router.replace(pathname+(qs?`?${qs}`:''),{scroll:false})}; const applyFilters=()=>go({destination,duration,price,sort:query.sort,page:1}); const resetFilters=()=>{setDestination('');setDuration('');setPrice('');go({destination:'',duration:'',price:'',sort:query.sort,page:1})}; const appliedCount=[query.destination,query.duration,query.price].filter(Boolean).length; const filtered=allTours.filter((t)=>(!query.destination||t.location===query.destination)&&(!query.duration||t.duration===query.duration)&&matchPriceBand(t.price,query.price)); const sorted=[...filtered].sort((a,b)=>query.sort==='Price: low to high'?(a.price-b.price||(a.slug<b.slug?-1:1)):query.sort==='Price: high to low'?(b.price-a.price||(a.slug<b.slug?-1:1)):0); const totalPages=Math.max(1,Math.ceil(sorted.length/perPage)); const safePage=Math.min(Math.max(1,query.page),totalPages); const paged=sorted.slice((safePage-1)*perPage,safePage*perPage); const isShore=slug==='shore-excursions'; return <><TourCategoryHero image={featured.image} eyebrow={catEyebrow} title={catTitle} intro={catIntro} primaryLabel={isShore ? tx(tl, { en: 'Explore shore excursions', es: 'Explora las excursiones en tierra', it: 'Esplora le escursioni a terra', ar: 'Ø§Ø³ØªÙƒØ´Ù Ø±Ø­Ù„Ø§Øª Ø§Ù„Ù…ÙˆØ§Ù†Ø¦' }) : tx(tl, { en: 'Explore journeys', es: 'Explora los viajes', it: 'Esplora i viaggi', ar: 'Ø§Ø³ØªÙƒØ´Ù Ø§Ù„Ø¨Ø§Ù‚Ø§Øª' })} primaryHref="#tour-listing" featuredLabel={isShore ? tx(tl, { en: 'Featured shore excursion', es: 'ExcursiÃ³n en tierra destacada', it: 'Escursione a terra in evidenza', ar: 'Ø±Ø­Ù„Ø© Ù…ÙŠÙ†Ø§Ø¡ Ù…Ù…ÙŠØ²Ø©' }) : tx(tl, { en: 'Featured journey', es: 'Viaje destacado', it: 'Viaggio in evidenza', ar: 'Ø¨Ø§Ù‚Ø© Ù…Ù…ÙŠØ²Ø©' })} featuredTitle={pickLocaleText(tl, { en: featured.title, ar: featured.titleAr })} featuredHref={`/egypt-tours/${featured.slug}`} featuredLocation={tl === 'ar' ? localizeTourLocation(featured.location) : featured.location} featuredDuration={tl === 'ar' ? localizeTourDuration(featured.duration) : featured.duration} statsLabel={tx(tl, { en: 'Tours summary', es: 'Resumen de viajes', it: 'Riepilogo dei viaggi', ar: 'Ù…Ù„Ø®Øµ Ø§Ù„Ø±Ø­Ù„Ø§Øª' })} stats={[{value:allTours.length,label:isShore ? tx(tl, { en: 'Shore excursions', es: 'Excursiones en tierra', it: 'Escursioni a terra', ar: 'Ø±Ø­Ù„Ø§Øª Ù…ÙˆØ§Ù†Ø¦' }) : tx(tl, { en: 'Journeys available', es: 'Viajes disponibles', it: 'Viaggi disponibili', ar: 'Ø¨Ø§Ù‚Ø§Øª Ù…ØªØ§Ø­Ø©' })},{value:destinationOptions.length,label:isShore ? tx(tl, { en: 'Ports & destinations', es: 'Puertos y destinos', it: 'Porti e destinazioni', ar: 'Ù…ÙˆØ§Ù†Ø¦ ÙˆÙˆØ¬Ù‡Ø§Øª' }) : tx(tl, { en: 'Egypt destinations', es: 'Destinos egipcios', it: 'Destinazioni egiziane', ar: 'ÙˆØ¬Ù‡Ø§Øª Ù…ØµØ±ÙŠØ©' })}]}/><Breadcrumb items={[tx(tl, { en: 'Egypt Tours', es: 'Circuitos por Egipto', it: 'Tour in Egitto', ar: 'Ø¬ÙˆÙ„Ø§Øª Ù…ØµØ±' }), catTitle]}/><main id="tour-listing" className="listing-page container"><CategoryFilter destination={destination} duration={duration} price={price} destinationOptions={destinationOptions} durationOptions={durationOptions} appliedCount={appliedCount} onDestination={setDestination} onDuration={setDuration} onPrice={setPrice} onSearch={applyFilters} onReset={resetFilters}/><div className="results-bar"><strong role="status">{tx(tl, { en: `${sorted.length} tour${sorted.length===1?'':'s'} found`, es: `${sorted.length} recorridos disponibles`, it: `${sorted.length} tour disponibili`, ar: `${sorted.length} Ø±Ø­Ù„Ø§Øª Ù…ØªØ§Ø­Ø©` })}</strong><SharedSelect value={query.sort} onChange={(o)=>go({...query,sort:o as TourListingQuery['sort'],page:1})} locale={tl} label={tx(tl, { en: 'Sort by', es: 'Ordenar por', it: 'Ordina per', ar: 'ØªØ±ØªÙŠØ¨ Ø­Ø³Ø¨' })} options={tourListingSorts.map((o)=>({value:o,label:sortLabel(o)}))} /></div>{paged.length?<div className="listing-grid">{paged.map(t=><TourCard key={t.slug} tour={t} variant={variant}/>)}</div>:<div className="account-empty"><h3>{tx(tl, { en: 'No tours match your filters.', es: 'NingÃºn viaje coincide con tus filtros.', it: 'Nessun viaggio corrisponde ai tuoi filtri.', ar: 'Ù„Ø§ ØªÙˆØ¬Ø¯ Ø±Ø­Ù„Ø§Øª ØªØ·Ø§Ø¨Ù‚ Ø§Ù„ÙÙ„Ø§ØªØ±.' })}</h3><p>{tx(tl, { en: 'Try a different destination or reset the filters to see everything.', es: 'Prueba otro destino o borra los filtros para verlo todo.', it: 'Prova unâ€™altra destinazione o cancella i filtri per vedere tutto.', ar: 'Ø¬Ø±Ù‘Ø¨ ÙˆØ¬Ù‡Ø© Ù…Ø®ØªÙ„ÙØ© Ø£Ùˆ Ø§Ù…Ø³Ø­ Ø§Ù„ÙÙ„Ø§ØªØ± Ù„Ø¹Ø±Ø¶ ÙƒÙ„ Ø§Ù„Ø±Ø­Ù„Ø§Øª.' })}</p><button type="button" className="primary-btn" onClick={resetFilters}>{tx(tl, { en: 'Reset Filters', es: 'Borrar filtros', it: 'Cancella i filtri', ar: 'Ù…Ø³Ø­ Ø§Ù„ÙÙ„Ø§ØªØ±' })}</button></div>}<nav className="pagination" aria-label={tx(tl, { en: 'Tour listing pages', es: 'PÃ¡ginas de viajes', it: 'Pagine dei viaggi', ar: 'ØµÙØ­Ø§Øª Ø§Ù„Ø±Ø­Ù„Ø§Øª' })}><button type="button" onClick={()=>go({...query,page:Math.max(1,safePage-1)})} aria-label={tx(tl, { en: 'Previous page', es: 'PÃ¡gina anterior', it: 'Pagina precedente', ar: 'Ø§Ù„ØµÙØ­Ø© Ø§Ù„Ø³Ø§Ø¨Ù‚Ø©' })} disabled={safePage<=1} style={safePage<=1?{opacity:.5}:undefined}>{tx(tl, { en: 'â€¹ Back', es: 'â€¹ AtrÃ¡s', it: 'â€¹ Indietro', ar: 'â€º Ø§Ù„Ø³Ø§Ø¨Ù‚' })}</button>{Array.from({length:totalPages},(_,i)=>safePage===i+1?<b key={i+1} aria-current="page">{i+1}</b>:<button key={i+1} type="button" aria-label={tx(tl, { en: `Go to page ${i+1}`, es: `Ve a la pÃ¡gina ${i+1}`, it: `Vai alla pagina ${i+1}`, ar: `Ø§Ù†ØªÙ‚Ù„ Ø¥Ù„Ù‰ ØµÙØ­Ø© ${i+1}` })} onClick={()=>go({...query,page:i+1})}>{i+1}</button>)}<button type="button" onClick={()=>go({...query,page:Math.min(totalPages,safePage+1)})} aria-label={tx(tl, { en: 'Next page', es: 'PÃ¡gina siguiente', it: 'Pagina successiva', ar: 'Ø§Ù„ØµÙØ­Ø© Ø§Ù„ØªØ§Ù„ÙŠØ©' })} disabled={safePage>=totalPages} style={safePage>=totalPages?{opacity:.5}:undefined}>{tx(tl, { en: 'Next â€º', es: 'Siguiente â€º', it: 'Avanti â€º', ar: 'Ø§Ù„ØªØ§Ù„ÙŠ â€¹' })}</button></nav></main><HelpCTA/></>}

export function HelpCTA(){const {locale:hc}=useLocale(); const ex=extra[hc]; const [sent,setSent]=useState(false); const [name,setName]=useState(''); const [countryCode,setCountryCode]=useState(defaultCountry.code); const [phone,setPhone]=useState(''); if(sent) return <section className="help container"><h2>{ex.helpDoneT}</h2><p>{ex.helpDoneP1}{name?` ${name}`:''}{ex.helpDoneP2}</p></section>; return <section className="help container"><h2>{ex.helpTitle}</h2><p>{ex.helpSub}</p><div><form style={{display:'contents'}} onSubmit={(e)=>{e.preventDefault();setSent(true)}}><input placeholder={ex.helpName} required value={name} onChange={(e)=>setName(e.target.value)} aria-label={ex.helpName}/><CountrySelect value={countryCode} onChange={setCountryCode} locale={hc} label={ex.helpNat} /><InternationalPhoneInput required value={phone} onChange={setPhone} locale={hc} countryCode={countryCode} onCountryChange={setCountryCode} placeholder={ex.helpPhone}/><button className="primary-btn" type="submit">{ex.helpBtn}</button></form></div></section>}

export function HomePage(){return <SiteShell><main><section className="hero"><img src="/egypt-hero.png" alt="Egyptian temple and desert"/><div className="hero-overlay"/><div className="hero-copy"><span>Get started your</span><h1>Exciting Journey With Us</h1></div><TripSearchEngine/></section><section className="stats container">{[['+100K','Happy customers'],['+50','Years of experience'],['+60','Total destinations'],['5.0','Rating in Tripadvisor']].map(([a,b])=><div key={b}><b>{a}</b><span>{b}</span></div>)}</section><section className="section container"><Heading title="Explore Egypt's Top Tours" copy="From the Pyramids to the Nile - find your perfect adventure."/><div className="tour-grid">{seasonalTours.map(t=><TourCard key={t.slug} tour={t}/>)}</div></section><section className="section pale"><div className="container"><Heading title="Popular Destination" copy="Every corner of Egypt has a story waiting for you."/><div className="destination-grid">{['Pyramids & Giza','White Desert','Nile Valley','Red Sea','Luxor Temples','Cairo Markets'].map((x,i)=><article className="destination" key={x}><img src={images[(i+1)%images.length]} alt={x}/><div><small>Explore now</small><h3>{x}</h3></div></article>)}</div></div></section><section className="section how"><div className="container"><Heading title="How it works?" copy="Only three steps away from Egypt."/><div className="steps">{['Finding Trip','Booking','Enjoy'].map((x,i)=><div key={x}><b>{i+1}</b><h3>{x}</h3><p>Start your journey</p></div>)}</div></div></section><section className="section container"><Heading title="Highlights of Egypt" copy="Discover the most important landmarks in Egypt."/><div className="highlight-row">{['Aswan Tours','Hurghada Tours','Sharm El Sheikh Tours','Dahab Tours'].map((x,i)=><div key={x}><img src={images[i%images.length]} alt={x}/><strong>{x}</strong></div>)}</div></section><HelpCTA/></main></SiteShell>}
