import { ENABLED_LOCALES, type EnabledLocale } from './locale-config'
import { HeroValidationError, initialHeroState, validateHeroMedia, type HeroAction, type HeroState } from './website-heroes'

export const FAQ_HERO_KEY = 'cms.hero.faq.v1'
export type EditorialSection = {
  id: string
  text: Record<EnabledLocale, { heading: string; description: string; action: string }>
  href: string
}
export type FaqHero = {
  text: Record<EnabledLocale, { heading: string; eyebrow: string; description: string; action: string; alt: string }>
  image: string
  href: string
  sections?: EditorialSection[]
}
export type FaqHeroState = Omit<HeroState, 'draft' | 'published'> & { draft: FaqHero | null; published: FaqHero | null }
export function originalFaqHero(): FaqHero {
  return {
    text: {
      en: { heading: 'A smoother way to plan Egypt', eyebrow: 'Questions, answered', description: 'Find clear answers to common questions, then talk to our team when you are ready for the details.', action: 'Ask a question', alt: '' },
      es: { heading: 'Una forma más fácil de planificar Egipto', eyebrow: 'Preguntas con respuesta', description: 'Encuentra respuestas claras a las preguntas frecuentes y habla con nuestro equipo cuando quieras los detalles.', action: 'Haz una pregunta', alt: '' },
      it: { heading: 'Un modo più semplice per pianificare.', eyebrow: 'Domande e risposte', description: 'Trova risposte chiare alle domande frequenti, poi parla con il nostro team quando vuoi i dettagli.', action: 'Fai una domanda', alt: '' },
    },
    image: 'https://images.unsplash.com/photo-1548013146-72479768bada?auto=format&fit=crop&w=1200&q=85',
    href: '/contact',
  }
}
// Only verified static routes: no invented or unpublished tour destinations.
export const FAQ_HERO_DESTINATIONS = ['/contact', '/make-your-trip', '/trips', '/special-offers', '/destinations', '/blogs', '/events', '/rent-car', '/about', '/faq', '/egypt-travel-guide', '/accessible-travel', '/'] as const
export function validateFaqHero(input: unknown): FaqHero {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new HeroValidationError('Invalid FAQ hero.')
  const raw = input as Record<string, unknown>
  if (Object.keys(raw).some((key) => !['text', 'image', 'href', 'sections'].includes(key))) throw new HeroValidationError('Unsupported FAQ hero field.')
  if (!raw.text || typeof raw.text !== 'object' || Array.isArray(raw.text)) throw new HeroValidationError('Check hero translations.')
  const text = raw.text as Record<string, unknown>
  if (Object.keys(text).some((key) => !ENABLED_LOCALES.includes(key as EnabledLocale))) throw new HeroValidationError('Unsupported hero language.')
  const result = {} as FaqHero['text']
  for (const locale of ENABLED_LOCALES) {
    const fields = text[locale]
    if (!fields || typeof fields !== 'object' || Array.isArray(fields)) throw new HeroValidationError(`Check ${locale} content.`)
    const values = fields as Record<string, unknown>
    if (Object.keys(values).some((key) => !['heading', 'eyebrow', 'description', 'action', 'alt'].includes(key))) throw new HeroValidationError('Unsupported text field.')
    const read = (key: string, max: number, required = true) => {
      const value = values[key]
      if (typeof value !== 'string' || value.length > max || /[<>\u0000-\u001f]/.test(value) || (required && !value.trim())) throw new HeroValidationError(`Check ${locale} ${key}.`)
      return value.trim()
    }
    result[locale] = { heading: read('heading', 160), eyebrow: read('eyebrow', 100, false), description: read('description', 600), action: read('action', 100), alt: read('alt', 250, false) }
  }
  if (!FAQ_HERO_DESTINATIONS.includes(raw.href as typeof FAQ_HERO_DESTINATIONS[number])) throw new HeroValidationError('Choose an existing page for the hero button.')
  const sections = raw.sections === undefined ? undefined : validateEditorialSections(raw.sections)
  return { text: result, image: validateHeroMedia(raw.image, 'image'), href: raw.href as string, ...(sections === undefined ? {} : { sections }) }
}
function validateEditorialSections(input: unknown): EditorialSection[] {
  if (!Array.isArray(input) || input.length > 8) throw new HeroValidationError('Use up to eight page sections.')
  const ids = new Set<string>()
  return input.map((value: unknown) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new HeroValidationError('Invalid page section.')
    const section = value as Record<string, unknown>
    if (Object.keys(section).some((key) => !['id', 'text', 'href'].includes(key)) || typeof section.id !== 'string' || !/^[a-z0-9-]{1,60}$/.test(section.id) || ids.has(section.id)) throw new HeroValidationError('Check page section identity.')
    ids.add(section.id)
    if (!section.text || typeof section.text !== 'object' || Array.isArray(section.text)) throw new HeroValidationError('Check section translations.')
    const text = section.text as Record<string, unknown>
    if (Object.keys(text).some((key) => !ENABLED_LOCALES.includes(key as EnabledLocale))) throw new HeroValidationError('Unsupported section language.')
    const translated = {} as EditorialSection['text']
    for (const locale of ENABLED_LOCALES) {
      const fields = text[locale]
      if (!fields || typeof fields !== 'object' || Array.isArray(fields)) throw new HeroValidationError(`Check ${locale} section.`)
      const raw = fields as Record<string, unknown>
      if (Object.keys(raw).some((key) => !['heading', 'description', 'action'].includes(key))) throw new HeroValidationError('Unsupported section field.')
      const read = (key: string, max: number) => {
        const v = raw[key]
        if (typeof v !== 'string' || !v.trim() || v.length > max || /[<>\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v)) throw new HeroValidationError(`Check ${locale} section ${key}.`)
        return v.trim()
      }
      translated[locale] = { heading: read('heading', 120), description: read('description', 1200), action: read('action', 100) }
    }
    if (!FAQ_HERO_DESTINATIONS.includes(section.href as typeof FAQ_HERO_DESTINATIONS[number])) throw new HeroValidationError('Choose an existing page for the section link.')
    return { id: section.id, text: translated, href: section.href as string }
  })
}
export function initialFaqHeroState(): FaqHeroState { return { ...initialHeroState(), draft: null, published: null } }
export function transitionFaqHero(state: FaqHeroState, action: HeroAction, content?: unknown, original: FaqHero = originalFaqHero()): FaqHeroState {
  const next = { ...state, revision: state.revision + 1, updatedAt: new Date().toISOString() }
  if (action === 'save-draft') return { ...next, draft: validateFaqHero(content) }
  if (action === 'publish') {
    if (!state.draft) throw new HeroValidationError('Save a draft before publishing.')
    return { ...next, published: validateFaqHero(state.draft), mode: 'published' }
  }
  if (action === 'unpublish') return { ...next, mode: 'hidden' }
  if (action === 'restore') return { ...next, draft: validateFaqHero(original), published: validateFaqHero(original), mode: 'published' }
  throw new HeroValidationError('Unsupported hero action.')
}
export type PublicFaqHero = { hidden: boolean; content: FaqHero | null; unavailable?: boolean }
export function publicFaqHero(state: FaqHeroState): PublicFaqHero { return { hidden: state.mode === 'hidden', content: state.mode === 'published' ? state.published : null } }
