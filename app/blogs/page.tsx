import type { Metadata } from 'next'
import { BlogsPage } from '@/components/extended-pages'
import { getSiteUrl, getHreflangEntries } from '@/lib/seo'
import { getPublishedDbBlogs } from '@/lib/server/blogs'

export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = await getSiteUrl()
  const hreflang = await getHreflangEntries('/blogs')

  return {
    title: 'Egypt Travel Blog',
    description: 'Read the STAR PYRAMIDS blog for Egypt travel tips, destination guides, tour insights, and inspiration for your next journey.',
    alternates: { canonical: `${siteUrl}/blogs`, languages: hreflang },
  }
}

export default async function Page() {
  return <BlogsPage initialBlogs={await getPublishedDbBlogs()} />
}
