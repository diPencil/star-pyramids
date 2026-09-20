import { OfferDetailPage } from '@/components/extended-pages'
export default async function Page({ params }: { params: Promise<{ slug: string }> }) { return <OfferDetailPage slug={(await params).slug} /> }
