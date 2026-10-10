import { NextResponse } from 'next/server';

import { getCurrentUser, hasPermission } from '@/lib/server/auth';
import { isSameOriginRequest } from '@/lib/server/csrf';
import { countEmailDeliveries, getEmailProvider, listEmailDeliveries } from '@/lib/server/email';
import { describeSmtpConfig, verifySmtpConnection } from '@/lib/server/email-smtp';

const STATUSES = new Set(['PENDING', 'SENT', 'FAILED', 'SKIPPED']);

/**
 * Email provider diagnostics.
 *
 * Reports configuration PRESENCE only (host, port, TLS mode, whether
 * credentials exist) and optionally performs a real connection test. It never
 * returns a password, auth token, or the full configuration string.
 */
export async function POST(request: Request) {
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!hasPermission(current, 'emails.view')) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });

  const config = describeSmtpConfig();
  if (!config.configured) {
    return NextResponse.json({ provider: getEmailProvider().name, config });
  }

  const verification = await verifySmtpConnection();
  return NextResponse.json({ provider: getEmailProvider().name, config, verification });
}

/**
 * Staff-only email delivery history (Phase 2J). Real DB-backed
 * outbox records — never fabricated. Supports status/type/recipient/
 * reference filters with client-side pagination.
 */
export async function GET(request: Request) {
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!hasPermission(current, 'emails.view')) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });

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
