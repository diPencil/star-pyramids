import { NextResponse } from 'next/server'
import { isReviewProvider } from '@/lib/review-integrations'
import { loadReviewFeed } from '@/lib/server/review-integrations'
export async function GET(request: Request) {
  const provider = new URL(request.url).searchParams.get('provider')
  const headers = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' }
  if (!isReviewProvider(provider)) return NextResponse.json({ error: 'Invalid provider.' }, { status: 400, headers })
  try { return NextResponse.json(await loadReviewFeed(provider), { headers }) }
  catch { return NextResponse.json({ error: 'Reviews are temporarily unavailable.' }, { status: 503, headers }) }
}
