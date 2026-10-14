import { NextResponse } from 'next/server'
import { getCurrentUser, hasPermission } from '@/lib/server/auth'
import { db } from '@/lib/server/db'
import { cmsPageRegistry, coverageCounts } from '@/lib/cms-coverage'
import { HERO_SETTING_KEY, originalHomeHero, validateHomeHero } from '@/lib/website-heroes'
import { isEditorialHeroId, originalEditorialHero, validateEditorialHero } from '@/lib/editorial-hero-definitions'
import { isShowcaseHeroId, originalShowcaseHero, validateShowcaseHero } from '@/lib/showcase-heroes'
import { HOME_PAGE_SETTING_KEY } from '@/lib/server/page-sections'
import { originalPageContent, validatePageContent } from '@/lib/page-sections'
import { isPageDocumentId } from '@/lib/additional-page-content'

function documents(pageKey: string): { key: string; original: unknown; scope: string; validate: (content: unknown) => unknown }[] {
  if (pageKey === 'homepage') return [{ key: HERO_SETTING_KEY, original: originalHomeHero(), scope: 'Hero', validate: validateHomeHero }, { key: HOME_PAGE_SETTING_KEY, original: originalPageContent(), scope: 'Page sections', validate: validatePageContent }]
  if (isEditorialHeroId(pageKey)) return [{ key: `cms.hero.${pageKey}.v1`, original: originalEditorialHero(pageKey), scope: pageKey === 'guide' || pageKey === 'accessible' ? 'Hero & topics' : 'Hero', validate: (content) => validateEditorialHero(pageKey, content) }, ...(isPageDocumentId(pageKey) ? [{ key: `cms.page.${pageKey}.v1`, original: originalPageContent(pageKey), scope: 'Page sections', validate: (content: unknown) => validatePageContent(content, pageKey) }] : [])]
  if (isPageDocumentId(pageKey)) return [...(isShowcaseHeroId(pageKey) ? [{ key: `cms.hero.showcase.${pageKey}.v1`, original: originalShowcaseHero(pageKey), scope: 'Hero', validate: (content: unknown) => validateShowcaseHero(pageKey, content) }] : []), { key: `cms.page.${pageKey}.v1`, original: originalPageContent(pageKey), scope: 'Page sections', validate: (content) => validatePageContent(content, pageKey) }]
  if (isShowcaseHeroId(pageKey)) return [{ key: `cms.hero.showcase.${pageKey}.v1`, original: originalShowcaseHero(pageKey), scope: 'Hero', validate: (content) => validateShowcaseHero(pageKey, content) }]
  return []
}
const signature = (value: unknown) => JSON.stringify(value, (_key, item: unknown) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item)
export async function GET() {
  const headers = { 'Cache-Control': 'private, no-store' }
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401, headers })
  if (!hasPermission(user, 'settings.view')) return NextResponse.json({ error: 'Forbidden.' }, { status: 403, headers })
  try {
    const keys = cmsPageRegistry.flatMap((page) => documents(page.key).map((document) => document.key))
    const rows = await db.siteSetting.findMany({ where: { key: { in: keys } }, select: { key: true, value: true } })
    const values = new Map(rows.map((row) => [row.key, row.value]))
    const pages = cmsPageRegistry.map((page) => {
      const statuses = documents(page.key).map((document) => {
        const raw = values.get(document.key)
        if (!raw) return { scope: document.scope, mode: 'original', draft: false, updatedAt: null as string | null }
        try {
          const state = JSON.parse(raw) as Record<string, unknown>
          if (!state || state.version !== 1 || typeof state.mode !== 'string' || !['original', 'published', 'hidden'].includes(state.mode) || !Number.isSafeInteger(state.revision) || Number(state.revision) < 0 || state.mode === 'published' && !state.published) throw new Error()
          const published = state.published ? document.validate(state.published) : document.validate(document.original)
          const draft = state.draft ? document.validate(state.draft) : null
          return { scope: document.scope, mode: state.mode, draft: !!draft && signature(draft) !== signature(published), updatedAt: typeof state.updatedAt === 'string' && Number.isFinite(Date.parse(state.updatedAt)) ? state.updatedAt : null }
        } catch { return { scope: document.scope, mode: 'unavailable', draft: false, updatedAt: null as string | null } }
      })
      return { ...page, statuses, updatedAt: statuses.map((s) => s.updatedAt).filter((v): v is string => !!v).sort().at(-1) ?? null, hasDraft: statuses.some((s) => s.draft), hasPublication: statuses.some((s) => s.mode === 'published') }
    })
    return NextResponse.json({ pages, counts: coverageCounts(), published: pages.filter((page) => page.hasPublication).length, drafts: pages.filter((page) => page.hasDraft).length }, { headers })
  } catch { return NextResponse.json({ error: 'Could not load CMS overview.' }, { status: 503, headers }) }
}
