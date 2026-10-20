'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { PageHead } from '@/components/admin/admin-shell'
import { AdminConfirmDialog } from '@/components/admin/admin-confirm-dialog'
import { AdminText, Card, StatusPill } from '@/components/admin/admin-ui'
import { useAdminLocale } from '@/components/admin/admin-locale'
import { useAdminCurrency } from '@/components/admin/admin-currency'
import { toast } from '@/components/admin/admin-toaster'
import { useCurrentUser } from '@/lib/use-current-user'
import { SharedSelect } from '@/components/shared-select'
import { paymentActivityLabel, paymentStatusLabel, type StaffPayment } from '@/lib/payment'

async function apiStaffPaymentDetail(reference: string): Promise<StaffPayment> {
  const res = await fetch(`/api/admin/payments/${encodeURIComponent(reference)}`, { credentials: 'same-origin' })
  const data = (await res.json()) as StaffPayment & { error?: string }
  if (!res.ok) throw new Error(data.error || 'Payment not found.')
  return data
}

export function PaymentDetailContent({ reference }: { reference: string }) {
  const ar = useAdminLocale() === 'ar'
  // Display-only conversion of server USD amounts, like the storefront.
  const { formatUsd } = useAdminCurrency()
  const { user } = useCurrentUser()
  const canRecordRefund = user?.permissions?.includes('payments.edit') ?? false
  const [item, setItem] = useState<StaffPayment | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [refundOpen, setRefundOpen] = useState(false)
  const [refAmount, setRefAmount] = useState('')
  const [refMethod, setRefMethod] = useState('bank_transfer')
  const [refExternal, setRefExternal] = useState('')
  const [refNote, setRefNote] = useState('')
  const [refConfirmed, setRefConfirmed] = useState(false)
  const [refSaving, setRefSaving] = useState(false)

  const openRefund = () => {
    setRefAmount('')
    setRefMethod('bank_transfer')
    setRefExternal('')
    setRefNote('')
    setRefConfirmed(false)
    setRefundOpen(true)
  }

  const submitRefund = () => {
    if (!item || refSaving) return
    setRefSaving(true)
    fetch(`/api/admin/payments/${encodeURIComponent(item.reference)}/refund`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        amount: Number(refAmount),
        method: refMethod,
        externalReference: refExternal,
        note: refNote,
        confirmReturned: refConfirmed,
      }),
    })
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        if (!res.ok) throw new Error(typeof data.error === 'string' && data.error ? data.error : 'Could not record the refund.')
        return apiStaffPaymentDetail(item.reference)
      })
      .then((row) => {
        setItem(row)
        setRefundOpen(false)
        toast.success(ar ? 'تم تسجيل الاسترداد.' : 'Refund recorded.', { dedupeKey: 'payment-refund' })
      })
      .catch((error: unknown) => {
        toast.error(error instanceof Error ? error.message : 'Could not record the refund.', { dedupeKey: 'payment-refund' })
      })
      .finally(() => setRefSaving(false))
  }

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

  const fmtDateTime = (iso: string | null) => (iso ? new Date(iso).toLocaleString(ar ? 'ar-EG' : 'en-US') : '-')

  return (
    <>
      <PageHead
        eyebrow="Orders"
        title={item.reference}
        titleAr={item.reference}
        sub={`${paymentStatusLabel(item.status, ar)} · ${formatUsd(item.amount)}`}
        subAr={`${paymentStatusLabel(item.status, ar)} · ${formatUsd(item.amount)}`}
        backHref="/admin/payments"
      />
      <div className="evr-detail-grid">
        <div className="evr-main-col">
          <Card title={<AdminText en="Payment overview" ar="نظرة عامة على الدفع" />}>
            <dl className="evr-kv">
              <div><dt><AdminText en="Reference" ar="المرجع" /></dt><dd><code dir="ltr">{item.reference}</code></dd></div>
              <div><dt><AdminText en="Status" ar="الحالة" /></dt><dd><StatusPill status={item.status} /> <span>{paymentStatusLabel(item.status, ar)}</span></dd></div>
              <div><dt><AdminText en="Booking" ar="الحجز" /></dt><dd><Link href={`/admin/bookings/${encodeURIComponent(item.bookingReference)}`}><code dir="ltr">{item.bookingReference}</code></Link></dd></div>
              <div><dt><AdminText en="Amount due" ar="المبلغ المستحق" /></dt><dd><strong>{formatUsd(item.amount)}</strong></dd></div>
              <div><dt><AdminText en="Amount paid" ar="المدفوع" /></dt><dd>{formatUsd(item.amountPaid)}</dd></div>
              <div><dt><AdminText en="Amount refunded" ar="المسترد" /></dt><dd>{formatUsd(item.amountRefunded)}</dd></div>
              <div><dt><AdminText en="Provider" ar="المزود" /></dt><dd><span>{item.provider === 'pending' ? (ar ? 'بانتظار الربط (بدون بوابة بعد)' : 'Awaiting handoff (no gateway yet)') : item.provider}</span></dd></div>
              {item.providerPaymentId && <div><dt><AdminText en="Provider reference" ar="مرجع المزود" /></dt><dd><code dir="ltr">{item.providerPaymentId}</code></dd></div>}
              {item.failureCode && <div><dt><AdminText en="Failure" ar="سبب الفشل" /></dt><dd>{item.failureCode}{item.failureMessage ? ` - ${item.failureMessage}` : ''}</dd></div>}
              <div><dt><AdminText en="Initiated" ar="أُنشئ" /></dt><dd>{fmtDateTime(item.initiatedAt)}</dd></div>
              <div><dt><AdminText en="Paid" ar="دُفع" /></dt><dd>{fmtDateTime(item.paidAt)}</dd></div>
              <div><dt><AdminText en="Last updated" ar="آخر تحديث" /></dt><dd>{fmtDateTime(item.updatedAt)}</dd></div>
              {item.account && <div><dt><AdminText en="Account" ar="الحساب" /></dt><dd>{item.account.name} <small style={{ color: 'var(--sp-muted)' }} dir="ltr">{item.account.email}</small></dd></div>}
            </dl>
            <p className="evr-manage-hint"><AdminText en="Payment status changes only through a verified provider handoff or a recorded offline receipt/refund." ar="تتغير حالة الدفع فقط عبر ربط مزود موثق أو إيصال/استرداد نقدي مسجل." /></p>
          </Card>
        </div>
        <div className="evr-side-col">
          <Card title={<AdminText en="Related booking" ar="الحجز المرتبط" />}>
            <div className="evr-manage">
              <p className="evr-manage-hint"><AdminText en="Booking and payment lifecycles are independent: a confirmed booking is not automatically paid." ar="دورتا الحجز والدفع مستقلتان: الحجز المؤكد ليس مدفوعًا تلقائيًا." /></p>
              <div className="evr-actions">
                <Link className="sp-btn" href={`/admin/bookings/${encodeURIComponent(item.bookingReference)}`}><AdminText en="Open booking" ar="فتح الحجز" /></Link>
                {canRecordRefund && (item.status === 'paid' || item.status === 'partially_refunded') && (
                  <button type="button" className="sp-btn" onClick={openRefund}>
                    <AdminText en="Record refund" ar="تسجيل استرداد" />
                  </button>
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>
      <AdminConfirmDialog
        open={refundOpen}
        onClose={() => { if (!refSaving) setRefundOpen(false) }}
        onConfirm={submitRefund}
        title={<AdminText en="Record offline refund" ar="تسجيل استرداد نقدي" />}
        description={<AdminText
          en={`Paid ${formatUsd(item.amountPaid)} · refunded ${formatUsd(item.amountRefunded)} · refundable ${formatUsd(Math.max(0, item.amountPaid - item.amountRefunded))}. Record only money already returned.`}
          ar={`المدفوع ${formatUsd(item.amountPaid)} · المسترد ${formatUsd(item.amountRefunded)} · القابل للاسترداد ${formatUsd(Math.max(0, item.amountPaid - item.amountRefunded))}. سجّل فقط المبالغ المعادة فعلًا.`}
        />}
        confirmLabel={<AdminText en={refSaving ? 'Recording…' : 'Record refund'} ar={refSaving ? 'جارٍ التسجيل…' : 'تسجيل الاسترداد'} />}
        cancelLabel={<AdminText en="Cancel" ar="إلغاء" />}
        tone="primary"
        canConfirm={!refSaving && Number(refAmount) > 0 && refExternal.trim() !== '' && refConfirmed}
      >
        <div className="sp-form">
          <label><AdminText en="Refund amount (USD)" ar="مبلغ الاسترداد (دولار)" /><input
            type="number" min="0" step="0.01" dir="ltr" value={refAmount}
            onChange={(e) => setRefAmount(e.target.value)} placeholder="0.00"
          /></label>
          <label><AdminText en="Method" ar="الطريقة" /><SharedSelect
            value={refMethod} onChange={setRefMethod} locale={ar ? 'ar' : 'en'}
            label={ar ? 'طريقة الاسترداد' : 'Refund method'}
            options={[
              { value: 'bank_transfer', label: ar ? 'تحويل بنكي' : 'Bank transfer' },
              { value: 'cash', label: ar ? 'نقدي' : 'Cash' },
            ]}
          /></label>
          <label><AdminText en="External bank/reference number (required)" ar="المرجع البنكي/الخارجي (إلزامي)" /><input
            type="text" dir="ltr" value={refExternal} maxLength={255}
            onChange={(e) => setRefExternal(e.target.value)} placeholder="REF-…"
          /></label>
          <label><AdminText en="Reason (optional)" ar="السبب (اختياري)" /><input
            type="text" value={refNote} maxLength={1000}
            onChange={(e) => setRefNote(e.target.value)}
          /></label>
          <label className="sp-check-row"><input
            type="checkbox" checked={refConfirmed}
            onChange={(e) => setRefConfirmed(e.target.checked)}
          /><span><AdminText en="The money has actually been returned to the customer." ar="تمت إعادة المبلغ للعميل فعلًا." /></span></label>
        </div>
      </AdminConfirmDialog>
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
