import type { Metadata } from 'next'
import { AdminShell } from '@/components/admin/admin-shell'
import './admin.css'

export const metadata: Metadata = {
  title: 'Star Pyramids | Internal Dashboard',
  description: 'Internal operations dashboard for bookings, trips, inbox and settings.',
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>
}
