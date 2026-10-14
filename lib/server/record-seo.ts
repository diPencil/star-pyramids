import 'server-only'
import { Prisma } from '@prisma/client'
import { db } from './db'
import { HeroConflictError } from './website-heroes'
import { isOfferActive, offerHref } from '../special-offers'
import { isTourPublished } from '../tour-publish'
import { recordSeoObject, recordSeoStateFromPayload, transitionRecordSeo, type RecordSeoAction, type RecordSeoDescriptor, type RecordSeoKind } from '../record-seo'

export class RecordSeoNotFoundError extends Error { readonly status = 404; readonly statusCode = 404 }
export class RecordSeoNotEligibleError extends RecordSeoNotFoundError {}
type Row = { slug: string; title?: string; name?: string; summary?: string; excerpt?: string; copy?: string; image?: string; status?: string; isPublished?: boolean; active?: boolean; showInDestinations?: boolean; showInOneDayTours?: boolean; tourSlug?: string | null; startsAt?: Date | null; deadline?: string | null; detail?: string | null; content?: string; updatedAt: Date }
type Delegate = {
  findUnique(args: { where: { slug: string } }): Promise<Row | null>
  findMany(): Promise<Row[]>
  updateMany(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<{ count: number }>
}
function delegate(kind: RecordSeoKind, client: Prisma.TransactionClient = db): Delegate {
  return client[kind === 'category' ? 'multiDayCategory' : kind] as unknown as Delegate
}
function field(kind: RecordSeoKind) { return kind === 'tour' || kind === 'destination' ? 'detail' : 'content' }
function descriptor(kind: RecordSeoKind, row: Row): RecordSeoDescriptor {
  const paths = { tour: '/egypt-tours/', blog: '/blogs/', destination: '/destinations/', event: '/events/', offer: '/special-offers/', category: '/egypt-tours/multi-days-tours/' }
  const publicUrl = kind === 'offer' ? offerHref(row) : paths[kind] + row.slug
  const published = kind === 'tour' ? isTourPublished(row) : kind === 'category' ? row.active === true : kind === 'offer' ? isOfferActive(row) : row.isPublished === true
  const module = { tour: 'trips', blog: 'blogs', destination: 'destinations', event: 'events', offer: 'offers', category: 'multi-day-categories' }[kind]
  const canonicalPaths = [publicUrl, ...(kind === 'destination' && row.showInOneDayTours ? [`/egypt-tours/one-day-tours/${row.slug}`] : [])]
  return { kind, slug: row.slug, name: row.title ?? row.name ?? row.slug, publicUrl, published, canonicalPaths, sourceEditor: `/admin/${module}/${kind === 'tour' ? 'builder' : 'new'}?slug=${encodeURIComponent(row.slug)}`, description: row.summary ?? row.excerpt ?? row.copy ?? '', image: row.image ?? '', updatedAt: row.updatedAt.toISOString() }
}
async function load(kind: RecordSeoKind, slug: string, client: Prisma.TransactionClient = db) {
  const row = await delegate(kind, client).findUnique({ where: { slug } })
  if (!row) throw new RecordSeoNotFoundError('Record not found.')
  if (kind === 'offer' && row.tourSlug) throw new RecordSeoNotEligibleError('Linked offers use their tour SEO.')
  const translation = kind === 'category' ? await client.catalogueTranslation.findUnique({ where: { entityType_slug: { entityType: 'category', slug } } }) : null
  const raw = kind === 'category' ? translation?.payload ?? '{}' : row[field(kind)]
  const state = recordSeoStateFromPayload(raw, kind === 'tour')
  const record = descriptor(kind, row)
  return { row, raw, translation, record, state }
}
export async function readRecordSeo(kind: RecordSeoKind, slug: string) {
  const { record, state } = await load(kind, slug)
  return { record, state }
}
export async function changeRecordSeo(kind: RecordSeoKind, slug: string, action: RecordSeoAction, revision: number, content?: unknown) {
  const change = async (client: Prisma.TransactionClient) => {
    // Serialize category SEO with translation edits and slug renames, including
    // first insertion when there is no translation row to lock yet.
    if (kind === 'category') await client.$queryRaw`SELECT slug FROM multi_day_categories WHERE slug = ${slug} FOR UPDATE`
    const current = await load(kind, slug, client)
    if (current.state.revision !== revision) throw new HeroConflictError('This record changed. Reload before saving SEO.')
    const state = transitionRecordSeo(current.state, action, content)
    const value = JSON.stringify({ ...recordSeoObject(current.raw, kind === 'tour'), seoManager: state })
    let count: number
    if (kind === 'category') {
      if (current.translation) {
        count = (await client.catalogueTranslation.updateMany({ where: { entityType: 'category', slug, payload: current.translation.payload }, data: { payload: value } })).count
      } else {
        try { await client.catalogueTranslation.create({ data: { entityType: 'category', slug, payload: value } }); count = 1 }
        catch (error) { if ((error as { code?: string }).code === 'P2002') throw new HeroConflictError('This record changed. Reload before saving SEO.'); throw error }
      }
    } else {
      count = (await delegate(kind, client).updateMany({ where: { slug, [field(kind)]: current.raw, updatedAt: current.row.updatedAt }, data: { [field(kind)]: value } })).count
    }
    if (count !== 1) throw new HeroConflictError('This record changed. Reload before saving SEO.')
    return { record: current.record, state }
  }
  return kind === 'category' ? db.$transaction(change) : change(db)
}
/** Admin-private inventory; callers must authorize before exposing this result. */
export async function listRecordSeo() {
  const kinds: RecordSeoKind[] = ['tour', 'blog', 'destination', 'event', 'offer', 'category']
  const groups = await Promise.all(kinds.map(async kind => {
    const rows = await delegate(kind).findMany()
    const translations = kind === 'category' ? await db.catalogueTranslation.findMany({ where: { entityType: 'category' } }) : []
    const payloads = new Map(translations.map(row => [row.slug, row.payload]))
    return rows.filter(row => kind !== 'offer' || !row.tourSlug).map(row => {
      const record = descriptor(kind, row)
      const raw = kind === 'category' ? payloads.get(row.slug) ?? '{}' : row[field(kind)]
      return { record, state: recordSeoStateFromPayload(raw, kind === 'tour') }
    })
  }))
  return groups.flat()
}
export async function getPublishedRecordSeo(kind: RecordSeoKind, slug: string) {
  try {
    const { record, state } = await readRecordSeo(kind, slug)
    return record.published ? state.published : null
  } catch (error) { if (error instanceof RecordSeoNotFoundError) return null; throw error }
}
