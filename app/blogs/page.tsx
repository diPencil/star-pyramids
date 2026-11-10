import type { Metadata } from 'next'
import { pageContentMetadata } from '@/lib/server/cms/page-content-metadata'
import { ServerShowcaseHero } from '@/components/cms/heroes/server-showcase-hero'
import { BlogsPage } from '@/components/extended-pages'
import { getSiteUrl, getHreflangEntries } from '@/lib/seo/seo'
import { getPublishedDbBlogs } from '@/lib/server/editorial/blogs'

export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = await getSiteUrl()
  const hreflang = await getHreflangEntries('/blogs')

  return {
    title: 'Egypt Travel Blog',
    description: 'Read the STAR PYRAMIDS blog for Egypt travel tips, destination guides, tour insights, and inspiration for your next journey.',
    alternates: { canonical: `${siteUrl}/blogs`, languages: hreflang },
    ...(await pageContentMetadata('blogs')),
  }
}

export default async function Page() {
  return <ServerShowcaseHero id="blogs"><BlogsPage initialBlogs={await getPublishedDbBlogs()} /></ServerShowcaseHero>
}
