'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { PageHead } from '@/components/admin/admin-shell'
import { AdminEmpty, AdminText, Avatar, Card } from '@/components/admin/admin-ui'
import { useAdminLocale } from '@/components/admin/admin-locale'
import { ImageField } from '@/components/admin/image-field'
import { countries, countryFlag, defaultCountry } from '@/data/countries'
import { bookings } from '@/components/admin/admin-data'
import { saveCustomItem, saveCustomerProfile, useCustomerProfile, useLiveCollection, type AdminCustomer } from '@/lib/admin-store'

const NO_BASE: AdminCustomer[] = []

export function generateStaticParams() {
  return bookings.map((booking) => ({ key: booking.customer }))
}

export function EditCustomerContent({ customerKey }: { customerKey: string }) {
  const ar = useAdminLocale() === 'ar'
  const key = decodeURIComponent(customerKey)
  const customCustomers = useLiveCollection('customers', NO_BASE)
  const isCustom = key.startsWith('custom-')
  const original = isCustom ? customCustomers.find((c) => c.slug === key) : undefined
  const bookingName = !isCustom && bookings.some((b) => b.customer === key) ? key : null
  const storedPatch = useCustomerProfile(bookingName ?? '')

  const originalNameParts = (original?.name ?? '').trim().split(/\s+/).filter(Boolean)
  const [firstName, setFirstName] = useState(original?.firstName ?? originalNameParts[0] ?? '')
  const [lastName, setLastName] = useState(original?.lastName ?? originalNameParts.slice(1).join(' '))
  const [username, setUsername] = useState(original?.username ?? '')
  const [email, setEmail] = useState(original?.email ?? storedPatch.email ?? '')
  const [countryCode, setCountryCode] = useState(countries.find((c) => c.name === (original?.country ?? storedPatch.country))?.code ?? defaultCountry.code)
  const [phone, setPhone] = useState(original?.phone.replace(/^\+\d+\s*/, '') ?? storedPatch.phone ?? '')
  const [avatar, setAvatar] = useState(original?.avatar ?? storedPatch.avatar ?? '')
  const [notes, setNotes] = useState(storedPatch.notes ?? '')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  if (!original && !bookingName) {
    return <>
      <PageHead eyebrow="CRM" title="Edit customer" titleAr="تعديل العميل" actions={<Link className="sp-btn" href="/admin/customers"><ArrowLeft size={16} /> <AdminText en="Back" ar="رجوع" /></Link>} />
      <AdminEmpty title={<AdminText en="Customer not found" ar="العميل غير موجود" />} />
    </>
  }

  const displayName = original?.name ?? bookingName ?? ''
  const country = countries.find((c) => c.code === countryCode) ?? defaultCountry

  const save = () => {
    if (original && (!firstName.trim() || !lastName.trim() || !email.trim())) {
      setError(ar ? 'الاسم والبريد حقول إلزامية.' : 'Name and email are required.')
      return
    }
    if (original) {
      const item: AdminCustomer = {
        ...original,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        name: `${firstName.trim()} ${lastName.trim()}`,
        username: username.trim() || original.username,
        email: email.trim(),
        country: country.name,
        dialCode: country.dialCode,
        phone: phone.trim() ? `${country.dialCode} ${phone.trim()}` : original.phone,
        avatar: avatar.trim() || undefined,
      }
      saveCustomItem('customers', item)
    } else if (bookingName) {
      saveCustomerProfile(bookingName, {
        email: email.trim() || undefined,
        phone: phone.trim() ? `${country.dialCode} ${phone.trim()}` : undefined,
        country: country.name,
        avatar: avatar.trim() || undefined,
        notes: notes.trim() || undefined,
      })
    }
    setSaved(true)
  }

  return <>
    <PageHead eyebrow="CRM" title="Edit customer" titleAr="تعديل العميل" sub={displayName} actions={<>
      <Link className="sp-btn" href={`/admin/customers/${encodeURIComponent(key)}`}><ArrowLeft size={16} /> <AdminText en="Back" ar="رجوع" /></Link>
      <button type="button" className="sp-btn dark" onClick={save}><AdminText en="Save changes" ar="حفظ التغييرات" /></button>
    </>} />
    <Card title={<AdminText en="Customer details" ar="بيانات العميل" />}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 16 }}>
        <Avatar name={displayName} src={avatar} size={56} />
        <div><strong>{displayName}</strong><br /><small style={{ color: 'var(--sp-muted)' }}>{original ? original.username : (ar ? 'سجل دليل الحجوزات' : 'Booking directory record')}</small></div>
      </div>
      <div className="sp-form">
        {original && (
          <div className="sp-form-2">
            <label><AdminText en="First name" ar="الاسم الأول" /><input value={firstName} onChange={(e) => setFirstName(e.target.value)} /></label>
            <label><AdminText en="Last name" ar="اسم العائلة" /><input value={lastName} onChange={(e) => setLastName(e.target.value)} /></label>
          </div>
        )}
        {original && <label><AdminText en="Username" ar="اسم المستخدم" /><input value={username} onChange={(e) => setUsername(e.target.value)} dir="ltr" /></label>}
        <label><AdminText en="Email address" ar="البريد الإلكتروني" /><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" /></label>
        <div className="sp-form-2">
          <label><AdminText en="Country" ar="الدولة" /><select value={countryCode} onChange={(e) => setCountryCode(e.target.value)}>{countries.map((c) => <option key={c.code} value={c.code}>{countryFlag(c.code)} {c.name} ({c.dialCode})</option>)}</select></label>
          <label><AdminText en="Mobile number" ar="رقم الموبايل" /><span className="sp-phone-field"><span>{countryFlag(country.code)} {country.dialCode}</span><input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" /></span></label>
        </div>
        <ImageField value={avatar} onChange={setAvatar} />
        {!original && <label><AdminText en="Staff notes" ar="ملاحظات الموظفين" /><textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={ar ? 'ملاحظات داخلية لا تظهر للعميل' : 'Internal notes, hidden from the customer'} /></label>}
      </div>
      {error && <p role="alert" style={{ color: '#b91c1c' }}>{error}</p>}
      {saved && <p role="status" style={{ color: '#15803d' }}><AdminText en="Saved successfully." ar="تم الحفظ بنجاح." /></p>}
      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <button type="button" className="sp-btn primary" onClick={save}><AdminText en="Save changes" ar="حفظ التغييرات" /></button>
      </div>
    </Card>
  </>
}
