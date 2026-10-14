import 'server-only'
import { NextResponse } from 'next/server'
import { getCurrentUser, hasPermission, type PublicUser } from './auth'
import { isSameOriginRequest } from './csrf'
import type { RecordSeoKind } from '../record-seo'

export const SEO_PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' }
const modules: Record<RecordSeoKind, string> = { tour: 'tours', blog: 'blogs', destination: 'destinations', event: 'events', offer: 'offers', category: 'categories' }
export function canReadRecordSeo(user: PublicUser, kind: RecordSeoKind) {
  return hasPermission(user, 'settings.view') && (hasPermission(user, modules[kind] + '.view') || hasPermission(user, modules[kind] + '.edit'))
}
export function canEditRecordSeo(user: PublicUser, kind: RecordSeoKind) {
  return hasPermission(user, 'settings.edit') && hasPermission(user, modules[kind] + '.edit')
}
export async function recordSeoAccess(kind?: RecordSeoKind, request?: Request) {
  if (request && !isSameOriginRequest(request)) return { user: null, response: NextResponse.json({ error: 'Forbidden.' }, { status: 403, headers: SEO_PRIVATE_HEADERS }) }
  const user = await getCurrentUser()
  if (!user) return { user: null, response: NextResponse.json({ error: 'Unauthorized.' }, { status: 401, headers: SEO_PRIVATE_HEADERS }) }
  if (!hasPermission(user, 'settings.view') || kind && (request ? !canEditRecordSeo(user, kind) : !canReadRecordSeo(user, kind))) return { user: null, response: NextResponse.json({ error: 'Forbidden.' }, { status: 403, headers: SEO_PRIVATE_HEADERS }) }
  return { user, response: null }
}
export async function readRecordSeoBody(request: Request) {
  const reader = request.body?.getReader()
  if (!reader) throw new Error('Missing request body.')
  let size = 0; const chunks: Uint8Array[] = []
  try {
    for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > 20000) { await reader.cancel(); throw new Error('SEO requests are limited to 20 KB.') } chunks.push(value) }
  } finally { reader.releaseLock() }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as { revision: number; action: 'save-draft' | 'publish' | 'restore'; content?: unknown }
}
