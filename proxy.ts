import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { SESSION_COOKIE_NAME } from '@/lib/server/session';
import { isProductionTrackingHost, isSafeTrackingUrl, TRACKING_ELIGIBLE_HEADER } from '@/lib/tracking';

function hasSafeReferrer(request: NextRequest, host: string): boolean {
  try {
    const referrer = new URL(request.headers.get('referer') ?? '');
    return referrer.protocol === 'https:' && referrer.host === host && isSafeTrackingUrl(referrer);
  } catch {
    return false;
  }
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE_NAME)?.value);
  const host = (request.headers.get('host') ?? request.nextUrl.host).toLowerCase();
  const productionHost = isProductionTrackingHost(process.env.NODE_ENV, host);
  const flight = request.headers.get('rsc') === '1';
  const pageUrl = new URL(request.nextUrl.href);
  if (flight) pageUrl.searchParams.delete('_rsc');
  const safePage = isSafeTrackingUrl(pageUrl);

  // Next falls back to a document navigation when a navigation fetch receives
  // no Flight payload. Keep protected pages out of a document running GTM.
  // A protected document sends no referrer, so leaving it also starts fresh.
  if (productionHost && flight && request.method === 'GET' && (!safePage || !hasSafeReferrer(request, host))) {
    return new NextResponse(null, {
      status: 204,
      headers: { 'Cache-Control': 'private, no-store', Vary: 'RSC, Referer', 'Referrer-Policy': 'no-referrer' },
    });
  }

  if ((pathname.startsWith('/admin') || pathname.startsWith('/account')) && !hasSession) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', `${pathname}${pageUrl.search}`);
    const response = NextResponse.redirect(loginUrl);
    response.headers.set('Referrer-Policy', 'no-referrer');
    return response;
  }

  const requestHeaders = new Headers(request.headers);
  // Account authorization also uses this path to preserve its return URL.
  requestHeaders.set('x-sp-path', `${pathname}${pageUrl.search}`);
  requestHeaders.set(TRACKING_ELIGIBLE_HEADER, productionHost && safePage ? '1' : '0');
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  if (!safePage) response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|api|media|gallery-videos|favicon\\.ico).*)',
  ],
};
