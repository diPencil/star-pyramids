'use client'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { PublicNavigation } from '@/lib/navigation'
const NavigationContext = createContext<PublicNavigation | null>(null)
export function NavigationProvider({ initial, children }: { initial: PublicNavigation | null; children: ReactNode }) {
  const [navigation, setNavigation] = useState(initial)
  useEffect(() => {
    let active = true; let sequence = 0
    const refresh = async () => {
      const current = ++sequence
      try { const response = await fetch('/api/navigation', { cache: 'no-store' }); if (!response.ok) return; const data = await response.json(); if (active && current === sequence) setNavigation(data.navigation) } catch { /* Preserve last successful publication; never restore defaults on fetch failure. */ }
    }
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void refresh() }, 30000)
    window.addEventListener('focus', refresh); window.addEventListener('sp-navigation-published', refresh)
    return () => { active = false; clearInterval(timer); window.removeEventListener('focus', refresh); window.removeEventListener('sp-navigation-published', refresh) }
  }, [initial])
  useEffect(() => setNavigation(initial), [initial])
  return <NavigationContext.Provider value={navigation}>{children}</NavigationContext.Provider>
}
export const usePublishedNavigation = () => useContext(NavigationContext)
