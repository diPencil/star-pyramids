import 'server-only'
import { Prisma } from '@prisma/client'
import { db } from './db'
import { validateCatalogueTranslations, type CatalogueKind, type CatalogueTranslations } from '../catalogue-translations'
import { preserveRecordSeo, stripRecordSeo } from '../record-seo'
import { HeroConflictError } from './website-heroes'

export async function attachCatalogueTranslations<T extends { slug: string }>(kind: CatalogueKind, rows: readonly T[]): Promise<(T & { translations: CatalogueTranslations })[]> {
  if (!rows.length) return []
  const stored = await db.$queryRaw<{ slug: string; payload: string }[]>(Prisma.sql`SELECT slug, payload FROM catalogue_translations WHERE entityType = ${kind} AND slug IN (${Prisma.join(rows.map((row) => row.slug))})`)
  const translations = new Map(stored.map((row) => [row.slug, validateCatalogueTranslations(kind, kind === 'category' ? stripRecordSeo(row.payload) : JSON.parse(row.payload))]))
  return rows.map((row) => ({ ...row, translations: translations.get(row.slug) ?? {} }))
}

/** Existing RBAC/CSRF gates run in the route before this atomic mutation. */
export async function saveWithCatalogueTranslations<T extends { slug: string }>(kind: CatalogueKind, input: unknown, previousSlug: string | undefined, mutate: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  const translations = input === undefined ? (previousSlug ? undefined : {}) : validateCatalogueTranslations(kind, input)
  return db.$transaction(async (tx) => {
    let previous: { payload: string } | undefined
    if (kind === 'category' && previousSlug) {
      await tx.$queryRaw`SELECT slug FROM multi_day_categories WHERE slug = ${previousSlug} FOR UPDATE`
      const rows = await tx.$queryRaw<{ payload: string }[]>`SELECT payload FROM catalogue_translations WHERE entityType = ${kind} AND slug = ${previousSlug} FOR UPDATE`
      previous = rows[0]
      if (previous) validateCatalogueTranslations(kind, stripRecordSeo(previous.payload))
    }
    const row = await mutate(tx)
    if (previousSlug && previousSlug !== row.slug) {
      await tx.$executeRaw`UPDATE catalogue_translations SET slug = ${row.slug} WHERE entityType = ${kind} AND slug = ${previousSlug}`
    }
    if (translations !== undefined || (kind === 'category' && previous && previousSlug !== row.slug)) {
      const payload = kind === 'category'
        ? preserveRecordSeo(previous?.payload ?? {}, translations, false, { kind: 'category', oldSlug: previousSlug ?? row.slug, newSlug: row.slug })!
        : JSON.stringify(translations)
      if (kind === 'category' && previous) {
        if (payload !== previous.payload) {
          const count = await tx.$executeRaw`UPDATE catalogue_translations SET payload = ${payload} WHERE entityType = ${kind} AND slug = ${row.slug} AND BINARY payload = BINARY ${previous.payload}`
          if (count !== 1) throw new HeroConflictError('This category changed. Reload before saving.')
        }
      } else if (kind === 'category') {
        try { await tx.$executeRaw`INSERT INTO catalogue_translations (entityType, slug, payload) VALUES (${kind}, ${row.slug}, ${payload})` }
        catch (error) { if (['P2002', 'P2010'].includes((error as { code?: string }).code ?? '')) throw new HeroConflictError('This category changed. Reload before saving.'); throw error }
      } else {
        await tx.$executeRaw`INSERT INTO catalogue_translations (entityType, slug, payload) VALUES (${kind}, ${row.slug}, ${payload}) ON DUPLICATE KEY UPDATE payload = ${payload}`
      }
    }
    return row
  })
}

export async function deleteWithCatalogueTranslations<T>(kind: CatalogueKind, slug: string, mutate: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return db.$transaction(async (tx) => {
    const result = await mutate(tx)
    await tx.$executeRaw`DELETE FROM catalogue_translations WHERE entityType = ${kind} AND slug = ${slug}`
    return result
  })
}

export async function catalogueTranslationResponse(kind: CatalogueKind, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const result = { ...body }
  const publicRow = <T extends { slug: string }>(row: T): T => {
    const clean = { ...row } as T & { content?: unknown; detail?: unknown }
    for (const key of ['content', 'detail'] as const) {
      if (key in clean) {
        const value = clean[key]
        const stripped = stripRecordSeo(value)
        clean[key] = typeof value === 'string' ? JSON.stringify(stripped) : stripped
      }
    }
    return clean
  }
  const isRecord = (value: unknown): value is { slug: string } => Boolean(value && typeof value === 'object' && 'slug' in value && typeof value.slug === 'string')
  for (const [key, value] of Object.entries(body)) {
    if (isRecord(value)) result[key] = (await attachCatalogueTranslations(kind, [publicRow(value)]))[0]
    else if (Array.isArray(value) && value.every(isRecord)) result[key] = await attachCatalogueTranslations(kind, value.map(publicRow))
  }
  return result
}
