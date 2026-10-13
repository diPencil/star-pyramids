import { describe, expect, it } from 'vitest';

import {
  createStaffPreviewToken,
  STAFF_PREVIEW_TTL_MS,
  verifyStaffPreviewToken,
} from '@/lib/core/staff-preview-token';

describe('staff customer preview token', () => {
  const now = 1_800_000_000_000;
  const sessionToken = 'opaque-session-token-a';

  it('round-trips a short-lived preview bound to the staff identity', () => {
    const token = createStaffPreviewToken('staff-1', 'customer-7', sessionToken, now);
    expect(verifyStaffPreviewToken(token, sessionToken, 'staff-1', now + 1_000)).toEqual({
      staffPublicId: 'staff-1',
      customerPublicId: 'customer-7',
      expiresAt: now + STAFF_PREVIEW_TTL_MS,
    });
  });

  it('rejects tampering, a different session, and a different staff member', () => {
    const token = createStaffPreviewToken('staff-1', 'customer-7', sessionToken, now);
    const [payload, signature] = token.split('.');
    const tamperedPayload = Buffer.from(JSON.stringify({
      staffPublicId: 'staff-1',
      customerPublicId: 'customer-8',
      expiresAt: now + STAFF_PREVIEW_TTL_MS,
    })).toString('base64url');

    expect(verifyStaffPreviewToken(`${tamperedPayload}.${signature}`, sessionToken, 'staff-1', now)).toBeNull();
    expect(verifyStaffPreviewToken(token, 'opaque-session-token-b', 'staff-1', now)).toBeNull();
    expect(verifyStaffPreviewToken(token, sessionToken, 'staff-2', now)).toBeNull();
    expect(payload).toBeTruthy();
  });

  it('rejects an expired preview', () => {
    const token = createStaffPreviewToken('staff-1', 'customer-7', sessionToken, now);
    expect(verifyStaffPreviewToken(token, sessionToken, 'staff-1', now + STAFF_PREVIEW_TTL_MS)).toBeNull();
  });
});
