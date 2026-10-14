/**
 * Shared SEO utilities — single source for site URL, canonicals, hreflang.
 */

export function resolveSiteUrl(): string {
  try {
    const url = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? '');
    const hostname = url.hostname.toLowerCase();
    if (
      url.protocol === 'https:' && !url.username && !url.password &&
      /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(hostname) &&
      !/(?:^|\.)(?:localhost|local|internal|test|invalid|example)$/.test(hostname) &&
      !hostname.endsWith('.home.arpa') && hostname !== 'home.arpa'
    ) return url.origin;
  } catch {
    // Fall through
  }
  return 'https://starpyramids.com';
}

export async function getSiteUrl(): Promise<string> {
  return resolveSiteUrl();
}

/**
 * Generate canonical URL for a given path.
 * Always uses the validated public origin or the production fallback.
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
