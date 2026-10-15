import { NextResponse } from 'next/server'
import { getCurrentUser, hasPermission } from '@/lib/server/auth'
import { db } from '@/lib/server/db'
const headers = { 'Cache-Control': 'private, no-store' }
export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user || !hasPermission(user, 'support.view')) return NextResponse.json({ error: 'Forbidden.' }, { status: user ? 403 : 401, headers })
  const params = new URL(request.url).searchParams
  const page = Number(params.get('page') ?? 1)
  const pageSize = Number(params.get('pageSize') ?? 10)
  const status = params.get('status') ?? 'all'
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000 || ![10, 20, 30, 50].includes(pageSize) || !['all', 'unread', 'read'].includes(status)) return NextResponse.json({ error: 'Invalid pagination.' }, { status: 400, headers })
  const where = { userId: user.id, ...(status === 'unread' ? { readAt: null } : status === 'read' ? { readAt: { not: null } } : {}) }
  try {
    const [notifications, total] = await Promise.all([
      db.notification.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * pageSize, take: pageSize, select: { id: true, type: true, title: true, message: true, href: true, readAt: true, createdAt: true } }),
      db.notification.count({ where }),
    ])
    return NextResponse.json({ notifications, total }, { headers })
  } catch { return NextResponse.json({ error: 'Could not load notifications.' }, { status: 503, headers }) }
}
