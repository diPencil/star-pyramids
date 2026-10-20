'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCheck, RefreshCw, ArrowRight, Check } from 'lucide-react'
import { PageHead } from './admin-shell'
import { AdminEmpty, AdminIconAction, AdminTableWrap, Card } from './admin-ui'
import { AdminPagination } from './admin-pagination'
import { useAdminLocale } from './admin-locale'
import { toast } from './admin-toaster'
import { SharedSelect } from '@/components/shared-select'
import { useAdminNotifications, type AdminNotification } from '@/lib/admin-notifications'

export function AdminNotificationsPage() {
  const ar = useAdminLocale() === 'ar'
  const router = useRouter()
  const store = useAdminNotifications()
  const [rows, setRows] = useState<AdminNotification[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [status, setStatus] = useState('all')
  const [refresh, setRefresh] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const pending = useRef(false)
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError('')
    void fetch(`/api/admin/notifications/history?${new URLSearchParams({ page: String(page), pageSize: String(pageSize), status })}`, { cache: 'no-store', signal: controller.signal }).then(async response => {
      const data = await response.json(); if (!response.ok) throw new Error()
      if (controller.signal.aborted) return
      const lastPage = Math.max(1, Math.ceil(data.total / pageSize))
      if (page > lastPage) { setPage(lastPage); return }
      setRows(data.notifications); setTotal(data.total)
    }).catch(() => { if (!controller.signal.aborted) setError(ar ? 'تعذر تحميل الإشعارات.' : 'Could not load notifications.') }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [page, pageSize, status, refresh, ar])
  async function read(item?: AdminNotification, open = false) {
    if (pending.current) return
    pending.current = true; setBusy(true); setError('')
    try {
      const ok = item ? item.readAt ? true : await store.markRead(item.id) : await store.markAllRead()
      if (!ok) { toast.error(ar ? 'تعذر تحديث الإشعارات. حاول مرة أخرى.' : 'Could not update notifications. Please retry.', { dedupeKey: 'notifications-read' }); return }
      setRefresh(value => value + 1)
      if (open && item?.href?.startsWith('/admin/') && !item.href.includes('\\')) router.push(item.href)
    } finally { pending.current = false; setBusy(false) }
  }
  return <>
    <PageHead eyebrow="Communication" title="Notifications" titleAr="الإشعارات" sub="Your notification history" subAr="سجل إشعارات حسابك" actions={<>
      <button type="button" className="sp-btn" disabled={loading || busy} onClick={() => { store.refresh(); setRefresh(value => value + 1) }}><RefreshCw size={16} />{ar ? 'تحديث' : 'Refresh'}</button>
      <button type="button" className="sp-btn dark" disabled={loading || busy || store.unreadCount === 0} onClick={() => void read()}><CheckCheck size={16} />{ar ? 'تعليم الكل كمقروء' : 'Mark all read'}</button>
    </>} />
    <Card title={ar ? 'كل الإشعارات' : 'All notifications'}>
      <div className="sp-table-tools"><SharedSelect label={ar ? 'حالة القراءة' : 'Read status'} locale={ar ? 'ar' : 'en'} value={status} onChange={value => { setStatus(value); setPage(1) }} options={[{ value: 'all', label: ar ? 'الكل' : 'All' }, { value: 'unread', label: ar ? 'غير مقروء' : 'Unread' }, { value: 'read', label: ar ? 'مقروء' : 'Read' }]} /></div>
      {error && <p role="alert">{error}</p>}
      {loading ? <p role="status">{ar ? 'جارٍ تحميل الإشعارات...' : 'Loading notifications...'}</p> : !error && <>
        {rows.length ? <AdminTableWrap><table className="sp-table"><thead><tr><th>{ar ? 'الإشعار' : 'Notification'}</th><th>{ar ? 'التاريخ' : 'Date'}</th><th>{ar ? 'الحالة' : 'Status'}</th><th>{ar ? 'الإجراءات' : 'Actions'}</th></tr></thead><tbody>{rows.map(item => <tr key={item.id}><td><strong>{item.title}</strong><p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', maxWidth: 620 }}>{item.message}</p></td><td>{new Date(item.createdAt).toLocaleString(ar ? 'ar-EG' : 'en-GB')}</td><td>{item.readAt ? ar ? 'مقروء' : 'Read' : ar ? 'غير مقروء' : 'Unread'}</td><td><div className="sp-table-actions">{!item.readAt && <AdminIconAction icon={Check} label={ar ? 'تعليم كمقروء' : 'Mark read'} disabled={busy} onClick={() => void read(item)} />}{item.href?.startsWith('/admin/') && !item.href.includes('\\') && <AdminIconAction icon={ArrowRight} label={ar ? 'فتح' : 'Open'} disabled={busy} onClick={() => void read(item, true)} />}</div></td></tr>)}</tbody></table></AdminTableWrap> : <AdminEmpty title={ar ? 'لا توجد إشعارات' : 'No notifications'} copy={ar ? 'ستظهر إشعارات حسابك هنا.' : 'Your notifications will appear here.'} />}
        <AdminPagination page={page} pageCount={Math.max(1, Math.ceil(total / pageSize))} onPage={setPage} pageSize={pageSize} onPageSize={size => { setPageSize(size); setPage(1) }} total={total} from={total ? (page - 1) * pageSize + 1 : 0} to={Math.min(page * pageSize, total)} />
      </>}
    </Card>
  </>
}
