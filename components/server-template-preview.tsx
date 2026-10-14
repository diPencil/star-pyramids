import { AboutPage, ContactPage, CarsPage, DestinationsPage, BlogsPage, OffersPage, BlogDetailPage, DestinationDetailPage, EventDetailPage } from './extended-pages'
import { CampaignDetail } from './offer-campaigns'
import { ServerShowcaseHero } from './server-showcase-hero'
import { FaqHeroProvider } from './faq-hero-context'
import { readFaqHeroState } from '@/lib/server/faq-hero'
import { publicEditorialHero } from '@/lib/editorial-hero-definitions'
import { getPublishedDbBlogs } from '@/lib/server/blogs'
import { getPublishedDbOffers } from '@/lib/server/offers'
import { db } from '@/lib/server/db'
import type { TemplatePageId } from '@/lib/template-presentation'
import { SiteShell, HelpCTA } from './site'

export async function ServerTemplatePreview({ id }: { id: TemplatePageId }) {
  if (id === 'shared') return <SiteShell><main className="section container"><HelpCTA /></main></SiteShell>
  if (id === 'about') return <ServerShowcaseHero id="about"><AboutPage /></ServerShowcaseHero>
  if (id === 'contact') return <ServerShowcaseHero id="contact"><ContactPage /></ServerShowcaseHero>
  if (id === 'cars') return <ServerShowcaseHero id="cars"><CarsPage /></ServerShowcaseHero>
  if (id === 'offers') return <ServerShowcaseHero id="offers"><OffersPage /></ServerShowcaseHero>
  if (id === 'blogs') return <ServerShowcaseHero id="blogs"><BlogsPage initialBlogs={await getPublishedDbBlogs()} /></ServerShowcaseHero>
  if (id === 'destinations') return <FaqHeroProvider state={publicEditorialHero('destinations', await readFaqHeroState('destinations'))}><DestinationsPage /></FaqHeroProvider>
  if (id === 'blog-detail') { const blogs = await getPublishedDbBlogs(); const article = blogs.find(blog => blog.editorial); return article ? <BlogDetailPage slug={article.slug} initialBlogs={blogs} /> : <p>No published editorial article is available for preview.</p> }
  const row = id === 'destination-detail' ? await db.destination.findFirst({ where: { isPublished: true }, select: { slug: true } }) : id === 'event-detail' ? await db.event.findFirst({ where: { isPublished: true }, select: { slug: true } }) : (await getPublishedDbOffers()).find(offer => !offer.tourSlug)
  if (!row) return <p>No published record is available for preview.</p>
  return id === 'destination-detail' ? <DestinationDetailPage slug={row.slug} /> : id === 'event-detail' ? <EventDetailPage slug={row.slug} /> : <CampaignDetail slug={row.slug} />
}
