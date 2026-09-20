import { EventDetailPage } from '@/components/extended-pages'
export default async function Page({ params }: { params: Promise<{ slug: string }> }) { return <EventDetailPage slug={(await params).slug} /> }
