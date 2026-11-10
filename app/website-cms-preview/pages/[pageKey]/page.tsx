import { notFound, redirect } from 'next/navigation'
import { requireStaff } from '@/lib/server/auth/guards'
import { hasPermission } from '@/lib/server/auth/auth'
import { readPageState } from '@/lib/server/cms/page-sections'
import { readHeroState } from '@/lib/server/cms/heroes/website-heroes'
import { publicHeroState } from '@/lib/cms/heroes/website-heroes'
import { originalPageContent } from '@/lib/cms/page-sections'
import { InitialLocaleProvider } from '@/components/locale'
import { RebuiltHomePage } from '@/components/home/homepage'
import { sanitizeLocale } from '@/lib/i18n/locale-config'
import { isPageDocumentId } from '@/lib/cms/additional-page-content'
import { FAQPage } from '@/components/extended-pages'
import { CmsPolicyPage } from '@/components/cms/cms-additional-pages'
import { FaqHeroProvider } from '@/components/cms/heroes/faq-hero-context'
import { readFaqHeroState } from '@/lib/server/cms/heroes/faq-hero'
import { publicEditorialHero } from '@/lib/cms/heroes/editorial-hero-definitions'
import { InformationPage } from '@/components/content/information-page'
import { isTemplatePageId } from '@/lib/cms/templates/template-presentation'
import { PresentationProvider } from '@/components/cms/presentation-content-context'
import { ServerTemplatePreview } from '@/components/cms/server-template-preview'
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
