import type { MetadataRoute } from 'next';
import { listTours } from '@/lib/server/tours';
import { getPublishedDestinations, getPublishedOneDayDestinations } from '@/lib/server/destinations';
import { listBlogSlugs } from '@/lib/server/blogs';
import { getPublishedDbEvents } from '@/lib/server/events';
import { getPublishedDbOffers } from '@/lib/server/offers';
import { getPublishedCategories } from '@/lib/server/categories';
import { cruiseTypes } from '@/data/tours';
import { isTourPublished } from '@/lib/tour-publish';
import { getSiteUrl } from '@/lib/seo';
import { SEO_PAGES, currentSeo, isSeoPage } from '@/lib/seo-manager';
import { readSeoState } from '@/lib/server/seo-manager';
import { getPublishedRecordSeo } from '@/lib/server/record-seo';
import { publicRecordCanonical, type RecordSeoKind } from '@/lib/dynamic-seo';

export const dynamic = 'force-dynamic';

/** Public canonical routes only; locale switching uses cookies, not separate URLs. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = await getSiteUrl();
  const staticPaths = [
    '', '/trips', '/egypt-tours/one-day-tours', '/egypt-tours/multi-days-tours',
    '/egypt-tours/nile-cruises', '/egypt-tours/shore-excursions', '/destinations',
    '/special-offers', '/blogs', '/events', '/rent-car', '/about', '/contact',
    '/faq', '/accessible-travel', '/egypt-travel-guide', '/make-your-trip',
    '/privacy', '/terms',
  ];

  const excludedStaticPaths = new Set((await Promise.all(
    Object.keys(SEO_PAGES).filter(isSeoPage).map(async (id) => {
      const path = SEO_PAGES[id]!.route;
      try {
        const seo = currentSeo(await readSeoState(id), id);
        if (seo.index === false || (seo.canonical && seo.canonical !== path)) return path;
      } catch {
        // Preserve the original static-route fallback when CMS state is unavailable.
      }
      return null;
    }),
  )).filter((path): path is string => path !== null));

  // On repository failure omit that collection rather than inventing fallback URLs.
  const [tours, destinations, blogs, events, offers, regions, categories] = await Promise.all([
    listTours().catch(() => []),
    getPublishedDestinations().catch(() => []),
    listBlogSlugs().catch(() => []),
    getPublishedDbEvents().catch(() => []),
    getPublishedDbOffers().catch(() => []),
    getPublishedOneDayDestinations().catch(() => []),
    getPublishedCategories().catch(() => []),
  ]);

  const dynamicRecords: { kind: RecordSeoKind; slug: string; path: string }[] = [
    ...tours.filter(isTourPublished).map(({ slug }) => ({ kind: 'tour' as const, slug, path: `/egypt-tours/${slug}` })),
    ...destinations.map(({ slug }) => ({ kind: 'destination' as const, slug, path: `/destinations/${slug}` })),
    ...blogs.map((slug) => ({ kind: 'blog' as const, slug, path: `/blogs/${slug}` })),
    ...events.map(({ slug }) => ({ kind: 'event' as const, slug, path: `/events/${slug}` })),
    ...offers.filter((offer) => !offer.tourSlug && offer.isPublished !== false).map(({ slug }) => ({ kind: 'offer' as const, slug, path: `/special-offers/${slug}` })),
    ...regions.map(({ slug }) => ({ kind: 'destination' as const, slug, path: `/egypt-tours/one-day-tours/${slug}` })),
    ...categories.map(({ slug }) => ({ kind: 'category' as const, slug, path: `/egypt-tours/multi-days-tours/${slug}` })),
  ];
  const publishedSeo = new Map<string, Promise<Awaited<ReturnType<typeof getPublishedRecordSeo>> | undefined>>();
  const included = await Promise.all(dynamicRecords.map(async ({ kind, slug, path }) => {
    const key = `${kind}:${slug}`;
    if (!publishedSeo.has(key)) publishedSeo.set(key, getPublishedRecordSeo(kind, slug).catch(() => undefined));
    const seo = await publishedSeo.get(key);
    if (seo === undefined) return null;
    const canonical = publicRecordCanonical(seo?.canonical);
    return seo?.index === false || (canonical && canonical !== path) ? null : path;
  }));
  const paths = [
    ...staticPaths,
    ...included.filter((path): path is string => path !== null),
    ...cruiseTypes.map(({ slug }) => `/egypt-tours/nile-cruises/${slug}`),
  ];

  return [...new Set(paths)].filter((path) => !excludedStaticPaths.has(path || '/'))
    .map((path) => ({ url: `${baseUrl}${path}` }));
}
