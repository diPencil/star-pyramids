import { NextResponse } from 'next/server'
import { getCurrentUser, hasPermission } from '@/lib/server/auth'
import { db } from '@/lib/server/db'
import { isOfferActive, offerHref } from '@/lib/special-offers'
export async function GET(request: Request) {
  const headers = { 'Cache-Control': 'private, no-store' }
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401, headers })
  if (!hasPermission(user, 'settings.view')) return NextResponse.json({ error: 'Forbidden.' }, { status: 403, headers })
  const params = new URL(request.url).searchParams
  const source = params.get('source')
  if (!['tours', 'destinations', 'blogs', 'offers'].includes(source ?? '')) return NextResponse.json({ error: 'Unknown content source.' }, { status: 400, headers })
  const q = (params.get('q') ?? '').trim().slice(0, 100)
  const title = q ? { contains: q } : undefined
  const base = { select: { slug: true, title: true }, take: 100, orderBy: { title: 'asc' as const } }
  try {
    if (source === 'offers') {
      const rows = await db.offer.findMany({ ...base, select: { slug: true, title: true, tourSlug: true, startsAt: true, deadline: true, isPublished: true, tour: { select: { status: true } } }, where: { isPublished: true, title } })
      return NextResponse.json({ options: rows.filter((row) => isOfferActive(row) && (!row.tour || row.tour.status === 'published')).map((row) => ({ value: row.slug, label: row.title, href: offerHref(row) })), truncated: rows.length === 100 }, { headers })
    }
    const rows = source === 'tours' ? await db.tour.findMany({ ...base, where: { status: 'published', title } }) : source === 'destinations' ? await db.destination.findMany({ ...base, where: { isPublished: true, title } }) : await db.blog.findMany({ ...base, where: { isPublished: true, title } })
    const prefix = source === 'tours' ? '/egypt-tours/' : source === 'offers' ? '/special-offers/' : '/' + source + '/'
    return NextResponse.json({ options: rows.map((row) => ({ value: row.slug, label: row.title, href: prefix + row.slug })), truncated: rows.length === 100 }, { headers })
  } catch { return NextResponse.json({ error: 'Could not load published content.' }, { status: 503, headers }) }
}
