import { rentCarFailure } from '@/lib/server/rent-car-errors';
// Public: resolve a price quote for a published vehicle on an active route
// (Phase 2, read-only, no auth required; nothing here is mutable).
// Outcomes:
//  - 400 → invalid input, unknown/hidden vehicle, or capacity that the
//          vehicle's unambiguous seat count cannot cover (never guessed);
//  - 200 { priceOnRequest: true, reason } → route/price unavailable or the
//          MANUAL round-trip rate was never configured;
//  - 200 { quote } → exact integer-cents amounts for the requested trip.
import { NextResponse } from 'next/server';

import { resolveCarRouteQuote } from '@/lib/server/car-pricing';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const vehicle = url.searchParams.get('vehicle') ?? '';
  const route = url.searchParams.get('route') ?? '';
  const from = url.searchParams.get('from') ?? '';
  const to = url.searchParams.get('to') ?? '';
  const trip = url.searchParams.get('trip') ?? '';
  const passengersRaw = url.searchParams.get('passengers') ?? '';
  const passengers = /^-?\d+$/.test(passengersRaw) ? Number(passengersRaw) : NaN;

  try {
    const outcome = await resolveCarRouteQuote({ vehicle, route, from, to, trip, passengers });
    if (outcome.kind === 'price_on_request') {
      return NextResponse.json({ priceOnRequest: true, reason: outcome.reason }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
    }
    return NextResponse.json({ quote: outcome.detail }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
  } catch (error) {
    const failure = rentCarFailure(error);
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
}
