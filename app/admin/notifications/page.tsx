import { redirect } from 'next/navigation'
import { requireStaff } from '@/lib/server/guards'
import { hasPermission } from '@/lib/server/auth'
import { AdminNotificationsPage } from '@/components/admin/notifications-page'

export default async function Page() {
  const user = await requireStaff()
  if (!hasPermission(user, 'support.view')) redirect('/admin/dashboard')
  return <AdminNotificationsPage />
}
