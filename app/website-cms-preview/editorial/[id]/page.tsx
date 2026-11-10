import { notFound, redirect } from 'next/navigation'
import { requireStaff } from '@/lib/server/auth/guards'
import { hasPermission } from '@/lib/server/auth/auth'
import { readFaqHeroState } from '@/lib/server/cms/heroes/faq-hero'
import { FAQPage, DestinationsPage } from '@/components/extended-pages'
import { FaqHeroProvider } from '@/components/cms/heroes/faq-hero-context'
import { InitialLocaleProvider, LocaleProvider } from '@/components/locale'
import { sanitizeLocale } from '@/lib/i18n/locale-config'
import { isEditorialHeroId, originalEditorialHero } from '@/lib/cms/heroes/editorial-hero-definitions'
import { InformationPage } from '@/components/content/information-page'
import { isInformationPageId } from '@/lib/cms/information-pages'
export const metadata = { robots: { index: false, follow: false, nocache: true } }
export default async function Preview({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ locale?: string }> }) {
  const user = await requireStaff()
  if (!hasPermission(user, 'settings.view')) redirect('/admin')
  const { id } = await params
  if (!isEditorialHeroId(id)) notFound()
  const state = await readFaqHeroState(id)
  const { locale } = await searchParams
  const content = isInformationPageId(id) ? <InformationPage id={id} /> : id === 'faq' ? <FAQPage /> : <DestinationsPage />
  return <InitialLocaleProvider locale={sanitizeLocale(locale)} preview><LocaleProvider initialLocale={sanitizeLocale(locale)}><FaqHeroProvider state={{ hidden: false, content: state.draft ?? state.published ?? originalEditorialHero(id) }}><div inert>{content}</div></FaqHeroProvider></LocaleProvider></InitialLocaleProvider>
}
