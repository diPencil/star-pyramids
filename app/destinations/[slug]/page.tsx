import { DestinationDetailPage } from '@/components/extended-pages'
export default async function Page({ params }: { params: Promise<{ slug: string }> }) { return <DestinationDetailPage slug={(await params).slug} /> }
