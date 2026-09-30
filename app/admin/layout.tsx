import type { Metadata } from 'next';
import { AdminShell } from '@/components/admin/admin-shell';
import { requireStaff } from '@/lib/server/guards';
import './admin.css';

export const metadata: Metadata = {
  title: 'Star Pyramids | Internal Dashboard',
  description: 'Internal operations dashboard for bookings, trips, inbox and settings.',
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireStaff();
  return <AdminShell>{children}</AdminShell>;
}
