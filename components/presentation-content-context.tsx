'use client'
import { Children, createContext, isValidElement, useContext, type ReactNode } from 'react'
import { originalPageContent, type PublicPageContent } from '@/lib/page-sections'
import { originalTemplateContent, templateSections, type TemplatePageId } from '@/lib/template-presentation'
import { useLocale } from './locale'
import { cmsIcons } from './cms-icons'

export type PresentationStates = Partial<Record<TemplatePageId | 'faq', PublicPageContent>>
const Context = createContext<PresentationStates>({})
export function useSharedFaqs(limit: number) {
  const state = useContext(Context).faq
  const { locale } = useLocale()
  const content = state === undefined ? originalPageContent('faq') : state.content
  const section = content?.sections.find(section => section.id === 'questions')
  if (state?.unavailable || section?.visible === false) return []
  return (section?.items ?? []).filter(item => item.visible).slice(0, limit).map(item => [item.text[locale === 'ar' ? 'en' : locale].question, item.text[locale === 'ar' ? 'en' : locale].answer])
}
export function PresentationProvider({ states, children }: { states: PresentationStates; children: ReactNode }) { const parent = useContext(Context); return <Context.Provider value={{ ...parent, ...states }}>{children}</Context.Provider> }
export function useSharedCopy<T extends Record<string, string>>(original: T, sectionId: 'navigation' | 'footer' | 'help'): { [K in keyof T]: string } {
  const cms = usePresentation('shared')
  const { locale } = useLocale()
  const section = cms.content?.sections.find((section) => section.id === sectionId)
  if (locale === 'ar' || cms.unavailable || !section) return original
  const translated = section.text[locale]
  return { ...original, ...Object.fromEntries(Object.entries(translated).filter(([key]) => key in original)) }
}
export function usePresentation(pageId: TemplatePageId) {
  const states = useContext(Context)
  const { locale } = useLocale()
  const state = states[pageId]
  const content = state === undefined ? originalTemplateContent(pageId) : state.content
  const section = (id: string) => content?.sections.find((section) => section.id === id)
  return {
    content, unavailable: state?.unavailable,
    cards(id: string) { const language = locale === 'ar' ? 'en' : locale; return state?.unavailable ? [] : (section(id)?.items ?? []).filter(item => item.visible).map(item => ({ id: item.id, title: item.text[language].heading, copy: item.text[language].description, number: item.text[language].step, Icon: cmsIcons[item.icon ?? 'Star'] })) },
    items<T>(id: string, fallback: T[]): T[] {
      if (locale === 'ar' && state === undefined) return fallback
      const items = section(id)?.items
      if (!items || state?.unavailable) return state === undefined ? fallback : []
      const language = locale === 'ar' ? 'en' : locale
      return items.filter((item) => item.visible).map((item) => {
        const text = item.text[language]
        if (Array.isArray(fallback[0])) return [text.step, text.heading, text.description] as T
        return { title: text.heading, copy: text.description, number: text.step, icon: item.icon ? cmsIcons[item.icon] : undefined, href: item.href, image: item.image } as T
      })
    },
    text(id: string, key: string, fallback: string) { if (locale === 'ar') return fallback; return state?.unavailable ? '' : section(id)?.text[locale]?.[key] ?? (state === undefined ? fallback : '') },
    media(id: string, key: string, fallback: string) { return section(id)?.media?.[key] ?? (state === undefined ? fallback : '') },
    link(id: string, key: string, fallback: string) { return section(id)?.links?.[key] ?? (state === undefined ? fallback : '') },
  }
}
export function PresentationSection({ pageId, id, children }: { pageId: TemplatePageId; id: string; children: ReactNode }) {
  const cms = usePresentation(pageId)
  const section = cms.content?.sections.find((section) => section.id === id)
  const required = templateSections(pageId).find(section => section.id === id)?.mandatory
  if (!required && (section?.visible === false || cms.unavailable)) return null
  return <>{children}</>
}
export function PresentationOrder({ pageId, children }: { pageId: TemplatePageId; children: ReactNode }) {
  const cms = usePresentation(pageId)
  const nodes = Children.toArray(children)
  const order = cms.content?.sections.map((section) => section.id) ?? []
  const editable = (node: ReactNode) => isValidElement<{ id: string }>(node) && node.type === PresentationSection
  const sections = nodes.filter(editable).sort((a, b) => order.indexOf((a as React.ReactElement<{ id: string }>).props.id) - order.indexOf((b as React.ReactElement<{ id: string }>).props.id))
  return <>{nodes.map((node) => editable(node) ? sections.shift() : node)}</>
}
