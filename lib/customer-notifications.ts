'use client'

import { useCallback, useEffect, useState } from 'react'

export type CustomerNotification = {
  id: string
  type: string
  title: string
  message: string
  href: string | null
  readAt: string | null
  createdAt: string
}

const EVENT_NAME = 'sp-customer-notifications'
const PANEL_LIMIT = 8

let cache: CustomerNotification[] | null = null
let unreadCache = 0
let settled = false
let inflight: Promise<void> | null = null

function emitNotificationsChange() {
  window.dispatchEvent(new Event(EVENT_NAME))
}

async function fetchNotifications(): Promise<void> {
  if (!inflight) {
    inflight = (async () => {
      try {
        const res = await fetch('/api/account/notifications', { credentials: 'same-origin' })
        if (!res.ok) return
        const data = (await res.json()) as { notifications?: unknown; unreadCount?: unknown }
        if (!Array.isArray(data.notifications)) return
        const rows = data.notifications.filter((row): row is CustomerNotification =>
          typeof row === 'object' &&
          row !== null &&
          typeof (row as CustomerNotification).id === 'string' &&
          typeof (row as CustomerNotification).title === 'string')
        cache = rows
        unreadCache = typeof data.unreadCount === 'number' ? data.unreadCount : rows.filter((row) => !row.readAt).length
        settled = true
        emitNotificationsChange()
      } catch {
        /* unreachable API keeps the previous set; panel shows its error state */
      } finally {
        inflight = null
      }
    })()
  }
  await inflight
}

async function patchNotifications(body: { action: 'read' | 'read-all'; id?: string }): Promise<boolean> {
  try {
    const res = await fetch('/api/account/notifications', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(body),
    })
    if (!res.ok) return false
    const data = (await res.json()) as { unreadCount?: unknown }
    if (typeof data.unreadCount === 'number') unreadCache = data.unreadCount
    return true
  } catch {
    return false
  }
}

/**
 * Authoritative authenticated notification state (Phase 2H).
 *
 * Single shared cache across every consumer (account bell, panels):
 * one fetch per mount burst, optimistic read marking, and a window
 * event to keep all mounted instances synchronized. No polling, no
 * localStorage mirror — the database is the source of truth.
 */
export function useCustomerNotifications() {
  const [notifications, setNotifications] = useState<CustomerNotification[]>(() => (cache ? [...cache] : []))
  const [unreadCount, setUnreadCount] = useState(() => unreadCache)
  const [loading, setLoading] = useState(() => !settled)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let cancelled = false
    const sync = () => {
      if (cancelled) return
      setNotifications(cache ? [...cache] : [])
      setUnreadCount(unreadCache)
    }
    if (!settled) {
      fetchNotifications()
        .then(() => {
          if (cancelled) return
          sync()
          // Settled without data means guests/unauthorized or an
          // unreachable API — show the error state instead of
          // hanging on loading.
          if (!settled) setLoadError('Could not load notifications.')
          setLoading(false)
        })
        .catch(() => {
          if (cancelled) return
          setLoadError('Could not load notifications.')
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
    fetchNotifications().then(() => {
      setNotifications(cache ? [...cache] : [])
      setUnreadCount(unreadCache)
      if (!settled) setLoadError('Could not load notifications.')
      setLoading(false)
    })
  }, [])

  const markRead = useCallback(async (id: string): Promise<boolean> => {
    const previous = cache
    if (cache) {
      const row = cache.find((item) => item.id === id)
      if (row && !row.readAt) {
        cache = cache.map((item) => (item.id === id ? { ...item, readAt: new Date().toISOString() } : item))
        unreadCache = Math.max(0, unreadCache - 1)
        emitNotificationsChange()
      }
    }
    const ok = await patchNotifications({ action: 'read', id })
    if (!ok) {
      cache = previous
      unreadCache = (previous ?? []).filter((item) => !item.readAt).length
      emitNotificationsChange()
    } else {
      await fetchNotifications()
    }
    return ok
  }, [])

  const markAllRead = useCallback(async (): Promise<boolean> => {
    const previous = cache
    if (cache) {
      const now = new Date().toISOString()
      cache = cache.map((item) => (item.readAt ? item : { ...item, readAt: now }))
      unreadCache = 0
      emitNotificationsChange()
    }
    const ok = await patchNotifications({ action: 'read-all' })
    if (!ok) {
      cache = previous
      unreadCache = (previous ?? []).filter((item) => !item.readAt).length
      emitNotificationsChange()
    } else {
      await fetchNotifications()
    }
    return ok
  }, [])

  return {
    notifications,
    unreadCount,
    loading,
    loadError,
    refresh,
    markRead,
    markAllRead,
    recent: notifications.slice(0, PANEL_LIMIT),
  }
}
