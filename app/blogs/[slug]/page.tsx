import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { BlogDetailPage } from '@/components/extended-pages'
import { findBlogBySlug, getPublishedDbBlogs, listBlogSlugs } from '@/lib/server/blogs'
import { generateBlogPostingJsonLd, generateBreadcrumbJsonLd, renderJsonLd } from '@/lib/structured-data'
import { getSiteUrl } from '@/lib/seo'
import { dynamicSeo, recordStructuredDataEnabled } from '@/lib/dynamic-seo'

export async function generateStaticParams() {
  const slugs = await listBlogSlugs()
  return slugs.map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const blog = await findBlogBySlug(slug)
  if (!blog) {
    return { title: 'Blog not found', description: 'This article is no longer available.', robots: { index: false, follow: false } }
  }
  return dynamicSeo(blog, 'blog', '/blogs')
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const [blog, publishedBlogs] = await Promise.all([findBlogBySlug(slug), getPublishedDbBlogs()])
  if (!blog) notFound()

  const siteUrl = await getSiteUrl()
  const schemaEnabled = await recordStructuredDataEnabled('blog', blog.slug)
  const blogJsonLd = generateBlogPostingJsonLd(blog)
  const breadcrumbJsonLd = generateBreadcrumbJsonLd([
    { name: 'Home', url: siteUrl },
    { name: 'Blogs', url: `${siteUrl}/blogs` },
    { name: blog.title, url: `${siteUrl}/blogs/${blog.slug}` },
  ])

  return (
    <>
      {schemaEnabled && renderJsonLd(blogJsonLd)}
      {schemaEnabled && renderJsonLd(breadcrumbJsonLd)}
      <BlogDetailPage slug={slug} initialBlogs={publishedBlogs} />
    </>
  )
}
