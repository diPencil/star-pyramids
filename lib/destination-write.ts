import type { Prisma } from '@prisma/client'
import type { Destination } from '@/data/types'
import { isTourImage } from './tour-write'
import { readJsonObject, readJsonText } from './json-text'

export class DestinationWriteError extends Error {
  constructor(message: string, public status = 400) { super(message) }
}
export type DestinationTourChange = { slug: string; expectedDestinationSlug: string | null; linked: boolean }
export type DestinationWrite = {
  slug?: string; title?: string; nameAr?: string | null; copy?: string; copyAr?: string | null
  image?: string | null; displayOrder?: number | null; detail?: Record<string, unknown> | null
  showInDestinations?: boolean; showInOneDayTours?: boolean; isPublished?: boolean
  translations?: unknown; expectedUpdatedAt?: string; tourChanges?: DestinationTourChange[]
}
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const validSlug = (value: unknown): value is string => typeof value === 'string' && value.length <= 80 && slugPattern.test(value)
export function validateDestinationWrite(value: unknown, creating = false): DestinationWrite {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new DestinationWriteError('Invalid destination JSON.')
  const body = value as Record<string, unknown>
  const allowed = ['slug', 'title', 'nameAr', 'copy', 'copyAr', 'image', 'displayOrder', 'detail', 'showInDestinations', 'showInOneDayTours', 'isPublished', 'translations', 'expectedUpdatedAt', 'tourChanges']
  if (Object.keys(body).some(key => !allowed.includes(key))) throw new DestinationWriteError('Unknown destination field.')
  if ((creating || body.slug !== undefined) && !validSlug(body.slug)) throw new DestinationWriteError('Enter a valid slug: lowercase letters, numbers, and hyphens.')
  if (creating && body.title === undefined) throw new DestinationWriteError('Enter the destination name.')
  for (const [key, max] of Object.entries({ title: 120, nameAr: 120, copy: 2000, copyAr: 2000 })) {
    const field = body[key]
    if (field === undefined || field === null && ['nameAr', 'copyAr'].includes(key)) continue
    if (typeof field !== 'string' || field.length > max || /[\u0000-\u001f]/.test(field.replace(/[\n\r\t]/g, '')) || key === 'title' && !field.trim()) throw new DestinationWriteError(`Check destination ${key}.`)
  }
  for (const key of ['showInDestinations', 'showInOneDayTours', 'isPublished']) {
    if (body[key] !== undefined && typeof body[key] !== 'boolean') throw new DestinationWriteError('Visibility flags must be boolean.')
  }
  if (body.image != null && body.image !== '' && (typeof body.image !== 'string' || body.image.length > 2000 || !isTourImage(body.image))) throw new DestinationWriteError('Use an uploaded/local image or a configured Unsplash/Wikimedia image URL.')
  if (body.displayOrder != null && (typeof body.displayOrder !== 'number' || !Number.isInteger(body.displayOrder) || body.displayOrder < 0 || body.displayOrder > 100000)) throw new DestinationWriteError('Display order must be a whole number from 0 to 100000.')
  if (body.expectedUpdatedAt !== undefined && (typeof body.expectedUpdatedAt !== 'string' || !Number.isFinite(Date.parse(body.expectedUpdatedAt)))) throw new DestinationWriteError('Invalid destination revision.')
  if (body.detail != null) {
    if (typeof body.detail !== 'object' || Array.isArray(body.detail) || JSON.stringify(body.detail).length > 500000) throw new DestinationWriteError('Invalid destination detail.')
    const detail = body.detail as Record<string, unknown>
    for (const key of ['heroImage', 'heroAlt', 'eyebrow', 'intro']) {
      if (detail[key] !== undefined && (typeof detail[key] !== 'string' || (detail[key] as string).length > 2000)) throw new DestinationWriteError(`Check destination ${key}.`)
    }
    if (detail.heroImage && !isTourImage(detail.heroImage)) throw new DestinationWriteError('Check the destination hero image.')
    for (const [key, fields] of Object.entries({ facts: ['label', 'value'], experiences: ['title', 'copy', 'image', 'alt'], rhythm: ['label', 'title', 'copy'], practical: ['title', 'copy'] })) {
      const list = detail[key]
      if (list === undefined) continue
      if (!Array.isArray(list) || list.length > 100 || list.some(row => !row || typeof row !== 'object' || fields.some(field => typeof row[field] !== 'string' || row[field].length > 2000) || key === 'experiences' && row.image && !isTourImage(row.image))) throw new DestinationWriteError(`Check destination ${key}.`)
    }
    for (const key of ['bestFor', 'tourSlugs']) {
      const list = detail[key]
      if (list !== undefined && (!Array.isArray(list) || list.length > 300 || list.some(item => typeof item !== 'string' || item.length > 2000 || key === 'tourSlugs' && !validSlug(item)))) throw new DestinationWriteError(`Check destination ${key}.`)
    }
  }
  if (body.tourChanges !== undefined) {
    const changes = body.tourChanges
    if (!Array.isArray(changes) || changes.length > 300 || changes.some(change => !change || typeof change !== 'object' || Object.keys(change).some(key => !['slug', 'expectedDestinationSlug', 'linked'].includes(key)) || !validSlug(change.slug) || change.expectedDestinationSlug !== null && !validSlug(change.expectedDestinationSlug) || typeof change.linked !== 'boolean') || new Set(changes.map(change => change.slug)).size !== changes.length) throw new DestinationWriteError('Invalid tour association changes.')
  }
  return body as DestinationWrite
}
export function destinationFailure(error: unknown): { error: string; status: number } {
  if (error instanceof DestinationWriteError) return { error: error.message, status: error.status }
  const code = (error as { code?: string } | null)?.code
  if (code && ['P2002', 'P2025', 'P2003', 'P2034'].includes(code)) return { error: 'This destination or its associations changed. Reload before saving.', status: 409 }
  return { error: 'Could not save the destination. Please try again.', status: 503 }
}

/** Explicit deltas only: visibility toggles never rewrite trip membership. */
export async function applyDestinationTourChanges(tx: Prisma.TransactionClient, changes: readonly DestinationTourChange[], destinationSlug: string) {
  for (const change of [...changes].sort((a, b) => a.slug.localeCompare(b.slug))) {
    const tour = await tx.tour.findUnique({ where: { slug: change.slug } })
    if (!tour || tour.category !== 'one-day-tours' || tour.destinationSlug !== change.expectedDestinationSlug) throw new DestinationWriteError('Tour associations changed. Reload before saving.', 409)
    if (!change.linked && tour.destinationSlug !== destinationSlug) throw new DestinationWriteError('This tour no longer belongs to this destination.', 409)
    if (!change.linked && tour.status === 'published') throw new DestinationWriteError('Reassign or unpublish the tour before removing its destination.', 409)
    const updated = await tx.tour.updateMany({ where: { slug: tour.slug, destinationSlug: tour.destinationSlug, category: tour.category, status: tour.status, updatedAt: tour.updatedAt }, data: { destinationSlug: change.linked ? destinationSlug : null } })
    if (updated.count !== 1) throw new DestinationWriteError('Tour associations changed. Reload before saving.', 409)
  }
}

/** Raw admin responses retain revision and unmodeled editorial fields. */
export function destinationEditorRecord(row: Record<string, unknown>): Destination & { updatedAt: string } {
  const raw = readJsonObject(row.detail)
  return { ...row, updatedAt: String(row.updatedAt ?? ''), detail: {
    ...raw, heroImage: raw.heroImage ?? row.image ?? '', heroAlt: raw.heroAlt ?? row.title ?? '',
    eyebrow: raw.eyebrow ?? '', intro: raw.intro ?? row.copy ?? '', facts: raw.facts ?? [],
    bestFor: raw.bestFor ?? [], experiences: raw.experiences ?? [], rhythm: raw.rhythm ?? [], practical: raw.practical ?? [], tourSlugs: raw.tourSlugs ?? [],
  } } as Destination & { updatedAt: string }
}

/** Public references are canonical, currently published tour identities only. Admin storage stays intact. */
export async function publicDestinationReferences<T extends { detail: string }>(rows: readonly T[], client: Pick<Prisma.TransactionClient, 'tour'>): Promise<T[]> {
  if (!rows.some(row => {
    const refs = readJsonObject(row.detail).tourSlugs
    return Array.isArray(refs) && refs.length > 0
  })) return [...rows]
  const tours = await client.tour.findMany({ where: { status: 'published' }, select: { slug: true, aliases: true, status: true } })
  const canonical = new Map<string, string>()
  // Canonical names win even if a legacy alias collides with another published URL.
  for (const tour of tours) if (tour.status === 'published') canonical.set(tour.slug, tour.slug)
  for (const tour of tours) {
    if (tour.status !== 'published') continue
    const aliases = readJsonText(tour.aliases)
    if (Array.isArray(aliases)) for (const alias of aliases) if (typeof alias === 'string' && !canonical.has(alias)) canonical.set(alias, tour.slug)
  }
  return rows.map(row => {
    const detail = readJsonObject(row.detail)
    if (!Array.isArray(detail.tourSlugs)) return { ...row }
    const references = detail.tourSlugs.flatMap(value => typeof value === 'string' && canonical.has(value) ? [canonical.get(value)!] : [])
    return { ...row, detail: JSON.stringify({ ...detail, tourSlugs: [...new Set(references)] }) }
  })
}
