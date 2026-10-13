import { authPageMetadata } from '@/lib/auth-page-metadata'
import { getServerLocale } from '@/lib/server/locale'
import { ForgotPasswordPage } from '@/components/extended-pages'

export async function generateMetadata() {
  return authPageMetadata('forgotPassword', await getServerLocale())
}

export default function Page() {
  return <ForgotPasswordPage />
}
