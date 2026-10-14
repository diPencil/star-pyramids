'use client'
import { createContext, useContext, type ReactNode } from 'react'
import type { PublicShowcaseHero } from '@/lib/showcase-heroes'
const Context = createContext<PublicShowcaseHero | undefined>(undefined)
export function ShowcaseHeroProvider({ state, children }: { state: PublicShowcaseHero; children: ReactNode }) { return <Context.Provider value={state}>{children}</Context.Provider> }
export function useShowcaseHero() { return useContext(Context) }
