import 'server-only';

import { isStaff, type PublicUser } from './auth';

function parseInternalPath(value: string | null | undefined): URL | null {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null;
  if (/[\\\u0000-\u001f\u007f]/.test(value)) return null;
  try {
    const url = new URL(value, 'https://starpyramids.invalid');
    return url.origin === 'https://starpyramids.invalid' ? url : null;
  } catch {
    return null;
  }
}

export function defaultAuthenticatedPath(user: PublicUser): string {
  if (isStaff(user)) return '/admin';
  if (user.roles.includes('CUSTOMER')) return '/account';
  return '/';
}

export function authorizedPostLoginPath(
  user: PublicUser,
  requested: string | null | undefined,
): string {
  const fallback = defaultAuthenticatedPath(user);
  const url = parseInternalPath(requested);
  if (!url) return fallback;
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/_next')) {
    return fallback;
  }
  if (url.pathname === '/login' || url.pathname === '/register') return fallback;
  if (url.pathname.startsWith('/admin') && !isStaff(user)) return fallback;
  if (url.pathname.startsWith('/account') && !user.roles.includes('CUSTOMER')) {
    return fallback;
  }
  return `${url.pathname}${url.search}${url.hash}`;
}
