import { copy, extra } from './site-copy'
type Text = { en: string; es: string; it: string }
const languages = ['en', 'es', 'it'] as const
const navKeys = ['home', 'tours', 'rent', 'about', 'contact', 'blogs', 'events', 'offer', 'make', 'signIn', 'dashboard', 'account', 'search'] as const
const categoryKeys = ['cat1', 'cat2', 'cat3', 'cat4', 'guideLink', 'faqsLink', 'accessLink'] as const
const footerKeys = ['footExplore', 'footCompany', 'contactInfo', 'certBadge', 'poweredBy', 'privacy', 'terms'] as const
const helpKeys = ['helpTitle', 'helpSub', 'helpName', 'helpNat', 'helpPhone', 'helpBtn', 'helpDoneT', 'helpDoneP1', 'helpDoneP2'] as const
const translate = (factory: (locale: typeof languages[number]) => string) => Object.fromEntries(languages.map(locale => [locale, factory(locale)])) as Text
const section = (id: string, name: string, fields: Record<string, Text>, mandatory: boolean) => ({ id, name, copy: fields, mandatory, media: {}, links: {} })
export const SHARED_TEMPLATE = {
  name: 'Shared website presentation', route: '/', sections: [
    section('hero', 'Brand, contact & promotional source modules', {}, true),
    section('navigation', 'Legacy menu fallback & functional control labels (published menus: Navigation Manager)', { ...Object.fromEntries(navKeys.map(key => [key, translate(locale => copy[locale][key])])), ...Object.fromEntries(categoryKeys.map(key => [key, translate(locale => extra[locale][key])])), companyLabel: { en: 'About Company', es: 'Nuestra empresa', it: 'La nostra azienda' }, explore: { en: 'Explore', es: 'Explorar', it: 'Esplora' }, cart: { en: 'Cart', es: 'Carrito', it: 'Carrello' }, bookings: { en: 'Bookings', es: 'Reservas', it: 'Prenotazioni' } }, true),
    section('footer', 'Footer labels (company data remains in Settings)', { ...Object.fromEntries(footerKeys.map(key => [key, translate(locale => extra[locale][key])])), allTrips: { en: 'All Trips', es: 'Todos los viajes', it: 'Tutti i viaggi' } }, true),
    section('help', 'Shared trip-help enquiry form', Object.fromEntries(helpKeys.map(key => [key, translate(locale => extra[locale][key])])), true),
  ],
}
