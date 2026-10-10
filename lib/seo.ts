import { getSetting } from '@/lib/server/settings';

/**
 * Shared SEO utilities — single source for site URL, canonicals, hreflang.
 */

export async function getSiteUrl(): Promise<string> {
  try {
    const siteName = await getSetting('site.name');
    const host = process.env.NEXT_PUBLIC_SITE_URL;
    if (host) return host.replace(/\/$/, '');
    if (siteName) return `https://${siteName.toLowerCase().replace(/\s+/g, '')}.com`.replace(/\/$/, '');
  } catch {
    // Fall through
  }
  return 'https://starpyramids.com';
}

/**
 * Generate canonical URL for a given path.
 * Always uses the production domain from NEXT_PUBLIC_SITE_URL or settings.
 */
export async function getCanonicalUrl(path: string): Promise<string> {
  const baseUrl = await getSiteUrl();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${normalizedPath}`;
}

/**
 * Hreflang configuration — only includes languages with real, accessible URLs.
 * Currently only English has a dedicated crawlable URL (single-URL architecture).
 * Returns hreflang entries for the current page path.
 * When locale-specific routes are implemented, add them here.
 */
export async function getHreflangEntries(path: string): Promise<Record<string, string>> {
  const baseUrl = await getSiteUrl();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  // Only declare languages with real, independently accessible URLs.
  // Since this site uses a single URL per page (client-side locale switching),
  // only English (the default) and x-default have real URLs.
  return {
    en: `${baseUrl}${normalizedPath}`,
    'x-default': `${baseUrl}${normalizedPath}`,
  };
}

/**
 * Generate robots metadata for public pages.
 */
export function getPublicRobots(): { index: true; follow: true } {
  return { index: true, follow: true };
}

/**
 * Generate robots metadata for private/auth pages.
 */
export function getPrivateRobots(): { index: false; follow: false; nocache: true } {
  return { index: false, follow: false, nocache: true };
}

/**
 * Generate robots metadata for admin pages.
 */
export function getAdminRobots(): { index: false; follow: false; nocache: true } {
  return { index: false, follow: false, nocache: true };
}

/**
 * Generate robots metadata for account pages.
 */
export function getAccountRobots(): { index: false; follow: false; nocache: true } {
  return { index: false, follow: false, nocache: true };
}