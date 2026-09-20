import { BlogDetailPage } from '@/components/extended-pages'
export default async function Page({ params }: { params: Promise<{ slug: string }> }) { return <BlogDetailPage slug={(await params).slug} /> }
