'use client'
import { Children, createContext, isValidElement, useContext, type ReactNode } from 'react'
import { HOME_SECTIONS, originalPageContent, type PageSection, type PublicPageContent } from '@/lib/page-sections'
import { homeStrings } from '@/lib/homepage-copy'
import { useLocale } from './locale'

const PageContext = createContext<PublicPageContent | undefined>(undefined)
const SectionContext = createContext<PageSection | undefined>(undefined)
const defaults = originalPageContent()
export function PageContentProvider({ state, children }: { state?: PublicPageContent; children: ReactNode }) { return <PageContext.Provider value={state}>{children}</PageContext.Provider> }
export function usePageSection(id: string) { const state = useContext(PageContext); return (state ? state.content : defaults)?.sections.find((section) => section.id === id) }
export function useSectionContent() { return useContext(SectionContext) }
export function CmsPageSection({ id, children }: { id: string; children: ReactNode }) {
  const state = useContext(PageContext)
  const section = usePageSection(id)
  if ((state?.unavailable && !HOME_SECTIONS.find((s) => s.id === id)?.mandatory) || section?.visible === false) return null
  return <SectionContext.Provider value={section}>{children}</SectionContext.Provider>
}
export function OrderedPageSections({ children }: { children: ReactNode }) {
  const state = useContext(PageContext)
  const order = (state?.content ?? defaults).sections.map((s) => s.id)
  return <>{Children.toArray(children).sort((a, b) => {
    const id = (child: ReactNode) => isValidElement<{ id: string }>(child) ? child.props.id : ''
    return order.indexOf(id(a)) - order.indexOf(id(b))
  })}</>
}
type HomeCopy = { [K in keyof typeof homeStrings.en]: typeof homeStrings.en[K] extends readonly string[] ? readonly string[] : string }
export function useHomeCopy(): HomeCopy {
  const { locale } = useLocale()
  const state = useContext(PageContext)
  const base = homeStrings[locale] as HomeCopy
  if (locale === 'ar' || !state?.content) return base
  const copy = { ...base }
  for (const section of state.content.sections) for (const [key, value] of Object.entries(section.text[locale])) if (key in base && key !== 'viewAll') (copy as Record<string, unknown>)[key] = value
  return copy
}
