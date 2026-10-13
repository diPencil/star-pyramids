import { ENABLED_LOCALES, type EnabledLocale } from './locale-config'

export const HERO_SETTING_KEY = 'cms.hero.homepage.v1'
export const MAX_HERO_VIDEO_BYTES = 20 * 1024 * 1024
export class HeroValidationError extends Error {}
export type HeroText = Record<EnabledLocale, { heading: string; eyebrow: string; alt: string }>
export type HomeHero = {
  text: HeroText
  mediaType: 'image' | 'video'
  mediaUrl: string
  mobileUrl: string
  poster: string
  position: 'center' | 'top' | 'bottom' | 'left' | 'right'
  overlay: number | null
}
export type HeroState = {
  version: 1
  revision: number
  draft: HomeHero | null
  published: HomeHero | null
  mode: 'original' | 'published' | 'hidden'
  updatedAt: string | null
}
export function originalHomeHero(): HomeHero {
  return {
    text: {
      en: { heading: 'Exciting Journey With Us', eyebrow: 'Get started your', alt: 'Egyptian temple columns in warm desert light at sunset' },
      es: { heading: 'Viaje fascinante con nosotros', eyebrow: 'Empieza tu', alt: 'Columnas de un templo egipcio al atardecer' },
      it: { heading: 'Viaggio emozionante con noi', eyebrow: 'Inizia la tua', alt: 'Colonne di un tempio egizio al tramonto' },
    },
    mediaType: 'image', mediaUrl: '/egypt-hero.png', mobileUrl: '', poster: '/egypt-hero.png', position: 'center', overlay: null,
  }
}
export function initialHeroState(): HeroState {
  return { version: 1, revision: 0, draft: null, published: null, mode: 'original', updatedAt: null }
}
export function validateHeroMedia(value: unknown, type: 'image' | 'video', optional = false): string {
  if (value === '' && optional) return ''
  if (typeof value !== 'string' || value.length > 2000 || /[\s\\\u0000-\u001f]/.test(value)) throw new HeroValidationError('Invalid media URL.')
  if (type === 'image' && (value === '/egypt-hero.png' || /^\/media\/\d{4}\/\d{2}\/[a-f0-9]{32}\.(?:jpg|jpeg|png|webp|gif|avif)$/.test(value))) return value
  if (type === 'video' && /^\/gallery-videos\/\d{4}\/\d{2}\/[a-f0-9]{32}\.(?:mp4|webm)$/.test(value)) return value
  let url: URL
  try { url = new URL(value) } catch { throw new HeroValidationError('Use a stored media URL or a direct HTTPS URL.') }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash || url.hostname === 'localhost' || url.hostname.endsWith('.local') || /^[\d.]+$/.test(url.hostname) || url.hostname.includes(':')) throw new HeroValidationError('Use a public HTTPS media URL.')
  if (type === 'video' && (!/\.(mp4|webm)$/i.test(url.pathname) || /(?:^|\.)(youtube\.com|youtu\.be|instagram\.com|facebook\.com|tiktok\.com)$/.test(url.hostname))) throw new HeroValidationError('Use a direct MP4 or WebM video URL, not a social page.')
  return url.href
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new HeroValidationError('Invalid hero content.')
  return value as Record<string, unknown>
}
export function validateHomeHero(input: unknown): HomeHero {
  const raw = record(input)
  if (Object.keys(raw).some((key) => !['text', 'mediaType', 'mediaUrl', 'mobileUrl', 'poster', 'position', 'overlay'].includes(key))) throw new HeroValidationError('Unsupported hero field.')
  const text = record(raw.text)
  if (Object.keys(text).some((key) => !ENABLED_LOCALES.includes(key as EnabledLocale))) throw new HeroValidationError('Unsupported hero language.')
  const result = {} as HeroText
  for (const locale of ENABLED_LOCALES) {
    const fields = record(text[locale])
    if (Object.keys(fields).some((key) => !['heading', 'eyebrow', 'alt'].includes(key))) throw new HeroValidationError('Unsupported text field.')
    const read = (key: string, max: number, required: boolean) => {
      const value = fields[key]
      if (typeof value !== 'string' || value.length > max || /[<>\u0000-\u001f]/.test(value) || (required && !value.trim())) throw new HeroValidationError(`Check ${locale} ${key}.`)
      return value.trim()
    }
    result[locale] = { heading: read('heading', 160, true), eyebrow: read('eyebrow', 100, false), alt: read('alt', 250, true) }
  }
  if (raw.mediaType !== 'image' && raw.mediaType !== 'video') throw new HeroValidationError('Select image or video.')
  if (!['center', 'top', 'bottom', 'left', 'right'].includes(String(raw.position))) throw new HeroValidationError('Invalid media position.')
  if (raw.overlay !== null && (typeof raw.overlay !== 'number' || !Number.isFinite(raw.overlay) || raw.overlay < 0 || raw.overlay > 0.85)) throw new HeroValidationError('Overlay must be between 0 and 85%.')
  return { text: result, mediaType: raw.mediaType, mediaUrl: validateHeroMedia(raw.mediaUrl, raw.mediaType), mobileUrl: validateHeroMedia(raw.mobileUrl, raw.mediaType, true), poster: validateHeroMedia(raw.poster, 'image', raw.mediaType === 'image'), position: raw.position as HomeHero['position'], overlay: raw.overlay as number | null }
}
export type HeroAction = 'save-draft' | 'publish' | 'unpublish' | 'restore'
export function transitionHero(state: HeroState, action: HeroAction, content?: unknown): HeroState {
  const next = { ...state, revision: state.revision + 1, updatedAt: new Date().toISOString() }
  if (action === 'save-draft') return { ...next, draft: validateHomeHero(content) }
  if (action === 'publish') {
    if (!state.draft) throw new HeroValidationError('Save a draft before publishing.')
    return { ...next, published: validateHomeHero(state.draft), mode: 'published' }
  }
  if (action === 'unpublish') return { ...next, mode: 'hidden' }
  if (action === 'restore') return { ...next, draft: originalHomeHero(), published: originalHomeHero(), mode: 'published' }
  throw new HeroValidationError('Unsupported hero action.')
}
export function publicHeroState(state: HeroState): { hidden: boolean; content: HomeHero | null } {
  return { hidden: state.mode === 'hidden', content: state.mode === 'published' ? state.published : null }
}
