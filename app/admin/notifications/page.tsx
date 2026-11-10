import { redirect } from 'next/navigation'
import { requireStaff } from '@/lib/server/auth/guards'
import { hasPermission } from '@/lib/server/auth/auth'
import { AdminNotificationsPage } from '@/components/admin/notifications-page'

export default async function Page() {
  const user = await requireStaff()
  if (!hasPermission(user, 'support.view')) redirect('/admin/dashboard')
  return <AdminNotificationsPage />
}
