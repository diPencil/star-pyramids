'use client';

import { useEffect } from 'react';

import type { AuthenticatedUser } from '@/lib/auth-types';
import { setImpersonationMarker } from '@/lib/admin-store';

export function StaffPreviewBootstrap({ customer }: { customer: AuthenticatedUser }) {
  useEffect(() => {
    setImpersonationMarker({
      publicId: customer.publicId,
      name: [customer.firstName, customer.lastName].filter(Boolean).join(' ') || customer.username || customer.email,
      email: customer.email,
      avatar: customer.avatar ?? undefined,
    });
  }, [customer]);
  return null;
}
