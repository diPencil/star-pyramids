import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/seo';

/**
 * robots.txt — allows all public routes, disallows admin/account/checkout/cart/auth.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const baseUrl = await getSiteUrl();

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin/',
          '/account/',
          '/checkout',
          '/cart',
          '/login',
          '/register',
          '/forgot-password',
          '/reset-password',
          '/booking/',
          '/api/',
          '/search',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
