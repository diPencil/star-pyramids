'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { AuthenticatedUser } from '@/lib/auth-types';

const AuthenticatedUserContext = createContext<AuthenticatedUser | null>(null);

export function AuthenticatedUserProvider({
  user,
  children,
}: {
  user: AuthenticatedUser;
  children: ReactNode;
}) {
  return <AuthenticatedUserContext.Provider value={user}>{children}</AuthenticatedUserContext.Provider>;
}

export function useAuthenticatedUser(): AuthenticatedUser {
  const user = useContext(AuthenticatedUserContext);
  if (!user) throw new Error('Authenticated user context is missing.');
  return user;
}
