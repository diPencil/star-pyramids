'use client'

import { useEffect, useRef, useState } from 'react'
import type { LiveAction, LiveThread } from './live-chat-contract'

const pendingKey = 'sp-live-chat-pending-request'
type Submission = Omit<LiveAction, 'requestId'>
class TransportError extends Error {
  constructor(public status: number) { super(status === 429 ? 'rate' : 'unavailable') }
}

/** Persist only an opaque retry ID and fingerprint, never message/contact contents. */
export class LiveChatTransport {
  private pending: { fingerprint: string; requestId: string } | null = null
  private etag: string | null = null
  private history: LiveThread = null
  constructor(private request: typeof fetch = fetch, private storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>) {
    // Native browser fetch requires its global receiver, not this transport instance.
    this.request = request.bind(globalThis)
  }

  private async json(url: string, init?: RequestInit) {
    const response = await this.request(url, { ...init, credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(10000) })
    if (!response.ok) throw new TransportError(response.status)
    return response.json()
  }

  async read(): Promise<LiveThread> {
    const response = await this.request('/api/live-chat', { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(10000), headers: this.etag ? { 'If-None-Match': this.etag } : {} })
    if (response.status === 304) return this.history
    if (!response.ok) throw new TransportError(response.status)
    this.history = (await response.json()).thread as LiveThread
    this.etag = response.headers.get('etag')
    return this.history
  }

  async submit(input: Submission): Promise<LiveThread> {
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(input)))
    const fingerprint = Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('')
    if (!this.pending) {
      try {
        const stored = JSON.parse(this.storage?.getItem(pendingKey) || 'null')
        if (stored && stored.fingerprint === fingerprint && typeof stored.requestId === 'string') this.pending = stored
      } catch { /* In-memory retries still work when storage is blocked. */ }
    }
    if (!this.pending || this.pending.fingerprint !== fingerprint) this.pending = { fingerprint, requestId: crypto.randomUUID() }
    try { this.storage?.setItem(pendingKey, JSON.stringify(this.pending)) } catch { /* No tracking or consent dependency. */ }
    // Bootstrap is safe to repeat; it never rotates an already-valid guest credential.
    const bootstrap = () => this.json('/api/live-chat/session', { method: 'POST' })
    if (typeof navigator !== 'undefined' && navigator.locks) await navigator.locks.request('sp-live-chat-session', bootstrap)
    else await bootstrap()
    let data: { thread: LiveThread }
    try {
      data = await this.json('/api/live-chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...input, requestId: this.pending.requestId }) })
    } catch (error) {
      if (error instanceof TransportError && error.status === 409) {
        // An ownership change/expired credential must not leave retries stuck forever.
        // Do not auto-send a replacement: the visitor must explicitly retry.
        this.pending = null
        try { this.storage?.removeItem(pendingKey) } catch { /* In-memory fallback. */ }
      }
      throw error
    }
    this.pending = null
    this.etag = null
    this.history = data.thread
    try { this.storage?.removeItem(pendingKey) } catch { /* A delivered request remains idempotent server-side. */ }
    return data.thread as LiveThread
  }
}

export function useLiveChat(open: boolean) {
  const [thread, setThread] = useState<LiveThread>(null)
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState(false)
  const transport = useRef<LiveChatTransport | null>(null)
  const writing = useRef(false)
  const version = useRef(0)
  const active = useRef(true)
  const client = () => {
    if (!transport.current) {
      let storage: Storage | undefined
      try { storage = window.sessionStorage } catch { /* In-memory fallback. */ }
      transport.current = new LiveChatTransport(fetch, storage)
    }
    return transport.current
  }
  useEffect(() => {
    active.current = true
    return () => { active.current = false; version.current++ }
  }, [])
  useEffect(() => {
    if (!open) return
    let cancelled = false
    let reading = false
    const refresh = async () => {
      if (reading || writing.current || document.hidden) return
      reading = true
      const revision = ++version.current
      try {
        const next = await client().read()
        if (!cancelled && revision === version.current) { setThread(next); setError(false) }
      } catch { if (!cancelled && revision === version.current) setError(true) }
      finally { reading = false }
    }
    void refresh()
    const timer = window.setInterval(() => void refresh(), 10000)
    document.addEventListener('visibilitychange', refresh)
    return () => { cancelled = true; window.clearInterval(timer); document.removeEventListener('visibilitychange', refresh) }
  }, [open])

  const send = async (input: Submission) => {
    if (writing.current) return false
    writing.current = true
    version.current++
    setBusy(true)
    setError(false)
    try {
      const next = await client().submit(input)
      if (active.current) setThread(next)
      return true
    } catch { if (active.current) setError(true); return false }
    finally { writing.current = false; if (active.current) setBusy(false) }
  }
  return { thread, error, busy, send }
}
