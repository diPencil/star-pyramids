import { authPageMetadata } from '@/lib/seo/auth-page-metadata'
import { getServerLocale } from '@/lib/server/locale'
import { RegisterPage } from '@/components/auth-pages'

export async function generateMetadata() {
  return authPageMetadata('register', await getServerLocale())
}

export default function Page() {
  return <RegisterPage />
}
