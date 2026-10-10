import 'server-only'
import { Prisma } from '@prisma/client'
import { db } from './db'
import { validateCatalogueTranslations, type CatalogueKind, type CatalogueTranslations } from '../catalogue-translations'

export async function attachCatalogueTranslations<T extends { slug: string }>(kind: CatalogueKind, rows: readonly T[]): Promise<(T & { translations: CatalogueTranslations })[]> {
  if (!rows.length) return []
  const stored = await db.$queryRaw<{ slug: string; payload: string }[]>(Prisma.sql`SELECT slug, payload FROM catalogue_translations WHERE entityType = ${kind} AND slug IN (${Prisma.join(rows.map((row) => row.slug))})`)
  const translations = new Map(stored.map((row) => [row.slug, validateCatalogueTranslations(kind, JSON.parse(row.payload))]))
  return rows.map((row) => ({ ...row, translations: translations.get(row.slug) ?? {} }))
}

/** Existing RBAC/CSRF gates run in the route before this atomic mutation. */
export async function saveWithCatalogueTranslations<T extends { slug: string }>(kind: CatalogueKind, input: unknown, previousSlug: string | undefined, mutate: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  const translations = input === undefined ? (previousSlug ? undefined : {}) : validateCatalogueTranslations(kind, input)
  return db.$transaction(async (tx) => {
    const row = await mutate(tx)
    if (previousSlug && previousSlug !== row.slug) {
      await tx.$executeRaw`UPDATE catalogue_translations SET slug = ${row.slug} WHERE entityType = ${kind} AND slug = ${previousSlug}`
    }
    if (translations !== undefined) {
      const payload = JSON.stringify(translations)
      await tx.$executeRaw`INSERT INTO catalogue_translations (entityType, slug, payload) VALUES (${kind}, ${row.slug}, ${payload}) ON DUPLICATE KEY UPDATE payload = ${payload}`
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
  const isRecord = (value: unknown): value is { slug: string } => Boolean(value && typeof value === 'object' && 'slug' in value && typeof value.slug === 'string')
  for (const [key, value] of Object.entries(body)) {
    if (isRecord(value)) result[key] = (await attachCatalogueTranslations(kind, [value]))[0]
    else if (Array.isArray(value) && value.every(isRecord)) result[key] = await attachCatalogueTranslations(kind, value)
  }
  return result
}
