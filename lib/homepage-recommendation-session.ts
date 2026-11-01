'use client'

import { useCallback, useEffect, useState } from 'react'

export type RecommendationSession = { seed: number; slugs: string[] }
export const RECOMMENDATION_SESSION_KEY = 'star-pyramids:recommended:v1'
type SessionStorage = Pick<Storage, 'getItem' | 'setItem'>
let memorySession: RecommendationSession | null = null

export function readRecommendationSession(storage: SessionStorage | undefined, seed: () => number): RecommendationSession {
  try {
    const raw = storage?.getItem(RECOMMENDATION_SESSION_KEY)
    const saved = raw ? JSON.parse(raw) : null
    if (saved && Number.isInteger(saved.seed) && saved.seed >= 0 && saved.seed <= 0xffffffff && Array.isArray(saved.slugs) && saved.slugs.length <= 6 && saved.slugs.every((slug: unknown) => typeof slug === 'string' && slug.length > 0 && slug.length <= 160) && new Set(saved.slugs).size === saved.slugs.length) return { seed: saved.seed, slugs: [...saved.slugs] }
  } catch { /* Invalid or blocked storage falls back to a fresh session. */ }
  return { seed: seed() >>> 0, slugs: [] }
}

function browserStorage(): SessionStorage | undefined {
  try { return window.sessionStorage } catch { return undefined }
}

function save(session: RecommendationSession) {
  memorySession = session
  try { browserStorage()?.setItem(RECOMMENDATION_SESSION_KEY, JSON.stringify(session)) } catch { /* Keep the in-memory session. */ }
}

function randomSeed() {
  try { return window.crypto.getRandomValues(new Uint32Array(1))[0] } catch { return Math.floor(Math.random() * 0x100000000) }
}

export function useRecommendationSession() {
  const [session, setSession] = useState<RecommendationSession | null>(() => memorySession)
  useEffect(() => {
    const storage = browserStorage()
    const initial = memorySession ?? readRecommendationSession(storage, randomSeed)
    save(initial); setSession(initial)
  }, [])
  const remember = useCallback((slugs: string[]) => {
    if (!session || session.slugs.length === slugs.length && session.slugs.every((slug, index) => slug === slugs[index])) return
    const next = { ...session, slugs: [...slugs] }
    save(next); setSession(next)
  }, [session])
  return { session, remember }
}

/** Deterministic shuffle per session, independent of API response order. */
export function sessionRecommendedOrder<T extends { slug: string }>(rows: readonly T[], session: RecommendationSession): T[] {
  const bySlug = new Map(rows.map(row => [row.slug, row]))
  const pinned: T[] = []
  for (const slug of session.slugs) {
    const row = bySlug.get(slug)
    if (row) { pinned.push(row); bySlug.delete(slug) }
  }
  const remaining = [...bySlug.values()].sort((a, b) => a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0)
  let state = session.seed >>> 0
  const random = () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = Math.imul(state ^ state >>> 15, state | 1)
    value ^= value + Math.imul(value ^ value >>> 7, value | 61)
    return ((value ^ value >>> 14) >>> 0) / 0x100000000
  }
  for (let index = remaining.length - 1; index > 0; index--) {
    const next = Math.floor(random() * (index + 1))
    ;[remaining[index], remaining[next]] = [remaining[next], remaining[index]]
  }
  return [...pinned, ...remaining]
}
