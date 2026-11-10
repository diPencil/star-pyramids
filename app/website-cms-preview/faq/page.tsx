import { redirect } from 'next/navigation'
import { requireStaff } from '@/lib/server/auth/guards'
import { hasPermission } from '@/lib/server/auth/auth'
import { readFaqHeroState } from '@/lib/server/cms/heroes/faq-hero'
import { FAQPage } from '@/components/extended-pages'
import { FaqHeroProvider } from '@/components/cms/heroes/faq-hero-context'
import { InitialLocaleProvider, LocaleProvider } from '@/components/locale'
import { sanitizeLocale } from '@/lib/i18n/locale-config'
import { originalFaqHero } from '@/lib/cms/heroes/faq-hero'

export const metadata = { robots: { index: false, follow: false, nocache: true } }
export default async function Preview({ searchParams }: { searchParams: Promise<{ locale?: string }> }) {
  const user = await requireStaff()
  if (!hasPermission(user, 'settings.view')) redirect('/admin')
  const state = await readFaqHeroState()
  const { locale } = await searchParams
  return <InitialLocaleProvider locale={sanitizeLocale(locale)} preview><LocaleProvider initialLocale={sanitizeLocale(locale)}><FaqHeroProvider state={{ hidden: false, content: state.draft ?? state.published ?? originalFaqHero() }}><div inert><FAQPage /></div></FaqHeroProvider></LocaleProvider></InitialLocaleProvider>
}
