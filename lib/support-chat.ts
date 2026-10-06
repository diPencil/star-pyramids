'use client'

import { useCallback, useEffect, useState } from 'react'

import { invalidateNotifications } from './customer-notifications'

export type SupportChatMessage = {
  id: string
  senderRole: 'customer' | 'staff'
  body: string
  readAt: string | null
  createdAt: string
}

export type SupportChatConversation = {
  reference: string
  subject: string
  status: 'open' | 'closed'
  assignedStaffEmail: string | null
  lastMessageAt: string
  createdAt: string
  updatedAt: string
  closedAt: string | null
  unreadCount: number
} | null

const EVENT_NAME = 'sp-support-chat'

let cache: { conversation: SupportChatConversation; messages: SupportChatMessage[] } | null = null
let unreadCache = 0
let settled = false
let inflight: Promise<void> | null = null

function emitChatChange() {
  window.dispatchEvent(new Event(EVENT_NAME))
}

function isValidMessage(row: unknown): row is SupportChatMessage {
  if (typeof row !== 'object' || row === null) return false
  const item = row as SupportChatMessage
  return (
    typeof item.id === 'string' &&
    (item.senderRole === 'customer' || item.senderRole === 'staff') &&
    typeof item.body === 'string'
  )
}

async function fetchThread(): Promise<void> {
  if (!inflight) {
    inflight = (async () => {
      try {
        const res = await fetch('/api/account/messages', { credentials: 'same-origin' })
        if (!res.ok) return
        const data = (await res.json()) as {
          conversation?: unknown
          messages?: unknown
          unreadCount?: unknown
        }
        if (!Array.isArray(data.messages)) return
        const conversation =
          data.conversation !== null && typeof data.conversation === 'object'
            ? (data.conversation as SupportChatConversation)
            : null
        cache = {
          conversation,
          messages: data.messages.filter(isValidMessage),
        }
        unreadCache =
          typeof data.unreadCount === 'number'
            ? data.unreadCount
            : cache.messages.filter((m) => m.senderRole === 'staff' && !m.readAt).length
        settled = true
        emitChatChange()
      } catch {
        /* unreachable API keeps the previous thread; UI shows its error state */
      } finally {
        inflight = null
      }
    })()
  }
  await inflight
}

/**
 * Authoritative DB-backed support thread state (Phase 2I).
 *
 * Single shared cache across the account shell badge and the messages
 * page: one fetch per mount burst, server-authoritative messages, and
 * a window event to keep mounted instances synchronized. No polling,
 * no localStorage mirror — the database is the source of truth.
 */
export function useSupportChat() {
  const [thread, setThread] = useState(() => cache)
  const [unreadCount, setUnreadCount] = useState(() => unreadCache)
  const [loading, setLoading] = useState(() => !settled)
  const [loadError, setLoadError] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    let cancelled = false
    const sync = () => {
      if (cancelled) return
      setThread(cache)
      setUnreadCount(unreadCache)
    }
    if (!settled) {
      fetchThread()
        .then(() => {
          if (cancelled) return
          sync()
          if (!settled) setLoadError('Could not load messages.')
          setLoading(false)
        })
        .catch(() => {
          if (cancelled) return
          setLoadError('Could not load messages.')
          setLoading(false)
        })
    } else {
      setLoading(false)
    }
    window.addEventListener(EVENT_NAME, sync)
    return () => {
      cancelled = true
      window.removeEventListener(EVENT_NAME, sync)
    }
  }, [])

  const refresh = useCallback(() => {
    settled = false
    setLoading(true)
    setLoadError('')
    fetchThread().then(() => {
      setThread(cache)
      setUnreadCount(unreadCache)
      if (!settled) setLoadError('Could not load messages.')
      setLoading(false)
    })
  }, [])

  const send = useCallback(async (body: string): Promise<{ ok: boolean; error: string }> => {
    const text = body.trim()
    if (!text) return { ok: false, error: '' }
    setSending(true)
    try {
      const res = await fetch('/api/account/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ body: text }),
      })
      const data = (await res.json().catch(() => null)) as {
        conversation?: unknown
        message?: unknown
      } | null
      if (!res.ok || !data || !isValidMessage(data.message)) {
        const message =
          data && typeof (data as { error?: unknown }).error === 'string'
            ? (data as { error: string }).error
            : 'Could not send the message.'
        return { ok: false, error: message }
      }
      settled = true
      await fetchThread()
      const confirmed = data.message
      // fetchThread no-ops while settled cache is fresh from another
      // tab state — merge the confirmed message directly instead.
      if (cache) {
        if (!cache.messages.some((m) => m.id === confirmed.id)) {
          cache = { ...cache, messages: [...cache.messages, confirmed] }
        }
        if (data.conversation !== null && typeof data.conversation === 'object') {
          cache = { ...cache, conversation: data.conversation as SupportChatConversation }
        }
        emitChatChange()
      }
      return { ok: true, error: '' }
    } catch {
      return { ok: false, error: 'Could not send the message.' }
    } finally {
      setSending(false)
    }
  }, [])

  const markRead = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch('/api/account/messages', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ action: 'read' }),
      })
      if (!res.ok) return false
      const data = (await res.json()) as { unreadCount?: unknown }
      if (typeof data.unreadCount === 'number') unreadCache = data.unreadCount
      // The server also resolved matching support notifications —
      // revalidate the notification bell cache immediately.
      invalidateNotifications()
      if (cache) {
        const now = new Date().toISOString()
        cache = {
          ...cache,
          messages: cache.messages.map((m) =>
            m.senderRole === 'staff' && !m.readAt ? { ...m, readAt: now } : m,
          ),
        }
        emitChatChange()
      }
      return true
    } catch {
      return false
    }
  }, [])

  return {
    conversation: thread?.conversation ?? null,
    messages: thread?.messages ?? [],
    unreadCount,
    loading,
    loadError,
    sending,
    refresh,
    send,
    markRead,
  }
}
