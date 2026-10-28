import { TripBuilder } from '@/components/admin/trip-builder'
import { readPublishedAppearance } from '@/lib/server/website-appearance'

export default async function TripBuilderPage({ searchParams }: { searchParams: Promise<{ slug?: string | string[] }> }) {
  const value = (await searchParams).slug
  const slug = (Array.isArray(value) ? value[0] : value) ?? null
  return <TripBuilder key={slug ?? 'new'} initialSlug={slug} previewAppearance={await readPublishedAppearance()} />
}
