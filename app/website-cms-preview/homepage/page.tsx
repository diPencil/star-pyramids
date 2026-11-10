import { redirect } from 'next/navigation'
import { requireStaff } from '@/lib/server/auth/guards'
import { hasPermission } from '@/lib/server/auth/auth'
import { readHeroState } from '@/lib/server/cms/heroes/website-heroes'
import { HomepageHeroPreview } from '@/components/home/homepage-hero-preview'
import { sanitizeLocale } from '@/lib/i18n/locale-config'
import { readPublishedPage } from '@/lib/server/cms/page-sections'
export const metadata = { robots: { index: false, follow: false, nocache: true } }
export default async function Preview({ searchParams }: { searchParams: Promise<{ locale?: string }> }) {
  const user = await requireStaff()
  if (!hasPermission(user, 'settings.view')) redirect('/admin')
  const state = await readHeroState()
  const { locale } = await searchParams
  return <HomepageHeroPreview initialLocale={sanitizeLocale(locale)} initialContent={state.draft ?? state.published} pageContent={await readPublishedPage()} />
}
