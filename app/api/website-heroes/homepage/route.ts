import { NextResponse } from 'next/server'
import { readHeroState } from '@/lib/server/cms/heroes/website-heroes'
import { publicHeroState } from '@/lib/cms/heroes/website-heroes'
export async function GET() {
  try { return NextResponse.json(publicHeroState(await readHeroState()), { headers: { 'Cache-Control': 'no-store' } }) }
  catch { return NextResponse.json({ error: 'Hero content unavailable.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } }) }
}
