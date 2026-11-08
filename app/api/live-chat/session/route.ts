import { NextResponse } from 'next/server'
import { isSameOriginRequest } from '@/lib/server/csrf'
import { chatOwner, ipChatBudget } from '@/lib/server/live-chat-session'
import { LiveChatError } from '@/lib/live-chat-contract'

export async function POST(request: Request) {
  const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' }
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Forbidden.' }, { status: 403, headers })
  try {
    await ipChatBudget(request, true)
    await chatOwner(true)
    // Separate bootstrap ensures the browser has the HttpOnly credential BEFORE message submission.
    return NextResponse.json({ ok: true }, { headers })
  } catch (error) {
    return NextResponse.json({ error: error instanceof LiveChatError ? error.message : 'Chat temporarily unavailable.',
      ...(error instanceof LiveChatError && error.code ? { code: error.code } : {}) }, { status: error instanceof LiveChatError ? error.status : 503, headers })
  }
}
