import { readJsonText, writeJsonText } from './json-text'

export const tourJsonFields = ['aliases', 'gallery', 'galleryCaptions', 'deal', 'detail', 'dayDetail', 'categorySlugs', 'journeyVideos', 'photoCredits'] as const

/** The DB uses LONGTEXT; clients and booking calculations need decoded objects. */
export function decodeTourJson<T extends object>(row: T): T {
  const result = { ...row } as Record<string, unknown>
  for (const key of tourJsonFields) if (key in result) result[key] = readJsonText(result[key])
  return result as T
}

/** Partial updates keep omitted fields omitted and preserve explicit nulls. */
type EncodedTourJson<T> = Omit<T, typeof tourJsonFields[number]> & {
  [K in Extract<keyof T, typeof tourJsonFields[number]>]: string | Extract<T[K], null | undefined>
}
export function encodeTourJson<T extends object>(row: T): EncodedTourJson<T> {
  const result = { ...row } as Record<string, unknown>
  for (const key of tourJsonFields) if (result[key] !== undefined && result[key] !== null) result[key] = writeJsonText(result[key])
  return result as EncodedTourJson<T>
}
