import 'server-only'
import { db } from './db'
import { HERO_SETTING_KEY, initialHeroState, transitionHero, validateHomeHero, type HeroAction, type HeroState } from '../website-heroes'

export class HeroConflictError extends Error {}
export async function readHeroState(): Promise<HeroState> {
  const row = await db.siteSetting.findUnique({ where: { key: HERO_SETTING_KEY } })
  if (!row) return initialHeroState()
  const state = JSON.parse(row.value) as HeroState
  if (state.version !== 1 || !Number.isSafeInteger(state.revision) || !['original', 'published', 'hidden'].includes(state.mode)) throw new Error('Stored hero content is invalid.')
  if (state.published) state.published = validateHomeHero(state.published)
  if (state.draft) state.draft = validateHomeHero(state.draft)
  if (state.mode === 'published' && !state.published) throw new Error('Published hero content is missing.')
  return state
}
export async function changeHero(action: HeroAction, revision: number, content?: unknown): Promise<HeroState> {
  // Compare-and-swap the whole small document: concurrent editors cannot overwrite
  // a newer draft or publication. No delete/reset/backfill path exists.
  const row = await db.siteSetting.findUnique({ where: { key: HERO_SETTING_KEY } })
  const state = row ? JSON.parse(row.value) as HeroState : initialHeroState()
  if (state.revision !== revision) throw new HeroConflictError('This hero changed. Reload before saving.')
  const next = transitionHero(state, action, content)
  if (row) {
    const updated = await db.siteSetting.updateMany({ where: { key: HERO_SETTING_KEY, value: row.value }, data: { value: JSON.stringify(next) } })
    if (updated.count !== 1) throw new HeroConflictError('This hero changed. Reload before saving.')
  } else {
    try { await db.siteSetting.create({ data: { key: HERO_SETTING_KEY, value: JSON.stringify(next), description: 'Website CMS homepage hero: private draft and published snapshot' } }) }
    catch (error) {
      if ((error as { code?: string }).code === 'P2002') throw new HeroConflictError('This hero changed. Reload before saving.')
      throw error
    }
  }
  return next
}
