'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageHead } from '@/components/admin/admin-shell'
import { AdminText, Card } from '@/components/admin/admin-ui'
import { useAdminLocale } from '@/components/admin/admin-locale'
import { countries, defaultCountry } from '@/data/countries'
import { ImageField } from '@/components/admin/image-field'
import { CountrySelect } from '@/components/country-select'
import { CountryFlag } from '@/components/country-flag'
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from '@/lib/core/validation'

export default function NewCustomerPage() {
  const ar = useAdminLocale() === 'ar'
  const router = useRouter()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [countryCode, setCountryCode] = useState(defaultCountry.code)
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [avatar, setAvatar] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  // Ref guard: blocks a double submit before React re-renders.
  const pending = useRef(false)

  const country = countries.find((c) => c.code === countryCode) ?? defaultCountry

  const save = async () => {
    if (pending.current) return
    if (!firstName.trim() || !lastName.trim() || !username.trim() || !email.trim() || !phone.trim()) {
      setError(ar ? 'الاسم والبريد والهاتف حقول إلزامية.' : 'Name, email and phone are required.')
      return
    }
    if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
      setError(ar
        ? `كلمة المرور من ${MIN_PASSWORD_LENGTH} إلى ${MAX_PASSWORD_LENGTH} أحرف.`
        : `Password must be ${MIN_PASSWORD_LENGTH}-${MAX_PASSWORD_LENGTH} characters.`)
      return
    }
    if (password !== confirmPassword) {
      setError(ar ? 'كلمتا المرور غير متطابقتين.' : 'The passwords do not match.')
      return
    }
    setError('')
    pending.current = true
    setSaving(true)
    try {
      const res = await fetch('/api/admin/customers', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          username: username.trim(),
          email: email.trim(),
          countryCode,
          phone: phone.trim(),
          password,
          confirmPassword,
          avatar: avatar.trim(),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(ar ? (data?.error || 'تعذّر إنشاء العميل.') : (data?.error || 'Could not create the customer.'))
        return
      }
      router.push(`/admin/customers/${encodeURIComponent(String(data?.customer?.publicId ?? ''))}`)
    } catch {
      setError(ar ? 'تعذّر إنشاء العميل. حاول مجددًا.' : 'Could not create the customer. Please try again.')
    } finally {
      pending.current = false
      setSaving(false)
    }
  }

  return <>
    <PageHead eyebrow="CRM" title="New customer" titleAr="عميل جديد" sub="Same fields as the website registration form" subAr="نفس حقول نموذج التسجيل في الموقع" backHref="/admin/customers" actions={<button type="button" className="sp-btn dark" onClick={save} disabled={saving}>{saving ? <AdminText en="Creating..." ar="جارٍ الإنشاء..." /> : <AdminText en="Create customer" ar="إنشاء العميل" />}</button>} />
    <Card title={<AdminText en="Customer details" ar="بيانات العميل" />}>
      <div className="sp-form">
        <div className="sp-form-2">
          <label><AdminText en="First name" ar="الاسم الأول" /><input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="John" /></label>
          <label><AdminText en="Last name" ar="اسم العائلة" /><input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Smith" /></label>
        </div>
        <label><AdminText en="Username" ar="اسم المستخدم" /><input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="john.smith" dir="ltr" /></label>
        <label><AdminText en="Email address" ar="البريد الإلكتروني" /><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" dir="ltr" /></label>
        <div className="sp-form-2">
          <label><AdminText en="Country" ar="الدولة" /><CountrySelect value={countryCode} onChange={setCountryCode} locale={ar ? 'ar' : 'en'} /></label>
          <label><AdminText en="Mobile number" ar="رقم الموبايل" /><span className="sp-phone-field"><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><CountryFlag code={country.code} size={18} /> {country.dialCode}</span><input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="100 000 0000" dir="ltr" /></span></label>
        </div>
        <div className="sp-form-2">
          <label><AdminText en={`Password (${MIN_PASSWORD_LENGTH}-${MAX_PASSWORD_LENGTH} characters)`} ar={`كلمة المرور (${MIN_PASSWORD_LENGTH}-${MAX_PASSWORD_LENGTH} أحرف)`} /><input type={showPassword ? 'text' : 'password'} minLength={MIN_PASSWORD_LENGTH} maxLength={MAX_PASSWORD_LENGTH} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" /></label>
          <label><AdminText en="Confirm password" ar="تأكيد كلمة المرور" /><input type={showPassword ? 'text' : 'password'} minLength={MIN_PASSWORD_LENGTH} maxLength={MAX_PASSWORD_LENGTH} autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} dir="ltr" /></label>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, flexDirection: 'row' }}>
          <input type="checkbox" checked={showPassword} onChange={(e) => setShowPassword(e.target.checked)} style={{ width: 18 }} />
          <AdminText en="Show password" ar="إظهار كلمة المرور" />
        </label>
        <ImageField value={avatar} onChange={setAvatar} />
      </div>
      {error && <p role="alert" style={{ color: '#b91c1c' }}>{error}</p>}
      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <button type="button" className="sp-btn primary" onClick={save} disabled={saving}>{saving ? <AdminText en="Creating..." ar="جارٍ الإنشاء..." /> : <AdminText en="Create customer" ar="إنشاء العميل" />}</button>
      </div>
    </Card>
  </>
}
