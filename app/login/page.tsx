import { LoginPage } from '@/components/auth-pages'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/server/auth'
import { authorizedPostLoginPath } from '@/lib/server/auth-navigation'

export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const [user, params] = await Promise.all([getCurrentUser(), searchParams])
  if (user) redirect(authorizedPostLoginPath(user, params.next))
  return <LoginPage />
}
