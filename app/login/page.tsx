import { authPageMetadata } from '@/lib/seo/auth-page-metadata'
import { getServerLocale } from '@/lib/server/locale'
import { LoginPage } from '@/components/auth-pages'
import { publicSocialOptions } from '@/lib/server/auth/social-flow'

export async function generateMetadata() {
  return authPageMetadata('login', await getServerLocale())
}

export default async function Page() {
  return <LoginPage {...await publicSocialOptions()} />
}
