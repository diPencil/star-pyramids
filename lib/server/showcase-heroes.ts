import 'server-only'
import { db } from './db'
import { HeroConflictError } from './website-heroes'
import { isShowcaseHeroId, initialShowcaseState, publicShowcaseHero, transitionShowcaseHero, validateShowcaseHero, type ShowcaseHeroId, type ShowcaseHeroState, type PublicShowcaseHero } from '../showcase-heroes'
import type { HeroAction } from '../website-heroes'
function key(id: ShowcaseHeroId) {
  if (!isShowcaseHeroId(id)) throw new Error('Unsupported hero.')
  return `cms.hero.showcase.${id}.v1`
}
function decode(id: ShowcaseHeroId, value: string): ShowcaseHeroState {
  const state = JSON.parse(value) as ShowcaseHeroState
  if (!state || state.version !== 1 || !Number.isSafeInteger(state.revision) || state.revision < 0 || !['original', 'published', 'hidden'].includes(state.mode)) throw new Error('Invalid stored hero.')
  if (state.draft) state.draft = validateShowcaseHero(id, state.draft)
  if (state.published) state.published = validateShowcaseHero(id, state.published)
  if (state.mode === 'published' && !state.published) throw new Error('Missing publication.')
  return state
}
export async function readShowcaseState(id: ShowcaseHeroId): Promise<ShowcaseHeroState> {
  const row = await db.siteSetting.findUnique({ where: { key: key(id) } })
  return row ? decode(id, row.value) : initialShowcaseState()
}
export async function readPublicShowcase(id: ShowcaseHeroId): Promise<PublicShowcaseHero> {
  try { return publicShowcaseHero(await readShowcaseState(id)) }
  catch { return { hidden: false, content: null, unavailable: true } }
}
export async function changeShowcaseHero(id: ShowcaseHeroId, action: HeroAction, revision: number, content?: unknown): Promise<ShowcaseHeroState> {
  const identity = key(id)
  const row = await db.siteSetting.findUnique({ where: { key: identity } })
  const current = row ? decode(id, row.value) : initialShowcaseState()
  if (current.revision !== revision) throw new HeroConflictError('This hero changed. Reload before saving.')
  const next = transitionShowcaseHero(id, current, action, content)
  if (row) {
    const update = await db.siteSetting.updateMany({ where: { key: identity, value: row.value }, data: { value: JSON.stringify(next) } })
    if (update.count !== 1) throw new HeroConflictError('This hero changed. Reload before saving.')
  } else {
    try { await db.siteSetting.create({ data: { key: identity, value: JSON.stringify(next), description: 'Website CMS showcase hero: private draft and publication' } }) }
    catch (error) { if ((error as { code?: string }).code === 'P2002') throw new HeroConflictError('This hero changed. Reload before saving.'); throw error }
  }
  return next
}
