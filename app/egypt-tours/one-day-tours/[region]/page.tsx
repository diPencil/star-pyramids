import { getPublishedOneDayDestinations } from '@/lib/server/destinations'
import { OneDayDestinationPage } from '@/components/site'

export async function generateStaticParams() {
  // DB-authoritative static params; no pre-render when DB is unreachable.
  try {
    const items = await getPublishedOneDayDestinations()
    return items.map((item) => ({ region: item.slug }))
  } catch {
    return []
  }
}

export default async function Page({ params }: { params: Promise<{ region: string }> }) {
  const { region: regionSlug } = await params
  return <OneDayDestinationPage slug={regionSlug} />
}
