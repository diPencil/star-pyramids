import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createStaffPreviewToken } from '@/lib/core/staff-preview-token';

const state = vi.hoisted(() => ({
  current: null as Record<string, unknown> | null,
  customer: null as Record<string, unknown> | null,
  cookies: new Map<string, string>(),
}));

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => state.cookies.has(name) ? { value: state.cookies.get(name) } : undefined,
    set: vi.fn(),
  }),
}));

vi.mock('@/lib/server/auth', () => ({
  getCurrentUser: async () => state.current,
  hasStaffRole: (user: { roles: string[] }) => user.roles.some((role) => role !== 'CUSTOMER'),
  hasPermission: (user: { permissions: string[] }, key: string) => user.permissions.includes(key),
}));

vi.mock('@/lib/server/users', () => ({
  findPublicUserByPublicId: async () => state.customer,
}));

import { SESSION_COOKIE_NAME } from '@/lib/server/session';
import {
  getAccountReadUser,
  getAccountWriteUser,
  STAFF_PREVIEW_COOKIE_NAME,
} from '@/lib/server/staff-preview';

const staff = {
  id: 'staff-db-id',
  publicId: 'staff-1',
  roles: ['ADMIN'],
  permissions: ['customers.view'],
};
const customer = {
  id: 'customer-db-id',
  publicId: 'customer-7',
  roles: ['CUSTOMER'],
  permissions: [],
};

beforeEach(() => {
  state.current = null;
  state.customer = null;
  state.cookies.clear();
});

describe('staff preview account access', () => {
  it('uses the target customer for reads but denies all customer writes', async () => {
    const sessionToken = 'staff-session-token';
    state.current = staff;
    state.customer = customer;
    state.cookies.set(SESSION_COOKIE_NAME, sessionToken);
    state.cookies.set(
      STAFF_PREVIEW_COOKIE_NAME,
      createStaffPreviewToken(staff.publicId, customer.publicId, sessionToken),
    );

    await expect(getAccountReadUser()).resolves.toBe(customer);
    await expect(getAccountWriteUser()).resolves.toBeNull();
  });

  it('still denies writes when a staff identity also carries CUSTOMER', async () => {
    const sessionToken = 'staff-session-token';
    state.current = { ...staff, roles: ['ADMIN', 'CUSTOMER'] };
    state.customer = customer;
    state.cookies.set(SESSION_COOKIE_NAME, sessionToken);
    state.cookies.set(
      STAFF_PREVIEW_COOKIE_NAME,
      createStaffPreviewToken(staff.publicId, customer.publicId, sessionToken),
    );

    await expect(getAccountReadUser()).resolves.toBe(customer);
    await expect(getAccountWriteUser()).resolves.toBeNull();
  });

  it('keeps an ordinary customer account readable and writable', async () => {
    state.current = customer;
    await expect(getAccountReadUser()).resolves.toBe(customer);
    await expect(getAccountWriteUser()).resolves.toBe(customer);
  });

  it('does not accept a preview cookie without customers.view permission', async () => {
    const sessionToken = 'staff-session-token';
    state.current = { ...staff, permissions: [] };
    state.customer = customer;
    state.cookies.set(SESSION_COOKIE_NAME, sessionToken);
    state.cookies.set(
      STAFF_PREVIEW_COOKIE_NAME,
      createStaffPreviewToken(staff.publicId, customer.publicId, sessionToken),
    );

    await expect(getAccountReadUser()).resolves.toBeNull();
  });
});
