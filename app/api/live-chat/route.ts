import { NextResponse } from 'next/server'
import { isSameOriginRequest } from '@/lib/server/csrf'
import { chatBudget, chatOwner, ipChatBudget } from '@/lib/server/live-chat-session'
import { liveThreadRevision, readLiveThread, writeLiveThread } from '@/lib/server/live-chat'
import { LiveChatError, parseLiveAction } from '@/lib/live-chat-contract'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const headers = { 'Cache-Control': 'private, no-store, max-age=0', Vary: 'Cookie' }
function failure(error: unknown) {
  // Never echo ORM errors, user content, tokens, contact details, or SQL to the browser/logs.
  return NextResponse.json({ error: error instanceof LiveChatError ? error.message : 'Chat temporarily unavailable. Please try again.',
    ...(error instanceof LiveChatError && error.code ? { code: error.code } : {}) }, { status: error instanceof LiveChatError ? error.status : 503, headers })
}

export async function GET(request: Request) {
  try {
    await ipChatBudget(request, false)
    const owner = await chatOwner()
    const ETag = owner ? await liveThreadRevision(owner) : '"empty"'
    if (request.headers.get('if-none-match') === ETag) return new NextResponse(null, { status: 304, headers: { ...headers, ETag } })
    return NextResponse.json({ thread: owner ? await readLiveThread(owner) : null }, { headers: { ...headers, ETag } })
  } catch (error) { return failure(error) }
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Forbidden.' }, { status: 403, headers })
  try {
    await ipChatBudget(request, true)
    const owner = await chatOwner()
    if (!owner) throw new LiveChatError(401, 'Chat session missing. Please reload.')
    await chatBudget(`owner:${owner.customerId ?? owner.guestSessionId}`, 30, 300)
    const reader = request.body?.getReader()
    if (!reader) throw new LiveChatError(400, 'Invalid request.')
    let size = 0
    const chunks: Uint8Array[] = []
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.length
      if (size > 4096) { await reader.cancel(); throw new LiveChatError(413, 'Message too large.') }
      chunks.push(value)
    }
    let value: unknown
    try { value = JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { throw new LiveChatError(400, 'Invalid request.') }
    const thread = await writeLiveThread(owner, parseLiveAction(value))
    return NextResponse.json({ thread }, { status: 201, headers })
  } catch (error) { return failure(error) }
}
