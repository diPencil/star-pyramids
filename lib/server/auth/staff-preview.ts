import 'server-only';

import { cookies } from 'next/headers';

import {
  createStaffPreviewToken,
  STAFF_PREVIEW_TTL_MS,
  verifyStaffPreviewToken,
} from '@/lib/core/staff-preview-token';
import { getCurrentUser, hasPermission, hasStaffRole, type PublicUser } from './auth';
import { SESSION_COOKIE_NAME } from './session';
import { findPublicUserByPublicId } from './users';

export const STAFF_PREVIEW_COOKIE_NAME = 'sp_staff_preview';

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  };
}

export async function beginStaffPreview(staff: PublicUser, customerPublicId: string): Promise<PublicUser | null> {
  if (!hasStaffRole(staff) || !hasPermission(staff, 'customers.view')) return null;
  const customer = await findPublicUserByPublicId(customerPublicId);
  if (!customer?.roles.includes('CUSTOMER')) return null;

  const jar = await cookies();
  const sessionToken = jar.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken) return null;
  jar.set(
    STAFF_PREVIEW_COOKIE_NAME,
    createStaffPreviewToken(staff.publicId, customer.publicId, sessionToken),
    cookieOptions(Math.floor(STAFF_PREVIEW_TTL_MS / 1000)),
  );
  return customer;
}

export async function clearStaffPreview(): Promise<void> {
  const jar = await cookies();
  jar.set(STAFF_PREVIEW_COOKIE_NAME, '', cookieOptions(0));
}

export async function getStaffPreviewCustomer(staff: PublicUser): Promise<PublicUser | null> {
  if (!hasStaffRole(staff) || !hasPermission(staff, 'customers.view')) return null;
  const jar = await cookies();
  const sessionToken = jar.get(SESSION_COOKIE_NAME)?.value;
  const previewToken = jar.get(STAFF_PREVIEW_COOKIE_NAME)?.value;
  if (!sessionToken || !previewToken) return null;

  const payload = verifyStaffPreviewToken(previewToken, sessionToken, staff.publicId);
  if (!payload) return null;
  const customer = await findPublicUserByPublicId(payload.customerPublicId);
  return customer?.roles.includes('CUSTOMER') ? customer : null;
}

export async function getAccountReadUser(): Promise<PublicUser | null> {
  const current = await getCurrentUser();
  if (!current) return null;
  const preview = await getStaffPreviewCustomer(current);
  if (preview) return preview;
  return current.roles.includes('CUSTOMER') ? current : null;
}

export async function getAccountWriteUser(): Promise<PublicUser | null> {
  const current = await getCurrentUser();
  if (!current) return null;
  if (await getStaffPreviewCustomer(current)) return null;
  return current.roles.includes('CUSTOMER') ? current : null;
}
