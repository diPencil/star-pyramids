import { EventDetailPage } from '@/components/extended-pages'
import { events } from '@/data/content'

export function generateStaticParams() {
  return events.map((item) => ({ slug: item.slug }))
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) { return <EventDetailPage slug={(await params).slug} /> }
