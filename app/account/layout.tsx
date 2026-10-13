import type { Metadata } from 'next';
import './account.css'
import './mobile.css'
import { headers } from 'next/headers'
import { AuthenticatedUserProvider } from '@/components/authenticated-user'
import { StaffPreviewBootstrap } from '@/components/staff-preview-bootstrap'
import { requireCustomerOrStaffPreview } from '@/lib/server/guards'
import { toClientUser } from '@/lib/server/users'
import { getAccountRobots } from '@/lib/seo'

export const metadata: Metadata = {
  robots: getAccountRobots(),
};

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const requestHeaders = await headers()
  const { user, isStaffPreview } = await requireCustomerOrStaffPreview(requestHeaders.get('x-sp-path') || '/account')
  const clientUser = toClientUser(user)
  return <AuthenticatedUserProvider user={clientUser}>
    {isStaffPreview ? <StaffPreviewBootstrap customer={clientUser} /> : null}
    {children}
  </AuthenticatedUserProvider>
}
