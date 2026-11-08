import 'server-only'
import { Prisma } from '@prisma/client'
import { hashToken } from '@/lib/core/tokens'
import { copy } from '@/lib/live-chat-bot'
import { catalogueBotReply } from './live-chat-catalogue'
import { LiveChatError, type LiveAction, type LiveThread } from '@/lib/live-chat-contract'
import { db } from './db'
import type { ChatOwner } from './live-chat-session'
import { adminSupportHref, notifyStaff } from './notifications'
import { mintReferenceCandidate } from './support-chat'

const include = { messages: { orderBy: { createdAt: 'asc' as const } } }
type ThreadRow = Prisma.SupportConversationGetPayload<{ include: typeof include }>

function owns(owner: ChatOwner, row: { customerId: string | null; guestSessionId: string | null }) {
  return owner.customerId ? row.customerId === owner.customerId : row.guestSessionId === owner.guestSessionId && row.customerId === null
}

function view(row: ThreadRow): LiveThread {
  return {
    reference: row.reference, status: row.status, agentRequested: row.agentRequestedAt !== null,
    needsStaffReply: row.needsStaffReply,
    messages: row.messages.map(m => ({ id: m.id, body: m.body, senderRole: m.senderRole === 'staff' ? 'staff' : m.senderRole === 'bot' ? 'bot' : 'customer', createdAt: m.createdAt.toISOString() })),
  }
}

export async function readLiveThread(owner: ChatOwner): Promise<LiveThread> {
  const row = await db.supportConversation.findFirst({ where: owner, orderBy: { updatedAt: 'desc' }, include })
  return row ? view(row) : null
}

export async function liveThreadRevision(owner: ChatOwner): Promise<string> {
  const row = await db.supportConversation.findFirst({ where: owner, orderBy: { updatedAt: 'desc' }, select: { id: true, updatedAt: true } })
  return row ? `"${hashToken(`${row.id}:${row.updatedAt.toISOString()}`)}"` : '"empty"'
}

/** One owner-serialized transaction: idempotency, thread creation, visitor and bot history. */
export async function writeLiveThread(owner: ChatOwner, input: LiveAction): Promise<LiveThread> {
  const fingerprint = hashToken(JSON.stringify(input))
  const result = await db.$transaction(async tx => {
    // Serialize first-message creation and retries across tabs/processes, not just one browser.
    if (owner.customerId) {
      await tx.$queryRaw(Prisma.sql`SELECT id FROM users WHERE id = ${owner.customerId} FOR UPDATE`)
    } else {
      const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT id FROM chat_guest_sessions WHERE id = ${owner.guestSessionId} AND expiresAt > UTC_TIMESTAMP(3) FOR UPDATE`)
      if (!rows.length) throw new LiveChatError(401, 'Chat session expired. Please reload.')
    }
    const replay = await tx.supportMessage.findUnique({ where: { requestId: input.requestId }, include: { conversation: true } })
    if (replay) {
      if (!owns(owner, replay.conversation) || replay.requestHash !== fingerprint) throw new LiveChatError(409, 'Request conflict.')
      const row = await tx.supportConversation.findUniqueOrThrow({ where: { id: replay.conversationId }, include })
      return { row, notify: false }
    }
    let thread = await tx.supportConversation.findFirst({ where: { ...owner, status: 'OPEN' }, orderBy: { updatedAt: 'desc' } })
    let timestamp = Date.now()
    if (!thread) {
      thread = await tx.supportConversation.create({ data: { ...owner, reference: mintReferenceCandidate(), channel: 'live', needsStaffReply: false } })
      await tx.supportMessage.create({ data: { conversationId: thread.id, senderRole: 'bot', body: copy[input.locale].greeting, readAt: new Date(), createdAt: new Date(timestamp++) } })
    }
    const handoff = input.action === 'handoff'
    const latest = await tx.supportMessage.findFirst({ where: { conversationId: thread.id }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } })
    timestamp = Math.max(timestamp, latest ? latest.createdAt.getTime() + 1 : timestamp)
    const staffReply = await tx.supportMessage.findFirst({ where: { conversationId: thread.id, senderRole: 'staff' }, select: { id: true } })
    const human = handoff || thread.agentRequestedAt !== null || thread.channel === 'account' || staffReply !== null
    const body = input.body || ({ en: 'Requested a staff reply.', es: 'Ha solicitado una respuesta del equipo.', it: 'Ha richiesto una risposta del team.' }[input.locale])
    await tx.supportMessage.create({ data: {
      conversationId: thread.id, senderId: owner.customerId ?? null, senderRole: 'customer', body,
      requestId: input.requestId, requestHash: fingerprint, readAt: human ? null : new Date(),
      createdAt: new Date(timestamp++),
    } })
    if (!human) {
      // No client-supplied bot text, sender role, price, or conversation ID is trusted.
      const answer = await catalogueBotReply(body, input.locale, tx)
      await tx.supportMessage.create({ data: { conversationId: thread.id, senderRole: 'bot', body: answer, readAt: new Date(), createdAt: new Date(timestamp++) } })
    }
    const row = await tx.supportConversation.update({ where: { id: thread.id }, data: {
      lastMessageAt: new Date(timestamp - 1), needsStaffReply: human,
      ...(handoff ? { guestName: input.name, guestPhone: input.phone, agentRequestedAt: thread.agentRequestedAt ?? new Date() } : {}),
    }, include })
    return { row, notify: human }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
  if (result.notify) await notifyStaff({ type: 'admin_support_message_received', title: 'Support reply requested', message: 'A visitor is waiting for a staff reply.', href: adminSupportHref(result.row.reference) })
  return view(result.row)
}
