import { DestinationDetailPage } from '@/components/extended-pages'
import { destinations } from '@/data/content'

export function generateStaticParams() {
  return destinations.map((item) => ({ slug: item.slug }))
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) { return <DestinationDetailPage slug={(await params).slug} /> }
