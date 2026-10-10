'use client'

import { useEffect, useRef, useState } from 'react'
import { PageHead } from '@/components/admin/admin-shell'
import { AdminEmpty, AdminText, Avatar, Card } from '@/components/admin/admin-ui'
import { useAdminLocale } from '@/components/admin/admin-locale'
import { ImageField } from '@/components/admin/image-field'
import { CountrySelect } from '@/components/country-select'
import { CountryFlag } from '@/components/country-flag'
import { countries, defaultCountry } from '@/data/countries'
import { mutateCustomerProfile, useDbCustomerDetail } from '@/lib/admin-customers-client'

/**
 * CRM editor backed entirely by the database.
 *
 * Loads the real customer record through /api/admin/customers/[publicId] and
 * saves through PATCH. There is no localStorage record, no mock booking
 * directory, and no way to change a password, role, or account status from
 * here - those live under the account and Users & Roles flows.
 */
export function EditCustomerContent({ customerKey }: { customerKey: string }) {
  const ar = useAdminLocale() === 'ar'
  const publicId = decodeURIComponent(customerKey)
  const { data: customer, canManage, loading, error, retry, refresh } = useDbCustomerDetail(publicId)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [username, setUsername] = useState('')
  const [countryCode, setCountryCode] = useState(defaultCountry.code)
  const [phone, setPhone] = useState('')
  const [avatar, setAvatar] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const pending = useRef(false)
  const hydrated = useRef(false)

  // Hydrate the form once the real record arrives. Never from mock data.
  useEffect(() => {
    if (!customer || hydrated.current) return
    hydrated.current = true
    setFirstName(customer.firstName ?? '')
    setLastName(customer.lastName ?? '')
    setUsername(customer.username ?? '')
    setCountryCode(customer.countryCode ?? defaultCountry.code)
    setPhone(customer.phone ?? '')
  }, [customer])

  if (loading) {
    return <>
      <PageHead eyebrow="CRM" title="Edit customer" titleAr="تعديل العميل" backHref="/admin/customers" />
      <AdminEmpty title={<AdminText en="Loading customer…" ar="جارٍ تحميل العميل…" />} copy={<AdminText en="Reading the customer record." ar="تتم قراءة سجل العميل." />} />
    </>
  }

  if (error || !customer) {
    return <>
      <PageHead eyebrow="CRM" title="Edit customer" titleAr="تعديل العميل" backHref="/admin/customers" />
      <AdminEmpty title={<AdminText en={error ? 'Could not load customer' : 'Customer not found'} ar={error ? 'تعذر تحميل العميل' : 'العميل غير موجود'} />} copy={error ? <AdminText en={error} ar={error} /> : undefined} />
      {error ? <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}><button type="button" className="sp-btn" onClick={retry}><AdminText en="Retry" ar="إعادة المحاولة" /></button></div> : null}
    </>
  }

  const country = countries.find((c) => c.code === countryCode) ?? defaultCountry
  const displayName = customer.displayName

  const save = async () => {
    if (pending.current) return
    if (!firstName.trim() || !lastName.trim()) {
      setErrorMessage(ar ? 'الاسم الأول واسم العائلة حقول إلزامية.' : 'First and last name are required.')
      return
    }
    setErrorMessage('')
    setSaved(false)
    pending.current = true
    setSaving(true)
    try {
      await mutateCustomerProfile(publicId, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        username: username.trim(),
        countryCode,
        phone: phone.trim(),
        avatar: avatar.trim(),
      })
      setSaved(true)
      refresh()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : (ar ? 'تعذر حفظ التغييرات.' : 'Could not save the changes.'))
    } finally {
      pending.current = false
      setSaving(false)
    }
  }

  return <>
    <PageHead eyebrow="CRM" title="Edit customer" titleAr="تعديل العميل" sub={displayName} backHref={`/admin/customers/${encodeURIComponent(publicId)}`} actions={<>
      <button type="button" className="sp-btn dark" onClick={save} disabled={saving || !canManage}>{saving ? <AdminText en="Saving..." ar="جارٍ الحفظ..." /> : <AdminText en="Save changes" ar="حفظ التغييرات" />}</button>
    </>} />
    <Card title={<AdminText en="Customer details" ar="بيانات العميل" />}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 16 }}>
        <Avatar name={displayName} src={avatar} size={56} />
        <div><strong>{displayName}</strong><br /><small style={{ color: 'var(--sp-muted)' }}>{customer.username || customer.email}</small></div>
      </div>
      {!canManage && <p role="note" style={{ color: 'var(--sp-muted)', marginTop: 0 }}><AdminText en="Your role can view this customer but cannot save changes." ar="يمكن لدورك عرض هذا العميل，但不能 حفظ التغييرات." /></p>}
      <div className="sp-form">
        <div className="sp-form-2">
          <label><AdminText en="First name" ar="الاسم الأول" /><input value={firstName} onChange={(e) => setFirstName(e.target.value)} disabled={!canManage} /></label>
          <label><AdminText en="Last name" ar="اسم العائلة" /><input value={lastName} onChange={(e) => setLastName(e.target.value)} disabled={!canManage} /></label>
        </div>
        <label><AdminText en="Username" ar="اسم المستخدم" /><input value={username} onChange={(e) => setUsername(e.target.value)} dir="ltr" disabled={!canManage} /></label>
        <label><AdminText en="Email address" ar="البريد الإلكتروني" /><input type="email" value={customer.email} readOnly dir="ltr" aria-readonly="true" /><small style={{ color: 'var(--sp-muted)' }}><AdminText en="The customer changes their own email in account settings." ar="يغير العميل بريده الإلكتروني من إعدادات الحساب." /></small></label>
        <div className="sp-form-2">
          <label><AdminText en="Country" ar="الدولة" /><CountrySelect value={countryCode} onChange={setCountryCode} locale={ar ? 'ar' : 'en'} /></label>
          <label><AdminText en="Mobile number" ar="رقم الموبايل" /><span className="sp-phone-field"><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><CountryFlag code={country.code} size={18} /> {country.dialCode}</span><input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" disabled={!canManage} /></span></label>
        </div>
        <ImageField value={avatar} onChange={setAvatar} />
      </div>
      {errorMessage && <p role="alert" style={{ color: '#b91c1c' }}>{errorMessage}</p>}
      {saved && !errorMessage && <p role="status" style={{ color: '#15803d' }}><AdminText en="Saved successfully." ar="تم الحفظ بنجاح." /></p>}
      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <button type="button" className="sp-btn primary" onClick={save} disabled={saving || !canManage}>{saving ? <AdminText en="Saving..." ar="جارٍ الحفظ..." /> : <AdminText en="Save changes" ar="حفظ التغييرات" />}</button>
      </div>
    </Card>
  </>
}
