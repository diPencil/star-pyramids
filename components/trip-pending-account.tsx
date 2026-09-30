'use client'

import { useState } from 'react'
import { Check, ShieldCheck, UserRound } from 'lucide-react'
import { useLocale } from '@/components/locale'
import { completePendingCustomer, type PendingCustomer } from '@/lib/trip-customers'
import { countries, countryByDialCode, nationalPhone, resolveCountry } from '@/data/countries'
import { CountrySelect } from '@/components/country-select'
import { InternationalPhoneInput } from './international-phone-input'

/**
 * Honest pending-account UX for a freshly prepared browser-local stub.
 * Collects profile completion fields and flips `pending` to `active-local`.
 * Collects no password and claims no email: secure setup and verification
 * arrive with the backend authentication service.
 */
export function PendingAccountBox({ stub, onCompleted }: { stub: PendingCustomer; onCompleted?: (updated: PendingCustomer) => void }) {
  const { locale } = useLocale()
  const ar = locale === 'ar'
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(stub.name)
  const [phone, setPhone] = useState(stub.phone)
  // Legacy stubs may carry a country NAME; normalize to ISO code.
  // Phone hydrates from the stored dial code independently.
  const initialCountry = resolveCountry(stub.nationality) ?? countryByDialCode(stub.dialCode)
  const [countryCode, setCountryCode] = useState(initialCountry.code)
  const [done, setDone] = useState(stub.status === 'active-local')

  if (done) {
    return (
      <div className="myt-success" style={{ marginTop: 18 }} role="status">
        <p><Check size={15} style={{ verticalAlign: '-2px', marginInlineEnd: 6 }} />{ar ? 'حسابك المحلي جاهز على هذا المتصفح.' : 'Your local account is ready on this browser.'}</p>
      </div>
    )
  }

  const save = () => {
    const selectedCountry = countries.find((country) => country.code === countryCode) ?? initialCountry
    const updated = completePendingCustomer(stub.id, { name, phone: nationalPhone(phone, selectedCountry.dialCode), dialCode: selectedCountry.dialCode, nationality: selectedCountry.code })
    if (!updated) return
    setDone(true)
    onCompleted?.(updated)
  }

  return (
    <div className="myt-success" style={{ marginTop: 18 }}>
      <h2 style={{ fontSize: 20 }}>{ar ? 'جهزنا لك حسابًا محليًا' : 'We prepared a local account for you'}</h2>
      <p><UserRound size={15} style={{ verticalAlign: '-2px', marginInlineEnd: 6 }} />{ar ? `أعددنا حساب STAR PYRAMIDS محليًا للبريد ${stub.email} حتى تكمل بياناتك وتدير طلبك على هذا المتصفح.` : `We prepared a local STAR PYRAMIDS account for ${stub.email} so you can continue your profile and manage this request on this browser.`}</p>
      <p><ShieldCheck size={15} style={{ verticalAlign: '-2px', marginInlineEnd: 6 }} />{ar ? 'نموذج تجريبي على المتصفح. لم نرسل أي بريد إلكتروني.' : 'Browser-local prototype. No email was sent.'}</p>
      {!open ? (
        <div className="myt-success-actions">
          <button type="button" className="primary-btn" onClick={() => setOpen(true)}>{ar ? 'استكمال حسابي' : 'Complete my account'}</button>
        </div>
      ) : (
        <div style={{ maxWidth: 520, margin: '18px auto', textAlign: 'start', display: 'grid', gap: 12 }}>
          <label className="myt-field"><span className="myt-label">{ar ? 'الاسم الكامل' : 'Full name'}</span><input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="name" /></label>
          <label className="myt-field"><span className="myt-label">{ar ? 'الجنسية' : 'Nationality'}</span><CountrySelect value={countryCode} onChange={setCountryCode} locale={locale} /></label>
          <label className="myt-field"><span className="myt-label">{ar ? 'رقم الهاتف' : 'Phone'}</span><InternationalPhoneInput value={phone} onChange={setPhone} locale={locale} countryCode={countryCode} onCountryChange={setCountryCode} /></label>
          <p className="myt-tour-note" style={{ margin: 0 }}>{ar ? 'سيتم تفعيل إعداد كلمة مرور آمنة والتحقق من البريد عند توصيل خدمة المصادقة في الخلفية.' : 'Secure password setup and email verification will be enabled when the backend authentication service is connected.'}</p>
          <div className="myt-success-actions">
            <button type="button" className="primary-btn" onClick={save}>{ar ? 'حفظ وإكمال' : 'Save and complete'}</button>
          </div>
        </div>
      )}
    </div>
  )
}
