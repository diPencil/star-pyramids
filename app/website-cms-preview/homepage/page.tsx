import { redirect } from 'next/navigation'
import { requireStaff } from '@/lib/server/guards'
import { hasPermission } from '@/lib/server/auth'
import { readHeroState } from '@/lib/server/website-heroes'
import { RebuiltHomePage } from '@/components/homepage'
import { sanitizeLocale } from '@/lib/locale-config'
import { InitialLocaleProvider } from '@/components/locale'
export const metadata = { robots: { index: false, follow: false, nocache: true } }
export default async function Preview({ searchParams }: { searchParams: Promise<{ locale?: string }> }) {
  const user = await requireStaff()
  if (!hasPermission(user, 'settings.view')) redirect('/admin')
  const state = await readHeroState()
  const { locale } = await searchParams
  return <InitialLocaleProvider locale={sanitizeLocale(locale)} preview><div inert><RebuiltHomePage initialLocale={sanitizeLocale(locale)} hero={{ hidden: false, content: state.draft ?? state.published }} /></div></InitialLocaleProvider>
}
