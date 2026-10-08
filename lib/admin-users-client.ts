'use client';

import { useCallback, useEffect, useState } from 'react';

export type DirectoryUser = {
  publicId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string;
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED';
  roles: string[];
  online: boolean;
  lastLoginAt: string | null;
  createdAt: string;
};

export type UsersDirectoryStatus = {
  /** DB staff list or null while loading/failed — never mock rows. */
  data: DirectoryUser[] | null;
  viewerPublicId: string | null;
  viewerRoles: string[];
  viewerPermissions: string[];
  grantableRoles: string[];
  loading: boolean;
  error: string | null;
  retry(): void;
  refresh(): void;
};

export function useDbUsersStatus(): UsersDirectoryStatus {
  const [data, setData] = useState<DirectoryUser[] | null>(null);
  const [viewerPublicId, setViewerPublicId] = useState<string | null>(null);
  const [viewerPermissions, setViewerPermissions] = useState<string[]>([]);
  const [viewerRoles, setViewerRoles] = useState<string[]>([]);
  const [grantableRoles, setGrantableRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const res = await fetch('/api/admin/users', { credentials: 'same-origin' });
        if (!res.ok) {
          const payload = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(
            payload?.error ||
              (res.status === 401
                ? 'Your session expired. Sign in again.'
                : res.status === 403
                  ? 'Your role cannot view the team directory.'
                  : `Request failed (${res.status}).`),
          );
        }
        const payload = (await res.json()) as {
          users?: unknown;
          viewer?: { publicId?: unknown; roles?: unknown; permissions?: unknown };
          grantableRoles?: unknown;
        };
        if (cancelled) return;
        setData(Array.isArray(payload.users) ? (payload.users as DirectoryUser[]) : []);
        setViewerPermissions(Array.isArray(payload.viewer?.permissions) ? (payload.viewer.permissions as string[]) : []);
        setViewerPublicId(typeof payload.viewer?.publicId === 'string' ? payload.viewer.publicId : null);
        setViewerRoles(Array.isArray(payload.viewer?.roles) ? (payload.viewer.roles as string[]) : []);
        setGrantableRoles(Array.isArray(payload.grantableRoles) ? (payload.grantableRoles as string[]) : []);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Could not load team members.');
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [nonce]);

  const retry = useCallback(() => setNonce((n) => n + 1), []);
  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  return { data, viewerPublicId, viewerRoles, viewerPermissions, grantableRoles, loading, error, retry, refresh };
}

export async function mutateDirectoryUser(
  method: 'POST' | 'PUT',
  url: string,
  body: Record<string, unknown>,
): Promise<DirectoryUser> {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    credentials: 'same-origin',
  });
  const payload = (await res.json().catch(() => null)) as {
    user?: DirectoryUser;
    error?: string;
  } | null;
  if (!res.ok || !payload?.user) {
    throw new Error(payload?.error || 'Could not complete the request.');
  }
  return payload.user;
}

export type DirectoryRole = {
  key: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: string[];
  memberCount: number;
};

export type CatalogPermission = {
  key: string;
  module: string;
  action: string;
  label: string | null;
};

export type RolesDirectoryStatus = {
  roles: DirectoryRole[] | null;
  catalog: CatalogPermission[];
  canManageRoles: boolean;
  /** SUPER_ADMIN-only capability keys: locked (never granted) on every
   * non-SUPER_ADMIN role in the matrix, matching API enforcement. */
  restrictedPermissions: string[];
  loading: boolean;
  error: string | null;
  retry(): void;
  refresh(): void;
};

export function useDbRolesStatus(): RolesDirectoryStatus {
  const [roles, setRoles] = useState<DirectoryRole[] | null>(null);
  const [catalog, setCatalog] = useState<CatalogPermission[]>([]);
  const [canManageRoles, setCanManageRoles] = useState(false);
  const [restrictedPermissions, setRestrictedPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const res = await fetch('/api/admin/roles', { credentials: 'same-origin' });
        if (!res.ok) {
          const payload = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(
            payload?.error ||
              (res.status === 401
                ? 'Your session expired. Sign in again.'
                : res.status === 403
                  ? 'Your role cannot view roles.'
                  : `Request failed (${res.status}).`),
          );
        }
        const payload = (await res.json()) as {
          roles?: unknown;
          catalog?: unknown;
          restrictedPermissions?: unknown;
          viewer?: { canManageRoles?: unknown };
        };
        if (cancelled) return;
        setRoles(Array.isArray(payload.roles) ? (payload.roles as DirectoryRole[]) : []);
        setCatalog(Array.isArray(payload.catalog) ? (payload.catalog as CatalogPermission[]) : []);
        setRestrictedPermissions(
          Array.isArray(payload.restrictedPermissions)
            ? (payload.restrictedPermissions as unknown[]).filter((key): key is string => typeof key === 'string')
            : [],
        );
        setCanManageRoles(payload.viewer?.canManageRoles === true);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Could not load roles.');
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [nonce]);

  const retry = useCallback(() => setNonce((n) => n + 1), []);
  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  return { roles, catalog, canManageRoles, restrictedPermissions, loading, error, retry, refresh };
}

export async function mutateDirectoryRole(
  method: 'POST' | 'PUT',
  url: string,
  body: Record<string, unknown>,
): Promise<DirectoryRole> {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    credentials: 'same-origin',
  });
  const payload = (await res.json().catch(() => null)) as {
    role?: DirectoryRole;
    error?: string;
  } | null;
  if (!res.ok || !payload?.role) {
    throw new Error(payload?.error || 'Could not complete the request.');
  }
  return payload.role;
}
