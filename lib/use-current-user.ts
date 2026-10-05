'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AuthenticatedUser } from '@/lib/auth-types';

export function useCurrentUser() {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
      if (res.ok) {
        const data = await res.json();
        // Trust boundary for every consumer (header, admin shell, trip
        // planner): accept only a well-formed user object and guarantee the
        // roles array contract, so a malformed payload can never crash a
        // render or flip an authenticated session to the guest branch.
        const next = data?.user;
        if (next && typeof next === 'object') {
          setUser({ ...next, roles: Array.isArray(next.roles) ? next.roles : [] });
        } else {
          setUser(null);
        }
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { user, loading, refresh };
}
