'use client'

import Link from 'next/link'
import { CalendarClock, ClipboardList, MapPin, Users } from 'lucide-react'
import { PageHead } from '@/components/admin/admin-shell'
import { AdminEmpty, AdminStats, AdminText, Card } from '@/components/admin/admin-ui'
import { useAdminLocale } from '@/components/admin/admin-locale'
import { destinations } from '@/data/content'
import { findTour } from '@/data/tours'
import { useTripPreview } from '@/lib/trip-request'

const timeCopy: Record<string, { en: string; ar: string }> = {
  exact: { en: 'Exact time', ar: 'موعد محدد' },
  approx: { en: 'Approximate time', ar: 'موعد تقريبي' },
  unsure: { en: 'Not sure yet', ar: 'لم يحدد بعد' },
}

export default function TripRequestsPage() {
  const ar = useAdminLocale() === 'ar'
  const preview = useTripPreview()
  const draft = preview?.draft ?? null
  const tourTitle = draft?.tourSlug ? findTour(draft.tourSlug)?.title ?? draft.tourSlug : null
  const destTitle = draft?.destinationSlug ? destinations.find((d) => d.slug === draft.destinationSlug)?.title ?? draft.destinationSlug : null
  const route = draft?.customTitle || tourTitle || destTitle || (draft ? (ar ? 'رحلة مخصصة' : 'Custom trip') : '')
  const dateText = draft && draft.preferredFrom && draft.preferredTo && draft.preferredFrom !== draft.preferredTo
    ? `${draft.preferredFrom} → ${draft.preferredTo}`
    : draft?.preferredFrom || draft?.preferredTo || ''
  const travelers = draft ? draft.adults + draft.children + draft.infants : 0

  return (
    <>
      <PageHead eyebrow="Requests" title="Trip Requests" titleAr="طلبات الرحلات" sub="Browser-local custom-trip requests from the website planner and customer accounts" subAr="طلبات الرحلات المخصصة المحفوظة محليًا من مخطط الموقع وحسابات العملاء" />
      <AdminStats items={[
        { label: <AdminText en="Requests here" ar="طلبات هنا" />, value: preview ? 1 : 0, note: <AdminText en="This browser only" ar="هذا المتصفح فقط" />, icon: ClipboardList },
        { label: <AdminText en="Route" ar="المسار" />, value: draft?.tourSlug ? (ar ? 'رحلة جاهزة' : 'Ready tour') : (ar ? 'رحلة حرة' : 'Custom') , note: <AdminText en="Tour anchor or free text" ar="رحلة جاهزة أو وصف حر" />, icon: MapPin, tone: 'orange' },
        { label: <AdminText en="Travelers" ar="المسافرون" />, value: travelers, note: <AdminText en="Adults + children + infants" ar="بالغون وأطفال ورضع" />, icon: Users, tone: 'green' },
        { label: <AdminText en="Submitted" ar="الحالة" />, value: preview ? (ar ? 'معاينة' : 'Preview') : (ar ? 'لا يوجد' : 'None'), note: <AdminText en="Local, not sent" ar="محلي، لم يُرسل" />, icon: CalendarClock, tone: 'violet' },
      ]} />
      {!preview || !draft ? (
        <Card title={<AdminText en="Trip requests" ar="طلبات الرحلات" />}>
          <AdminEmpty title={<AdminText en="No trip requests on this browser" ar="لا توجد طلبات رحلات على هذا المتصفح" />} copy={<AdminText en="Custom-trip requests created from the website planner or a customer account appear here." ar="طلبات الرحلات المخصصة المنشأة من مخطط الموقع أو حساب عميل تظهر هنا." />} />
        </Card>
      ) : (
        <>
          <Card
            title={<AdminText en="Trip requests" ar="طلبات الرحلات" />}
            sub={<AdminText en="1 of 1 shown · Browser-local prototype, not backend data" ar="عرض 1 من 1 · معاينة محلية وليست بيانات خلفية" />}>
            <div className="sp-table-wrap"><table className="sp-table">
              <thead><tr><th className="sp-row-number">#</th><th><AdminText en="Ref" ar="المرجع" /></th><th><AdminText en="Customer" ar="العميل" /></th><th><AdminText en="Route" ar="المسار" /></th><th><AdminText en="Dates" ar="التواريخ" /></th><th><AdminText en="Travelers" ar="المسافرون" /></th><th><AdminText en="Budget" ar="الميزانية" /></th><th><AdminText en="Status" ar="الحالة" /></th></tr></thead>
              <tbody><tr>
                <td className="sp-row-number">1</td>
                <td dir="ltr"><strong>{preview.localRef}</strong></td>
                <td>{draft.contact.name || (ar ? 'بدون اسم' : 'No name')}<br /><small style={{ color: 'var(--sp-muted)' }} dir="ltr">{draft.contact.email}</small></td>
                <td><strong>{route}</strong>{draft.tourSlug && destTitle && <><br /><small style={{ color: 'var(--sp-muted)' }}>{destTitle}</small></>}</td>
                <td><span dir="ltr">{dateText || (ar ? 'موعد مرن' : 'Flexible')}</span><br /><small style={{ color: 'var(--sp-muted)' }}>{ar ? timeCopy[draft.timeMode].ar : timeCopy[draft.timeMode].en}</small></td>
                <td>{travelers}</td>
                <td><span dir="ltr">{draft.budgetMin.toLocaleString('en-US')} - {draft.budgetMax.toLocaleString('en-US')} {draft.currency}</span></td>
                <td><span className="sp-status is-new">{ar ? 'معاينة محلية' : 'Local preview'}</span></td>
              </tr></tbody>
            </table></div>
          </Card>
          <Card title={<AdminText en="Request detail" ar="تفاصيل الطلب" />}>
            <dl className="sp-detail-list">
              <div><dt><AdminText en="Reference (browser-local)" ar="المرجع (محلي)" /></dt><dd dir="ltr"><strong>{preview.localRef}</strong></dd></div>
            <div><dt><AdminText en="Name" ar="الاسم" /></dt><dd>{draft.contact.name || (ar ? 'غير محدد' : 'Not specified')}</dd></div>
            <div><dt><AdminText en="Phone" ar="الهاتف" /></dt><dd dir="ltr">{draft.contact.phone || (ar ? 'غير محدد' : 'Not specified')}</dd></div>
            <div><dt><AdminText en="Email" ar="البريد" /></dt><dd dir="ltr">{draft.contact.email || (ar ? 'غير محدد' : 'Not specified')}</dd></div>
              <div><dt><AdminText en="Nationality" ar="الجنسية" /></dt><dd>{draft.nationality || (ar ? 'غير محدد' : 'Not specified')}</dd></div>
              <div><dt><AdminText en="Flight options" ar="خيارات الطيران" /></dt><dd>{draft.flightOffer ? (ar ? 'مطلوبة' : 'Requested') : (ar ? 'غير مطلوبة' : 'Not requested')}</dd></div>
              {draft.requestedAddOns.length > 0 && <div><dt><AdminText en="Requested add-ons" ar="إضافات مطلوبة" /></dt><dd>{draft.requestedAddOns.join(', ')}</dd></div>}
              {draft.notes && <div><dt><AdminText en="Notes" ar="ملاحظات" /></dt><dd>{draft.notes}</dd></div>}
            </dl>
            <p className="sp-detail-note"><AdminText en="Same browser-local preview the website planner and customer accounts write. Real staff workflow arrives with the backend." ar="نفس المعاينة المحلية التي يكتبها مخطط الموقع وحسابات العملاء. سير العمل الحقيقي يأتي مع الخلفية." /></p>
            <p><Link className="sp-btn" href="/make-your-trip"><AdminText en="Open website planner" ar="فتح مخطط الموقع" /></Link></p>
          </Card>
        </>
      )}
    </>
  )
}
