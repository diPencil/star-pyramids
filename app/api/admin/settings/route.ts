import { NextResponse } from 'next/server';

import { getCurrentUser, hasPermission } from '@/lib/server/auth';
import { isSameOriginRequest } from '@/lib/server/csrf';
import { db } from '@/lib/server/db';
import {
  applyAdminSettings,
  getAdminSettings,
} from '@/lib/server/settings';

/**
 * Canonical admin settings endpoint (DB-backed, MySQL via SiteSetting/FxRate).
 *
 * - GET: any authenticated staff member (SUPER_ADMIN / ADMIN / STAFF).
 *   Secrets are returned as `{ configured: boolean }` only.
 * - PATCH: privileged roles only (SUPER_ADMIN / ADMIN). STAFF is read-only.
 *   Unknown keys are rejected server-side; secrets are never echoed back.
 */
export async function GET() {
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!hasPermission(current, 'settings.view')) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }
  const snapshot = await getAdminSettings();
  return NextResponse.json(snapshot);
}

type SettingsPatchBody = {
  values?: unknown;
  rates?: unknown;
};

export async function PATCH(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!hasPermission(current, 'settings.edit')) {
    return NextResponse.json(
      { error: 'System settings require an Admin role.' },
      { status: 403 },
    );
  }

  let body: SettingsPatchBody;
  try {
    body = (await request.json()) as SettingsPatchBody;
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  try {
    const result = await applyAdminSettings({
      values: body.values,
      rates: body.rates,
    });
    // Audit the key list only — secret VALUES must never enter audit rows.
    await db.staffActionAudit
      .create({
        data: {
          actorId: current.id,
          action: 'settings.update',
          entityType: 'site_settings',
          metadata: JSON.stringify({
            keys: result.updatedKeys,
            secretsUpdated: result.secretsUpdated,
            ratesUpdated: result.ratesUpdated,
          }),
        },
      })
      .catch(() => undefined);
    return NextResponse.json(result.snapshot);
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
