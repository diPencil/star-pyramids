import { authPageMetadata } from '@/lib/auth-page-metadata'
import { getServerLocale } from '@/lib/server/locale'
import { LoginPage } from '@/components/auth-pages'

export async function generateMetadata() {
  return authPageMetadata('login', await getServerLocale())
}

export default function Page() {
  return <LoginPage />
}
