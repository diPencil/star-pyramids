import { destinations } from '@/data/content'
import { getPublishedOneDayDestinations } from '@/data/tours'
import { OneDayDestinationPage } from '@/components/site'

export function generateStaticParams() {
  return getPublishedOneDayDestinations(destinations).map((item) => ({ region: item.slug }))
}

export default async function Page({ params }: { params: Promise<{ region: string }> }) {
  const { region: regionSlug } = await params
  return <OneDayDestinationPage slug={regionSlug} />
}
