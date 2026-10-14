import { showcaseDefaults as imageDefaults } from './showcase-hero-defaults'
import { compactHeroDefaults, isCompactHeroId } from './compact-hero-defaults'
import { ENABLED_LOCALES, type EnabledLocale } from './locale-config'
import { FAQ_HERO_DESTINATIONS } from './faq-hero'
import { HeroValidationError, initialHeroState, validateHeroMedia, type HeroAction, type HeroState } from './website-heroes'

const showcaseDefaults = { ...imageDefaults, ...compactHeroDefaults }
export type ShowcaseHeroId = keyof typeof showcaseDefaults
export const SHOWCASE_HERO_IDS = Object.keys(showcaseDefaults) as ShowcaseHeroId[]
export const SHOWCASE_PAGES: Record<ShowcaseHeroId, { name: string; route: string }> = {
  trips: { name: 'All trips', route: '/trips' },
  'standard-nile-cruises': { name: 'Standard Nile Cruises', route: '/egypt-tours/nile-cruises/standard-nile-cruises' },
  'deluxe-nile-cruise': { name: 'Deluxe Nile Cruise', route: '/egypt-tours/nile-cruises/deluxe-nile-cruise' },
  'superior-nile-cruise': { name: 'Superior Nile Cruise', route: '/egypt-tours/nile-cruises/superior-nile-cruise' },
  'luxury-nile-cruise': { name: 'Luxury Nile Cruises', route: '/egypt-tours/nile-cruises/luxury-nile-cruise' },
  about: { name: 'About company', route: '/about' }, contact: { name: 'Contact', route: '/contact' },
  blogs: { name: 'Blogs', route: '/blogs' }, events: { name: 'Events', route: '/events' },
  cars: { name: 'Rent cars', route: '/rent-car' }, offers: { name: 'Special offers', route: '/special-offers' },
  'one-day': { name: 'One-day tours', route: '/egypt-tours/one-day-tours' },
  'multi-day': { name: 'Multi-day tours', route: '/egypt-tours/multi-days-tours' },
  nile: { name: 'Nile cruises', route: '/egypt-tours/nile-cruises' }, shore: { name: 'Shore excursions', route: '/egypt-tours/shore-excursions' },
}
export function isShowcaseHeroId(id: string): id is ShowcaseHeroId { return Object.hasOwn(showcaseDefaults, id) }
export type ShowcaseHero = {
  text: Record<EnabledLocale, Record<string, string>>
  links: Record<string, string>
  image: string
  mobileImage: string
  alt: Record<EnabledLocale, string>
  position: 'source' | 'center' | 'top' | 'bottom' | 'left' | 'right'
  overlay: number | null
}
export type ShowcaseHeroState = Omit<HeroState, 'draft' | 'published'> & { draft: ShowcaseHero | null; published: ShowcaseHero | null }
export type PublicShowcaseHero = { hidden: boolean; content: ShowcaseHero | null; unavailable?: boolean }
export function originalShowcaseHero(id: ShowcaseHeroId): ShowcaseHero {
  return { ...structuredClone(showcaseDefaults[id]), mobileImage: '', alt: { en: '', es: '', it: '' }, position: 'source', overlay: null }
}
export function initialShowcaseState(): ShowcaseHeroState { return { ...initialHeroState(), draft: null, published: null } }
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new HeroValidationError('Invalid hero content.')
  return value as Record<string, unknown>
}
export function validateShowcaseHero(id: ShowcaseHeroId, input: unknown): ShowcaseHero {
  const raw = record(input), original = originalShowcaseHero(id)
  if (Object.keys(raw).some((key) => !['text', 'links', 'image', 'mobileImage', 'alt', 'position', 'overlay'].includes(key))) throw new HeroValidationError('Unsupported hero field.')
  const text = record(raw.text), links = record(raw.links), alt = record(raw.alt)
  if ([...Object.keys(text), ...Object.keys(alt)].some((key) => !ENABLED_LOCALES.includes(key as EnabledLocale))) throw new HeroValidationError('Unsupported language.')
  const result = {} as ShowcaseHero['text'], resultAlt = {} as ShowcaseHero['alt']
  const read = (value: unknown, max: number, required: boolean) => {
    if (typeof value !== 'string' || value.length > max || /[<>\u0000-\u001f]/.test(value) || (required && !value.trim())) throw new HeroValidationError('Check hero text and required translations.')
    return value.trim()
  }
  for (const locale of ENABLED_LOCALES) {
    const values = record(text[locale])
    if (Object.keys(values).some((key) => !Object.hasOwn(original.text[locale], key))) throw new HeroValidationError('This field belongs to the featured content editor.')
    result[locale] = {}
    for (const key of Object.keys(original.text[locale])) result[locale][key] = read(values[key], key === 'intro' ? 600 : key === 'title' || key === 'railTitle' ? 160 : 100, true)
    resultAlt[locale] = read(alt[locale], 250, false)
  }
  if (Object.keys(links).some((key) => !Object.hasOwn(original.links, key))) throw new HeroValidationError('Featured content links remain source-managed.')
  const resultLinks: Record<string, string> = {}
  for (const key of Object.keys(original.links)) {
    const value = links[key]
    if (typeof value !== 'string' || (!FAQ_HERO_DESTINATIONS.includes(value as typeof FAQ_HERO_DESTINATIONS[number]) && !Object.values(original.links).includes(value))) throw new HeroValidationError('Choose an existing page or this hero original anchor.')
    resultLinks[key] = value
  }
  if (!['source', 'center', 'top', 'bottom', 'left', 'right'].includes(String(raw.position))) throw new HeroValidationError('Invalid media position.')
  if (raw.overlay !== null && (typeof raw.overlay !== 'number' || !Number.isFinite(raw.overlay) || raw.overlay < 0 || raw.overlay > 0.85)) throw new HeroValidationError('Invalid overlay.')
  if (isCompactHeroId(id) && (raw.image !== '' || raw.mobileImage !== '' || raw.position !== 'source' || raw.overlay !== null || Object.values(resultAlt).some(Boolean))) throw new HeroValidationError('This text hero does not support media settings.')
  return { text: result, links: resultLinks, image: validateHeroMedia(raw.image, 'image', true), mobileImage: validateHeroMedia(raw.mobileImage, 'image', true), alt: resultAlt, position: raw.position as ShowcaseHero['position'], overlay: raw.overlay as number | null }
}
export function transitionShowcaseHero(id: ShowcaseHeroId, state: ShowcaseHeroState, action: HeroAction, content?: unknown): ShowcaseHeroState {
  const next = { ...state, revision: state.revision + 1, updatedAt: new Date().toISOString() }
  if (action === 'save-draft') return { ...next, draft: validateShowcaseHero(id, content) }
  if (action === 'publish') {
    if (!state.draft) throw new HeroValidationError('Save a draft before publishing.')
    return { ...next, published: validateShowcaseHero(id, state.draft), mode: 'published' }
  }
  if (action === 'unpublish') return { ...next, mode: 'hidden' }
  if (action === 'restore') return { ...next, draft: originalShowcaseHero(id), published: null, mode: 'original' }
  throw new HeroValidationError('Unsupported action.')
}
export function publicShowcaseHero(state: ShowcaseHeroState): PublicShowcaseHero { return { hidden: state.mode === 'hidden', content: state.mode === 'published' ? state.published : null } }
export function readShowcasePreviewMessage(id: ShowcaseHeroId, event: Pick<MessageEvent, 'origin' | 'source' | 'data'>, origin: string, parent: MessageEventSource | null, embedded: boolean): { content: ShowcaseHero; locale: EnabledLocale } | null {
  if (!embedded || event.origin !== origin || event.source !== parent || event.data?.type !== 'star-showcase-preview' || event.data.id !== id || !ENABLED_LOCALES.includes(event.data.locale)) return null
  try { return { content: validateShowcaseHero(id, event.data.content), locale: event.data.locale } } catch { return null }
}
