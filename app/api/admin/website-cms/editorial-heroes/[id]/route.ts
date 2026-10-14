import { NextResponse } from 'next/server'
import { isEditorialHeroId } from '@/lib/editorial-hero-definitions'
import { readEditorialHeroApi, updateEditorialHeroApi } from '@/lib/server/editorial-hero-api'
type Context = { params: Promise<{ id: string }> }
export async function GET(_request: Request, { params }: Context) {
  const { id } = await params
  return isEditorialHeroId(id) ? readEditorialHeroApi(id) : NextResponse.json({ error: 'Not found.' }, { status: 404 })
}
export async function PATCH(request: Request, { params }: Context) {
  const { id } = await params
  return isEditorialHeroId(id) ? updateEditorialHeroApi(request, id) : NextResponse.json({ error: 'Not found.' }, { status: 404 })
}
