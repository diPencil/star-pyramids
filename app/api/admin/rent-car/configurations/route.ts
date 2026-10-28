import { rentCarFailure } from '@/lib/server/rent-car-errors';
import { NextResponse } from 'next/server';
import { getCurrentUser, hasPermission } from '@/lib/server/auth';
import { isSameOriginRequest } from '@/lib/server/csrf';
import { listCarPricingConfigurations, updateCarPricingConfiguration } from '@/lib/server/car-pricing';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!hasPermission(user, 'cars.edit')) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  return NextResponse.json({ configurations: await listCarPricingConfigurations() });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!hasPermission(user, 'cars.edit')) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  try {
    const configuration = await updateCarPricingConfiguration(await request.json());
    return configuration ? NextResponse.json({ configuration }) : NextResponse.json({ error: 'Configuration not found.' }, { status: 404 });
  } catch (error) {
    const failure = rentCarFailure(error);
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
}
