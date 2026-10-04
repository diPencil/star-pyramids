import './account.css'
import { headers } from 'next/headers'
import { AuthenticatedUserProvider } from '@/components/authenticated-user'
import { requireCustomer } from '@/lib/server/guards'
import { toClientUser } from '@/lib/server/users'

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const requestHeaders = await headers()
  const user = await requireCustomer(requestHeaders.get('x-sp-path') || '/account')
  return <AuthenticatedUserProvider user={toClientUser(user)}>{children}</AuthenticatedUserProvider>
}
