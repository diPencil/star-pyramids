'use client'
import { useEffect, useRef, useState } from 'react'
import { invalidateNotifications } from './customer-notifications'
import { currentNotification, isMarketingNotification, MARKETING_CHANGE_EVENT, type MarketingNotification } from './marketing-notifications'

const READ_KEY = 'sp-marketing-offer-reads-v2'
function guestReads(): Set<string> {
  try { const rows: unknown = JSON.parse(localStorage.getItem(READ_KEY) ?? '[]'); return new Set(Array.isArray(rows) ? rows.filter((id): id is string => typeof id === 'string' && isMarketingNotification(id)) : []) }
  catch { return new Set() }
}

/** Auth-bound state; an old guest/customer request cannot overwrite a newer session's feed. */
export function useMarketingNotifications(userId: string | null | undefined) {
  const [state, setState] = useState<{ owner: string | null | undefined; items: MarketingNotification[]; loading: boolean; error: string }>({ owner: undefined, items: [], loading: true, error: '' })
  const sequence = useRef(0)
  const ownerGeneration = useRef(0)
  const reload = useRef<() => Promise<void>>(async () => {})
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let active = true
    ownerGeneration.current++
    const owner = userId
    setState({ owner, items: [], loading: true, error: '' })
    if (owner === undefined) return
    const load = async () => {
      const request = ++sequence.current
      try {
        const response = await fetch(owner ? '/api/account/notifications' : '/api/marketing-notifications', { credentials: 'same-origin', cache: 'no-store' })
        if (!response.ok) throw Error('Could not load offers.')
        const body = await response.json()
        if (owner && body.marketingUnavailable) throw Error('Could not load offers.')
        if (!Array.isArray(body.notifications)) throw Error('Could not load offers.')
        const read = owner ? new Set<string>() : guestReads()
        const items = body.notifications.filter((item: MarketingNotification) => item && isMarketingNotification(item.id) && typeof item.title === 'string' && typeof item.message === 'string' && typeof item.href === 'string' && /^\/(special-offers|egypt-tours)\/[a-z0-9-]+$/.test(item.href) && currentNotification(item))
          .map((item: MarketingNotification) => ({ ...item, readAt: owner ? item.readAt : read.has(item.id) ? item.createdAt : null }))
        if (active && request === sequence.current) setState({ owner, items, loading: false, error: '' })
      } catch { if (active && request === sequence.current) setState({ owner, items: [], loading: false, error: 'Could not load offers.' }) }
    }
    reload.current = load
    void load()
    const interval = window.setInterval(() => { void load() }, 30000)
    const changed = () => { void load() }
    const storage = (event: StorageEvent) => { if (event.key === READ_KEY) void load() }
    window.addEventListener('focus', changed)
    window.addEventListener(MARKETING_CHANGE_EVENT, changed)
    if (owner) window.addEventListener('sp-customer-notifications', changed)
    window.addEventListener('storage', storage)
    return () => { active = false; sequence.current++; ownerGeneration.current++; window.clearInterval(interval); window.removeEventListener('focus', changed); window.removeEventListener(MARKETING_CHANGE_EVENT, changed); window.removeEventListener('sp-customer-notifications', changed); window.removeEventListener('storage', storage) }
  }, [userId])
  const visible = state.owner === userId ? state : { owner: userId, items: [], loading: true, error: '' }
  const markRead = async (id?: string) => {
    if (busy || userId === undefined) return
    setBusy(true)
    const identity = ownerGeneration.current, owner = userId
    try {
      if (owner) {
        const response = await fetch('/api/account/notifications', { method: 'PATCH', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(id ? { action: 'read', id } : { action: 'read-offers' }) })
        if (!response.ok) throw Error('Could not mark offers read.')
        if (identity !== ownerGeneration.current) return
        invalidateNotifications()
        await reload.current()
        return
      } else {
        const reads = guestReads()
        visible.items.filter(item => !id || item.id === id).forEach(item => reads.add(item.id))
        try { localStorage.setItem(READ_KEY, JSON.stringify([...reads].slice(-1000))) } catch { /* Read state remains usable for this session. */ }
      }
      if (!owner) sequence.current++
      if (identity === ownerGeneration.current) setState(current => current.owner === owner ? { ...current, items: current.items.map(item => !id || item.id === id ? { ...item, readAt: item.readAt ?? new Date().toISOString() } : item), error: '' } : current)
    } catch { if (identity === ownerGeneration.current) setState(current => ({ ...current, error: 'Could not mark offers read.' })) }
    finally { setBusy(false) }
  }
  return { ...visible, busy, unreadCount: visible.items.filter(item => !item.readAt).length, refresh: () => { void reload.current() }, markRead, markAllRead: () => markRead() }
}
