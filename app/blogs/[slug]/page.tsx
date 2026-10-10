import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { BlogDetailPage } from '@/components/extended-pages'
import { findBlogBySlug, listBlogSlugs } from '@/lib/server/blogs'
import { generateBlogPostingJsonLd, generateBreadcrumbJsonLd, renderJsonLd } from '@/lib/structured-data'
import { getSiteUrl, getHreflangEntries } from '@/lib/seo'

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
  const siteUrl = await getSiteUrl()
  const hreflang = await getHreflangEntries(`/blogs/${blog.slug}`)
  const title = `${blog.title} | STAR PYRAMIDS`
  const description = blog.excerpt?.trim()
    ? blog.excerpt.slice(0, 160)
    : `Read ${blog.title} on the STAR PYRAMIDS blog. Travel tips, guides, and insights for Egypt from our local experts.`
  return {
    title,
    description,
    alternates: { canonical: `${siteUrl}/blogs/${blog.slug}`, languages: hreflang },
    openGraph: {
      title,
      description,
      type: 'article',
      images: blog.image ? [{ url: blog.image }] : [],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  }
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const blog = await findBlogBySlug(slug)
  if (!blog) notFound()

  const siteUrl = await getSiteUrl()
  const blogJsonLd = generateBlogPostingJsonLd(blog)
  const breadcrumbJsonLd = generateBreadcrumbJsonLd([
    { name: 'Home', url: siteUrl },
    { name: 'Blogs', url: `${siteUrl}/blogs` },
    { name: blog.title, url: `${siteUrl}/blogs/${blog.slug}` },
  ])

  return (
    <>
      {renderJsonLd(blogJsonLd)}
      {renderJsonLd(breadcrumbJsonLd)}
      <BlogDetailPage slug={slug} />
    </>
  )
}
