import 'server-only'
import { cache } from 'react'
import { db } from './db'
import { HeroConflictError } from './website-heroes'
import { CMS_STATIC_LINKS, HOME_SECTIONS, initialPageState, publicPageContent, transitionPageContent, validatePageContent, type PageContent, type PageContentState } from '../page-sections'
import { HeroValidationError, type HeroAction } from '../website-heroes'
import { isOfferActive } from '../special-offers'
import type { PageDocumentId } from '../additional-page-content'
import { TEMPLATE_PAGES, type TemplatePageId } from '../template-presentation'
import type { PublicPageContent } from '../page-sections'

const offerReferenceSelect = { slug: true, isPublished: true, startsAt: true, deadline: true, tour: { select: { status: true } } } as const
async function activeOfferReferences(slugs: string[]) {
  const rows = await db.offer.findMany({ where: { slug: { in: slugs }, isPublished: true }, select: offerReferenceSelect })
  return rows.filter((row) => isOfferActive(row) && (!row.tour || row.tour.status === 'published'))
}

export const HOME_PAGE_SETTING_KEY = 'cms.page.homepage.v1'
export const pageSettingKey = (pageId: PageDocumentId) => `cms.page.${pageId}.v1`
export function decodePageState(value: string, pageId: PageDocumentId = 'homepage'): PageContentState {
  const state = JSON.parse(value) as PageContentState
  if (!state || state.version !== 1 || !Number.isSafeInteger(state.revision) || state.revision < 0 || !['original', 'published', 'hidden'].includes(state.mode)) throw new Error('Invalid page state.')
  if (state.draft) state.draft = validatePageContent(state.draft, pageId)
  if (state.published) state.published = validatePageContent(state.published, pageId)
  if (state.mode === 'published' && !state.published) throw new Error('Missing page publication.')
  return state
}
export async function readPageState(pageId: PageDocumentId = 'homepage'): Promise<PageContentState> {
  const row = await db.siteSetting.findUnique({ where: { key: pageSettingKey(pageId) } })
  return row ? decodePageState(row.value, pageId) : initialPageState()
}
export const readPublishedPage = cache(async (pageId: PageDocumentId = 'homepage') => {
  try { const state = publicPageContent(await readPageState(pageId), pageId); return { ...state, content: state.content ? await withoutUnavailableLinks(state.content) : null } }
  catch { return { content: null, unavailable: true } }
})
async function withoutUnavailableLinks(content: PageContent): Promise<PageContent> {
  const links = content.sections.flatMap((section) => [section.href, ...Object.values(section.links ?? {}), ...(section.items ?? []).map((item) => item.href)]).filter((link): link is string => !!link)
  const references = [...new Set(links)].flatMap((href) => {
    if (CMS_STATIC_LINKS.includes(href as typeof CMS_STATIC_LINKS[number])) return []
    const match = /^\/(egypt-tours|destinations|blogs|events|special-offers)\/([a-z0-9-]+)$/.exec(href)
    return match ? [{ href, type: match[1], slug: match[2] }] : []
  })
  if (!references.length) return content
  const unavailable = new Set<string>()
  for (const type of new Set(references.map((reference) => reference.type))) {
    const group = references.filter((reference) => reference.type === type)
    const where = { slug: { in: group.map((reference) => reference.slug) } }
    const rows = type === 'egypt-tours' ? await db.tour.findMany({ where: { ...where, status: 'published' }, select: { slug: true } }) : type === 'destinations' ? await db.destination.findMany({ where: { ...where, isPublished: true }, select: { slug: true } }) : type === 'blogs' ? await db.blog.findMany({ where: { ...where, isPublished: true }, select: { slug: true } }) : type === 'events' ? await db.event.findMany({ where: { ...where, isPublished: true }, select: { slug: true } }) : await activeOfferReferences(where.slug.in)
    for (const reference of group) if (!rows.some((row) => row.slug === reference.slug)) unavailable.add(reference.href)
  }
  const valid = (href?: string) => href && unavailable.has(href) ? '' : href
  return { ...content, sections: content.sections.map((section) => ({ ...section, ...(section.href === undefined ? {} : { href: valid(section.href) }), ...(section.links ? { links: Object.fromEntries(Object.entries(section.links).map(([key, href]) => [key, valid(href) ?? ''])) } : {}), ...(section.items ? { items: section.items.map((item) => ({ ...item, ...(item.href === undefined ? {} : { href: valid(item.href) }) })) } : {}) })) }
}
async function validateReferences(content: PageContent) {
  for (const section of content.sections) {
    const source = HOME_SECTIONS.find((definition) => definition.id === section.id)?.source
    if (!source || section.selectionMode !== 'selected' || !section.selection?.length) continue
    const where = { slug: { in: section.selection } }
    const records = source === 'tours' ? await db.tour.findMany({ where: { ...where, status: 'published' }, select: { slug: true } }) : source === 'destinations' ? await db.destination.findMany({ where: { ...where, isPublished: true }, select: { slug: true } }) : source === 'blogs' ? await db.blog.findMany({ where: { ...where, isPublished: true }, select: { slug: true } }) : await activeOfferReferences(section.selection)
    if (section.selection.some((slug) => !records.some((record) => record.slug === slug))) throw new HeroValidationError('A selected record is missing or unpublished. Refresh the selection before publishing.')
  }
  // Validate dynamic CTA references as well, without copying their business data.
  const links = content.sections.flatMap((section) => [section.href, ...Object.values(section.links ?? {}), ...(section.items ?? []).map((item) => item.href)]).filter((link): link is string => !!link)
  for (const link of new Set(links)) {
    const match = /^\/(egypt-tours|destinations|blogs|events|special-offers)\/([a-z0-9-]+)$/.exec(link)
    if (!match || ['/egypt-tours/one-day-tours', '/egypt-tours/multi-days-tours', '/egypt-tours/nile-cruises', '/egypt-tours/shore-excursions'].includes(link)) continue
    const [, type, slug] = match
    const exists = type === 'egypt-tours' ? await db.tour.findFirst({ where: { slug, status: 'published' }, select: { slug: true } }) : type === 'destinations' ? await db.destination.findFirst({ where: { slug, isPublished: true }, select: { slug: true } }) : type === 'blogs' ? await db.blog.findFirst({ where: { slug, isPublished: true }, select: { slug: true } }) : type === 'events' ? await db.event.findFirst({ where: { slug, isPublished: true }, select: { slug: true } }) : (await activeOfferReferences([slug]))[0]
    if (!exists) throw new HeroValidationError('A link points to missing or unpublished content.')
  }
}
export const readPresentationStates = cache(async (): Promise<Partial<Record<TemplatePageId, PublicPageContent>>> => {
  const ids = Object.keys(TEMPLATE_PAGES) as TemplatePageId[]
  const result: Partial<Record<TemplatePageId, PublicPageContent>> = {}
  try {
    const rows = await db.siteSetting.findMany({ where: { key: { in: ids.map(pageSettingKey) } }, select: { key: true, value: true } })
    for (const id of ids) {
      const row = rows.find((row) => row.key === pageSettingKey(id))
      if (!row) continue
      try { const state = publicPageContent(decodePageState(row.value, id), id); result[id] = { ...state, content: state.content ? await withoutUnavailableLinks(state.content) : null } }
      catch { result[id] = { content: null, unavailable: true } }
    }
  } catch { for (const id of ids) result[id] = { content: null, unavailable: true } }
  return result
})
export async function changePageContent(action: HeroAction, revision: number, content?: unknown, pageId: PageDocumentId = 'homepage') {
  const key = pageSettingKey(pageId)
  const row = await db.siteSetting.findUnique({ where: { key } })
  const state = row ? decodePageState(row.value, pageId) : initialPageState()
  if (state.revision !== revision) throw new HeroConflictError('This page changed. Reload before saving.')
  const next = transitionPageContent(state, action, content, pageId)
  if (action === 'publish' && next.published) await validateReferences(next.published)
  if (row) {
    const updated = await db.siteSetting.updateMany({ where: { key, value: row.value }, data: { value: JSON.stringify(next) } })
    if (updated.count !== 1) throw new HeroConflictError('This page changed. Reload before saving.')
  } else {
    try { await db.siteSetting.create({ data: { key, value: JSON.stringify(next), description: `Website CMS ${pageId} sections: private draft and publication` } }) }
    catch (error) { if ((error as { code?: string }).code === 'P2002') throw new HeroConflictError('This page changed. Reload before saving.'); throw error }
  }
  return next
}
