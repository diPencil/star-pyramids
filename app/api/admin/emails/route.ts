import { NextResponse } from 'next/server';

import { getCurrentUser, isStaff } from '@/lib/server/auth';
import { countEmailDeliveries, listEmailDeliveries } from '@/lib/server/email';

const STATUSES = new Set(['PENDING', 'SENT', 'FAILED', 'SKIPPED']);

/**
 * Staff-only email delivery history (Phase 2J). Real DB-backed
 * outbox records — never fabricated. Supports status/type/recipient/
 * reference filters with client-side pagination.
 */
export async function GET(request: Request) {
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!isStaff(current)) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });

  const url = new URL(request.url);
  const statusParam = url.searchParams.get('status');
  const status = statusParam && STATUSES.has(statusParam.toUpperCase())
    ? (statusParam.toUpperCase() as 'PENDING' | 'SENT' | 'FAILED' | 'SKIPPED')
    : undefined;
  const eventType = url.searchParams.get('type')?.trim() || undefined;
  const recipient = url.searchParams.get('recipient')?.trim() || undefined;
  const relatedReference = url.searchParams.get('reference')?.trim() || undefined;
  const limitRaw = Number(url.searchParams.get('limit') ?? '50');
  const offsetRaw = Number(url.searchParams.get('offset') ?? '0');
  const limit = Number.isInteger(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 50;
  const offset = Number.isInteger(offsetRaw) ? Math.max(offsetRaw, 0) : 0;

  const filters = {
    ...(status ? { status } : {}),
    ...(eventType ? { eventType } : {}),
    ...(recipient ? { recipient } : {}),
    ...(relatedReference ? { relatedReference } : {}),
  };
  const [deliveries, total] = await Promise.all([
    listEmailDeliveries({ ...filters, limit, offset }),
    countEmailDeliveries(filters),
  ]);
  return NextResponse.json({ deliveries, total, limit, offset });
}
