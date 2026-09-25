import { BlogDetailPage } from '@/components/extended-pages'
import { blogs } from '@/data/content'

export function generateStaticParams() {
  return blogs.map((item) => ({ slug: item.slug }))
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) { return <BlogDetailPage slug={(await params).slug} /> }
