'use client';

import { useCallback, useEffect, useState } from 'react';

export type DirectoryCustomer = {
  publicId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string;
  username: string | null;
  countryCode: string | null;
  phone: string | null;
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED';
  emailVerifiedAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  bookingsCount: number;
  totalSpent: number;
  confirmedSpent: number;
  lastBookingAt: string | null;
};

export type CustomerDetail = DirectoryCustomer & {
  bookings: Array<{
    reference: string;
    status: string;
    paymentStatus: string;
    currency: string;
    total: number;
    createdAt: string;
    items: Array<{ tourSlug: string; tourTitle: string; travelDate: string; guests: number }>;
  }>;
  tripRequests: Array<{ reference: string; status: string; title: string; createdAt: string }>;
  carRequests: Array<{ reference: string; status: string; title: string; vehicleSlug: string; tripType: string; createdAt: string }>;
  eventRequests: Array<{ reference: string; status: string; title: string; createdAt: string }>;
  payments: Array<{ reference: string; bookingReference: string; status: string; currency: string; amount: number; amountPaid: number; createdAt: string }>;
  favorites: Array<{ itemType: string; itemSlug: string; createdAt: string }>;
  conversations: Array<{ reference: string; subject: string | null; status: string; lastMessageAt: string; messageCount: number }>;
};

export type CustomersDirectoryStatus = {
  /** DB customer list or null while loading/failed — never mock rows. */
  data: DirectoryCustomer[] | null;
  viewerPermissions: string[];
  loading: boolean;
  error: string | null;
  retry(): void;
  refresh(): void;
};

export function useDbCustomersStatus(): CustomersDirectoryStatus {
  const [data, setData] = useState<DirectoryCustomer[] | null>(null);
  const [viewerPermissions, setViewerPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const res = await fetch('/api/admin/customers', { credentials: 'same-origin' });
        if (!res.ok) {
          const payload = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(
            payload?.error ||
              (res.status === 401
                ? 'Your session expired. Sign in again.'
                : res.status === 403
                  ? 'Your role cannot view customers.'
                  : `Request failed (${res.status}).`),
          );
        }
        const payload = (await res.json()) as {
          customers?: unknown;
          viewer?: { permissions?: unknown };
        };
        if (cancelled) return;
        setData(Array.isArray(payload.customers) ? (payload.customers as DirectoryCustomer[]) : []);
        setViewerPermissions(Array.isArray(payload.viewer?.permissions) ? (payload.viewer.permissions as string[]) : []);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Could not load customers.');
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [nonce]);

  const retry = useCallback(() => setNonce((n) => n + 1), []);
  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  return { data, viewerPermissions, loading, error, retry, refresh };
}

export type CustomerDetailStatus = {
  data: CustomerDetail | null;
  canManage: boolean;
  loading: boolean;
  error: string | null;
  retry(): void;
  refresh(): void;
};

export function useDbCustomerDetail(publicId: string): CustomerDetailStatus {
  const [data, setData] = useState<CustomerDetail | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const res = await fetch(`/api/admin/customers/${encodeURIComponent(publicId)}`, { credentials: 'same-origin' });
        if (!res.ok) {
          const payload = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(
            payload?.error ||
              (res.status === 401
                ? 'Your session expired. Sign in again.'
                : res.status === 403
                  ? 'Your role cannot view customers.'
                  : res.status === 404
                    ? 'Customer not found.'
                    : `Request failed (${res.status}).`),
          );
        }
        const payload = (await res.json()) as {
          customer?: unknown;
          viewer?: { permissions?: unknown };
        };
        if (cancelled) return;
        setData((payload.customer ?? null) as CustomerDetail | null);
        const perms = Array.isArray(payload.viewer?.permissions) ? (payload.viewer.permissions as string[]) : [];
        setCanManage(perms.includes('customers.edit'));
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Could not load the customer.');
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [publicId, nonce]);

  const retry = useCallback(() => setNonce((n) => n + 1), []);
  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  return { data, canManage, loading, error, retry, refresh };
}

export async function mutateCustomerStatus(publicId: string, status: 'ACTIVE' | 'SUSPENDED'): Promise<DirectoryCustomer> {
  const res = await fetch(`/api/admin/customers/${encodeURIComponent(publicId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
    credentials: 'same-origin',
  });
  const payload = (await res.json().catch(() => null)) as {
    customer?: DirectoryCustomer;
    error?: string;
  } | null;
  if (!res.ok || !payload?.customer) {
    throw new Error(payload?.error || 'Could not update status.');
  }
  return payload.customer;
}

/** Fields a CRM edit may write. Anything else is rejected server side. */
export type CustomerProfilePatchInput = {
  firstName?: string;
  lastName?: string;
  username?: string;
  countryCode?: string;
  phone?: string;
  avatar?: string;
};

export async function mutateCustomerProfile(
  publicId: string,
  patch: CustomerProfilePatchInput,
): Promise<DirectoryCustomer> {
  const res = await fetch(`/api/admin/customers/${encodeURIComponent(publicId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
    credentials: 'same-origin',
  });
  const payload = (await res.json().catch(() => null)) as {
    customer?: DirectoryCustomer;
    error?: string;
  } | null;
  if (!res.ok || !payload?.customer) {
    throw new Error(payload?.error || 'Could not save the customer.');
  }
  return payload.customer;
}
