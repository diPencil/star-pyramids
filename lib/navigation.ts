export const NAVIGATION_KEY = 'cms.navigation.public.v1'
export const navigationLocales = ['en', 'es', 'it'] as const
export type NavigationLocale = typeof navigationLocales[number]
export const navigationKinds = ['tour', 'destination', 'blog', 'event', 'offer'] as const
export type NavigationKind = typeof navigationKinds[number]
export type NavigationTarget = { type: 'internal'; href: string } | { type: 'external'; href: string } | { type: 'record'; kind: NavigationKind; id: string }
export type NavigationItem = { id: string; type: 'link' | 'group'; labels: Record<NavigationLocale, string>; visibility: 'both' | 'desktop' | 'mobile' | 'hidden'; enabled: boolean; newTab: boolean; target?: NavigationTarget; children: NavigationItem[]; placement?: 'action' }
export type NavigationContent = { primaryLocale: NavigationLocale; items: NavigationItem[] }
export type NavigationState = { version: 1; revision: number; draft: NavigationContent | null; published: NavigationContent | null; previous: NavigationContent | null; hasPrevious: boolean; updatedAt: string | null }
export type NavigationAction = 'save-draft' | 'publish' | 'restore' | 'reset-draft'
export type ResolvedNavigationItem = Omit<NavigationItem, 'target' | 'children'> & { href?: string; children: ResolvedNavigationItem[] }
export type PublicNavigation = { revision: number; primaryLocale: NavigationLocale; items: ResolvedNavigationItem[] }
export class NavigationValidationError extends Error {}
export const initialNavigation = (): NavigationState => ({ version: 1, revision: 0, draft: null, published: null, previous: null, hasPrevious: false, updatedAt: null })
export const internalNavigationPages = [
  ['/', 'Home'], ['/trips', 'All Trips'], ['/destinations', 'Destinations'], ['/egypt-tours/one-day-tours', 'One Day Tours'], ['/egypt-tours/multi-days-tours', 'Multi Day Tours'], ['/egypt-tours/nile-cruises', 'Nile Cruises'], ['/egypt-tours/shore-excursions', 'Shore Excursions'], ['/rent-car', 'Rent Cars'], ['/events', 'Events'], ['/special-offers', 'Special Offers'], ['/blogs', 'Blogs'], ['/about', 'About Company'], ['/contact', 'Contact'], ['/faq', 'FAQ'], ['/accessible-travel', 'Accessible Travel'], ['/egypt-travel-guide', 'Egypt Travel Guide'], ['/make-your-trip', 'Make Your Trip'], ['/privacy', 'Privacy'], ['/terms', 'Terms'], ['/search', 'Search'],
] as const
export function safeNavigationUrl(value: unknown, external = false): value is string {
  if (typeof value !== 'string' || value.length > 1500 || /[\s\\\u0000-\u001f\u007f]/.test(value)) return false
  try {
    if (external) { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password }
    if (!value.startsWith('/') || value.startsWith('//') || /%(?:2f|5c|0[0-9a-f]|1[0-9a-f]|7f)/i.test(value)) return false
    const url = new URL(value, 'https://navigation.invalid'); return url.origin === 'https://navigation.invalid' && internalNavigationPages.some(([route]) => route === url.pathname)
  } catch { return false }
}
export function validateNavigation(input: unknown): NavigationContent {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new NavigationValidationError('Invalid navigation document.')
  const doc = input as NavigationContent
  if (!navigationLocales.includes(doc.primaryLocale) || !Array.isArray(doc.items) || doc.items.length > 30) throw new NavigationValidationError('Choose EN, ES or IT and at most 30 top-level items.')
  const ids = new Set<string>(); let count = 0
  function item(raw: NavigationItem, depth: number): NavigationItem {
    if (!raw || typeof raw !== 'object' || ++count > 120 || !/^[a-zA-Z0-9_-]{1,80}$/.test(raw.id) || ids.has(raw.id)) throw new NavigationValidationError('Menu IDs must be unique; maximum 120 items.')
    ids.add(raw.id)
    if (!['link', 'group'].includes(raw.type) || !['both', 'desktop', 'mobile', 'hidden'].includes(raw.visibility) || typeof raw.enabled !== 'boolean' || typeof raw.newTab !== 'boolean' || !Array.isArray(raw.children) || raw.children.length > 30 || (raw.placement !== undefined && raw.placement !== 'action')) throw new NavigationValidationError('Invalid menu item settings.')
    if (!raw.labels || typeof raw.labels !== 'object' || navigationLocales.some(locale => typeof raw.labels[locale] !== 'string' || raw.labels[locale].length > 100) || !raw.labels[doc.primaryLocale].trim()) throw new NavigationValidationError('Every item needs a primary-language label (maximum 100 characters).')
    const clean: NavigationItem = { id: raw.id, type: raw.type, labels: { en: raw.labels.en.trim(), es: raw.labels.es.trim(), it: raw.labels.it.trim() }, visibility: raw.visibility, enabled: raw.enabled, newTab: raw.newTab, children: [] }
    if (raw.placement === 'action') { if (depth || raw.type !== 'link') throw new NavigationValidationError('Only a top-level link can be a header action.'); clean.placement = 'action' }
    if (raw.type === 'group') {
      if (depth || raw.target || raw.newTab) throw new NavigationValidationError('Only one dropdown level is supported. Groups cannot be links.')
      clean.children = raw.children.map(child => item(child, depth + 1))
    } else {
      if (raw.children.length) throw new NavigationValidationError('Links cannot contain children.')
      const target = raw.target
      if (!target || !['internal', 'external', 'record'].includes(target.type)) throw new NavigationValidationError('Choose a link destination.')
      if (target.type === 'record') {
        if (!navigationKinds.includes(target.kind) || !/^[a-zA-Z0-9_-]{1,100}$/.test(target.id)) throw new NavigationValidationError('Invalid content reference.')
        clean.target = { type: 'record', kind: target.kind, id: target.id }
      } else {
        if (!safeNavigationUrl(target.href, target.type === 'external')) throw new NavigationValidationError('Choose a valid public page or HTTP(S) URL. Dynamic pages must use a published record reference.')
        clean.target = { type: target.type, href: target.href }
      }
    }
    return clean
  }
  const items = doc.items.map(row => item(row, 0))
  if (items.filter(row => row.placement === 'action' && row.enabled && row.visibility !== 'hidden').length > 1) throw new NavigationValidationError('Only one header action is supported.')
  return { primaryLocale: doc.primaryLocale, items }
}
export function decodeNavigation(raw: string): NavigationState {
  const value = JSON.parse(raw) as NavigationState
  if (!value || value.version !== 1 || !Number.isSafeInteger(value.revision) || value.revision < 0 || typeof value.hasPrevious !== 'boolean' || (value.updatedAt !== null && (typeof value.updatedAt !== 'string' || !Number.isFinite(Date.parse(value.updatedAt))))) throw new NavigationValidationError('Invalid stored navigation.')
  for (const key of ['draft', 'published', 'previous'] as const) if (value[key] !== null) value[key] = validateNavigation(value[key])
  return value
}
export function transitionNavigation(state: NavigationState, action: NavigationAction, input?: unknown): NavigationState {
  const next = { ...state, revision: state.revision + 1, updatedAt: new Date().toISOString() }
  if (action === 'save-draft') next.draft = validateNavigation(input)
  else if (action === 'publish') {
    if (state.draft === null) throw new NavigationValidationError('Save a draft before publishing.')
    next.previous = state.published; next.hasPrevious = true; next.published = validateNavigation(state.draft); next.draft = null
  } else if (action === 'restore') {
    if (!state.hasPrevious) throw new NavigationValidationError('No previous publication exists.')
    next.published = state.previous; next.previous = state.published; next.draft = null
  } else if (action === 'reset-draft') next.draft = null
  else throw new NavigationValidationError('Unknown navigation action.')
  return next
}
export function navigationLabel(item: Pick<NavigationItem, 'labels'>, locale: string, primary: NavigationLocale) { return item.labels[locale as NavigationLocale] || item.labels[primary] }
export function visibleNavigation(items: ResolvedNavigationItem[], device: 'desktop' | 'mobile'): ResolvedNavigationItem[] {
  return items.filter(item => item.enabled && (item.visibility === 'both' || item.visibility === device)).flatMap(item => {
    const children = visibleNavigation(item.children, device)
    return item.type === 'group' && !children.length ? [] : [{ ...item, children }]
  })
}
export function navigationActive(item: ResolvedNavigationItem, path: string): boolean {
  if (item.children.some(child => navigationActive(child, path))) return true
  // The catalogue owns tour detail routes even when that particular tour is not a menu entry.
  if (item.type === 'group' && item.children.some(child => child.href === '/trips') && path.startsWith('/egypt-tours/')) return true
  if (!item.href?.startsWith('/')) return false
  const route = item.href.split(/[?#]/)[0]
  return path === route || route !== '/' && path.startsWith(route + '/')
}
// Immutable tree move shared by dragging and accessible controls. Groups stay top-level.
export function moveNavigation(content: NavigationContent, id: string, parent: string | null, index: number): NavigationContent {
  const next = structuredClone(content)
  const all = next.items.flatMap(item => [item, ...item.children])
  const moving = all.find(item => item.id === id); const group = parent ? next.items.find(item => item.id === parent && item.type === 'group') : null
  if (!moving || parent && !group || moving.id === parent || moving.type === 'group' && parent) throw new NavigationValidationError('Invalid menu move.')
  next.items = next.items.filter(item => item.id !== id).map(item => ({ ...item, children: item.children.filter(child => child.id !== id) }))
  const target = parent ? next.items.find(item => item.id === parent)!.children : next.items
  if (parent) delete moving.placement
  target.splice(Math.max(0, Math.min(target.length, index)), 0, moving)
  return validateNavigation(next)
}
export function defaultNavigation(primaryLocale: NavigationLocale = 'en'): NavigationContent {
  const link = (id: string, href: string, en: string, es: string, it: string, visibility: NavigationItem['visibility'] = 'both'): NavigationItem => ({ id, type: 'link', labels: { en, es, it }, visibility, enabled: true, newTab: false, target: { type: 'internal', href }, children: [] })
  const group = (id: string, labels: NavigationItem['labels'], children: NavigationItem[], visibility: NavigationItem['visibility'] = 'both'): NavigationItem => ({ id, type: 'group', labels, children, visibility, enabled: true, newTab: false })
  const tours = [link('all-trips', '/trips', 'All Trips', 'Todos los viajes', 'Tutti i viaggi'), link('one-day', '/egypt-tours/one-day-tours', 'One Day Tours', 'Circuitos de un día', 'Tour di un giorno'), link('multi-day', '/egypt-tours/multi-days-tours', 'Multi Day Tours', 'Viajes de varios días', 'Tour di più giorni'), link('nile', '/egypt-tours/nile-cruises', 'Nile Cruises', 'Cruceros por el Nilo', 'Crociere sul Nilo'), link('shore', '/egypt-tours/shore-excursions', 'Shore Excursions', 'Excursiones en tierra', 'Escursioni a terra'), link('mobile-offer', '/special-offers', 'Special Offer', 'Oferta especial', 'Offerta speciale', 'mobile'), link('destinations', '/destinations', 'Destinations', 'Destinos', 'Destinazioni')]
  const rent = link('rent', '/rent-car', 'Rent Car', 'Alquilar coche', 'Noleggio auto', 'desktop'); const event = link('events', '/events', 'Events', 'Eventos', 'Eventi', 'desktop'); const blog = link('blogs', '/blogs', 'Blogs', 'Blog', 'Blog', 'desktop'); const make = link('make', '/make-your-trip', 'Make Your Trip', 'Diseña tu viaje', 'Crea il tuo viaggio', 'desktop'); make.placement = 'action'
  const clone = (row: NavigationItem) => ({ ...row, id: 'mobile-' + row.id, visibility: 'mobile' as const, placement: undefined })
  return { primaryLocale, items: [link('home', '/', 'Home', 'Inicio', 'Home', 'desktop'), group('tours', { en: 'Egypt Tours', es: 'Circuitos por Egipto', it: 'Tour in Egitto' }, tours), rent, event, group('company', { en: 'About Company', es: 'Nuestra empresa', it: 'La nostra azienda' }, [link('about', '/about', 'About Us', 'Sobre nosotros', 'Chi siamo'), link('contact', '/contact', 'Contact Us', 'Contacto', 'Contatti')], 'desktop'), blog, link('offer', '/special-offers', 'Special Offer', 'Oferta especial', 'Offerta speciale', 'desktop'), make, group('mobile-plan', { en: 'Plan & discover', es: 'Planifica y descubre', it: 'Pianifica e scopri' }, [clone(make), clone(rent), clone(event), clone(blog), link('guide', '/egypt-travel-guide', 'Egypt Travel Guide', 'Guía de Egipto', 'Guida dell’Egitto')], 'mobile'), group('mobile-help', { en: 'Help & company', es: 'Ayuda y empresa', it: 'Assistenza e azienda' }, [link('mobile-about', '/about', 'About Us', 'Sobre nosotros', 'Chi siamo'), link('mobile-contact', '/contact', 'Contact Us', 'Contacto', 'Contatti'), link('faq', '/faq', 'FAQs', 'Preguntas frecuentes', 'Domande frequenti'), link('accessible', '/accessible-travel', 'Accessible Travel', 'Viajes accesibles', 'Viaggi accessibili')], 'mobile')] }
}
