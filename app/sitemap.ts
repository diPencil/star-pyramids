import type { MetadataRoute } from 'next';
import { listTourRouteSlugs } from '@/lib/server/tours';
import { listDestinationSlugs } from '@/lib/server/destinations';
import { listBlogSlugs } from '@/lib/server/blogs';
import { listEventSlugs } from '@/lib/server/events';
import { listOfferSlugs } from '@/lib/server/offers';
import { getSiteUrl } from '@/lib/seo';

/**
 * Dynamic sitemap.xml — DB-authoritative for all public routes.
 * Excludes admin, account, checkout, cart, auth, and private pages.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = await getSiteUrl();
  const lastModified = new Date();

  // Static public routes
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: baseUrl, changeFrequency: 'daily' as const, priority: 1, lastModified },
    { url: `${baseUrl}/trips`, changeFrequency: 'weekly' as const, priority: 0.9, lastModified },
    { url: `${baseUrl}/egypt-tours/one-day-tours`, changeFrequency: 'weekly' as const, priority: 0.8, lastModified },
    { url: `${baseUrl}/egypt-tours/multi-days-tours`, changeFrequency: 'weekly' as const, priority: 0.8, lastModified },
    { url: `${baseUrl}/egypt-tours/nile-cruises`, changeFrequency: 'weekly' as const, priority: 0.8, lastModified },
    { url: `${baseUrl}/egypt-tours/shore-excursions`, changeFrequency: 'weekly' as const, priority: 0.8, lastModified },
    { url: `${baseUrl}/destinations`, changeFrequency: 'weekly' as const, priority: 0.7, lastModified },
    { url: `${baseUrl}/special-offers`, changeFrequency: 'weekly' as const, priority: 0.8, lastModified },
    { url: `${baseUrl}/blogs`, changeFrequency: 'weekly' as const, priority: 0.6, lastModified },
    { url: `${baseUrl}/events`, changeFrequency: 'weekly' as const, priority: 0.6, lastModified },
    { url: `${baseUrl}/rent-car`, changeFrequency: 'weekly' as const, priority: 0.7, lastModified },
    { url: `${baseUrl}/about`, changeFrequency: 'monthly' as const, priority: 0.5, lastModified },
    { url: `${baseUrl}/contact`, changeFrequency: 'monthly' as const, priority: 0.5, lastModified },
    { url: `${baseUrl}/faq`, changeFrequency: 'monthly' as const, priority: 0.4, lastModified },
    { url: `${baseUrl}/accessible-travel`, changeFrequency: 'monthly' as const, priority: 0.4, lastModified },
    { url: `${baseUrl}/egypt-travel-guide`, changeFrequency: 'monthly' as const, priority: 0.5, lastModified },
    { url: `${baseUrl}/make-your-trip`, changeFrequency: 'monthly' as const, priority: 0.6, lastModified },
    { url: `${baseUrl}/privacy`, changeFrequency: 'yearly' as const, priority: 0.1, lastModified },
    { url: `${baseUrl}/terms`, changeFrequency: 'yearly' as const, priority: 0.1, lastModified },
  ];

  // Dynamic routes — DB-authoritative
  const [tours, destinations, blogs, events, offers] = await Promise.all([
    listTourRouteSlugs().catch(() => [] as string[]),
    listDestinationSlugs().catch(() => [] as string[]),
    listBlogSlugs().catch(() => [] as string[]),
    listEventSlugs().catch(() => [] as string[]),
    listOfferSlugs().catch(() => [] as string[]),
  ]);

  const dynamicRoutes: MetadataRoute.Sitemap = [
    ...tours.map((slug) => ({
      url: `${baseUrl}/egypt-tours/${slug}`,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
      lastModified,
    })),
    ...destinations.map((slug) => ({
      url: `${baseUrl}/destinations/${slug}`,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
      lastModified,
    })),
    ...blogs.map((slug) => ({
      url: `${baseUrl}/blogs/${slug}`,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
      lastModified,
    })),
    ...events.map((slug) => ({
      url: `${baseUrl}/events/${slug}`,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
      lastModified,
    })),
    ...offers.map((slug) => ({
      url: `${baseUrl}/special-offers/${slug}`,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
      lastModified,
    })),
  ];

  return [...staticRoutes, ...dynamicRoutes];
}
