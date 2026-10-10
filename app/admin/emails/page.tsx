'use client'

import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Mail, MailOpen, Send, XCircle } from 'lucide-react'
import { PageHead } from '@/components/admin/admin-shell'
import { AdminEmpty, AdminStats, AdminTableTools, AdminTableWrap, AdminText, Card, StatusPill } from '@/components/admin/admin-ui'
import { useAdminLocale } from '@/components/admin/admin-locale'
import { AdminPagination, usePagination } from '@/components/admin/admin-pagination'
import { SharedSelect } from '@/components/shared-select'
import { SortableTh, useAdminTableSort } from '@/components/admin/admin-table-sort'
import { getSiteTimezone } from '@/components/locale'

type EmailDeliveryRow = {
  id: string
  recipient: string
  recipientType: 'customer' | 'staff'
  eventType: string
  subject: string
  relatedReference: string | null
  status: 'PENDING' | 'SENT' | 'FAILED' | 'SKIPPED'
  providerMessageId: string | null
  attempt: number
  errorSummary: string | null
  createdAt: string
  sentAt: string | null
  failedAt: string | null
}

const statusTabs = [
  { id: 'all', en: 'All', ar: 'الكل' },
  { id: 'SENT', en: 'Sent', ar: 'تم الإرسال' },
  { id: 'PENDING', en: 'Pending', ar: 'قيد الانتظار' },
  { id: 'FAILED', en: 'Failed', ar: 'فشل' },
  { id: 'SKIPPED', en: 'Skipped', ar: 'تم التخطي' },
] as const

function formatTime(iso: string, ar: boolean): string {
  try {
    return new Date(iso).toLocaleString(ar ? 'ar-EG' : 'en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: getSiteTimezone(),
    })
  } catch {
    return iso
  }
}

/**
 * Admin email delivery history (Phase 2J). Real DB-backed outbox
 * records from `/api/admin/emails`: status, recipient, type,
 * subject, related reference, timestamps, and safe error summaries.
 * No compose/send UI - delivery rows are created server-side by
 * domain events only. A row is SENT only when the SMTP server
 * accepted the message; otherwise it is FAILED with a reason.
 */
export default function EmailsPage() {
  const ar = useAdminLocale() === 'ar'
  const [deliveries, setDeliveries] = useState<EmailDeliveryRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'all' | 'SENT' | 'PENDING' | 'FAILED' | 'SKIPPED'>('all')

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setLoadError('')
      try {
        const params = new URLSearchParams({ limit: '100', offset: '0' })
        if (status !== 'all') params.set('status', status)
        const res = await fetch(`/api/admin/emails?${params.toString()}`, { credentials: 'same-origin' })
        if (!res.ok) throw new Error('load')
        const data = (await res.json()) as { deliveries?: unknown; total?: unknown }
        if (cancelled) return
        setDeliveries(Array.isArray(data.deliveries) ? (data.deliveries as EmailDeliveryRow[]) : [])
        setTotal(typeof data.total === 'number' ? data.total : 0)
      } catch {
        if (!cancelled) setLoadError(ar ? 'تعذر تحميل سجل البريد.' : 'Could not load the email history.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [status, ar])

  // Provider diagnostics: configuration presence only, never secrets.
  const [provider, setProvider] = useState<{ name: string; config: { configured: boolean; host: string | null; port: number; secure: boolean; authenticated: boolean; reason?: string } } | null>(null)
  const [checking, setChecking] = useState(false)
  const checkProvider = async () => {
    setChecking(true)
    try {
      const res = await fetch('/api/admin/emails', { method: 'POST', credentials: 'same-origin' })
      if (res.ok) setProvider(await res.json())
    } catch {
      /* diagnostics are best effort */
    } finally {
      setChecking(false)
    }
  }
  useEffect(() => { void checkProvider() }, [])

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return deliveries
    return deliveries.filter((row) =>
      `${row.recipient} ${row.subject} ${row.eventType} ${row.relatedReference ?? ''}`.toLowerCase().includes(q),
    )
  }, [deliveries, query])

  const emailSort = useAdminTableSort(rows, {
    recipient: (row) => row.recipient,
    subject: (row) => row.subject,
    type: (row) => row.eventType,
    time: (row) => row.createdAt,
    status: (row) => row.status,
  }, 'time', 'desc')
  const paging = usePagination(emailSort.sortedRows)

  const sent = deliveries.filter((row) => row.status === 'SENT').length
  const failed = deliveries.filter((row) => row.status === 'FAILED').length
  const pending = deliveries.filter((row) => row.status === 'PENDING').length

  return <>
    <PageHead eyebrow="Mailbox" title="Email" titleAr="البريد" sub="Real delivery history from domain events" subAr="سجل الإرسال الحقيقي من أحداث النظام" />
    {provider && !provider.config.configured ? (
      <p role="status" style={{ background: '#fff7ed', border: '1px solid #fdba74', color: '#9a3412', padding: '10px 12px', borderRadius: 8, margin: '0 0 12px' }}>
        <strong>{ar ? 'مزود البريد غير مُعد.' : 'Email provider not configured.'}</strong>{' '}
        {ar ? 'كل رسائل البريد الإلكتروني تفشل حتى تُضبط متغيرات بيئة SMTP.' : 'Every email will fail until the SMTP environment variables are set.'}{' '}
        <code>{provider.config.reason}</code>
      </p>
    ) : null}
    {provider?.config.configured ? (
      <p role="status" style={{ background: '#f0fdf4', border: '1px solid #86efac', color: '#166534', padding: '10px 12px', borderRadius: 8, margin: '0 0 12px' }}>
        <strong>{ar ? 'مزود البريد مُعد.' : 'Email provider configured.'}</strong>{' '}
        {`${provider.name} · ${provider.config.host}:${provider.config.port} · ${provider.config.secure ? 'TLS' : 'STARTTLS'} · ${provider.config.authenticated ? (ar ? 'مصادق' : 'authenticated') : (ar ? 'بدون مصادقة' : 'no auth')}`}
      </p>
    ) : null}
    <AdminStats items={[
      { label: <AdminText en="Deliveries" ar="الرسائل" />, value: total, note: <AdminText en="Recorded email attempts" ar="محاولات الإرسال المسجلة" />, icon: Mail },
      { label: <AdminText en="Sent" ar="تم الإرسال" />, value: sent, note: <AdminText en="Accepted by adapter" ar="قبلها المحول" />, icon: Send, tone: 'green' },
      { label: <AdminText en="Failed" ar="فشل" />, value: failed, note: <AdminText en="Needs attention" ar="تحتاج انتباه" />, icon: XCircle, tone: 'orange' },
      { label: <AdminText en="Pending" ar="قيد الانتظار" />, value: pending, note: <AdminText en="Queued attempts" ar="محاولات معلقة" />, icon: MailOpen, tone: 'violet' },
    ]} />
    <Card title={<AdminText en="Delivery history" ar="سجل الإرسال" />} sub={<AdminText en={`${rows.length} of ${total} deliveries shown`} ar={`عرض ${rows.length} من ${total} رسائل`} />}>
      <AdminTableTools query={query} onQueryChange={setQuery} placeholder={ar ? 'ابحث بمستلم أو موضوع أو مرجع...' : 'Search recipient, subject, or reference...'}>
        <SharedSelect value={status} onChange={(next) => setStatus(next as typeof status)} locale={ar ? 'ar' : 'en'} label={ar ? 'فلترة حالة البريد' : 'Filter email status'} options={statusTabs.map((tab) => ({ value: tab.id, label: ar ? tab.ar : tab.en }))} />
      </AdminTableTools>
      {loading
        ? <AdminEmpty title={<AdminText en="Loading email history…" ar="جارٍ تحميل سجل البريد…" />} copy={<AdminText en="Fetching delivery records." ar="جارٍ جلب سجلات الإرسال." />} />
        : loadError
          ? <AdminEmpty title={<AdminText en="Could not load email history" ar="تعذر تحميل سجل البريد" />} copy={<AdminText en="Check your connection and try again." ar="تحقق من الاتصال وحاول مجددًا." />} />
          : rows.length
            ? <AdminTableWrap><table className="sp-table">
              <thead><tr><th className="sp-row-number">#</th><SortableTh label={<AdminText en="Recipient" ar="المستلم" />} column="recipient" sortKey={emailSort.sortKey} direction={emailSort.direction} onSort={emailSort.sortBy} /><SortableTh label={<AdminText en="Subject" ar="الموضوع" />} column="subject" sortKey={emailSort.sortKey} direction={emailSort.direction} onSort={emailSort.sortBy} /><SortableTh label={<AdminText en="Type" ar="النوع" />} column="type" sortKey={emailSort.sortKey} direction={emailSort.direction} onSort={emailSort.sortBy} /><SortableTh label={<AdminText en="Time" ar="الوقت" />} column="time" sortKey={emailSort.sortKey} direction={emailSort.direction} onSort={emailSort.sortBy} /><SortableTh label={<AdminText en="Status" ar="الحالة" />} column="status" sortKey={emailSort.sortKey} direction={emailSort.direction} onSort={emailSort.sortBy} /><th><AdminText en="Detail" ar="التفاصيل" /></th></tr></thead>
              <tbody>{paging.pageRows.map((row, index) => <tr key={row.id}><td className="sp-row-number">{paging.from + index}</td><td style={{ overflowWrap: 'anywhere' }}>{row.recipient}<br /><small style={{ color: 'var(--sp-muted)' }}>{row.recipientType}{row.relatedReference ? ` · ${row.relatedReference}` : ''}</small></td><td><strong>{row.subject}</strong></td><td><small>{row.eventType}</small></td><td>{formatTime(row.createdAt, ar)}</td><td><StatusPill status={row.status.toLowerCase()} /></td><td><small style={{ color: 'var(--sp-muted)' }}>{row.status === 'FAILED' && row.errorSummary ? row.errorSummary : row.status === 'SENT' && row.sentAt ? (ar ? `أُرسلت ${formatTime(row.sentAt, ar)}` : `Sent ${formatTime(row.sentAt, ar)}`) : '-'}</small></td></tr>)}</tbody>
            </table></AdminTableWrap>
            : <AdminEmpty title={<AdminText en="No email found" ar="لا يوجد بريد" />} copy={<AdminText en="Delivery records from real domain events will appear here." ar="ستظهر هنا سجلات الإرسال من أحداث النظام الحقيقية." />} />}
      {rows.length > 0 && <AdminPagination page={paging.page} pageCount={paging.pageCount} onPage={paging.setPage} pageSize={paging.pageSize} onPageSize={paging.setPageSize} from={paging.from} to={paging.to} total={paging.total} />}
    </Card>
    <p style={{ color: 'var(--sp-muted)', fontSize: 12, display: 'flex', gap: 6, alignItems: 'center' }}><CheckCircle2 size={14} /><AdminText en="No email provider is connected - rows are recorded by the development/log adapter. Nothing leaves the server." ar="لا يوجد مزود بريد مرتبط - تُسجل الصفوف عبر محول التطوير. لا شيء يغادر الخادم." /></p>
  </>
}
