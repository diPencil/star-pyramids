'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { PageHead } from '@/components/admin/admin-shell'
import { AdminText, Card, StatusPill } from '@/components/admin/admin-ui'
import { useAdminLocale } from '@/components/admin/admin-locale'
import { paymentActivityLabel, paymentStatusLabel, type StaffPayment } from '@/lib/payment'

async function apiStaffPaymentDetail(reference: string): Promise<StaffPayment> {
  const res = await fetch(`/api/admin/payments/${encodeURIComponent(reference)}`, { credentials: 'same-origin' })
  const data = (await res.json()) as StaffPayment & { error?: string }
  if (!res.ok) throw new Error(data.error || 'Payment not found.')
  return data
}

export function PaymentDetailContent({ reference }: { reference: string }) {
  const ar = useAdminLocale() === 'ar'
  const [item, setItem] = useState<StaffPayment | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError('')
    apiStaffPaymentDetail(reference)
      .then((row) => { if (!cancelled) { setItem(row); setLoading(false) } })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : 'Payment not found.')
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [reference])

  if (loading) {
    return (
      <>
        <PageHead eyebrow="Orders" title="Payment" titleAr="الدفع" sub="Payment detail" subAr="تفاصيل الدفع" backHref="/admin/payments" />
        <Card title={<AdminText en="Loading…" ar="جارٍ التحميل…" />}><p><AdminText en="Loading the stored payment…" ar="جارٍ تحميل الدفع المحفوظ…" /></p></Card>
      </>
    )
  }

  if (!item) {
    return (
      <>
        <PageHead eyebrow="Orders" title="Payment" titleAr="الدفع" sub="Payment detail" subAr="تفاصيل الدفع" backHref="/admin/payments" />
        <Card title={<AdminText en="Payment not found" ar="الدفع غير موجود" />}>
          <p><AdminText en={loadError || 'This payment does not exist.'} ar={loadError || 'هذا الدفع غير موجود.'} /></p>
        </Card>
      </>
    )
  }

  const fmtDateTime = (iso: string | null) => (iso ? new Date(iso).toLocaleString(ar ? 'ar-EG' : 'en-US') : '—')

  return (
    <>
      <PageHead
        eyebrow="Orders"
        title={item.reference}
        titleAr={item.reference}
        sub={`${paymentStatusLabel(item.status, ar)} · $${item.amount.toLocaleString('en-US')} USD`}
        subAr={`${paymentStatusLabel(item.status, ar)} · $${item.amount.toLocaleString('en-US')} USD`}
        backHref="/admin/payments"
      />
      <div className="evr-detail-grid">
        <div className="evr-main-col">
          <Card title={<AdminText en="Payment overview" ar="نظرة عامة على الدفع" />}>
            <dl className="evr-kv">
              <div><dt><AdminText en="Reference" ar="المرجع" /></dt><dd><code dir="ltr">{item.reference}</code></dd></div>
              <div><dt><AdminText en="Status" ar="الحالة" /></dt><dd><StatusPill status={item.status} /> <span>{paymentStatusLabel(item.status, ar)}</span></dd></div>
              <div><dt><AdminText en="Booking" ar="الحجز" /></dt><dd><Link href={`/admin/bookings/${encodeURIComponent(item.bookingReference)}`}><code dir="ltr">{item.bookingReference}</code></Link></dd></div>
              <div><dt><AdminText en="Amount due" ar="المبلغ المستحق" /></dt><dd><strong>${item.amount.toLocaleString('en-US')} USD</strong></dd></div>
              <div><dt><AdminText en="Amount paid" ar="المدفوع" /></dt><dd>${item.amountPaid.toLocaleString('en-US')} USD</dd></div>
              <div><dt><AdminText en="Amount refunded" ar="المسترد" /></dt><dd>${item.amountRefunded.toLocaleString('en-US')} USD</dd></div>
              <div><dt><AdminText en="Provider" ar="المزود" /></dt><dd><span>{item.provider === 'pending' ? (ar ? 'بانتظار الربط (بدون بوابة بعد)' : 'Awaiting handoff (no gateway yet)') : item.provider}</span></dd></div>
              {item.providerPaymentId && <div><dt><AdminText en="Provider reference" ar="مرجع المزود" /></dt><dd><code dir="ltr">{item.providerPaymentId}</code></dd></div>}
              {item.failureCode && <div><dt><AdminText en="Failure" ar="سبب الفشل" /></dt><dd>{item.failureCode}{item.failureMessage ? ` — ${item.failureMessage}` : ''}</dd></div>}
              <div><dt><AdminText en="Initiated" ar="أُنشئ" /></dt><dd>{fmtDateTime(item.initiatedAt)}</dd></div>
              <div><dt><AdminText en="Paid" ar="دُفع" /></dt><dd>{fmtDateTime(item.paidAt)}</dd></div>
              <div><dt><AdminText en="Last updated" ar="آخر تحديث" /></dt><dd>{fmtDateTime(item.updatedAt)}</dd></div>
              {item.account && <div><dt><AdminText en="Account" ar="الحساب" /></dt><dd>{item.account.name} <small style={{ color: 'var(--sp-muted)' }} dir="ltr">{item.account.email}</small></dd></div>}
            </dl>
            <p className="evr-manage-hint"><AdminText en="Read-only in this phase: payment status changes only through a future provider handoff or an audited offline workflow." ar="للقراءة فقط في هذه المرحلة: تتغير حالة الدفع فقط عبر ربط مزود مستقبلي أو سير عمل موثق." /></p>
          </Card>
        </div>
        <div className="evr-side-col">
          <Card title={<AdminText en="Related booking" ar="الحجز المرتبط" />}>
            <div className="evr-manage">
              <p className="evr-manage-hint"><AdminText en="Booking and payment lifecycles are independent: a confirmed booking is not automatically paid." ar="دورتا الحجز والدفع مستقلتان: الحجز المؤكد ليس مدفوعًا تلقائيًا." /></p>
              <div className="evr-actions">
                <Link className="sp-btn" href={`/admin/bookings/${encodeURIComponent(item.bookingReference)}`}><AdminText en="Open booking" ar="فتح الحجز" /></Link>
              </div>
            </div>
          </Card>
        </div>
      </div>
      <Card title={<AdminText en="Payment history" ar="سجل الدفع" />}>
        {item.events.length ? (
          <ol className="evr-timeline">
            {item.events.map((e, i) => (
              <li key={`${e.at}-${i}`}>
                <span className="evr-dot" aria-hidden="true" />
                <div>
                  <strong>{paymentActivityLabel(e.action, ar)}{e.internal ? (ar ? ' · داخلية' : ' · Internal') : ''}</strong>
                  <small>{e.by === 'customer' ? (ar ? 'العميل' : 'Customer') : e.by === 'provider' ? (ar ? 'المزود' : 'Provider') : (ar ? 'الفريق' : 'Staff')} · {new Date(e.at).toLocaleDateString(ar ? 'ar-EG' : 'en-US')} · {new Date(e.at).toLocaleTimeString(ar ? 'ar-EG' : 'en-US', { hour: 'numeric', minute: '2-digit' })}</small>
                  {e.note && <small className="evr-note-inline">{e.note}</small>}
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p><AdminText en="No activity yet." ar="لا يوجد سجل بعد." /></p>
        )}
      </Card>
    </>
  )
}
