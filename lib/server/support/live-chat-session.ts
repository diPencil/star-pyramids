import 'server-only'
import { cookies } from 'next/headers'
import { generateOpaqueToken, hashToken } from '@/lib/core/tokens'
import { LiveChatError } from '@/lib/support/live-chat-contract'
import { getCurrentUser } from '../auth/auth'
import { getStaffPreviewCustomer } from '../auth/staff-preview'
import { db } from '../db'

export const GUEST_CHAT_COOKIE = process.env.NODE_ENV === 'production' ? '__Host-sp-chat' : 'sp_chat'
const TTL = 30 * 24 * 60 * 60 * 1000
export type ChatOwner = { customerId: string; guestSessionId?: never } | { guestSessionId: string; customerId?: never }

export async function chatOwner(createGuest = false): Promise<ChatOwner | null> {
  const current = await getCurrentUser()
  if (current) {
    // Preview must never write as the impersonated customer. A staff member
    // browsing the public site normally can instead use an isolated guest chat.
    if (await getStaffPreviewCustomer(current)) throw new LiveChatError(403, 'Customer chat is unavailable in staff preview.', 'preview_read_only')
    if (current.roles.includes('CUSTOMER')) return { customerId: current.id }
  }
  const jar = await cookies()
  const token = jar.get(GUEST_CHAT_COOKIE)?.value
  if (token && /^[A-Za-z0-9_-]{43}$/.test(token)) {
    const session = await db.chatGuestSession.findUnique({ where: { tokenHash: hashToken(token) } })
    if (session && session.expiresAt.getTime() > Date.now()) return { guestSessionId: session.id }
  }
  if (!createGuest) return null
  const secret = generateOpaqueToken()
  const session = await db.chatGuestSession.create({ data: { tokenHash: hashToken(secret), expiresAt: new Date(Date.now() + TTL) } })
  jar.set(GUEST_CHAT_COOKIE, secret, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/', maxAge: TTL / 1000 })
  return { guestSessionId: session.id }
}

export async function chatBudget(key: string, limit: number, seconds: number) {
  const window = Math.floor(Date.now() / (seconds * 1000))
  const row = await db.chatRateBucket.upsert({
    where: { key: hashToken(`${key}:${window}`) },
    create: { key: hashToken(`${key}:${window}`), expiresAt: new Date((window + 1) * seconds * 1000) },
    update: { count: { increment: 1 } },
  })
  if (row.count > limit) throw new LiveChatError(429, 'Too many requests. Please try again later.')
}

export async function ipChatBudget(request: Request, write: boolean) {
  // Deployment must overwrite this header at the trusted reverse proxy.
  const ip = (request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown').slice(0, 64)
  await chatBudget(`ip:${write ? 'write' : 'read'}:${ip}`, write ? 90 : 600, 300)
}
