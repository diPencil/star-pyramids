'use client'
import { usePathname } from 'next/navigation'
import { createContext, useContext } from 'react'
import { appearanceCss, isPublicAppearancePath, type AppearanceTokens } from '@/lib/website-appearance'
const AppearanceContext = createContext<AppearanceTokens | null>(null)

export function PublicAppearance({ tokens, children }: { tokens: AppearanceTokens; children: React.ReactNode }) {
  const path = usePathname()
  if (!isPublicAppearancePath(path ?? '/')) return <AppearanceContext.Provider value={null}>{children}</AppearanceContext.Provider>
  const css = appearanceCss(tokens)
  return <AppearanceContext.Provider value={tokens}><div className="public-appearance" style={{ display: tokens.background ? 'block' : 'contents' }}>{css && <style>{css}</style>}{children}</div></AppearanceContext.Provider>
}

export function PublicAppearancePortal({ children }: { children: React.ReactNode }) {
  const tokens = useContext(AppearanceContext)
  if (!tokens) return <>{children}</>
  return <div className="public-appearance" style={{ display: 'contents' }}>{children}</div>
}
