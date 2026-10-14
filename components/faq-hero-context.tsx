'use client'
import { createContext, useContext, type ReactNode } from 'react'
import type { PublicFaqHero } from '@/lib/faq-hero'

const FaqHeroContext = createContext<PublicFaqHero | undefined>(undefined)
export function FaqHeroProvider({ children, state }: { children: ReactNode; state: PublicFaqHero }) {
  return <FaqHeroContext.Provider value={state}>{children}</FaqHeroContext.Provider>
}
export function useFaqHero() { return useContext(FaqHeroContext) }
