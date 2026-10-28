'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { MARKETING_CHANGE_EVENT, currentNotification, isMarketingNotification, type MarketingNotification } from './marketing-notifications'

export type CustomerNotification = {
  id: string; type: string; title: string; message: string; href: string | null; readAt: string | null; createdAt: string
  expiresAt?: string | null
  localized?: MarketingNotification['localized']
}
const EVENT_NAME = 'sp-customer-notifications'
const PANEL_LIMIT = 8

/** Revalidate active account consumers after a successful domain/read operation. */
export function invalidateNotifications(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENT_NAME))
}

/** Owner-authenticated state. No cross-session module cache or localStorage mirror. */
export function useCustomerNotifications() {
  const [notifications, setNotifications] = useState<CustomerNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const sequence = useRef(0), mounted = useRef(false)
  const load = useCallback(async () => {
    const request = ++sequence.current
    try {
      const response = await fetch('/api/account/notifications', { credentials: 'same-origin', cache: 'no-store' })
      if (!response.ok) throw Error('Could not load notifications.')
      const body = await response.json()
      if (!Array.isArray(body.notifications)) throw Error('Could not load notifications.')
      const rows: CustomerNotification[] = body.notifications.filter((item: CustomerNotification) => item && typeof item.id === 'string' && typeof item.title === 'string' && typeof item.createdAt === 'string')
      if (!mounted.current || request !== sequence.current) return
      setNotifications(rows.filter(item => currentNotification(item)))
      setUnreadCount(Math.max(0, (typeof body.unreadCount === 'number' ? body.unreadCount : rows.filter(item => !item.readAt).length) - rows.filter(item => !item.readAt && !currentNotification(item)).length))
      setLoadError('')
    } catch {
      if (!mounted.current || request !== sequence.current) return
      setNotifications([]); setUnreadCount(0); setLoadError('Could not load notifications.')
    } finally { if (mounted.current && request === sequence.current) setLoading(false) }
  }, [])
  useEffect(() => {
    mounted.current = true
    void load()
    const revalidate = () => { void load() }
    const interval = window.setInterval(revalidate, 30000)
    window.addEventListener(EVENT_NAME, revalidate)
    window.addEventListener(MARKETING_CHANGE_EVENT, revalidate)
    window.addEventListener('focus', revalidate)
    return () => { mounted.current = false; sequence.current++; window.clearInterval(interval); window.removeEventListener(EVENT_NAME, revalidate); window.removeEventListener(MARKETING_CHANGE_EVENT, revalidate); window.removeEventListener('focus', revalidate) }
  }, [load])
  const refresh = useCallback(() => { setLoading(true); setLoadError(''); void load() }, [load])
  const patch = useCallback(async (body: { action: 'read' | 'read-all'; id?: string }): Promise<boolean> => {
    try {
      const response = await fetch('/api/account/notifications', { method: 'PATCH', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      if (!response.ok) throw Error('Could not update notifications.')
      const result = await response.json()
      invalidateNotifications()
      const partial = result.marketingUnavailable && (body.action === 'read-all' || body.id && isMarketingNotification(body.id))
      if (partial && mounted.current) setLoadError('Some offer notifications could not be updated. Please try again.')
      return !partial
    } catch { if (mounted.current) setLoadError('Could not update notifications.'); return false }
  }, [])
  const markRead = useCallback((id: string) => patch({ action: 'read', id }), [patch])
  const markAllRead = useCallback(() => patch({ action: 'read-all' }), [patch])
  return { notifications, unreadCount, loading, loadError, refresh, markRead, markAllRead, recent: notifications.slice(0, PANEL_LIMIT) }
}
