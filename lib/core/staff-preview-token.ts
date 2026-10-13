import { createHmac, timingSafeEqual } from 'node:crypto';

export const STAFF_PREVIEW_TTL_MS = 15 * 60 * 1000;

type StaffPreviewPayload = {
  staffPublicId: string;
  customerPublicId: string;
  expiresAt: number;
};

function signature(payload: string, sessionToken: string): string {
  return createHmac('sha256', sessionToken).update(payload, 'utf8').digest('base64url');
}

export function createStaffPreviewToken(
  staffPublicId: string,
  customerPublicId: string,
  sessionToken: string,
  now = Date.now(),
): string {
  const payload = Buffer.from(JSON.stringify({
    staffPublicId,
    customerPublicId,
    expiresAt: now + STAFF_PREVIEW_TTL_MS,
  } satisfies StaffPreviewPayload)).toString('base64url');
  return `${payload}.${signature(payload, sessionToken)}`;
}

export function verifyStaffPreviewToken(
  token: string,
  sessionToken: string,
  expectedStaffPublicId: string,
  now = Date.now(),
): StaffPreviewPayload | null {
  const [payload, suppliedSignature, extra] = token.split('.');
  if (!payload || !suppliedSignature || extra) return null;

  const expectedSignature = signature(payload, sessionToken);
  const supplied = Buffer.from(suppliedSignature, 'utf8');
  const expected = Buffer.from(expectedSignature, 'utf8');
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Partial<StaffPreviewPayload>;
    if (
      typeof parsed.staffPublicId !== 'string' ||
      parsed.staffPublicId !== expectedStaffPublicId ||
      typeof parsed.customerPublicId !== 'string' ||
      !parsed.customerPublicId ||
      parsed.customerPublicId.length > 128 ||
      typeof parsed.expiresAt !== 'number' ||
      !Number.isFinite(parsed.expiresAt) ||
      parsed.expiresAt <= now
    ) return null;
    return parsed as StaffPreviewPayload;
  } catch {
    return null;
  }
}
