import { validateSeoContent, type SeoContent } from './seo-content'

export type RecordSeoKind = 'tour' | 'blog' | 'destination' | 'event' | 'offer' | 'category'
export type RecordSeoContent = SeoContent & { structuredData?: boolean }
export type RecordSeoAction = 'save-draft' | 'publish' | 'restore'
export type RecordSeoState = { version: 1; revision: number; draft: RecordSeoContent | null; published: RecordSeoContent | null; updatedAt: string | null }
export type RecordSeoDescriptor = { kind: RecordSeoKind; slug: string; name: string; publicUrl: string | null; published: boolean; canonicalPaths: string[]; sourceEditor: string; description?: string; image?: string; updatedAt?: string | null }

export function isRecordSeoKind(value: string): value is RecordSeoKind {
  return ['tour', 'blog', 'destination', 'event', 'offer', 'category'].includes(value)
}
export function initialRecordSeoState(): RecordSeoState {
  return { version: 1, revision: 0, draft: null, published: null, updatedAt: null }
}
export function emptyRecordSeoContent(): RecordSeoContent {
  return { text: { en: { title: '', description: '' }, es: { title: '', description: '' }, it: { title: '', description: '' } }, image: '' }
}
export function validateRecordSeoContent(value: unknown): RecordSeoContent {
  const raw = recordSeoObject(value)
  const { structuredData, ...seo } = raw
  if (structuredData !== undefined && typeof structuredData !== 'boolean') throw new Error('Invalid structured data option.')
  return { ...validateSeoContent(seo), ...(structuredData === undefined ? {} : { structuredData }) }
}
export function validateRecordSeoState(value: unknown): RecordSeoState {
  const raw = recordSeoObject(value)
  if (raw.version !== 1 || !Number.isSafeInteger(raw.revision) || (raw.revision as number) < 0 ||
    !(raw.updatedAt === null || (typeof raw.updatedAt === 'string' && Number.isFinite(Date.parse(raw.updatedAt))))) throw new Error('Invalid stored record SEO state.')
  return { ...raw, version: 1, revision: raw.revision as number, updatedAt: raw.updatedAt as string | null,
    draft: raw.draft === null ? null : validateRecordSeoContent(raw.draft),
    published: raw.published === null ? null : validateRecordSeoContent(raw.published) }
}
export function transitionRecordSeo(state: RecordSeoState, action: RecordSeoAction, input?: unknown): RecordSeoState {
  const current = validateRecordSeoState(state)
  if (current.revision === Number.MAX_SAFE_INTEGER) throw new Error('Record SEO revision limit reached.')
  const next = { ...current, revision: current.revision + 1, updatedAt: new Date().toISOString() }
  if (action === 'save-draft') return { ...next, draft: validateRecordSeoContent(input) }
  if (action === 'publish') {
    if (!current.draft) throw new Error('Save an SEO draft before publishing.')
    return { ...next, published: validateRecordSeoContent(current.draft) }
  }
  if (action === 'restore') return { ...next, draft: null, published: null }
  throw new Error('Unsupported record SEO action.')
}

/** Strict decoding for writes: malformed original content must never be reset. */
export function recordSeoObject(value: unknown, nullable = false): Record<string, unknown> {
  const parsed: unknown = typeof value === 'string' ? JSON.parse(value) : value
  if (nullable && parsed === null) return {}
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid original record JSON.')
  return parsed as Record<string, unknown>
}
export function recordSeoStateFromPayload(value: unknown, nullable = false): RecordSeoState {
  const payload = recordSeoObject(value, nullable)
  return Object.hasOwn(payload, 'seoManager') ? validateRecordSeoState(payload.seoManager) : initialRecordSeoState()
}
export type RecordSeoRename = { kind: RecordSeoKind; oldSlug: string; newSlug: string }

/** Only exact self-canonicals follow identity changes; shared targets stay put. */
export function remapRecordSeoCanonical(value: unknown, rename: RecordSeoRename): RecordSeoState {
  const state = value as RecordSeoState
  if (rename.oldSlug === rename.newSlug) return state
  validateRecordSeoState(value)
  const prefixes: Record<RecordSeoKind, string[]> = {
    tour: ['/egypt-tours/'], blog: ['/blogs/'], destination: ['/destinations/', '/egypt-tours/one-day-tours/'],
    event: ['/events/'], offer: ['/special-offers/'], category: ['/egypt-tours/multi-days-tours/'],
  }
  const paths = new Map(prefixes[rename.kind].map(prefix => [prefix + rename.oldSlug, prefix + rename.newSlug]))
  const remap = (content: RecordSeoContent | null) => {
    const canonical = content?.canonical && paths.get(content.canonical)
    return canonical ? { ...content!, canonical } : content
  }
  const draft = remap(state.draft)
  const published = remap(state.published)
  if (draft === state.draft && published === state.published) return state
  if (state.revision === Number.MAX_SAFE_INTEGER) throw new Error('Record SEO revision limit reached.')
  return { ...state, draft, published, revision: state.revision + 1, updatedAt: new Date().toISOString() }
}

/** Original editors can change business content, but cannot submit reserved SEO. */
export function preserveRecordSeo(original: unknown, incoming: unknown, nullable = false, rename?: RecordSeoRename): string | null {
  const previous = recordSeoObject(original, nullable)
  const next = incoming === undefined ? { ...previous } : { ...recordSeoObject(incoming, nullable) }
  delete next.seoManager
  if (Object.hasOwn(previous, 'seoManager')) next.seoManager = rename ? remapRecordSeoCanonical(previous.seoManager, rename) : previous.seoManager
  if (nullable && (incoming === null || (incoming === undefined && original === null)) && !Object.hasOwn(next, 'seoManager')) return null
  return JSON.stringify(next)
}
/** An SEO-only tour detail remains absent to public presentation code. */
export function stripRecordSeo(value: unknown, emptyAsNull = false): unknown {
  const parsed: unknown = typeof value === 'string' ? JSON.parse(value) : value
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return parsed
  const { seoManager: reserved, ...content } = parsed as Record<string, unknown>
  return emptyAsNull && reserved !== undefined && !Object.keys(content).length ? null : content
}
