import { notFound } from 'next/navigation'
import { BlogDetailPage } from '@/components/extended-pages'
import { findBlogBySlug, listBlogSlugs } from '@/lib/server/blogs'

export async function generateStaticParams() {
  const slugs = await listBlogSlugs()
  return slugs.map((slug) => ({ slug }))
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  // DB-authoritative catalogue: unknown slugs are real 404s.
  if (!(await findBlogBySlug(slug))) notFound()
  return <BlogDetailPage slug={slug} />
}
