import 'server-only'
import { db } from './db'
import { HeroConflictError } from './website-heroes'
import { initialFaqHeroState, transitionFaqHero, type FaqHeroState } from '../faq-hero'
import { isEditorialHeroId, originalEditorialHero, validateEditorialHero, type EditorialHeroId } from '../editorial-hero-definitions'
import type { HeroAction } from '../website-heroes'

function decode(value: string, id: EditorialHeroId): FaqHeroState {
  const state = JSON.parse(value) as FaqHeroState
  if (!state || state.version !== 1 || !Number.isSafeInteger(state.revision) || state.revision < 0 || !['original', 'published', 'hidden'].includes(state.mode)) throw new Error('Invalid FAQ hero state.')
  if (state.draft) state.draft = validateEditorialHero(id, state.draft)
  if (state.published) state.published = validateEditorialHero(id, state.published)
  if (state.mode === 'published' && !state.published) throw new Error('Missing published hero.')
  return state
}
function storageKey(id: EditorialHeroId) {
  if (!isEditorialHeroId(id)) throw new Error('Unsupported editorial hero.')
  return `cms.hero.${id}.v1`
}
export async function readFaqHeroState(id: EditorialHeroId = 'faq'): Promise<FaqHeroState> {
  const row = await db.siteSetting.findUnique({ where: { key: storageKey(id) } })
  return row ? decode(row.value, id) : initialFaqHeroState()
}
export async function changeFaqHero(action: HeroAction, revision: number, content?: unknown, id: EditorialHeroId = 'faq'): Promise<FaqHeroState> {
  const key = storageKey(id)
  const row = await db.siteSetting.findUnique({ where: { key } })
  const state = row ? decode(row.value, id) : initialFaqHeroState()
  if (state.revision !== revision) throw new HeroConflictError('This hero changed. Reload before saving.')
  const next = transitionFaqHero(state, action, action === 'save-draft' ? validateEditorialHero(id, content) : content, originalEditorialHero(id))
  if (row) {
    const result = await db.siteSetting.updateMany({ where: { key, value: row.value }, data: { value: JSON.stringify(next) } })
    if (result.count !== 1) throw new HeroConflictError('This hero changed. Reload before saving.')
  } else {
    try { await db.siteSetting.create({ data: { key, value: JSON.stringify(next), description: 'Website CMS editorial hero: private draft and publication' } }) }
    catch (error) {
      if ((error as { code?: string }).code === 'P2002') throw new HeroConflictError('This hero changed. Reload before saving.')
      throw error
    }
  }
  return next
}
