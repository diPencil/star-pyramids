'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageHead } from '@/components/admin/admin-shell'
import { AdminText, Card } from '@/components/admin/admin-ui'
import { useAdminLocale } from '@/components/admin/admin-locale'
import { countries, countryFlag, defaultCountry } from '@/data/countries'
import { saveCustomItem, slugify, type AdminCustomer } from '@/lib/admin-store'
import { ImageField } from '@/components/admin/image-field'

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

  const country = countries.find((c) => c.code === countryCode) ?? defaultCountry

  const save = () => {
    if (!firstName.trim() || !lastName.trim() || !username.trim() || !email.trim() || !phone.trim()) {
      setError(ar ? 'الاسم والبريد والهاتف حقول إلزامية.' : 'Name, email and phone are required.')
      return
    }
    if (password.length < 8) {
      setError(ar ? 'كلمة المرور 8 أحرف على الأقل مثل صفحة التسجيل.' : 'Password must be at least 8 characters like the registration page.')
      return
    }
    if (password !== confirmPassword) {
      setError(ar ? 'كلمتا المرور غير متطابقتين.' : 'The passwords do not match.')
      return
    }
    const item: AdminCustomer = {
      slug: slugify(username),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      name: `${firstName.trim()} ${lastName.trim()}`,
      username: username.trim(),
      email: email.trim(),
      country: country.name,
      dialCode: country.dialCode,
      phone: `${country.dialCode} ${phone.trim()}`,
      avatar: avatar.trim() || undefined,
      active: true,
      createdAt: new Date().toISOString().slice(0, 10),
    }
    saveCustomItem('customers', item)
    router.push('/admin/customers')
  }

  return <>
    <PageHead eyebrow="CRM" title="New customer" titleAr="عميل جديد" sub="Same fields as the website registration form" subAr="نفس حقول نموذج التسجيل في الموقع" actions={<button type="button" className="sp-btn dark" onClick={save}><AdminText en="Create customer" ar="إنشاء العميل" /></button>} />
    <Card title={<AdminText en="Customer details" ar="بيانات العميل" />}>
      <div className="sp-form">
        <div className="sp-form-2">
          <label><AdminText en="First name" ar="الاسم الأول" /><input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="John" /></label>
          <label><AdminText en="Last name" ar="اسم العائلة" /><input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Smith" /></label>
        </div>
        <label><AdminText en="Username" ar="اسم المستخدم" /><input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="john.smith" dir="ltr" /></label>
        <label><AdminText en="Email address" ar="البريد الإلكتروني" /><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" dir="ltr" /></label>
        <div className="sp-form-2">
          <label><AdminText en="Country" ar="الدولة" /><select value={countryCode} onChange={(e) => setCountryCode(e.target.value)}>{countries.map((c) => <option key={c.code} value={c.code}>{countryFlag(c.code)} {c.name} ({c.dialCode})</option>)}</select></label>
          <label><AdminText en="Mobile number" ar="رقم الموبايل" /><span className="sp-phone-field"><span>{countryFlag(country.code)} {country.dialCode}</span><input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="100 000 0000" dir="ltr" /></span></label>
        </div>
        <div className="sp-form-2">
          <label><AdminText en="Password (8+ characters)" ar="كلمة المرور (8 أحرف على الأقل)" /><input type={showPassword ? 'text' : 'password'} minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" /></label>
          <label><AdminText en="Confirm password" ar="تأكيد كلمة المرور" /><input type={showPassword ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} dir="ltr" /></label>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, flexDirection: 'row' }}>
          <input type="checkbox" checked={showPassword} onChange={(e) => setShowPassword(e.target.checked)} style={{ width: 18 }} />
          <AdminText en="Show password" ar="إظهار كلمة المرور" />
        </label>
        <ImageField value={avatar} onChange={setAvatar} />
      </div>
      {error && <p role="alert" style={{ color: '#b91c1c' }}>{error}</p>}
      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <button type="button" className="sp-btn primary" onClick={save}><AdminText en="Create customer" ar="إنشاء العميل" /></button>
      </div>
    </Card>
  </>
}
