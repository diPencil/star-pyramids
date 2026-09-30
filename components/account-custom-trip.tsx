'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Clock3, Eye, Minus, Pencil, Plus, X } from 'lucide-react'
import { LocaleProvider, useLocale } from '@/components/locale'
import { AccountShell, CustomerConfirmDialog, CustomerPagination, EmptyState } from './account-portal'
import { usePagination } from '@/components/admin/admin-pagination'
import { destinations } from '@/data/content'
import { catalogTours } from '@/data/tours'
import { countries, countryByDialCode, countryCode as resolveCountryCode, countryDisplayName, defaultCountry } from '@/data/countries'
import { CountrySelect } from '@/components/country-select'
import { SharedSelect } from '@/components/shared-select'
import { displayInternationalPhone } from '@/lib/phone'
import { InternationalPhoneInput } from '@/components/international-phone-input'
import { readCustomerProfile } from '@/lib/customer-account'
import { DateInput } from '@/components/date-input'
import {
  TRIP_BUDGET_CAP,
  TRIP_NOTE_MAX,
  cancelTripRequest,
  createTripRequest,
  getTripRequest,
  hasTripErrors,
  updateTripRequest,
  tripRequestStatusLabel,
  tripActivityLabel,
  useTripRequest,
  useTripRequests,
  validateTripRequest,
  type MakeYourTripRequestDraft,
  type TripFieldErrors,
  type TripRequest,
  type TripRequestStatus,
  type TripTimeMode,
} from '@/lib/trip-request'
import { resolveTripCustomer, type PendingCustomer } from '@/lib/trip-customers'
import { PendingAccountBox } from '@/components/trip-pending-account'

function errText(field: keyof TripFieldErrors, code: 'required' | 'invalid', ar: boolean): string {
  const en: Record<string, string> = {
    destination: 'Type a trip name above, or pick a tour, or choose a destination.',
    from: code === 'required' ? 'Enter your preferred start date.' : 'Enter a valid preferred start date (today or later).',
    to: code === 'required' ? 'Enter your preferred end date.' : 'Enter a valid preferred end date on or after the start date.',
    travelers: 'Travelers must include at least 1 adult (max 50 per group).',
    name: code === 'required' ? 'Enter your full name.' : 'Enter a name with at least 2 letters.',
    email: code === 'required' ? 'Enter your email address.' : 'Enter a valid email address (name@example.com).',
    nationality: 'Choose your nationality.',
    phone: code === 'required' ? 'Enter your phone number.' : 'Enter a valid phone number (at least 7 digits).',
    budget: `Preferred budget must be between 0 and ${TRIP_BUDGET_CAP.toLocaleString('en-US')} with min below max.`,
    notes: `Notes must be ${TRIP_NOTE_MAX} characters or fewer.`,
  }
  const arText: Record<string, string> = {
    destination: 'اكتب اسم الرحلة بالأعلى، أو اختر رحلة جاهزة، أو اختر وجهة.',
    from: code === 'required' ? 'أدخل تاريخ البدء المفضل.' : 'أدخل تاريخ بدء مفضلًا صالحًا (اليوم أو بعده).',
    to: code === 'required' ? 'أدخل تاريخ الانتهاء المفضل.' : 'أدخل تاريخ انتهاء مفضلًا صالحًا في تاريخ البدء أو بعده.',
    travelers: 'يجب أن يشمل المسافرون بالغًا واحدًا على الأقل (بحد أقصى 50).',
    name: code === 'required' ? 'أدخل اسمك الكامل.' : 'أدخل اسمًا من حرفين على الأقل.',
    email: code === 'required' ? 'أدخل بريدك الإلكتروني.' : 'أدخل بريدًا إلكترونيًا صالحًا (name@example.com).',
    nationality: 'اختر جنسيتك.',
    phone: code === 'required' ? 'أدخل رقم هاتفك.' : 'أدخل رقم هاتف صالحًا (7 أرقام على الأقل).',
    budget: `يجب أن تكون الميزانية المفضلة بين 0 و${TRIP_BUDGET_CAP.toLocaleString('en-US')} والحد الأدنى أقل من الأقصى.`,
    notes: `يجب ألا تتجاوز الملاحظات ${TRIP_NOTE_MAX} حرف.`,
  }
  return ar ? arText[field] : en[field]
}

function Stepper({ label, sub, value, set, min = 0 }: { label: string; sub: string; value: number; set: (v: number) => void; min?: number }) {
  return (
    <div className="guest-row">
      <span><b>{label}</b><small>{sub}</small></span>
      <div>
        <button type="button" aria-label={label} disabled={value <= min} onClick={() => set(Math.max(min, value - 1))}><Minus size={14} /></button>
        <b aria-live="polite">{value}</b>
        <button type="button" aria-label={label} disabled={value >= 50} onClick={() => set(Math.min(50, value + 1))}><Plus size={14} /></button>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: TripRequestStatus }) {
  const { locale } = useLocale()
  const ar = locale === 'ar'
  const tone = status === 'new' ? 'request_received' : status === 'reviewing' ? 'reviewing' : status === 'proposal_ready' ? 'proposal_ready' : status === 'approved' ? 'confirmed' : 'cancelled'
  return <span className={`customer-status ${tone}`}>{tripRequestStatusLabel(status, ar)}</span>
}

type LastCreated = { ref: string; stub: PendingCustomer | null; existingCustomer: boolean } | null

function TripRequestsSection({ startNew = false, editRef = null }: { startNew?: boolean; editRef?: string | null }) {
  const { locale, currency } = useLocale()
  const ar = locale === 'ar'
  const router = useRouter()
  const requests = useTripRequests()
  const [mode, setMode] = useState<'list' | 'form'>(startNew || editRef ? 'form' : 'list')
  const [editingRef, setEditingRef] = useState<string | null>(null)
  const [cancellingRef, setCancellingRef] = useState<string | null>(null)
  const [lastCreated, setLastCreated] = useState<LastCreated>(null)
  const [time, setTime] = useState<TripTimeMode>('exact')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [destination, setDestination] = useState('')
  const [tourSlug, setTourSlug] = useState('')
  const [tripName, setTripName] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [flightOffer, setFlightOffer] = useState(false)
  const [nationality, setNationality] = useState('')
  const [phoneCountry, setPhoneCountry] = useState(defaultCountry.code)
  const [phone, setPhone] = useState('')
  const [adults, setAdults] = useState(2)
  const [children, setChildren] = useState(0)
  const [infants, setInfants] = useState(0)
  const [priceMin, setPriceMin] = useState(1000)
  const [priceMax, setPriceMax] = useState(3000)
  const [note, setNote] = useState('')
  const [errors, setErrors] = useState<TripFieldErrors>({})
  const [summary, setSummary] = useState('')
  const [dateFilter, setDateFilter] = useState<'all' | 'upcoming' | 'past'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | TripRequestStatus>('all')

  // Prefill contact from the browser-local customer profile so account
  // users type less. These are editable copies; the profile is never
  // written back automatically.
  useEffect(() => {
    const profile = readCustomerProfile()
    if (profile.firstName || profile.lastName) {
      setFullName(`${profile.firstName} ${profile.lastName}`.trim())
      setEmail(profile.email && profile.email.includes('@') ? profile.email : '')
      setPhone(profile.phone || '')
    }
    const profileCountry = resolveCountryCode(profile.country)
      || countryByDialCode(profile.dialCode).code
    setNationality(profileCountry)
    setPhoneCountry(countryByDialCode(profile.dialCode).code)
    setPhone(profile.phone || '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Deep links: `?edit=SP-…` loads that exact record; `?new=1` opens a
  // blank form. The query is consumed once so refresh stays on the list.
  useEffect(() => {
    if (editRef) {
      const record = getTripRequest(editRef)
      if (record && (record.status === 'new' || record.status === 'reviewing')) {
        applyDraftRecord(record)
        setEditingRef(record.localRef)
        setMode('form')
      }
    } else if (startNew && mode === 'list') {
      blankForm()
      setEditingRef(null)
      setMode('form')
    }
    router.replace('/account/trip-requests', { scroll: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startNew, editRef])

  const blankForm = () => {
    setTime('exact')
    setFrom('')
    setTo('')
    setDestination('')
    setTourSlug('')
    setTripName('')
    setFlightOffer(false)
    setAdults(2)
    setChildren(0)
    setInfants(0)
    setPriceMin(1000)
    setPriceMax(3000)
    setNote('')
    setErrors({})
    setSummary('')
    const profile = readCustomerProfile()
    setFullName(`${profile.firstName} ${profile.lastName}`.trim())
    setEmail(profile.email && profile.email.includes('@') ? profile.email : '')
    setPhone(profile.phone || '')
    const blankCountry = resolveCountryCode(profile.country)
      || countryByDialCode(profile.dialCode).code
    setNationality(blankCountry)
    setPhoneCountry(countryByDialCode(profile.dialCode).code)
  }

  const applyDraftRecord = (record: TripRequest) => {
    setTime(record.timeMode)
    setFrom(record.preferredFrom)
    setTo(record.preferredTo)
    setDestination(record.destinationSlug)
    setTourSlug(record.tourSlug)
    if (record.tourSlug && !record.customTitle) {
      const t = catalogTours.find((item) => item.slug === record.tourSlug)
      setTripName(t ? t.title : record.tourSlug)
    } else {
      setTripName(record.customTitle)
    }
    setFullName(record.contact.name)
    setEmail(record.contact.email)
    // Legacy snapshots may carry a country NAME; normalize to ISO code.
    // Phone country hydrates independently from the stored dial code.
    setNationality(resolveCountryCode(record.contact.nationality))
    setPhoneCountry(countryByDialCode(record.contact.dialCode).code)
    setPhone(record.contact.phone)
    setAdults(record.adults)
    setChildren(record.children)
    setInfants(record.infants)
    setPriceMin(record.budgetMin)
    setPriceMax(record.budgetMax)
    setNote(record.notes)
    setFlightOffer(record.flightOffer)
  }

  const pickTour = (slug: string) => {
    setTourSlug(slug)
    if (!slug) {
      setTripName('')
      return
    }
    const t = catalogTours.find((item) => item.slug === slug)
    setTripName(t ? (ar ? t.titleAr ?? t.title : t.title) : slug)
  }

  const buildDraft = (): MakeYourTripRequestDraft => {
    return {
      destinationSlug: destination,
      tourSlug,
      customTitle: tripName.trim().slice(0, 120),
      requestedAddOns: [],
      timeMode: time,
      preferredFrom: from.trim(),
      preferredTo: to.trim(),
      adults, children, infants,
      budgetMin: priceMin, budgetMax: priceMax,
      currency,
      flightOffer,
      nationality: nationality.trim(),
      dialCode: (countries.find((c) => c.code === phoneCountry) ?? defaultCountry).dialCode,
      notes: note.trim().slice(0, TRIP_NOTE_MAX + 1),
      contact: {
        name: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
      },
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const errs = validateTripRequest(buildDraft())
    setErrors(errs)
    if (hasTripErrors(errs)) {
      setSummary(ar ? 'تعذر حفظ الطلب. راجع الحقول الموضحة أدناه.' : 'Could not save the request. Review the highlighted fields below.')
      return
    }
    if (editingRef) {
      const updated = updateTripRequest(editingRef, { ...buildDraft(), notes: note.trim().slice(0, TRIP_NOTE_MAX) }, 'customer')
      if (!updated) {
        setSummary(ar ? 'تعذر حفظ التعديلات. ربما تغيرت حالة الطلب.' : 'Could not save the changes. The request status may have changed.')
        return
      }
      setErrors({})
      setSummary('')
      setEditingRef(null)
      setLastCreated(null)
      setMode('list')
      return
    }
    const draft = { ...buildDraft(), notes: note.trim().slice(0, TRIP_NOTE_MAX) }
    const resolution = resolveTripCustomer(draft.contact.email, {
      name: draft.contact.name,
      phone: draft.contact.phone,
      dialCode: draft.dialCode,
      nationality: draft.nationality,
    })
    const created = createTripRequest(draft, { customerId: resolution.customerId, ownership: resolution.ownership })
    if (!created) {
      setSummary(ar ? 'تعذر حفظ الطلب. راجع الحقول الموضحة أدناه.' : 'Could not save the request. Review the highlighted fields below.')
      return
    }
    setErrors({})
    setSummary('')
    setEditingRef(null)
    setLastCreated({ ref: created.localRef, stub: resolution.stubCreated ? resolution.stub : null, existingCustomer: resolution.existingCustomer })
    setMode('list')
  }

  const requestNew = () => {
    blankForm()
    setEditingRef(null)
    setLastCreated(null)
    setMode('form')
  }

  const startEdit = (ref: string) => {
    const record = getTripRequest(ref)
    if (!record || (record.status !== 'new' && record.status !== 'reviewing')) return
    applyDraftRecord(record)
    setErrors({})
    setSummary('')
    setEditingRef(record.localRef)
    setLastCreated(null)
    setMode('form')
  }

  const backToList = () => {
    setErrors({})
    setSummary('')
    setEditingRef(null)
    setMode('list')
  }

  const fieldError = (field: keyof TripFieldErrors) =>
    errors[field] ? <em className="form-error" role="alert">{errText(field, errors[field]!, ar)}</em> : null

  // List filtering + pagination hooks must run on EVERY render, before any
  // early return. `usePagination` owns useState/useEffect/useMemo internally;
  // calling it after the `mode === 'form'` return below rendered fewer hooks
  // in form mode and crashed React when switching list -> form (Edit).
  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const isPastTravel = (r: TripRequest) => {
    const end = r.preferredTo || r.preferredFrom || ''
    return end !== '' && end < today
  }
  const visible = requests
    .filter((r) => (dateFilter === 'past' ? isPastTravel(r) : dateFilter === 'upcoming' ? !isPastTravel(r) : true))
    .filter((r) => statusFilter === 'all' || r.status === statusFilter)
  const paging = usePagination(visible)

  if (mode === 'form') {
    const timeTabs: { id: TripTimeMode; en: string; ar: string }[] = [
      { id: 'exact', en: 'Exact time', ar: 'موعد محدد' },
      { id: 'approx', en: 'Approximate time', ar: 'موعد تقريبي' },
      { id: 'unsure', en: 'Not sure yet', ar: 'لم أحدد بعد' },
    ]
    return (
      <section className="customer-account-block">
        <header>
          <div>
            <span>{ar ? 'طلب رحلة' : 'Trip request'}</span>
            <h2>{editingRef ? (ar ? 'تعديل طلب الرحلة' : 'Edit trip request') : (ar ? 'طلب رحلة جديدة' : 'New trip request')}</h2>
          </div>
          <button type="button" className="account-icon-action" onClick={backToList}>{ar ? 'عودة لطلباتي' : 'Back to my requests'}</button>
        </header>
        <form className="contact-form" onSubmit={handleSubmit} noValidate>
          <div className="customer-form-grid">
            <label className="full">{ar ? 'اسم الرحلة' : 'Trip name'}
              <input value={tripName} onChange={(e) => setTripName(e.target.value)} disabled={tourSlug !== ''} placeholder={ar ? 'مثال: شهر عسل في أسوان' : 'e.g. Honeymoon in Aswan'} maxLength={120} aria-label={ar ? 'اسم الرحلة' : 'Trip name'} />
              {tourSlug === '' && fieldError('destination')}
              {tourSlug !== '' && <small className="customer-field-hint">{ar ? 'الاسم من الرحلة المختارة' : 'Name taken from the selected tour'}</small>}
            </label>
            <label className="full">{ar ? 'اختر من رحلاتنا (اختياري)' : 'Choose from our tours (optional)'}
              <SharedSelect value={tourSlug} onChange={pickTour} locale={locale} label={ar ? 'رحلة جاهزة' : 'Ready-made tour'} popupWidth="trigger" options={[{ value: '', label: ar ? 'رحلة حرة بوصفك الخاص' : 'Fully custom trip in my own words' }, ...catalogTours.map((tour) => ({ value: tour.slug, label: ar ? tour.titleAr ?? tour.title : tour.title }))]} />
            </label>
            <label className="full">{ar ? 'الوجهة (اختياري)' : 'Destination (optional)'}
              <SharedSelect value={destination} onChange={setDestination} locale={locale} label={ar ? 'الوجهة' : 'Destination'} popupWidth="trigger" options={[{ value: '', label: ar ? 'اختر وجهة في مصر' : 'Choose a place in Egypt' }, ...destinations.map((item) => ({ value: item.slug, label: ar ? item.nameAr ?? item.title : item.title }))]} />
            </label>
          </div>
          <div className="customer-time-tabs" role="radiogroup" aria-label={ar ? 'موعد السفر' : 'Travel time'}>
            {timeTabs.map((tab) => (
              <button key={tab.id} type="button" role="radio" aria-checked={time === tab.id} className={time === tab.id ? 'active' : ''} onClick={() => setTime(tab.id)}>
                {ar ? tab.ar : tab.en}
              </button>
            ))}
          </div>
          <div className="customer-form-grid">
            <label>{ar ? 'تاريخ البدء المفضل' : 'Preferred start date'}<DateInput dir="ltr" value={from} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setFrom(e.target.value)} />{fieldError('from')}</label>
            <label>{ar ? 'تاريخ الانتهاء المفضل' : 'Preferred end date'}<DateInput dir="ltr" value={to} min={from || new Date().toISOString().slice(0, 10)} onChange={(e) => setTo(e.target.value)} />{fieldError('to')}</label>
          </div>
          <div className="guest-rows">
            <Stepper label={ar ? 'البالغون' : 'Adults'} sub={ar ? '12 سنة فأكثر' : 'Ages 12+'} value={adults} set={setAdults} min={1} />
            <Stepper label={ar ? 'الأطفال' : 'Children'} sub={ar ? '3 - 11 سنة' : 'Ages 3-11'} value={children} set={setChildren} />
            <Stepper label={ar ? 'الرضع' : 'Infants'} sub={ar ? 'أقل من 3 سنوات' : 'Under 3'} value={infants} set={setInfants} />
          </div>
          {errors.travelers && <em className="form-error" role="alert">{errText('travelers', errors.travelers, ar)}</em>}
          <div className="customer-form-grid">
            <label>{ar ? `الحد الأدنى (${currency})` : `Min (${currency})`}<input type="number" dir="ltr" min={0} max={TRIP_BUDGET_CAP} value={priceMin} onChange={(e) => setPriceMin(Math.max(0, Math.min(Number(e.target.value) || 0, priceMax - 100)))} /></label>
            <label>{ar ? `الحد الأقصى (${currency})` : `Max (${currency})`}<input type="number" dir="ltr" min={0} max={TRIP_BUDGET_CAP} value={priceMax} onChange={(e) => setPriceMax(Math.min(TRIP_BUDGET_CAP, Math.max(Number(e.target.value) || 0, priceMin + 100)))} /></label>
          </div>
          {fieldError('budget')}
          <label className="customer-check-row"><input type="checkbox" checked={flightOffer} onChange={(e) => setFlightOffer(e.target.checked)} />{ar ? 'تضمين خيارات الطيران في طلبي' : 'Include flight options in my request'}</label>
          <div className="customer-form-grid">
            <label className="full">{ar ? 'الاسم الكامل *' : 'Full name *'}<input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={ar ? 'اكتب اسمك الكامل' : 'Your full name'} maxLength={80} autoComplete="name" />{fieldError('name')}</label>
            <label className="full">{ar ? 'البريد الإلكتروني *' : 'Email *'}<input type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" maxLength={120} autoComplete="email" />{fieldError('email')}</label>
            <label>{ar ? 'الجنسية *' : 'Nationality *'}
              <CountrySelect value={nationality} onChange={setNationality} locale={locale} placeholder={ar ? 'اختر جنسيتك' : 'Choose your nationality'} invalid={Boolean(errors.nationality)} />
              {fieldError('nationality')}
            </label>
            <label>{ar ? 'رقم الهاتف *' : 'Phone *'}<InternationalPhoneInput value={phone} onChange={setPhone} locale={locale} countryCode={phoneCountry} onCountryChange={setPhoneCountry} />{fieldError('phone')}</label>
            <label className="full">{ar ? 'ملاحظات إضافية' : 'Additional notes'}<textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={TRIP_NOTE_MAX + 50} placeholder={ar ? 'اوصف رحلتك الحرة هنا: الأماكن والإيقاع وأي تفاصيل' : 'Describe your custom trip here: places, pace, anything'} />{fieldError('notes')}</label>
          </div>
          {summary && <p className="form-error" role="alert">{summary}</p>}
          <button className="primary-btn" type="submit">{editingRef ? (ar ? 'حفظ التعديلات' : 'Save changes') : (ar ? 'حفظ طلب الرحلة' : 'Save trip request')}</button>
        </form>
        <p className="customer-block-note">{ar ? 'طلبات النموذج التجريبي محفوظة على هذا المتصفح فقط ولا تُرسل إلى نظام STAR PYRAMIDS الفعلي.' : 'Prototype requests are stored on this browser only and are not submitted to a live STAR PYRAMIDS backend.'}</p>
      </section>
    )
  }

  if (!requests.length && !lastCreated) {
    return <section className="customer-account-block customer-full-block"><EmptyState Icon={Plus} title={ar ? 'لا يوجد طلب رحلة بعد' : 'No trip request yet'} copy={ar ? 'خطط رحلتك المخصصة وستظهر هنا.' : 'Plan your custom trip and it will appear here.'} href="/account/trip-requests?new=1" action={ar ? 'خطط رحلتك' : 'Plan your trip'} /></section>
  }

  const dateTabs = [
    { id: 'all', en: 'All', ar: 'الكل' },
    { id: 'upcoming', en: 'Upcoming', ar: 'القادمة' },
    { id: 'past', en: 'Past', ar: 'السابقة' },
  ] as const
  const statusOptions = ['new', 'reviewing', 'proposal_ready', 'approved', 'rejected', 'cancelled'] as const
  const viewLabel = ar ? 'عرض الطلب' : 'View request'
  return (
    <section className="customer-account-block customer-full-block">
      {lastCreated && (
        <div style={{ padding: '18px 18px 0' }}>
          <div className="customer-inline-success" role="status">
            <strong>{ar ? 'تم حفظ طلب الرحلة' : 'Trip request saved'}</strong>
            <span dir="ltr">{lastCreated.ref}</span>
            {lastCreated.existingCustomer && <small>{ar ? 'يوجد حساب بالفعل لهذا البريد. سجّل الدخول لإدارة الطلبات المرتبطة بحسابك.' : 'An account already exists for this email. Sign in to manage requests associated with your account.'}</small>}
            <button type="button" className="account-icon-action" onClick={() => setLastCreated(null)}>{ar ? 'إخفاء' : 'Dismiss'}</button>
          </div>
          {lastCreated.stub && lastCreated.stub.status === 'pending' && (
            <PendingAccountBox stub={lastCreated.stub} onCompleted={(updated) => setLastCreated({ ...lastCreated, stub: updated })} />
          )}
        </div>
      )}
      <div className="customer-filterbar">
        <div role="tablist" aria-label={ar ? 'فلترة طلبات الرحلات' : 'Filter trip requests'}>
          {dateTabs.map((tab) => <button key={tab.id} type="button" className={dateFilter === tab.id ? 'active' : ''} onClick={() => setDateFilter(tab.id)}>{ar ? tab.ar : tab.en}</button>)}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <SharedSelect value={statusFilter} onChange={(next) => setStatusFilter(next as typeof statusFilter)} locale={locale} label={ar ? 'فلترة حسب الحالة' : 'Filter by status'} options={[{ value: 'all', label: ar ? 'كل الحالات' : 'All statuses' }, ...statusOptions.map((s) => ({ value: s, label: tripRequestStatusLabel(s, ar) }))]} />
          <button type="button" className="account-icon-action" onClick={requestNew}><Plus size={16} />{ar ? 'طلب جديد' : 'New request'}</button>
        </div>
      </div>
      {paging.pageRows.length ? (
        <>
          <div className="customer-table-wrap"><table className="customer-table">
            <thead><tr><th>#</th><th>{ar ? 'الوجهة' : 'Destination'}</th><th>{ar ? 'التواريخ' : 'Dates'}</th><th>{ar ? 'المسافرون' : 'Travelers'}</th><th>{ar ? 'الميزانية' : 'Budget'}</th><th>{ar ? 'الحالة' : 'Status'}</th><th></th></tr></thead>
            <tbody>{paging.pageRows.map((r, index) => {
              const detailHref = `/account/trip-requests/detail?ref=${encodeURIComponent(r.localRef)}`
              const editable = r.status === 'new' || r.status === 'reviewing'
              return <tr key={r.localRef}>
                <td className="customer-row-number">{paging.from + index}</td>
                <td><span className="customer-trip-cell"><span><strong><Link href={detailHref}>{titleOf(r)}</Link></strong><small><span dir="ltr">{r.localRef}</span></small></span></span></td>
                <td><span dir="ltr">{dateTextOf(r)}</span></td>
                <td>{r.adults + r.children + r.infants}</td>
                <td><span dir="ltr">{r.budgetMin.toLocaleString('en-US')} - {r.budgetMax.toLocaleString('en-US')} {r.currency}</span></td>
                <td><StatusBadge status={r.status} /></td>
                <td><span className="customer-table-actions">
                  <Link href={detailHref} aria-label={viewLabel} title={viewLabel}><Eye size={16} /></Link>
                  {editable && <button type="button" onClick={() => startEdit(r.localRef)} aria-label={ar ? 'تعديل الطلب' : 'Edit request'} title={ar ? 'تعديل الطلب' : 'Edit request'}><Pencil size={16} /></button>}
                  {editable && <button type="button" className="danger" onClick={() => setCancellingRef(r.localRef)} aria-label={ar ? 'إلغاء الطلب' : 'Cancel request'} title={ar ? 'إلغاء الطلب' : 'Cancel request'}><X size={16} /></button>}
                </span></td>
              </tr>
            })}</tbody>
          </table></div>
          <CustomerConfirmDialog
            open={cancellingRef !== null}
            onClose={() => setCancellingRef(null)}
            onConfirm={() => { if (cancellingRef) cancelTripRequest(cancellingRef, 'customer'); setCancellingRef(null) }}
            title={ar ? 'إلغاء طلب الرحلة؟' : 'Cancel this trip request?'}
            copy={ar ? 'سيبقى هذا الطلب في سجلك بحالة ملغي.' : 'This request will remain in your history with a Cancelled status.'}
            confirmLabel={ar ? 'إلغاء الطلب' : 'Cancel request'}
            cancelLabel={ar ? 'أبقِ الطلب' : 'Keep request'}
          />
          <CustomerPagination page={paging.page} pageCount={paging.pageCount} onPage={paging.setPage} pageSize={paging.pageSize} onPageSize={paging.setPageSize} from={paging.from} to={paging.to} total={paging.total} />
          <div style={{ padding: '0 18px 18px' }}>
            <p className="car-request-notice" role="note"><Clock3 size={15} /><span>{ar ? 'طلبات النموذج التجريبي محفوظة على هذا المتصفح فقط ولا تُرسل إلى نظام STAR PYRAMIDS الفعلي.' : 'Prototype requests are stored on this browser only and are not submitted to a live STAR PYRAMIDS backend.'}</span></p>
          </div>
        </>
      ) : (
        <div className="customer-empty"><span><Clock3 size={24} /></span><h3>{ar ? 'لا توجد طلبات في هذا العرض' : 'No requests in this view'}</h3><p>{ar ? 'جرب فلترًا مختلفًا من الأعلى.' : 'Try a different filter above.'}</p><button type="button" className="account-icon-action" onClick={() => { setDateFilter('all'); setStatusFilter('all') }}>{ar ? 'عرض الكل' : 'Show all'}</button></div>
      )}
    </section>
  )
}

function titleOf(r: TripRequest): string {
  if (r.customTitle) return r.customTitle
  if (r.tourSlug) return catalogTours.find((item) => item.slug === r.tourSlug)?.title ?? r.tourSlug
  if (r.destinationSlug) return destinations.find((item) => item.slug === r.destinationSlug)?.title ?? r.destinationSlug
  return 'Custom trip'
}

function dateTextOf(r: TripRequest): string {
  if (r.preferredFrom && r.preferredTo && r.preferredFrom !== r.preferredTo) return `${r.preferredFrom} → ${r.preferredTo}`
  return r.preferredFrom || r.preferredTo || ''
}

export function CustomerTripRequestsPage({ startNew = false, editRef = null }: { startNew?: boolean; editRef?: string | null }) {
  return (
    <LocaleProvider>
      <AccountShell
        section="trip-requests"
        headLeading={<HeadPlanTrip />}
      >
        <TripRequestsSection startNew={startNew} editRef={editRef} />
      </AccountShell>
    </LocaleProvider>
  )
}

function HeadPlanTrip() {
  const { locale } = useLocale()
  const ar = locale === 'ar'
  return <Link href="/account/trip-requests?new=1" className="account-icon-action"><Plus size={17} />{ar ? 'خطط رحلتك' : 'Plan your trip'}</Link>
}

export function TripRequestDetailSection({ reference }: { reference: string }) {
  const { locale } = useLocale()
  const ar = locale === 'ar'
  const item = useTripRequest(reference)
  const [cancelling, setCancelling] = useState(false)
  if (!item) {
    return (
      <div className="customer-inline-empty">
        <Clock3 size={20} />
        <span>
          <strong>{ar ? 'طلب الرحلة غير موجود' : 'Trip request not found'}</strong>
          <small>{ar ? 'ربما تم حذفه أو أنه محفوظ في متصفح مختلف.' : 'It may have been removed or saved in a different browser.'}</small>
        </span>
        <Link href="/account/trip-requests">{ar ? 'عودة لطلبات الرحلات' : 'Back to trip requests'}</Link>
      </div>
    )
  }
  const editable = item.status === 'new' || item.status === 'reviewing'
  const timeLabel = item.timeMode === 'exact' ? (ar ? 'موعد محدد' : 'Exact time') : item.timeMode === 'approx' ? (ar ? 'موعد تقريبي' : 'Approximate time') : (ar ? 'لم يحدد بعد' : 'Not sure yet')
  return (
    <div className="customer-account-block">
      <header>
        <div>
          <span>{ar ? 'تفاصيل طلب الرحلة' : 'Trip request detail'}</span>
          <h2>{titleOf(item)}</h2>
        </div>
        <StatusBadge status={item.status} />
      </header>
      <dl className="customer-detail-grid">
        <div><dt>{ar ? 'المرجع المحلي' : 'Local reference'}</dt><dd dir="ltr">{item.localRef}</dd></div>
        <div><dt>{ar ? 'أُنشئ في' : 'Created'}</dt><dd>{new Date(item.createdAt).toLocaleString(ar ? 'ar-EG' : 'en-US')}</dd></div>
        <div><dt>{ar ? 'آخر تحديث' : 'Updated'}</dt><dd>{new Date(item.updatedAt).toLocaleString(ar ? 'ar-EG' : 'en-US')}</dd></div>
        <div><dt>{ar ? 'الوجهة' : 'Destination'}</dt><dd>{titleOf(item)}</dd></div>
        <div><dt>{ar ? 'التواريخ' : 'Dates'}</dt><dd dir="ltr">{dateTextOf(item) || (ar ? 'موعد مرن' : 'Flexible date')}</dd></div>
        <div><dt>{ar ? 'إيقاع المواعيد' : 'Date flexibility'}</dt><dd>{timeLabel}</dd></div>
        <div><dt>{ar ? 'المسافرون' : 'Travelers'}</dt><dd>{ar ? `${item.adults} بالغ، ${item.children} أطفال، ${item.infants} رضع` : `${item.adults} adults, ${item.children} children, ${item.infants} infants`}</dd></div>
        <div><dt>{ar ? 'خيارات الطيران' : 'Flight options'}</dt><dd>{item.flightOffer ? (ar ? 'مطلوبة' : 'Requested') : (ar ? 'غير مطلوبة' : 'Not requested')}</dd></div>
        {item.requestedAddOns.length > 0 && <div className="full"><dt>{ar ? 'إضافات مطلوبة' : 'Requested add-ons'}</dt><dd>{item.requestedAddOns.join(ar ? '، ' : ', ')}</dd></div>}
        <div><dt>{ar ? 'الميزانية' : 'Budget'}</dt><dd dir="ltr">{item.budgetMin.toLocaleString('en-US')} - {item.budgetMax.toLocaleString('en-US')} {item.currency}</dd></div>
        <div><dt>{ar ? 'الاسم' : 'Name'}</dt><dd>{item.contact.name}</dd></div>
        <div><dt>{ar ? 'البريد الإلكتروني' : 'Email'}</dt><dd dir="ltr">{item.contact.email}</dd></div>
        <div><dt>{ar ? 'الهاتف' : 'Phone'}</dt><dd dir="ltr">{displayInternationalPhone(item.contact.dialCode, item.contact.phone)}</dd></div>
        <div><dt>{ar ? 'الجنسية' : 'Nationality'}</dt><dd>{countryDisplayName(item.contact.nationality, locale)}</dd></div>
        {item.notes && <div className="full"><dt>{ar ? 'ملاحظات' : 'Notes'}</dt><dd>{item.notes}</dd></div>}
      </dl>
      {item.activity.length > 0 && (
        <section className="customer-activity" aria-label={ar ? 'سجل الطلب' : 'Request activity'}>
          <h3>{ar ? 'سجل الطلب' : 'Activity'}</h3>
          <ul>{item.activity.map((a, i) => <li key={`${a.at}-${i}`}><span>{new Date(a.at).toLocaleString(ar ? 'ar-EG' : 'en-US')}</span><strong>{tripActivityLabel(a.action, ar)}</strong>{a.note && <small>{a.note}</small>}</li>)}</ul>
        </section>
      )}
      <div className="customer-detail-actions">
        <Link href="/account/trip-requests" className="account-icon-action">{ar ? 'عودة للقائمة' : 'Back to list'}</Link>
        {editable && <Link href={`/account/trip-requests?edit=${encodeURIComponent(item.localRef)}`} className="account-icon-action"><Pencil size={16} />{ar ? 'تعديل الطلب' : 'Edit request'}</Link>}
        {editable && (
          <button type="button" className="account-icon-action danger" onClick={() => setCancelling(true)}><X size={16} />{ar ? 'إلغاء الطلب' : 'Cancel request'}</button>
        )}
      </div>
      <CustomerConfirmDialog
        open={cancelling}
        onClose={() => setCancelling(false)}
        onConfirm={() => { cancelTripRequest(item.localRef, 'customer'); setCancelling(false) }}
        title={ar ? 'إلغاء طلب الرحلة؟' : 'Cancel this trip request?'}
        copy={ar ? 'سيبقى هذا الطلب في سجلك بحالة ملغي.' : 'This request will remain in your history with a Cancelled status.'}
        confirmLabel={ar ? 'إلغاء الطلب' : 'Cancel request'}
        cancelLabel={ar ? 'أبقِ الطلب' : 'Keep request'}
      />
      <p className="customer-block-note">{ar ? 'طلبات النموذج التجريبي محفوظة على هذا المتصفح فقط ولا تُرسل إلى نظام STAR PYRAMIDS الفعلي. بيانات التواصل المعروضة لقطة تاريخية لهذا الطلب.' : 'Prototype requests are stored on this browser only and are not submitted to a live STAR PYRAMIDS backend. Contact details shown are a historical snapshot of this request.'}</p>
    </div>
  )
}

export function CustomerTripRequestDetailPage({ reference }: { reference: string }) {
  return (
    <LocaleProvider>
      <TripRequestDetailShell reference={reference} />
    </LocaleProvider>
  )
}

function TripRequestDetailShell({ reference }: { reference: string }) {
  const { locale } = useLocale()
  const ar = locale === 'ar'
  return (
    <AccountShell section="trip-requests" headLeading={<Link href="/account/trip-requests" className="account-icon-action">{ar ? 'عودة لطلبات الرحلات' : 'Back to trip requests'}</Link>}>
      <TripRequestDetailSection reference={reference} />
    </AccountShell>
  )
}
