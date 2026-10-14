import { redirect } from 'next/navigation'
import { requireStaff } from '@/lib/server/guards'
import { hasPermission } from '@/lib/server/auth'
import { readFaqHeroState } from '@/lib/server/faq-hero'
import { FAQPage } from '@/components/extended-pages'
import { FaqHeroProvider } from '@/components/faq-hero-context'
import { InitialLocaleProvider, LocaleProvider } from '@/components/locale'
import { sanitizeLocale } from '@/lib/locale-config'
import { originalFaqHero } from '@/lib/faq-hero'

export const metadata = { robots: { index: false, follow: false, nocache: true } }
export default async function Preview({ searchParams }: { searchParams: Promise<{ locale?: string }> }) {
  const user = await requireStaff()
  if (!hasPermission(user, 'settings.view')) redirect('/admin')
  const state = await readFaqHeroState()
  const { locale } = await searchParams
  return <InitialLocaleProvider locale={sanitizeLocale(locale)} preview><LocaleProvider initialLocale={sanitizeLocale(locale)}><FaqHeroProvider state={{ hidden: false, content: state.draft ?? state.published ?? originalFaqHero() }}><div inert><FAQPage /></div></FaqHeroProvider></LocaleProvider></InitialLocaleProvider>
}
