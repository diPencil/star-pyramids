'use client'

import { useEffect, useState } from 'react'
import { PageHead } from '@/components/admin/admin-shell'
import { AdminText, Avatar, Card } from '@/components/admin/admin-ui'
import { useAdminLocale } from '@/components/admin/admin-locale'
import { countries, defaultCountry } from '@/data/countries'
import { saveAdminProfile } from '@/lib/admin-store'
import { ImageField } from '@/components/admin/image-field'
import { CountrySelect } from '@/components/country-select'
import { InternationalPhoneInput } from '@/components/international-phone-input'
import type { AuthenticatedUser } from '@/lib/auth-types'

export default function ProfilePage() {
  const ar = useAdminLocale() === 'ar'
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [countryCode, setCountryCode] = useState(defaultCountry.code)
  const [phoneCountry, setPhoneCountry] = useState(defaultCountry.code)
  const [phone, setPhone] = useState('')
  const [avatar, setAvatar] = useState('')
  const [roles, setRoles] = useState<string[]>([])
  const [status, setStatus] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/auth/me', { credentials: 'same-origin' })
      .then(async (res) => {
        if (!res.ok) throw new Error('load-failed')
        const data = await res.json() as { user: AuthenticatedUser | null }
        if (!data.user) throw new Error('load-failed')
        return data.user
      })
      .then((user) => {
        if (cancelled) return
        setFirstName(user.firstName ?? '')
        setLastName(user.lastName ?? '')
        setUsername(user.username ?? '')
        setEmail(user.email ?? '')
        setAvatar(user.avatar ?? '')
        const code = countries.some((c) => c.code === user.countryCode) ? (user.countryCode as string) : defaultCountry.code
        setCountryCode(code)
        setPhoneCountry(code)
        setPhone(user.phone ?? '')
        setRoles(user.roles ?? [])
        setStatus(typeof user.status === 'string' ? user.status : '')
        setLoading(false)
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError(ar ? 'تعذر تحميل بيانات البروفايل.' : 'Could not load profile data.')
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [ar])

  const touch = () => setSaved(false)

  const onCountry = (code: string) => {
    setCountryCode(code)
    setPhoneCountry(code)
    touch()
  }

  const save = async () => {
    if (saving || loading) return
    setError('')
    if (!firstName.trim() || !lastName.trim()) {
      setError(ar ? 'الاسم الأول واسم العائلة حقول إلزامية.' : 'First and last name are required.')
      return
    }
    if (password && password !== confirmPassword) {
      setError(ar ? 'كلمتا المرور غير متطابقتين.' : 'The passwords do not match.')
      return
    }
    setSaving(true)
    try {
      // Save profile details
      const response = await fetch('/api/admin/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          username: username.trim(),
          email: email.trim(),
          countryCode,
          phone,
          // Persist the avatar URL (link or uploaded /media URL) with the
          // profile. Legacy data URLs keep the dedicated avatar endpoint.
          ...(!avatar.startsWith('data:') ? { avatar } : {}),
          ...(password ? { password, confirmPassword } : {}),
        }),
      })
      const data = await response.json().catch(() => ({})) as { user?: AuthenticatedUser; error?: string }
      if (!response.ok || !data.user) {
        setError(typeof data.error === 'string' && data.error
          ? data.error
          : (ar ? 'تعذر حفظ البروفايل. حاول مرة أخرى.' : 'Could not save the profile. Please try again.'))
        return
      }
      const updated: AuthenticatedUser = data.user
      setFirstName(updated.firstName ?? '')
      setLastName(updated.lastName ?? '')
      setUsername(updated.username ?? '')
      setEmail(updated.email ?? '')
      if (updated.countryCode && countries.some((c) => c.code === updated.countryCode)) {
        const code = updated.countryCode
        setCountryCode(code)
        setPhoneCountry(code)
      }
      setPhone(updated.phone ?? '')
      setRoles(updated.roles ?? [])
      setPassword('')
      setConfirmPassword('')
      // The server avatar is the source of truth: reflect it in the
      // preview and mirror it to the shell (topbar + sidebar) at once.
      setAvatar(updated.avatar ?? '')
      saveAdminProfile({ avatar: updated.avatar ?? '' })

      // Save avatar separately if it's a data URL (uploaded file)
      if (avatar && avatar.startsWith('data:')) {
        const avatarResponse = await fetch('/api/avatar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ avatar, isAdmin: true }),
        })
        const avatarData = await avatarResponse.json().catch(() => ({})) as { user?: AuthenticatedUser; error?: string }
        if (!avatarResponse.ok) {
          console.error('Avatar upload failed:', avatarData.error)
        } else if (avatarData.user) {
          setAvatar(avatarData.user.avatar ?? '')
          saveAdminProfile({ avatar: avatarData.user.avatar ?? '' })
        }
      }

      setSaved(true)
    } catch {
      setError(ar ? 'تعذر حفظ البروفايل. حاول مرة أخرى.' : 'Could not save the profile. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const displayName = `${firstName} ${lastName}`.trim() || email || 'Admin'

  return <>
    <PageHead eyebrow="Account" title="Profile" titleAr="البروفايل" sub="Account details, credentials and avatar" subAr="تفاصيل الحساب وبيانات الدخول والصورة الرمزية" actions={<button type="button" className="sp-btn dark" onClick={save} disabled={saving || loading}><AdminText en={saving ? 'Saving…' : 'Save changes'} ar={saving ? 'جارٍ الحفظ…' : 'حفظ التغييرات'} /></button>} />
    <div className="sp-set-grid">
      <div className="sp-profile-avatar">
        <Card title={<AdminText en="Avatar" ar="الصورة الرمزية" />} sub={<AdminText en="Link or upload from device" ar="رابط أو رفع من الجهاز" />}>
          <div style={{ display: 'grid', justifyItems: 'center', gap: 12 }}>
            <Avatar name={displayName} src={avatar} size={96} />
            <div className="sp-form" style={{ width: '100%' }}>
              <ImageField value={avatar} onChange={(next) => { setAvatar(next); touch() }} scope="avatar" linkLabel={{ en: 'Avatar URL', ar: 'رابط الصورة الرمزية' }} uploadLabel={{ en: 'Upload avatar', ar: 'رفع صورة رمزية' }} />
            </div>
            <small style={{ color: 'var(--sp-muted)', fontSize: 11, textAlign: 'center' }}>
              <AdminText en="Changes are saved to your account and persist across devices." ar="التغييرات محفوظة في حسابك وتظهر على جميع الأجهزة." />
            </small>
          </div>
        </Card>
      </div>
      <Card title={<AdminText en="Account details" ar="تفاصيل الحساب" />} sub={<AdminText en="Same identity fields as account registration" ar="نفس حقول هوية تسجيل الحساب" />}>
        {loading
          ? <p role="status" style={{ color: 'var(--sp-muted)' }}><AdminText en="Loading profile…" ar="جارٍ تحميل البروفايل…" /></p>
          : loadError
            ? <p role="alert" style={{ color: '#b91c1c' }}>{loadError}</p>
            : (
              <div className="sp-form">
                <div className="sp-form-2">
                  <label><AdminText en="First name" ar="الاسم الأول" /><input value={firstName} onChange={(e) => { setFirstName(e.target.value); touch() }} autoComplete="given-name" /></label>
                  <label><AdminText en="Last name" ar="اسم العائلة" /><input value={lastName} onChange={(e) => { setLastName(e.target.value); touch() }} autoComplete="family-name" /></label>
                </div>
                <div className="sp-form-2">
                  <label><AdminText en="Username" ar="اسم المستخدم" /><input value={username} onChange={(e) => { setUsername(e.target.value); touch() }} dir="ltr" autoComplete="username" /></label>
                  <label><AdminText en="Email address" ar="البريد الإلكتروني" /><input type="email" value={email} onChange={(e) => { setEmail(e.target.value); touch() }} dir="ltr" autoComplete="email" /></label>
                </div>
                <div className="sp-form-2">
                  <label><AdminText en="Country" ar="الدولة" /><CountrySelect value={countryCode} onChange={onCountry} locale={ar ? 'ar' : 'en'} /></label>
                  <label><AdminText en="Mobile number" ar="رقم الموبايل" /><InternationalPhoneInput value={phone} onChange={(next) => { setPhone(next); touch() }} locale={ar ? 'ar' : 'en'} countryCode={phoneCountry} onCountryChange={(code) => { setPhoneCountry(code); touch() }} /></label>
                </div>
                <div className="sp-form-2">
                  <label><AdminText en="New password (optional, 6-8 characters)" ar="كلمة مرور جديدة (اختياري، 6-8 أحرف)" /><input type="password" value={password} onChange={(e) => { setPassword(e.target.value); touch() }} placeholder={ar ? '6-8 أحرف' : '6-8 characters'} dir="ltr" autoComplete="new-password" /></label>
                  <label><AdminText en="Confirm password" ar="تأكيد كلمة المرور" /><input type="password" value={confirmPassword} onChange={(e) => { setConfirmPassword(e.target.value); touch() }} dir="ltr" autoComplete="new-password" /></label>
                </div>
                <div className="sp-form-2">
                  <label><AdminText en="Role" ar="الدور" /><input value={roles.join(' · ') || '-'} readOnly disabled /></label>
                  <label><AdminText en="Status" ar="الحالة" /><input value={status || '-'} readOnly disabled /></label>
                </div>
              </div>
            )}
        {error && <p role="alert" style={{ color: '#b91c1c' }}>{error}</p>}
        {saved && <p role="status" style={{ color: '#15803d' }}><AdminText en="Saved successfully." ar="تم الحفظ بنجاح." /></p>}
      </Card>
    </div>
  </>
}
