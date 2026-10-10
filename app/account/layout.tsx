import type { Metadata } from 'next';
import './account.css'
import { headers } from 'next/headers'
import { AuthenticatedUserProvider } from '@/components/authenticated-user'
import { requireCustomer } from '@/lib/server/guards'
import { toClientUser } from '@/lib/server/users'
import { getAccountRobots } from '@/lib/seo'

export const metadata: Metadata = {
  robots: getAccountRobots(),
};

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const requestHeaders = await headers()
  const user = await requireCustomer(requestHeaders.get('x-sp-path') || '/account')
  return <AuthenticatedUserProvider user={toClientUser(user)}>{children}</AuthenticatedUserProvider>
}
