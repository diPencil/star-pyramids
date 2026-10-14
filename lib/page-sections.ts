import { ENABLED_LOCALES, type EnabledLocale } from './locale-config'
import { validateSeoContent, type SeoContent } from './seo-content'
import { homeStrings } from './homepage-copy'
import { additionalSections, originalAdditionalPage, type PageDocumentId } from './additional-page-content'
import { HeroValidationError, validateHeroMedia, type HeroAction } from './website-heroes'

export const CMS_ICON_IDS = ['Users', 'Award', 'MapPin', 'Star', 'MousePointerClick', 'CalendarDays', 'ThumbsUp', 'Landmark', 'Leaf', 'Compass', 'Heart', 'ShieldCheck', 'Clock3', 'Sun', 'Ship', 'CheckCircle', 'HeartHandshake', 'Route', 'Anchor', 'CalendarCheck', 'Gift', 'Headphones'] as const
export type CmsIconId = typeof CMS_ICON_IDS[number]
export type SectionItem = { id: string; visible: boolean; text: Record<EnabledLocale, Record<string, string>>; icon?: CmsIconId; href?: string; image?: string; value?: number; prefix?: string; suffix?: string; decimals?: number }
export type PageSection = { id: string; visible: boolean; text: Record<EnabledLocale, Record<string, string>>; items?: SectionItem[]; href?: string; image?: string; selection?: string[]; selectionMode?: 'automatic' | 'selected'; limit?: number; media?: Record<string, string>; links?: Record<string, string> }
export type PageContent = { sections: PageSection[]; seo: SeoContent }
export type PageContentState = { version: 1; revision: number; mode: 'original' | 'published' | 'hidden'; draft: PageContent | null; published: PageContent | null; updatedAt: string | null; seoDraft?: SeoContent | null; seoManaged?: boolean }
export type PublicPageContent = { content: PageContent | null; unavailable?: boolean }
export type SectionDefinition = { id: string; name: string; fields: readonly string[]; mandatory?: boolean; editor?: string; itemFields?: readonly string[]; itemHref?: boolean; itemImage?: boolean; minItems?: number; maxItems?: number; icons?: boolean; numbers?: boolean; href?: string; image?: string; source?: 'tours' | 'destinations' | 'blogs' | 'offers'; limit?: number; fieldLabels?: Record<string, string>; mediaFields?: readonly string[]; linkFields?: readonly string[] }

export const HOME_SECTIONS: readonly SectionDefinition[] = [
  { id: 'hero', name: 'Hero & trip search', fields: [], mandatory: true, editor: '/admin/website-cms/hero-sections/homepage' },
  { id: 'stats', name: 'Statistics', fields: [], itemFields: ['label'], minItems: 1, maxItems: 4, icons: true, numbers: true },
  { id: 'featured', name: 'Featured tours', fields: ['xmasT', 'xmasS', 'viewAll'], href: '/egypt-tours/multi-days-tours', source: 'tours', limit: 12 },
  { id: 'popular', name: 'Popular journeys & category filter', fields: ['popT', 'popS', 'viewAll'], href: '/trips', source: 'tours', limit: 12 },
  { id: 'planner', name: 'Make Your Trip form', fields: ['tripT', 'tripS', 'startPlan'], mandatory: true },
  { id: 'offers', name: 'Special offers', fields: ['offE', 'offT', 'offS', 'viewAll'], href: '/special-offers', source: 'offers', limit: 8 },
  { id: 'how', name: 'How it works', fields: ['howT', 'howS'], itemFields: ['step', 'heading', 'description'], minItems: 3, maxItems: 3, icons: true, href: '' },
  { id: 'highlights', name: 'Destination highlights', fields: ['hlT', 'hlS'], source: 'destinations', limit: 12 },
  { id: 'blogs', name: 'Travel blogs', fields: ['blogT', 'blogS', 'readMore', 'viewAll'], href: '/blogs', source: 'blogs', limit: 12 },
  { id: 'sustainability', name: 'Sustainability', fields: ['susE', 'susT1', 'susT2', 'susP', 'susCta', 'susB1', 'susB2', 'susB3'], href: '/about', itemFields: ['line1', 'line2'], minItems: 1, maxItems: 3, icons: true },
  { id: 'gallery', name: 'Journey Gallery', fields: ['galT', 'galS'], editor: '/admin/gallery' },
  { id: 'reviews', name: 'Traveller reviews', fields: ['heading', 'description'], editor: '/admin/reviews' },
  { id: 'faq', name: 'Frequently asked questions', fields: ['faqT', 'faqS', 'faqAll'], href: '/faq', itemFields: ['question', 'answer'], minItems: 0, maxItems: 12 },
  { id: 'help', name: 'Help enquiry form', fields: ['helpT', 'helpS', 'contactNow'], mandatory: true },
]
export const CMS_STATIC_LINKS = ['/', '/about', '/contact', '/trips', '/destinations', '/blogs', '/events', '/rent-car', '/rent-car/request', '/special-offers', '/faq', '/egypt-travel-guide', '/accessible-travel', '/make-your-trip', '/privacy', '/terms', '/egypt-tours/one-day-tours', '/egypt-tours/multi-days-tours', '/egypt-tours/nile-cruises', '/egypt-tours/shore-excursions'] as const
export function validateCmsLink(value: unknown): string {
  if (typeof value !== 'string' || value.length > 2000) throw new HeroValidationError('Check the link destination.')
  if (CMS_STATIC_LINKS.includes(value as typeof CMS_STATIC_LINKS[number]) || /^\/(?:egypt-tours|destinations|blogs|events|special-offers)\/[a-z0-9][a-z0-9-]{0,99}$/.test(value)) return value
  if (value.startsWith('https://')) return validateHeroMedia(value, 'image')
  throw new HeroValidationError('Choose an existing public page or a public HTTPS URL.')
}
const translations = (factory: (locale: EnabledLocale) => Record<string, string>) => Object.fromEntries(ENABLED_LOCALES.map((locale) => [locale, factory(locale)])) as PageSection['text']
export function pageSections(id: PageDocumentId = 'homepage'): readonly SectionDefinition[] { return id === 'homepage' ? HOME_SECTIONS : additionalSections(id) }
export function originalPageContent(id: PageDocumentId = 'homepage'): PageContent {
  if (id !== 'homepage') return originalAdditionalPage(id)
  const sections = HOME_SECTIONS.map((definition): PageSection => ({ id: definition.id, visible: true, text: translations((locale) => Object.fromEntries(definition.fields.map((key) => [key, key === 'heading' ? homeStrings[locale].revT : key === 'description' ? locale === 'es' ? 'Experiencias de nuestros viajeros.' : locale === 'it' ? 'Esperienze dei nostri viaggiatori.' : 'Experiences shared by our travelers.' : String(homeStrings[locale][key as keyof typeof homeStrings.en] ?? '')]))), ...(definition.href ? { href: definition.href } : {}), ...(definition.source ? { selection: [], selectionMode: 'automatic', limit: definition.id === 'offers' ? 4 : 0 } : {}) }))
  const item = (id: string, values: (locale: EnabledLocale) => Record<string, string>, extra: Partial<SectionItem> = {}): SectionItem => ({ id, visible: true, text: translations(values), ...extra })
  sections.find((s) => s.id === 'stats')!.items = ['Users', 'Award', 'MapPin', 'Star'].map((icon, index) => item('stat-' + index, (locale) => ({ label: homeStrings[locale].stats[index] }), { icon: icon as CmsIconId, value: [100, 50, 60, 5][index], prefix: index === 3 ? '' : '+', suffix: index === 0 ? 'K' : '', decimals: index === 3 ? 1 : 0 }))
  sections.find((s) => s.id === 'how')!.items = ['MousePointerClick', 'CalendarDays', 'ThumbsUp'].map((icon, index) => item('step-' + index, (locale) => ({ step: homeStrings[locale].howP[index], heading: homeStrings[locale].howTi[index], description: homeStrings[locale].howD[index] }), { icon: icon as CmsIconId, href: ['/egypt-tours/one-day-tours', '/make-your-trip', '/special-offers'][index] }))
  sections.find((s) => s.id === 'sustainability')!.items = ['Users', 'Landmark', 'Leaf'].map((icon, index) => item('value-' + index, (locale) => ({ line1: [homeStrings[locale].susA, homeStrings[locale].susB, homeStrings[locale].susC][index][0], line2: [homeStrings[locale].susA, homeStrings[locale].susB, homeStrings[locale].susC][index][1] }), { icon: icon as CmsIconId }))
  sections.find((s) => s.id === 'faq')!.items = homeStrings.en.faqQ.map((_, index) => item('faq-' + index, (locale) => ({ question: homeStrings[locale].faqQ[index], answer: homeStrings[locale].faqA })))
  return { sections, seo: { text: translations(() => ({ title: '', description: '' })) as PageContent['seo']['text'], image: '' } }
}
function object(input: unknown): Record<string, unknown> { if (!input || typeof input !== 'object' || Array.isArray(input)) throw new HeroValidationError('Invalid page content.'); return input as Record<string, unknown> }
function keys(input: Record<string, unknown>, allowed: readonly string[]) { if (Object.keys(input).some((key) => !allowed.includes(key))) throw new HeroValidationError('Unsupported page field.') }
function string(value: unknown, max = 1200, required = true): string { if (typeof value !== 'string' || value.length > max || (required && !value.trim()) || /[<>\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) throw new HeroValidationError('Check the content and translations.'); return value.trim() }
export function cmsFieldMax(field: string) { return field.startsWith('description') || field === 'answer' || field.endsWith('S') || field === 'susP' ? 1200 : field === 'question' ? 240 : field === 'heading' || field.endsWith('T') || /^susT[12]$/.test(field) ? 160 : 100 }
function text(input: unknown, fields: readonly string[], required = false): PageSection['text'] {
  const raw = object(input); keys(raw, ENABLED_LOCALES)
  return translations((locale) => { const values = object(raw[locale]); keys(values, fields); return Object.fromEntries(fields.map((field) => { try { return [field, string(values[field], fields.includes('title') ? field === 'title' ? 160 : 320 : cmsFieldMax(field), required || ['startPlan', 'contactNow', 'viewAll', 'susCta', 'faqAll', 'readMore'].includes(field))] } catch { throw new HeroValidationError(`Check ${locale.toUpperCase()} ${field}.`) } })) })
}
export function validatePageContent(input: unknown, pageId: PageDocumentId = 'homepage'): PageContent {
  const definitions = pageSections(pageId)
  const raw = object(input); keys(raw, ['sections', 'seo'])
  if (!Array.isArray(raw.sections) || raw.sections.length !== definitions.length) throw new HeroValidationError('Keep every registered section; use visibility to hide eligible sections.')
  const ids = new Set<string>()
  const sections = raw.sections.map((value, index): PageSection => {
    const section = object(value); const definition = definitions.find((s) => s.id === section.id)
    if (!definition || ids.has(definition.id) || (index === 0) !== (definition.id === 'hero')) throw new HeroValidationError('Invalid section order or identity.')
    ids.add(definition.id)
    keys(section, ['id', 'visible', 'text', ...(definition.itemFields ? ['items'] : []), ...(definition.href ? ['href'] : []), ...(definition.source ? ['selection', 'selectionMode', 'limit'] : []), ...(definition.mediaFields?.length ? ['media'] : []), ...(definition.linkFields?.length ? ['links'] : [])])
    if (typeof section.visible !== 'boolean' || (definition.mandatory && !section.visible)) throw new HeroValidationError('Required search and form sections must remain visible.')
    const result: PageSection = { id: definition.id, visible: section.visible, text: text(section.text, definition.fields, pageId === 'shared' && definition.id !== 'help') }
    if (pageId === 'shared' && definition.id === 'help') for (const locale of ENABLED_LOCALES) for (const key of ['helpName', 'helpNat', 'helpPhone', 'helpBtn']) if (!result.text[locale][key].trim()) throw new HeroValidationError('Keep required enquiry controls labelled.')
    if (definition.mediaFields?.length) {
      const media = object(section.media); keys(media, definition.mediaFields)
      result.media = Object.fromEntries(definition.mediaFields.map((key) => [key, validateHeroMedia(media[key], 'image')]))
    }
    if (definition.linkFields?.length) {
      const links = object(section.links); keys(links, definition.linkFields)
      result.links = Object.fromEntries(definition.linkFields.map((key) => [key, validateCmsLink(links[key])]))
    }
    if (definition.href) result.href = validateCmsLink(section.href)
    if (definition.itemFields) {
      if (!Array.isArray(section.items) || section.items.length < (definition.minItems ?? 0) || section.items.length > (definition.maxItems ?? 12)) throw new HeroValidationError(`Check the item count in ${definition.name}.`)
      const itemIds = new Set<string>()
      result.items = section.items.map((rawItem): SectionItem => {
        const item = object(rawItem); keys(item, ['id', 'visible', 'text', ...(definition.icons ? ['icon'] : []), ...(definition.numbers ? ['value', 'prefix', 'suffix', 'decimals'] : []), ...(definition.id === 'how' || definition.itemHref ? ['href'] : []), ...(definition.itemImage ? ['image'] : [])])
        const id = string(item.id, 60)
        if (!/^[a-z0-9-]+$/.test(id) || itemIds.has(id) || typeof item.visible !== 'boolean') throw new HeroValidationError('Check item identity and visibility.')
        itemIds.add(id)
        const result: SectionItem = { id, visible: item.visible, text: text(item.text, definition.itemFields!, true) }
        if (definition.icons) { if (!CMS_ICON_IDS.includes(item.icon as CmsIconId)) throw new HeroValidationError('Choose a supported icon.'); result.icon = item.icon as CmsIconId }
        if (definition.id === 'how' || definition.itemHref) result.href = validateCmsLink(item.href)
        if (definition.itemImage) result.image = validateHeroMedia(item.image, 'image')
        if (definition.numbers) {
          if (typeof item.value !== 'number' || !Number.isFinite(item.value) || item.value < 0 || item.value > 1000000000 || ![0, 1, 2].includes(item.decimals as number)) throw new HeroValidationError('Check statistic value and decimal places.')
          Object.assign(result, { value: item.value, prefix: string(item.prefix, 10, false), suffix: string(item.suffix, 10, false), decimals: item.decimals })
        }
        return result
      })
    }
    if (definition.source) {
      if (!['automatic', 'selected'].includes(String(section.selectionMode)) || !Array.isArray(section.selection) || section.selection.length > 30 || section.selection.some((slug) => typeof slug !== 'string' || !/^[a-z0-9][a-z0-9-]{0,99}$/.test(slug)) || new Set(section.selection).size !== section.selection.length) throw new HeroValidationError('Check selected content references.')
      if (!Number.isInteger(section.limit) || Number(section.limit) < 0 || Number(section.limit) > definition.limit!) throw new HeroValidationError('Check the section display limit.')
      Object.assign(result, { selectionMode: section.selectionMode, selection: section.selection, limit: section.limit })
    }
    return result
  })
  try { return { sections, seo: validateSeoContent(raw.seo) } }
  catch (error) { throw new HeroValidationError((error as Error).message) }
}
export function initialPageState(): PageContentState { return { version: 1, revision: 0, mode: 'original', draft: null, published: null, updatedAt: null } }
export function transitionPageContent(state: PageContentState, action: HeroAction, content?: unknown, pageId: PageDocumentId = 'homepage'): PageContentState {
  const next = { ...state, revision: state.revision + 1, updatedAt: new Date().toISOString() }
  if (action === 'save-draft') return { ...next, draft: validatePageContent(content, pageId) }
  if (action === 'publish') { if (!state.draft) throw new HeroValidationError('Save a draft before publishing.'); const content = validatePageContent(state.draft, pageId); return { ...next, mode: 'published', published: { ...content, seo: state.seoManaged && state.published ? state.published.seo : content.seo } } }
  if (action === 'unpublish') return { ...next, mode: 'hidden' }
  if (action === 'restore') return { ...next, mode: 'original', draft: originalPageContent(pageId), published: state.seoManaged && state.published ? { ...originalPageContent(pageId), seo: state.published.seo } : null }
  throw new HeroValidationError('Unsupported page action.')
}
export function publicPageContent(state: PageContentState, pageId: PageDocumentId = 'homepage'): PublicPageContent {
  if (state.mode === 'original') { const content = originalPageContent(pageId); return { content: state.seoManaged && state.published ? { ...content, seo: state.published.seo } : content } }
  if (state.mode === 'published') return { content: state.published }
  const source = state.published ?? originalPageContent(pageId)
  return { content: { ...source, sections: source.sections.map((section) => ({ ...section, visible: !!pageSections(pageId).find((s) => s.id === section.id)?.mandatory })) } }
}
export function selectPageRecords<T extends { slug: string }>(section: PageSection | undefined, records: T[], automatic = records): T[] {
  const selected = section?.selectionMode === 'selected' ? (section.selection ?? []).flatMap((slug) => { const record = records.find((row) => row.slug === slug); return record ? [record] : [] }) : automatic
  return section?.limit ? selected.slice(0, section.limit) : selected
}
