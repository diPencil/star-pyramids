import 'server-only'
import { db } from './db'
import { HeroConflictError } from './website-heroes'
import { NAVIGATION_KEY, decodeNavigation, initialNavigation, transitionNavigation, validateNavigation, internalNavigationPages, type NavigationContent, type NavigationTarget, type NavigationKind, type NavigationAction, type ResolvedNavigationItem, type PublicNavigation } from '../navigation'
import { defaultNavigation, navigationLocales } from '../navigation'
import { copy, extra } from '../site-copy'
import { getSetting } from './settings'
import { readPublishedPage } from './page-sections'
import { isOfferActive, offerHref } from '../special-offers'

export async function readNavigation() {
  const row = await db.siteSetting.findUnique({ where: { key: NAVIGATION_KEY } })
  return row ? decodeNavigation(row.value) : initialNavigation()
}
export async function changeNavigation(revision: number, action: NavigationAction, content?: unknown) {
  const row = await db.siteSetting.findUnique({ where: { key: NAVIGATION_KEY } })
  const state = row ? decodeNavigation(row.value) : initialNavigation()
  if (state.revision !== revision) throw new HeroConflictError('Navigation changed. Reload before saving; your local edits have not overwritten it.')
  const next = transitionNavigation(state, action, content)
  if (row) {
    const result = await db.siteSetting.updateMany({ where: { key: NAVIGATION_KEY, value: row.value }, data: { value: JSON.stringify(next) } })
    if (result.count !== 1) throw new HeroConflictError('Navigation changed. Reload before saving.')
  } else {
    try { await db.siteSetting.create({ data: { key: NAVIGATION_KEY, value: JSON.stringify(next), description: 'Website CMS navigation; private draft and published snapshot' } }) }
    catch (error) { if ((error as { code?: string }).code === 'P2002') throw new HeroConflictError('Navigation changed. Reload before saving.'); throw error }
  }
  return next
}
export type NavigationOption = { key: string; label: string; target: NavigationTarget; href: string }
// Only selected published rows are resolved. Immutable database IDs survive slug renames.
export async function recordNavigationOptions(kind: NavigationKind, ids?: string[], query = ''): Promise<NavigationOption[]> {
  if (ids && !ids.length) return []
  const where = { ...(ids ? { id: { in: ids } } : {}), ...(query ? { title: { contains: query.slice(0, 100) } } : {}) }
  const select = { id: true, slug: true, title: true }
  const base = { select, take: 120, orderBy: { title: 'asc' as const } }
  if (kind === 'offer') {
    const rows = await db.offer.findMany({ ...base, select: { ...select, isPublished: true, startsAt: true, deadline: true, tourSlug: true, tour: { select: { status: true } } }, where: { ...where, isPublished: true } })
    return rows.filter(row => isOfferActive(row) && (!row.tourSlug || row.tour?.status === 'published')).map(row => ({ key: `${kind}:${row.id}`, label: row.title, href: offerHref(row), target: { type: 'record', kind, id: row.id } }))
  }
  const rows = kind === 'tour' ? await db.tour.findMany({ ...base, where: { ...where, status: 'published' } }) : kind === 'destination' ? await db.destination.findMany({ ...base, where: { ...where, isPublished: true } }) : kind === 'blog' ? await db.blog.findMany({ ...base, where: { ...where, isPublished: true } }) : await db.event.findMany({ ...base, where: { ...where, isPublished: true } })
  const prefix = { tour: '/egypt-tours/', destination: '/destinations/', blog: '/blogs/', event: '/events/' }[kind]
  return rows.map(row => ({ key: `${kind}:${row.id}`, label: row.title, href: prefix + encodeURIComponent(row.slug), target: { type: 'record', kind, id: row.id } }))
}
export async function resolveNavigation(content: NavigationContent, revision = 0): Promise<PublicNavigation> {
  const clean = validateNavigation(content)
  const references = clean.items.flatMap(item => [item, ...item.children]).flatMap(item => item.target?.type === 'record' ? [item.target] : [])
  const kinds = [...new Set(references.map(ref => ref.kind))]
  const records = (await Promise.all(kinds.map(kind => recordNavigationOptions(kind, references.filter(ref => ref.kind === kind).map(ref => ref.id))))).flat()
  const urls = new Map(records.map(record => [record.key, record.href]))
  function resolve(items: NavigationContent['items']): ResolvedNavigationItem[] {
    return items.flatMap(item => {
      if (!item.enabled || item.visibility === 'hidden') return []
      const { target, children, ...settings } = item
      if (item.type === 'group') { const resolved = resolve(children); return resolved.length ? [{ ...settings, children: resolved }] : [] }
      const href = target?.type === 'record' ? urls.get(`${target.kind}:${target.id}`) : target?.href
      return href ? [{ ...settings, href, children: [] }] : []
    })
  }
  return { revision, primaryLocale: clean.primaryLocale, items: resolve(clean.items) }
}
export async function publishedNavigation(): Promise<PublicNavigation | null> {
  const state = await readNavigation()
  return state.published === null ? null : resolveNavigation(state.published, state.revision)
}
export const staticNavigationOptions = (): NavigationOption[] => internalNavigationPages.map(([href, label]) => ({ key: href, label, href, target: { type: 'internal', href } }))

export async function navigationDefaults(): Promise<NavigationContent> {
  const configured = await getSetting('app.defaultLocale')
  const primaryLocale = configured === 'es' || configured === 'it' ? configured : 'en'
  const content = defaultNavigation(primaryLocale)
  const shared = await readPublishedPage('shared')
  const navigation = shared.content?.sections.find(section => section.id === 'navigation')
  const footer = shared.content?.sections.find(section => section.id === 'footer')
  const keys: Record<string, string> = { home: 'home', tours: 'tours', rent: 'rent', events: 'events', company: 'companyLabel', about: 'about', contact: 'contact', blogs: 'blogs', offer: 'offer', make: 'make', 'one-day': 'cat1', 'multi-day': 'cat2', nile: 'cat3', shore: 'cat4', guide: 'guideLink', faq: 'faqsLink', accessible: 'accessLink' }
  for (const item of content.items.flatMap(item => [item, ...item.children])) {
    const key = keys[item.id.replace(/^mobile-/, '')]
    if (!key) continue
    for (const locale of navigationLocales) {
      const original = { ...copy[locale], ...extra[locale] } as Record<string, string>
      item.labels[locale] = (navigation?.text[locale]?.[key] ?? (key === 'companyLabel' ? item.labels[locale] : original[key])) || item.labels[locale]
      // Category/help labels historically also passed through the shared footer override.
      if (['cat1', 'cat2', 'cat3', 'cat4', 'guideLink', 'faqsLink', 'accessLink'].includes(key)) item.labels[locale] = footer?.text[locale]?.[key] ?? item.labels[locale]
    }
  }
  return validateNavigation(content)
}
