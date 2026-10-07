import { NextResponse } from 'next/server';

import { getStorefrontSettings } from '@/lib/server/settings';

/**
 * Public storefront settings. No authentication: this exposes only
 * non-secret configuration (brand, contact, social links, locale and
 * currency defaults, live rates, SEO/promo copy). Provider keys, tokens,
 * hosts, usernames and passwords are never selected or returned.
 */
export async function GET() {
  try {
    const settings = await getStorefrontSettings();
    return NextResponse.json(
      { settings },
      { headers: { 'Cache-Control': 'public, max-age=60' } },
    );
  } catch {
    return NextResponse.json(
      { error: 'Could not load settings.' },
      { status: 500 },
    );
  }
}
