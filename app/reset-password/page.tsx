import { authPageMetadata } from '@/lib/auth-page-metadata'
import { getServerLocale } from '@/lib/server/locale'
import { ResetPasswordPage } from '@/components/extended-pages'

export async function generateMetadata() {
  return authPageMetadata('resetPassword', await getServerLocale())
}

export default function Page() {
  return <ResetPasswordPage />
}
