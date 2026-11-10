import sanitizeHtml from 'sanitize-html'
import { Parser, parseDocument } from 'htmlparser2'
import { readJsonText } from '../json-text'
import { writeTourText, type Translatable } from './tour-translations'

export type RichLocale = 'en' | 'es' | 'it'
export type RichField = 'overview' | 'itineraryNote' | 'description'
export type ContentFormats = Partial<Record<RichField, Partial<Record<RichLocale, 'html-v1'>>>>
export type RichOwner = Translatable & { contentFormats?: ContentFormats }
export const RICH_LIMITS = { fieldBytes: 65536, requestBytes: 1048576, depth: 8, nodes: 2000 } as const
export const utf8Bytes = (value: string) => new TextEncoder().encode(value).length
const locales: readonly string[] = ['en', 'es', 'it']
const tags = ['p', 'br', 'strong', 'em', 'u', 'h2', 'h3', 'ul', 'ol', 'li', 'a']
const executable = new Set(['script', 'style', 'iframe', 'object', 'embed', 'svg', 'math', 'form', 'input', 'button', 'link', 'meta', 'base', 'template'])
const alignment = /^sp-rich-align-(left|center|right)$/
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)

export function safeRichLink(value: string): boolean {
  let decoded = value
  try {
    for (let i = 0; i < 3; i++) { const next = decodeURIComponent(decoded); if (next === decoded) break; decoded = next }
    if (/[\\\u0000-\u0020\u007f<>"']/.test(decoded) || decoded.startsWith('//')) return false
    if (decoded.startsWith('/')) return true
    const url = new URL(decoded)
    return url.protocol === 'https:' && !url.username && !url.password
  } catch { return false }
}

/** Deterministic in Node and webpack. HTML is never trusted merely because it came from staff. */
export function sanitizeTourHtml(value: string, strict = false): string {
  if (utf8Bytes(value) > RICH_LIMITS.fieldBytes) throw Error('Rich text exceeds 64 KiB. Shorten it before saving; nothing was truncated.')
  let depth = 0, nodes = 0
  const count = () => { if (++nodes > RICH_LIMITS.nodes) throw Error('Rich text contains too many nodes.') }
  new Parser({
    onopentag(name, attrs) {
      count()
      if (++depth > RICH_LIMITS.depth) throw Error('Rich text nesting exceeds 8 levels.')
      if (strict && (executable.has(name) || Object.keys(attrs).some(key => /^on/i.test(key) || ['srcdoc', 'contenteditable'].includes(key)))) throw Error('Executable HTML is not allowed in tour content.')
      if (strict && name === 'a' && attrs.href !== undefined && !safeRichLink(attrs.href)) throw Error('Use an HTTPS link or a site-root path in tour content.')
    },
    onclosetag() { depth-- }, ontext() { count() },
  }).end(value)
  const html = sanitizeHtml(value, {
    allowedTags: tags, allowedAttributes: { a: ['href', 'rel'], p: ['class'], h2: ['class'], h3: ['class'] },
    allowedClasses: { p: [alignment], h2: [alignment], h3: [alignment] },
    allowedSchemes: ['https'], allowProtocolRelative: false,
    nonTextTags: [...executable], parseStyleAttributes: false,
    transformTags: {
      b: 'strong', i: 'em',
      a: (_tag, attrs) => ({ tagName: 'a', attribs: safeRichLink(attrs.href ?? '') ? { href: attrs.href, rel: 'noopener noreferrer' } : {} as Record<string, string> }),
    },
  })
  if (utf8Bytes(html) > RICH_LIMITS.fieldBytes) throw Error('Normalized rich text exceeds 64 KiB.')
  return html
}

/** Plain-text projection with decoded entities and readable block/list separators. */
export function richTextPlain(value: string, format: unknown): string {
  if (format !== 'html-v1') return value
  let html: string
  try { html = sanitizeTourHtml(value) } catch { return '' } // malformed external imports must not break JSON-LD/export
  let text = ''
  const lists: Array<{ ordered: boolean; count: number }> = []
  new Parser({
    onopentag(name) {
      if (name === 'ul' || name === 'ol') lists.push({ ordered: name === 'ol', count: 0 })
      if (name === 'li') { const list = lists.at(-1); text += `${text.endsWith('\n') ? '' : '\n'}${list?.ordered ? `${++list.count}.` : '•'} ` }
      if (name === 'br') text += '\n'
    },
    ontext(value) { text += value },
    onclosetag(name) { if (name === 'ul' || name === 'ol') lists.pop(); if (['p', 'h2', 'h3', 'li', 'ul', 'ol'].includes(name)) text += '\n' },
  }, { decodeEntities: true }).end(html)
  return text.replace(/\u00a0/g, ' ').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
}

export const richFormat = (owner: RichOwner | undefined, field: RichField, locale: string = 'en') =>
  owner?.contentFormats?.[field]?.[locale as RichLocale]
export function hasNarrative(value: string, owner: RichOwner, field: RichField, locale = 'en') {
  return richTextPlain(value, richFormat(owner, field, locale)).trim().length > 0
}
export function overviewFromEditor(value: string, owner: RichOwner, locale = 'en'): string[] {
  return richFormat(owner, 'overview', locale) === 'html-v1' ? (hasNarrative(value, owner, 'overview', locale) ? [value] : []) : value.split('\n').map(line => line.trim()).filter(Boolean)
}
export const overviewToEditor = (values: readonly string[] | undefined, owner: RichOwner) =>
  richFormat(owner, 'overview') === 'html-v1' ? values?.[0] ?? '' : (values ?? []).join('\n')

export function writeNarrative<T extends RichOwner>(owner: T, field: RichField & keyof T, html: string, locale: RichLocale): T {
  const safe = sanitizeTourHtml(html)
  const value = richTextPlain(safe, 'html-v1').trim() ? safe : ''
  const next = writeTourText(owner, field, value, locale)
  const fields: ContentFormats = { ...owner.contentFormats }
  const languages: Partial<Record<RichLocale, 'html-v1'>> = { ...fields[field] }
  if (value) languages[locale] = 'html-v1'
  else delete languages[locale]
  if (Object.keys(languages).length) fields[field] = languages
  else delete fields[field]
  if (Object.keys(fields).length) next.contentFormats = fields
  else delete next.contentFormats
  return next
}

/** Overlay values and matching formats together. Never mutate canonical persistence objects. */
export function resolveNarrative(owner: RichOwner, field: RichField, canonical: string, locale: string, suppressFallback = false) {
  const translated = locale === 'es' || locale === 'it' ? owner.translations?.[locale]?.[field] : undefined
  const useTranslation = typeof translated === 'string' && (suppressFallback || translated.trim() !== '')
  return { value: suppressFallback && !useTranslation ? '' : useTranslation ? translated : canonical, format: suppressFallback && !useTranslation ? undefined : richFormat(owner, field, useTranslation ? locale : 'en') }
}

const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
export const legacyEditorHtml = (value: string) => value.split('\n').map(line => `<p>${escape(line)}</p>`).join('')

/** Semantic paste cleanup, including Word list paragraphs. Unsupported layouts become readable text. */
export function normalizeTourPaste(value: string): string {
  if (utf8Bytes(value) > RICH_LIMITS.fieldBytes) throw Error('Pasted content exceeds 64 KiB.')
  // Check parser resource limits before constructing the paste tree.
  sanitizeTourHtml(value)
  type Node = ReturnType<typeof parseDocument>['children'][number]
  const render = (nodes: readonly Node[]): string => {
    let result = '', list: 'ul' | 'ol' | null = null
    const closeList = () => { if (list) result += `</${list}>`; list = null }
    for (const node of nodes) {
      if (node.type === 'text') { if (node.data.trim()) closeList(); if (!list || node.data.trim()) result += escape(node.data); continue }
      if (!('name' in node) || !('attribs' in node) || !('children' in node) || executable.has(node.name)) continue
      const attrs = node.attribs
      if (/mso-list\s*:\s*ignore/i.test(attrs.style ?? '')) continue
      const officeList = node.name === 'p' && /mso-list\s*:/i.test(attrs.style ?? '')
      const content = render(node.children)
      if (officeList) {
        const textOf = (node: Node): string => node.type === 'text' ? node.data : 'children' in node ? node.children.map(textOf).join('') : ''
        const plain = textOf(node).replace(/\u00a0/g, ' ')
        const kind = /^\s*\d+[.)]\s/.test(plain) ? 'ol' : 'ul'
        if (list !== kind) { closeList(); list = kind; result += `<${kind}>` }
        result += `<li>${content.replace(/^(?:\s|&nbsp;)*(?:[•·]|\d+[.)])(?:\s|&nbsp;)+/, '')}</li>`
        continue
      }
      closeList()
      const name = node.name === 'b' ? 'strong' : node.name === 'i' ? 'em' : node.name
      if (name === 'a') result += safeRichLink(attrs.href ?? '') ? `<a href="${escape(attrs.href)}">${content}</a>` : content
      else if (tags.includes(name)) {
        const align = /(?:^|;)\s*text-align\s*:\s*(left|center|right)\s*(?:;|$)/i.exec(attrs.style ?? '')?.[1]?.toLowerCase()
        const cls = ['p', 'h2', 'h3'].includes(name) ? align ? `sp-rich-align-${align}` : (attrs.class ?? '').split(/\s+/).find(item => alignment.test(item)) : undefined
        result += `<${name}${cls ? ` class="${cls}"` : ''}>${content}${name === 'br' ? '' : `</${name}>`}`
      } else if (name === 'span') {
        let text = content
        if (/font-weight\s*:\s*(bold|[6-9]00)/i.test(attrs.style ?? '')) text = `<strong>${text}</strong>`
        if (/font-style\s*:\s*italic/i.test(attrs.style ?? '')) text = `<em>${text}</em>`
        if (/text-decoration(?:-line)?\s*:[^;]*underline/i.test(attrs.style ?? '')) text = `<u>${text}</u>`
        result += text
      } else result += ['td', 'th', 'tr', 'div'].includes(name) ? `<p>${content}</p>` : content
    }
    closeList()
    return result
  }
  return sanitizeTourHtml(render(parseDocument(value).children))
}

function normalizeOwner(raw: Record<string, unknown>, fields: readonly RichField[], label: string): Record<string, unknown> {
  if (raw.contentFormats === undefined) return raw
  if (!object(raw.contentFormats)) throw Error(`${label}: invalid contentFormats.`)
  const result = { ...raw }, formats: ContentFormats = {}
  let translations: Record<string, unknown> | undefined
  if (raw.translations !== undefined) {
    if (!object(raw.translations)) throw Error(`${label}: invalid translations.`)
    translations = { ...raw.translations }
  }
  for (const [field, map] of Object.entries(raw.contentFormats)) {
    if (!fields.includes(field as RichField) || !object(map)) throw Error(`${label}: unsupported rich field ${field}.`)
    for (const [locale, version] of Object.entries(map)) {
      if (!locales.includes(locale) || version !== 'html-v1') throw Error(`${label}.${field}: unsupported locale or format.`)
      let value: unknown = locale === 'en' ? raw[field] : object(translations?.[locale]) ? translations[locale][field] : undefined
      if (field === 'overview' && locale === 'en') {
        if (!Array.isArray(value) || value.length > 1 || value.some(item => typeof item !== 'string')) throw Error(`${label}: marked overview must contain at most one HTML document.`)
        value = value[0] ?? ''
      }
      if (typeof value !== 'string') throw Error(`${label}.${field}.${locale}: expected text.`)
      let safe: string
      try { safe = sanitizeTourHtml(value, true) }
      catch (error) { throw Error(`${label}.${field}.${locale}: ${error instanceof Error ? error.message : 'Invalid HTML.'}`) }
      const normalized = richTextPlain(safe, 'html-v1') ? safe : ''
      if (locale === 'en') result[field] = field === 'overview' ? normalized ? [normalized] : [] : normalized
      else {
        translations ??= {}
        const copy = { ...(translations[locale] as Record<string, unknown>) }
        if (normalized) copy[field] = normalized
        else delete copy[field]
        if (Object.keys(copy).length) translations[locale] = copy
        else delete translations[locale]
      }
      if (normalized) { formats[field as RichField] ??= {}; formats[field as RichField]![locale as RichLocale] = 'html-v1' }
    }
  }
  if (Object.keys(formats).length) result.contentFormats = formats
  else delete result.contentFormats
  if (translations) { if (Object.keys(translations).length) result.translations = translations; else delete result.translations }
  return result
}

/** Pure copy-on-write validation/normalization, used by both API mutation paths. */
export function normalizeTourRichText<T extends object>(input: T): T {
  if (utf8Bytes(JSON.stringify(input)) > RICH_LIMITS.requestBytes) throw Error('Tour content exceeds 1 MiB. Nothing was truncated.')
  const result = { ...input } as Record<string, unknown>
  const permitted = new Set<object>()
  for (const field of ['detail', 'dayDetail']) {
    if (result[field] == null) continue
    const detail = readJsonText(result[field])
    if (!object(detail)) continue // existing Tour validator reports malformed detail
    let copy = normalizeOwner(detail, ['overview', 'itineraryNote'], field)
    permitted.add(copy)
    const rowsKey = field === 'detail' ? 'itinerary' : 'stops'
    if (Array.isArray(copy[rowsKey])) copy = { ...copy, [rowsKey]: copy[rowsKey].map((row: unknown, index: number) => {
      if (!object(row)) return row
      const next = normalizeOwner(row, ['description'], `${field}.${rowsKey}.${index}`)
      permitted.add(next)
      return next
    }) }
    permitted.add(copy)
    result[field] = copy
  }
  const queue: unknown[] = [result]
  while (queue.length) {
    const value = queue.pop()
    if (!value || typeof value !== 'object') continue
    if (object(value) && 'contentFormats' in value && !permitted.has(value)) throw Error('Rich text metadata is allowed only on tour detail and itinerary narrative fields.')
    queue.push(...Object.values(value))
  }
  if (utf8Bytes(JSON.stringify(result)) > RICH_LIMITS.requestBytes) throw Error('Normalized tour content exceeds 1 MiB. Nothing was truncated.')
  return result as T
}

/** Bound request memory before JSON.parse; no silent truncation or database access. */
export async function readTourWriteRequest(request: Request): Promise<Record<string, unknown>> {
  if (Number(request.headers.get('content-length')) > RICH_LIMITS.requestBytes) throw Error('Tour request exceeds 1 MiB.')
  const reader = request.body?.getReader()
  if (!reader) throw Error('Invalid tour JSON.')
  const chunks: Uint8Array[] = []; let size = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.length
    if (size > RICH_LIMITS.requestBytes) { await reader.cancel(); throw Error('Tour request exceeds 1 MiB.') }
    chunks.push(value)
  }
  const bytes = new Uint8Array(size); let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
  const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes))
  if (!object(parsed)) throw Error('Invalid tour JSON.')
  return normalizeTourRichText(parsed)
}
