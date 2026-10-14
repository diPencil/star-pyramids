import type { ReactNode } from 'react'
import { ShowcaseHeroProvider } from './showcase-hero-context'
import { readPublicShowcase } from '@/lib/server/showcase-heroes'
import type { ShowcaseHeroId } from '@/lib/showcase-heroes'
export async function ServerShowcaseHero({ id, children }: { id: ShowcaseHeroId; children: ReactNode }) { return <ShowcaseHeroProvider state={await readPublicShowcase(id)}>{children}</ShowcaseHeroProvider> }
