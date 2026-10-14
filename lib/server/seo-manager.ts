import 'server-only'
import { db } from './db'
import { decodePageState, pageSettingKey } from './page-sections'
import { HeroConflictError } from './website-heroes'
import { initialPageState } from '../page-sections'
import { transitionSeo, type SeoAction, type SeoPageId } from '../seo-manager'
import { isPageDocumentId } from '../additional-page-content'
import { validateSeoContent } from '../seo-content'

export function decodeSeoState(value: string, id: SeoPageId) {
  if (isPageDocumentId(id)) return decodePageState(value, id)
  const state = JSON.parse(value) as ReturnType<typeof initialPageState>
  if (!state || state.version !== 1 || !Number.isSafeInteger(state.revision) || state.revision < 0 || state.mode !== 'original' || state.draft !== null || (state.seoManaged !== undefined && typeof state.seoManaged !== 'boolean')) throw new Error('Invalid SEO-only document.')
  if (state.seoDraft) state.seoDraft = validateSeoContent(state.seoDraft)
  if (state.published) {
    if (!Array.isArray(state.published.sections) || state.published.sections.length) throw new Error('Unexpected SEO-only sections.')
    state.published = { sections: [], seo: validateSeoContent(state.published.seo) }
  }
  if (state.seoManaged && !state.published) throw new Error('Missing SEO publication.')
  return state
}
export async function readSeoState(id: SeoPageId) {
  const row = await db.siteSetting.findUnique({ where: { key: pageSettingKey(id) } })
  return row ? decodeSeoState(row.value, id) : initialPageState()
}

export async function changeSeo(id: SeoPageId, revision: number, action: SeoAction, content?: unknown) {
  const key = pageSettingKey(id)
  const row = await db.siteSetting.findUnique({ where: { key } })
  const state = row ? decodeSeoState(row.value, id) : initialPageState()
  if (state.revision !== revision) throw new HeroConflictError('This page changed. Reload before saving SEO.')
  const next = transitionSeo(state, id, action, content)
  if (row) {
    const result = await db.siteSetting.updateMany({ where: { key, value: row.value }, data: { value: JSON.stringify(next) } })
    if (result.count !== 1) throw new HeroConflictError('This page changed. Reload before saving SEO.')
  } else {
    try { await db.siteSetting.create({ data: { key, value: JSON.stringify(next), description: `Website CMS ${id} page and SEO` } }) }
    catch (error) { if ((error as { code?: string }).code === 'P2002') throw new HeroConflictError('This page changed. Reload before saving SEO.'); throw error }
  }
  return next
}
