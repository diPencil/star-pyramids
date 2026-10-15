import 'server-only'
import { db } from './db'
import { HeroConflictError } from './website-heroes'
import { APPEARANCE_KEY, decodeAppearance, initialAppearance, transitionAppearance, type AppearanceAction } from '../website-appearance'

export async function readAppearance() {
  const row = await db.siteSetting.findUnique({ where: { key: APPEARANCE_KEY } })
  return row ? decodeAppearance(row.value) : initialAppearance()
}
export async function readPublishedAppearance() {
  try { return (await readAppearance()).published ?? {} } catch { return {} }
}
export async function changeAppearance(revision: number, action: AppearanceAction, content?: unknown) {
  const row = await db.siteSetting.findUnique({ where: { key: APPEARANCE_KEY } })
  const state = row ? decodeAppearance(row.value) : initialAppearance()
  if (state.revision !== revision) throw new HeroConflictError('Appearance changed. Reload before saving.')
  const next = transitionAppearance(state, action, content)
  if (row) {
    const result = await db.siteSetting.updateMany({ where: { key: APPEARANCE_KEY, value: row.value }, data: { value: JSON.stringify(next) } })
    if (result.count !== 1) throw new HeroConflictError('Appearance changed. Reload before saving.')
  } else {
    try { await db.siteSetting.create({ data: { key: APPEARANCE_KEY, value: JSON.stringify(next), description: 'Public website appearance; independent draft and publication' } }) }
    catch (error) { if ((error as { code?: string }).code === 'P2002') throw new HeroConflictError('Appearance changed. Reload before saving.'); throw error }
  }
  return next
}
