import { notFound, redirect } from 'next/navigation'
import { requireStaff } from '@/lib/server/guards'
import { hasPermission } from '@/lib/server/auth'
import { readPageState } from '@/lib/server/page-sections'
import { readHeroState } from '@/lib/server/website-heroes'
import { publicHeroState } from '@/lib/website-heroes'
import { originalPageContent } from '@/lib/page-sections'
import { InitialLocaleProvider } from '@/components/locale'
import { RebuiltHomePage } from '@/components/homepage'
import { sanitizeLocale } from '@/lib/locale-config'
import { isPageDocumentId } from '@/lib/additional-page-content'
import { FAQPage } from '@/components/extended-pages'
import { CmsPolicyPage } from '@/components/cms-additional-pages'
import { FaqHeroProvider } from '@/components/faq-hero-context'
import { readFaqHeroState } from '@/lib/server/faq-hero'
import { publicEditorialHero } from '@/lib/editorial-hero-definitions'
import { InformationPage } from '@/components/information-page'
import { isTemplatePageId } from '@/lib/template-presentation'
import { PresentationProvider } from '@/components/presentation-content-context'
import { ServerTemplatePreview } from '@/components/server-template-preview'
export const metadata = { robots: { index: false, follow: false, nocache: true } }
export default async function Preview({ params, searchParams }: { params: Promise<{ pageKey: string }>; searchParams: Promise<{ locale?: string }> }) {
  const user = await requireStaff()
  if (!hasPermission(user, 'settings.view')) redirect('/admin')
  const { pageKey } = await params
  if (!isPageDocumentId(pageKey)) notFound()
  const [state, query] = await Promise.all([readPageState(pageKey), searchParams])
  const locale = sanitizeLocale(query.locale)
  const pageContent = { content: state.draft ?? state.published ?? originalPageContent(pageKey) }
  const content = isTemplatePageId(pageKey) ? <PresentationProvider states={{ [pageKey]: pageContent }}><ServerTemplatePreview id={pageKey} /></PresentationProvider> : pageKey === 'homepage' ? <RebuiltHomePage initialLocale={locale} hero={publicHeroState(await readHeroState())} pageContent={pageContent} /> : pageKey === 'faq' ? <FaqHeroProvider state={publicEditorialHero('faq', await readFaqHeroState())}><FAQPage pageContent={pageContent} /></FaqHeroProvider> : pageKey === 'guide' || pageKey === 'accessible' ? <FaqHeroProvider state={publicEditorialHero(pageKey, await readFaqHeroState(pageKey))}><InformationPage id={pageKey} pageContent={pageContent} /></FaqHeroProvider> : <CmsPolicyPage pageId={pageKey} state={pageContent} />
  return <InitialLocaleProvider locale={locale} preview><div inert>{content}</div></InitialLocaleProvider>
}
