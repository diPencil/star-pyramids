import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getCurrentUser, hasPermission } from '@/lib/server/auth'
import { isSameOriginRequest } from '@/lib/server/csrf'
import { readAppearance, changeAppearance } from '@/lib/server/website-appearance'
import { AppearanceValidationError, type AppearanceAction } from '@/lib/website-appearance'
import { HeroConflictError } from '@/lib/server/website-heroes'
const headers = { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' }
export async function GET() {
  const user = await getCurrentUser()
  if (!user || !hasPermission(user, 'settings.view')) return NextResponse.json({ error: 'Forbidden.' }, { status: user ? 403 : 401, headers })
  try { return NextResponse.json({ state: await readAppearance(), canEdit: hasPermission(user, 'settings.edit') }, { headers }) }
  catch { return NextResponse.json({ error: 'Could not load appearance. No settings were changed.' }, { status: 503, headers }) }
}
export async function PATCH(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Forbidden.' }, { status: 403, headers })
  const user = await getCurrentUser()
  if (!user || !hasPermission(user, 'settings.view') || !hasPermission(user, 'settings.edit')) return NextResponse.json({ error: 'Forbidden.' }, { status: user ? 403 : 401, headers })
  let body: { revision: number; action: AppearanceAction; content?: unknown }
  try {
    const reader = request.body?.getReader(); if (!reader) throw new Error()
    let size = 0; const chunks: Uint8Array[] = []
    try { for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > 16000) { await reader.cancel(); throw new Error() }; chunks.push(value) } } finally { reader.releaseLock() }
    body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    if (!body || !Number.isSafeInteger(body.revision) || body.revision < 0 || !['save-draft', 'publish', 'restore'].includes(body.action)) throw new Error()
  } catch { return NextResponse.json({ error: 'Invalid appearance request (maximum 16 KB).' }, { status: 400, headers }) }
  try {
    const state = await changeAppearance(body.revision, body.action, body.content)
    if (body.action !== 'save-draft') revalidatePath('/', 'layout')
    return NextResponse.json({ state }, { headers })
  } catch (error) { return NextResponse.json({ error: error instanceof HeroConflictError || error instanceof AppearanceValidationError ? error.message : 'Appearance could not be saved. Reload and retry.' }, { status: error instanceof HeroConflictError ? 409 : error instanceof AppearanceValidationError ? 400 : 503, headers }) }
}
