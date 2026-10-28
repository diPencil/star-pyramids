'use client'
import { createContext, useContext, type ReactNode } from 'react'
import type { BrandSettings } from '@/lib/brand-settings'
const BrandContext = createContext<BrandSettings | null>(null)
export function BrandProvider({ initial, children }: { initial: BrandSettings; children: ReactNode }) { return <BrandContext.Provider value={initial}>{children}</BrandContext.Provider> }
export const useBrandSeed = () => useContext(BrandContext)
