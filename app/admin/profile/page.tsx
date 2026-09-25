'use client'

import { useState } from 'react'
import { PageHead } from '@/components/admin/admin-shell'
import { AdminText, Avatar, Card } from '@/components/admin/admin-ui'
import { useAdminLocale } from '@/components/admin/admin-locale'
import { currentUser } from '@/components/admin/admin-data'
import { countries, defaultCountry } from '@/data/countries'
import { readAdminProfile, readImageFile, saveAdminProfile } from '@/lib/admin-store'

export default function ProfilePage() {
  const ar = useAdminLocale() === 'ar'
  const [profile, setProfile] = useState(readAdminProfile)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const set = (key: keyof typeof profile) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setProfile((p) => ({ ...p, [key]: e.target.value }))
    setSaved(false)
  }

  const onCountry = (code: string) => {
    const country = countries.find((c) => c.code === code) ?? defaultCountry
    setProfile((p) => ({ ...p, country: country.name, dialCode: country.dialCode }))
    setSaved(false)
  }

  const onFile = async (files: FileList | null) => {
    const dataUrl = files?.[0] ? await readImageFile(files[0]) : null
    if (dataUrl) {
      setProfile((p) => ({ ...p, avatar: dataUrl }))
      setSaved(false)
    } else {
      setError(ar ? 'الصورة كبيرة. استخدم رابطا أو صورة أقل من 1.5MB.' : 'Image too large. Use a link or an image under 1.5MB.')
    }
  }

  const save = () => {
    setError('')
    if (!profile.name.trim() || !profile.email.trim()) {
      setError(ar ? 'الاسم والبريد حقول إلزامية.' : 'Name and email are required.')
      return
    }
    if (password && password.length < 8) {
      setError(ar ? 'كلمة المرور الجديدة 8 أحرف على الأقل.' : 'The new password must be at least 8 characters.')
      return
    }
    if (password && password !== confirmPassword) {
      setError(ar ? 'كلمتا المرور غير متطابقتين.' : 'The passwords do not match.')
      return
    }
    saveAdminProfile({
      name: profile.name.trim(),
      username: profile.username.trim(),
      email: profile.email.trim(),
      country: profile.country,
      dialCode: profile.dialCode,
      phone: profile.phone.trim(),
      avatar: profile.avatar.trim(),
    })
    setPassword('')
    setConfirmPassword('')
    setSaved(true)
  }

  return <>
    <PageHead eyebrow="Account" title="Profile" titleAr="البروفايل" sub="Account details, credentials and avatar" subAr="تفاصيل الحساب وبيانات الدخول والصورة الرمزية" actions={<button type="button" className="sp-btn dark" onClick={save}><AdminText en="Save changes" ar="حفظ التغييرات" /></button>} />
    <div className="sp-set-grid" style={{ gridTemplateColumns: '320px minmax(0,1fr)' }}>
      <Card title={<AdminText en="Avatar" ar="الصورة الرمزية" />} sub={<AdminText en="Link or upload from device" ar="رابط أو رفع من الجهاز" />}>
        <div style={{ display: 'grid', justifyItems: 'center', gap: 12 }}>
          <Avatar name={profile.name || 'Admin'} src={profile.avatar} size={96} />
          <div className="sp-form" style={{ width: '100%' }}>
            <label><AdminText en="Image link" ar="رابط الصورة" /><input value={profile.avatar} onChange={set('avatar')} placeholder="https://..." dir="ltr" /></label>
            <label><AdminText en="Or upload an image" ar="أو رفع صورة" /><input type="file" accept="image/*" onChange={(e) => onFile(e.target.files)} /></label>
          </div>
        </div>
      </Card>
      <Card title={<AdminText en="Account details" ar="تفاصيل الحساب" />} sub={<AdminText en="Same fields as account registration" ar="نفس حقول تسجيل الحساب" />}>
        <div className="sp-form">
          <div className="sp-form-2">
            <label><AdminText en="Full name" ar="الاسم الكامل" /><input value={profile.name} onChange={set('name')} /></label>
            <label><AdminText en="Username" ar="اسم المستخدم" /><input value={profile.username} onChange={set('username')} dir="ltr" /></label>
          </div>
          <label><AdminText en="Email address" ar="البريد الإلكتروني" /><input type="email" value={profile.email} onChange={set('email')} dir="ltr" /></label>
          <div className="sp-form-2">
            <label><AdminText en="Country" ar="الدولة" /><select value={countries.find((c) => c.name === profile.country)?.code ?? defaultCountry.code} onChange={(e) => onCountry(e.target.value)}>{countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</select></label>
            <label><AdminText en={`Mobile number (${profile.dialCode})`} ar={`رقم الموبايل (${profile.dialCode})`} /><input type="tel" value={profile.phone} onChange={set('phone')} dir="ltr" /></label>
          </div>
          <div className="sp-form-2">
            <label><AdminText en="New password (optional)" ar="كلمة مرور جديدة (اختياري)" /><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={ar ? '8 أحرف على الأقل' : '8+ characters'} dir="ltr" /></label>
            <label><AdminText en="Confirm password" ar="تأكيد كلمة المرور" /><input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} dir="ltr" /></label>
          </div>
          <label><AdminText en="Role" ar="الدور" /><input value={currentUser.roleLabel} readOnly disabled /></label>
        </div>
        {error && <p role="alert" style={{ color: '#b91c1c' }}>{error}</p>}
        {saved && <p role="status" style={{ color: '#15803d' }}><AdminText en="Saved. Name and avatar updated in the top bar instantly." ar="تم الحفظ. تحدث الاسم والصورة في الشريط العلوي فورا." /></p>}
        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <button type="button" className="sp-btn primary" onClick={save}><AdminText en="Save changes" ar="حفظ التغييرات" /></button>
        </div>
      </Card>
    </div>
  </>
}
