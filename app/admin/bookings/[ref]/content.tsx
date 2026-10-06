'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { CalendarDays, MapPin, StickyNote, Users } from 'lucide-react'
import { PageHead } from '@/components/admin/admin-shell'
import { AdminText, Card } from '@/components/admin/admin-ui'
import { AdminConfirmDialog } from '@/components/admin/admin-confirm-dialog'
import { useAdminLocale } from '@/components/admin/admin-locale'
import { bookingActivityLabel, bookingPaymentStatusLabel, bookingStatusLabel, canTransitionBooking, type BookingStatus, type StaffBooking } from '@/lib/booking'

const ACTIONS: { from: BookingStatus[]; to: BookingStatus; tone: 'primary' | 'danger' }[] = [
  { from: ['pending'], to: 'confirmed', tone: 'primary' },
  { from: ['confirmed'], to: 'completed', tone: 'primary' },
  { from: ['pending', 'confirmed'], to: 'cancelled', tone: 'danger' },
]

const actionCopy: Record<BookingStatus, { en: string; ar: string }> = {
  pending: { en: 'Pending', ar: 'قيد الانتظار' },
  confirmed: { en: 'Confirm booking', ar: 'تأكيد الحجز' },
  completed: { en: 'Mark completed', ar: 'إتمام الحجز' },
  cancelled: { en: 'Cancel booking', ar: 'إلغاء الحجز' },
}

async function apiStaffDetail(reference: string): Promise<StaffBooking> {
  const res = await fetch(`/api/admin/bookings/${encodeURIComponent(reference)}`, { credentials: 'same-origin' })
  const data = (await res.json()) as StaffBooking & { error?: string }
  if (!res.ok) throw new Error(data.error || 'Booking not found.')
  return data
}

async function apiStaffMutate(reference: string, body: Record<string, unknown>): Promise<StaffBooking> {
  const res = await fetch(`/api/admin/bookings/${encodeURIComponent(reference)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(body),
  })
  const data = (await res.json()) as StaffBooking & { error?: string }
  if (!res.ok) throw new Error(data.error || 'Could not update the booking.')
  return data
}

export function BookingDetailContent({ reference }: { reference: string }) {
  const ar = useAdminLocale() === 'ar'
  const [item, setItem] = useState<StaffBooking | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [pending, setPending] = useState<BookingStatus | null>(null)
  const [actionError, setActionError] = useState('')
  const [note, setNote] = useState('')
  const [savingNote, setSavingNote] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError('')
    apiStaffDetail(reference)
      .then((row) => { if (!cancelled) { setItem(row); setLoading(false) } })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : 'Booking not found.')
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [reference])

  if (loading) {
    return (
      <>
        <PageHead eyebrow="Orders" title="Booking" titleAr="الحجز" sub="Booking detail" subAr="تفاصيل الحجز" backHref="/admin/bookings" />
        <Card title={<AdminText en="Loading…" ar="جارٍ التحميل…" />}><p><AdminText en="Loading the stored booking…" ar="جارٍ تحميل الحجز المحفوظ…" /></p></Card>
      </>
    )
  }

  if (!item) {
    return (
      <>
        <PageHead eyebrow="Orders" title="Booking" titleAr="الحجز" sub="Booking detail" subAr="تفاصيل الحجز" backHref="/admin/bookings" />
        <Card title={<AdminText en="Booking not found" ar="الحجز غير موجود" />}>
          <p><AdminText en={loadError || 'This booking does not exist.'} ar={loadError || 'هذا الحجز غير موجود.'} /></p>
        </Card>
      </>
    )
  }

  const available = ACTIONS.filter((a) => a.from.includes(item.status))
  const fmtDateTime = (iso: string) => new Date(iso).toLocaleString(ar ? 'ar-EG' : 'en-US')
  const guests = item.lines.reduce((sum, line) => sum + line.adults + line.children + line.infants, 0)

  const runTransition = (to: BookingStatus) => {
    setActionError('')
    apiStaffMutate(item.reference, { status: to })
      .then((row) => { setItem(row); setPending(null) })
      .catch((error: unknown) => {
        setActionError(error instanceof Error ? error.message : 'Could not update the booking.')
        setPending(null)
      })
  }

  const saveNote = () => {
    if (!note.trim() || savingNote) return
    setActionError('')
    setSavingNote(true)
    apiStaffMutate(item.reference, { note: note.trim() })
      .then((row) => { setItem(row); setNote('') })
      .catch((error: unknown) => {
        setActionError(error instanceof Error ? error.message : 'Could not save the note.')
      })
      .finally(() => setSavingNote(false))
  }

  return (
    <>
      <PageHead
        eyebrow="Orders"
        title={item.reference}
        titleAr={item.reference}
        sub={`${item.lines[0]?.title ?? 'Booking'} · ${guests} ${ar ? 'ضيوف' : 'guests'}`}
        subAr={`${item.lines[0]?.title ?? 'الحجز'} · ${guests} ضيوف`}
        backHref="/admin/bookings"
      />
      <div className="evr-detail-grid">
        <div className="evr-main-col">
          <Card title={<AdminText en="Booking overview" ar="نظرة عامة على الحجز" />}>
            <dl className="evr-kv">
              <div><dt><AdminText en="Reference" ar="المرجع" /></dt><dd><code dir="ltr">{item.reference}</code></dd></div>
              <div><dt><AdminText en="Status" ar="الحالة" /></dt><dd><span className={`sp-status is-${item.status}`}>{bookingStatusLabel(item.status, ar)}</span></dd></div>
              <div><dt><AdminText en="Payment" ar="الدفع" /></dt><dd>{bookingPaymentStatusLabel(item.paymentStatus, ar)}</dd></div>
              {item.paymentSummary && item.paymentSummary.latestReference && (
                <div><dt><AdminText en="Payment record" ar="سجل الدفع" /></dt><dd><Link href={`/admin/payments/${encodeURIComponent(item.paymentSummary.latestReference)}`}><code dir="ltr">{item.paymentSummary.latestReference}</code></Link><small style={{ color: 'var(--sp-muted)' }}>${item.paymentSummary.paidTotal.toLocaleString('en-US')} paid · {item.paymentSummary.payments} attempt{item.paymentSummary.payments === 1 ? '' : 's'}</small></dd></div>
              )}
              {item.paymentSummary && !item.paymentSummary.latestReference && (
                <div><dt><AdminText en="Payment record" ar="سجل الدفع" /></dt><dd><small style={{ color: 'var(--sp-muted)' }}>{ar ? 'لا يوجد سجل دفع — غير مدفوع' : 'No payment record — unpaid'}</small></dd></div>
              )}
              <div><dt><AdminText en="Guests" ar="الضيوف" /></dt><dd><Users size={14} />{guests}</dd></div>
              <div><dt><AdminText en="Subtotal" ar="المجموع الفرعي" /></dt><dd>${item.subtotal.toLocaleString('en-US')}</dd></div>
              <div><dt><AdminText en="Total" ar="الإجمالي" /></dt><dd><strong>${item.total.toLocaleString('en-US')} USD</strong></dd></div>
              <div><dt><AdminText en="Submitted" ar="أُرسل" /></dt><dd>{fmtDateTime(item.createdAt)}</dd></div>
              <div><dt><AdminText en="Last updated" ar="آخر تحديث" /></dt><dd>{fmtDateTime(item.updatedAt)}</dd></div>
              {item.account && <div><dt><AdminText en="Account" ar="الحساب" /></dt><dd>{item.account.name} <small style={{ color: 'var(--sp-muted)' }} dir="ltr">{item.account.email}</small></dd></div>}
            </dl>
            {item.notes && <p className="evr-note"><span><AdminText en="Customer note" ar="ملاحظة العميل" /></span>{item.notes}</p>}
          </Card>
          <Card title={<AdminText en="Booked trips" ar="الرحلات المحجوزة" />}>
            {item.lines.map((line) => (
              <div key={line.key} className="evr-event">
                <Link href={`/egypt-tours/${line.tourSlug}`} className="evr-event-title">{line.title}</Link>
                <p><CalendarDays size={14} />{line.date || (ar ? 'التاريخ مفتوح' : 'Open date')}</p>
                <p><MapPin size={14} />{line.adults} {ar ? 'بالغين' : 'adults'}{line.children > 0 && ` · ${line.children} ${ar ? 'أطفال' : 'children'}`}{line.infants > 0 && ` · ${line.infants} ${ar ? 'رضع' : 'infants'}`}</p>
                <p><small dir="ltr">${line.adultUnit} / adult{line.children > 0 && ` · $${line.childUnit} / child`}{line.addons.length > 0 && ` · ${line.addons.join(', ')} (+$${line.addonTotal})`}</small></p>
                <p><strong>${line.total.toLocaleString('en-US')}</strong></p>
              </div>
            ))}
          </Card>
        </div>
        <div className="evr-side-col">
          <Card title={<AdminText en="Customer" ar="العميل" />}>
            <dl className="evr-kv evr-customer">
              <div><dt><AdminText en="Name" ar="الاسم" /></dt><dd>{item.contact.name}</dd></div>
              <div><dt><AdminText en="Email" ar="البريد" /></dt><dd><a dir="ltr" href={`mailto:${item.contact.email}`}>{item.contact.email}</a></dd></div>
              <div><dt><AdminText en="Phone" ar="الهاتف" /></dt><dd><a dir="ltr" href={`tel:${item.contact.phone.replace(/\s/g, '')}`}>{item.contact.phone}</a></dd></div>
            </dl>
          </Card>
          <Card title={<AdminText en="Booking management" ar="إدارة الحجز" />}>
            <div className="evr-manage">
              {available.length ? (
                <div className="evr-actions">
                  {available.map((a) => (
                    <button key={a.to} type="button" className={`sp-btn ${a.tone === 'danger' ? 'danger' : 'primary'}`} onClick={() => setPending(a.to)}>
                      <AdminText en={actionCopy[a.to].en} ar={actionCopy[a.to].ar} />
                    </button>
                  ))}
                </div>
              ) : (
                <p className="evr-manage-hint"><AdminText en="No further transitions. Completed and cancelled bookings are terminal." ar="لا توجد انتقالات أخرى. الحجوزات المكتملة والملغاة نهائية." /></p>
              )}
              {actionError && <p className="evr-manage-hint" role="alert">{actionError}</p>}
            </div>
          </Card>
          <Card title={<AdminText en="Internal note" ar="ملاحظة داخلية" />}>
            <div className="evr-manage">
              <p className="evr-manage-hint"><StickyNote size={14} /> <AdminText en="Staff-only. Never visible to the customer." ar="للفريق فقط. لا تظهر للعميل أبدًا." /></p>
              <textarea
                rows={3}
                maxLength={1000}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={ar ? 'اكتب ملاحظة داخلية…' : 'Write an internal note…'}
                aria-label={ar ? 'ملاحظة داخلية' : 'Internal note'}
                style={{ width: '100%', resize: 'vertical' }}
              />
              <div className="evr-actions">
                <button type="button" className="sp-btn primary" disabled={!note.trim() || savingNote} onClick={saveNote}>
                  <AdminText en={savingNote ? 'Saving…' : 'Save internal note'} ar={savingNote ? 'جارٍ الحفظ…' : 'حفظ الملاحظة الداخلية'} />
                </button>
              </div>
            </div>
          </Card>
        </div>
      </div>
      <Card title={<AdminText en="Activity" ar="سجل النشاط" />}>
        {item.activity.length ? (
          <ol className="evr-timeline">
            {item.activity.map((a, i) => (
              <li key={`${a.at}-${i}`}>
                <span className="evr-dot" aria-hidden="true" />
                <div>
                  <strong>{bookingActivityLabel(a.action, ar)}{a.internal ? (ar ? ' · داخلية' : ' · Internal') : ''}</strong>
                  <small>{a.by === 'customer' ? (ar ? 'العميل' : 'Customer') : (ar ? 'الفريق' : 'Staff')} · {new Date(a.at).toLocaleDateString(ar ? 'ar-EG' : 'en-US')} · {new Date(a.at).toLocaleTimeString(ar ? 'ar-EG' : 'en-US', { hour: 'numeric', minute: '2-digit' })}</small>
                  {a.note && <small className="evr-note-inline">{a.note}</small>}
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p><AdminText en="No activity yet." ar="لا يوجد سجل بعد." /></p>
        )}
      </Card>
      <AdminConfirmDialog
        open={pending !== null}
        onClose={() => setPending(null)}
        onConfirm={() => { if (pending && canTransitionBooking(item.status, pending)) runTransition(pending) }}
        title={<AdminText en={pending ? `Move to ${actionCopy[pending].en}?` : 'Confirm'} ar={pending ? `نقل إلى ${actionCopy[pending].ar}؟` : 'تأكيد'} />}
        description={<AdminText en={`Updates the stored record ${item.reference}.`} ar={`يحدّث السجل المحفوظ ${item.reference}.`} />}
        confirmLabel={<AdminText en="Confirm" ar="تأكيد" />}
        cancelLabel={<AdminText en="Keep" ar="تراجع" />}
        tone={pending === 'cancelled' ? 'danger' : 'primary'}
      />
    </>
  )
}
