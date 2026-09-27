'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Ban, Clock3, Minus, Pencil, Plus } from 'lucide-react'
import { LocaleProvider, useLocale } from '@/components/locale'
import { AccountShell, CustomerConfirmDialog, EmptyState } from './account-portal'
import { destinations } from '@/data/content'
import { catalogTours } from '@/data/tours'
import { countries, defaultCountry } from '@/data/countries'
import { readCustomerProfile } from '@/lib/customer-account'
import {
  TRIP_BUDGET_CAP,
  TRIP_NOTE_MAX,
  clearTripPreview,
  hasTripErrors,
  readTripPreview,
  recordTripRequestPreview,
  sanitizeTripDraft,
  validateTripRequest,
  type MakeYourTripRequestDraft,
  type TripFieldErrors,
  type TripRequestPreview,
  type TripTimeMode,
} from '@/lib/trip-request'

const NATIONALITIES = ['Egyptian', 'American', 'British', 'French', 'German', 'Spanish', 'Italian', 'Saudi', 'Emirati', 'Canadian', 'Australian', 'Other'] as const

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

function TripRequestsSection({ startNew = false }: { startNew?: boolean }) {
  const { locale, currency } = useLocale()
  const ar = locale === 'ar'
  const router = useRouter()
  const [placed, setPlaced] = useState<TripRequestPreview | null>(null)
  const [activeRef, setActiveRef] = useState<string | null>(null)
  const [mode, setMode] = useState<'list' | 'form'>(startNew ? 'form' : 'list')
  const [editing, setEditing] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [confirmReplace, setConfirmReplace] = useState(false)
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
  const [countryCode, setCountryCode] = useState(defaultCountry.code)
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

  const selectedCountry = countries.find((c) => c.code === countryCode) ?? defaultCountry

  // Resume the single browser-local preview; prefill contact from the
  // customer profile so account users type less than website guests.
  useEffect(() => {
    const profile = readCustomerProfile()
    if (profile.firstName || profile.lastName) {
      setFullName(`${profile.firstName} ${profile.lastName}`.trim())
      setEmail(profile.email && profile.email.includes('@') ? profile.email : '')
      setPhone(profile.phone || '')
    }
    const stored = readTripPreview()
    if (!stored) return
    const clean = sanitizeTripDraft(stored.draft)
    if (!clean) return
    setActiveRef(stored.localRef)
    setPlaced({ draft: clean, localRef: stored.localRef })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Header "Plan your trip" deep link: open a blank form, or offer to
  // replace the saved request when one already exists.
  useEffect(() => {
    if (!startNew || mode !== 'list') return
    if (placed) setConfirmReplace(true)
    else {
      blankForm()
      setEditing(false)
      setMode('form')
    }
    router.replace('/account/trip-requests', { scroll: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startNew])

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
  }

  const applyDraft = (clean: MakeYourTripRequestDraft) => {
    setTime(clean.timeMode)
    setFrom(clean.preferredFrom)
    setTo(clean.preferredTo)
    setDestination(clean.destinationSlug)
    setTourSlug(clean.tourSlug)
    if (clean.tourSlug && !clean.customTitle) {
      const t = catalogTours.find((item) => item.slug === clean.tourSlug)
      setTripName(t ? t.title : clean.tourSlug)
    } else {
      setTripName(clean.customTitle)
    }
    setFullName(clean.contact.name)
    setEmail(clean.contact.email)
    setNationality(clean.nationality)
    if (clean.dialCode) {
      const match = countries.find((c) => c.dialCode === clean.dialCode)
      if (match) setCountryCode(match.code)
    }
    setPhone(clean.contact.phone.replace(clean.dialCode, '').trim() || clean.contact.phone)
    setAdults(clean.adults)
    setChildren(clean.children)
    setInfants(clean.infants)
    setPriceMin(clean.budgetMin)
    setPriceMax(clean.budgetMax)
    setNote(clean.notes)
    setFlightOffer(clean.flightOffer)
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
    const cleanPhone = phone.trim()
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
      dialCode: selectedCountry.dialCode,
      notes: note.trim().slice(0, TRIP_NOTE_MAX + 1),
      contact: {
        name: fullName.trim(),
        email: email.trim(),
        phone: cleanPhone ? `${selectedCountry.dialCode} ${cleanPhone}`.trim() : '',
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
    const preview = recordTripRequestPreview({ ...buildDraft(), notes: note.trim().slice(0, TRIP_NOTE_MAX) }, activeRef)
    setErrors({})
    setSummary('')
    setActiveRef(preview.localRef)
    setPlaced(preview)
    setEditing(false)
    setMode('list')
  }

  const requestNew = () => {
    if (placed) setConfirmReplace(true)
    else {
      blankForm()
      setEditing(false)
      setMode('form')
    }
  }

  const confirmNew = () => {
    clearTripPreview()
    setPlaced(null)
    setActiveRef(null)
    blankForm()
    setEditing(false)
    setMode('form')
    setConfirmReplace(false)
  }

  const startEdit = () => {
    if (!placed) return
    applyDraft(placed.draft)
    setErrors({})
    setSummary('')
    setEditing(true)
    setMode('form')
  }

  const backToList = () => {
    setErrors({})
    setSummary('')
    setEditing(false)
    setMode('list')
  }

  const handleDiscard = () => {
    clearTripPreview()
    setPlaced(null)
    setActiveRef(null)
    setEditing(false)
    setErrors({})
    setSummary('')
    setConfirmDiscard(false)
    setMode('list')
  }

  const fieldError = (field: keyof TripFieldErrors) =>
    errors[field] ? <em className="form-error" role="alert">{errText(field, errors[field]!, ar)}</em> : null

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
            <h2>{editing ? (ar ? 'تعديل طلب الرحلة' : 'Edit trip request') : (ar ? 'طلب رحلة جديدة' : 'New trip request')}</h2>
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
              <select value={tourSlug} onChange={(e) => pickTour(e.target.value)} aria-label={ar ? 'رحلة جاهزة' : 'Ready-made tour'}>
                <option value="">{ar ? 'رحلة حرة بوصفك الخاص' : 'Fully custom trip in my own words'}</option>
                {catalogTours.map((tour) => <option key={tour.slug} value={tour.slug}>{ar ? tour.titleAr ?? tour.title : tour.title}</option>)}
              </select>
            </label>
            <label className="full">{ar ? 'الوجهة (اختياري)' : 'Destination (optional)'}
              <select value={destination} onChange={(e) => setDestination(e.target.value)} aria-label={ar ? 'الوجهة' : 'Destination'}>
                <option value="">{ar ? 'اختر وجهة في مصر' : 'Choose a place in Egypt'}</option>
                {destinations.map((item) => <option key={item.slug} value={item.slug}>{ar ? item.nameAr ?? item.title : item.title}</option>)}
              </select>
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
            <label>{ar ? 'تاريخ البدء المفضل' : 'Preferred start date'}<input type="date" dir="ltr" value={from} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setFrom(e.target.value)} />{fieldError('from')}</label>
            <label>{ar ? 'تاريخ الانتهاء المفضل' : 'Preferred end date'}<input type="date" dir="ltr" value={to} min={from || new Date().toISOString().slice(0, 10)} onChange={(e) => setTo(e.target.value)} />{fieldError('to')}</label>
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
              <select value={nationality} onChange={(e) => setNationality(e.target.value)}>
                <option value="">{ar ? 'اختر جنسيتك' : 'Choose your nationality'}</option>
                {NATIONALITIES.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              {fieldError('nationality')}
            </label>
            <label>{ar ? 'رقم الهاتف *' : 'Phone *'}<span className="customer-phone-field"><span aria-hidden="true">{selectedCountry.dialCode}</span><input type="tel" inputMode="tel" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={ar ? 'رقم الهاتف' : 'Phone number'} maxLength={24} autoComplete="tel" /></span>{fieldError('phone')}</label>
            <label className="full">{ar ? 'ملاحظات إضافية' : 'Additional notes'}<textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={TRIP_NOTE_MAX + 50} placeholder={ar ? 'اوصف رحلتك الحرة هنا: الأماكن والإيقاع وأي تفاصيل' : 'Describe your custom trip here: places, pace, anything'} />{fieldError('notes')}</label>
          </div>
          {summary && <p className="form-error" role="alert">{summary}</p>}
          <button className="primary-btn" type="submit">{editing ? (ar ? 'حفظ التعديلات' : 'Save changes') : (ar ? 'حفظ طلب الرحلة' : 'Save trip request')}</button>
        </form>
        <p className="customer-block-note">{ar ? 'طلب مبدئي محفوظ محليًا على هذا المتصفح فقط. لم يتم إرساله إلى STAR PYRAMIDS.' : 'Preliminary request saved locally on this browser only. It has not been submitted to STAR PYRAMIDS.'}</p>
        <CustomerConfirmDialog
          open={confirmReplace}
          onClose={() => setConfirmReplace(false)}
          onConfirm={confirmNew}
          title={ar ? 'استبدال الطلب المحفوظ؟' : 'Replace the saved request?'}
          copy={ar ? 'يوجد طلب محفوظ بالفعل. إنشاء طلب جديد سيستبدله. لن يتأثر أي شيء آخر.' : 'A request is already saved. Creating a new one replaces it. Nothing else is affected.'}
          confirmLabel={ar ? 'طلب جديد' : 'New request'}
        />
      </section>
    )
  }

  if (!placed) {
    return <section className="customer-account-block customer-full-block"><EmptyState Icon={Plus} title={ar ? 'لا يوجد طلب رحلة بعد' : 'No trip request yet'} copy={ar ? 'خطط رحلتك المخصصة وستظهر هنا.' : 'Plan your custom trip and it will appear here.'} href="/account/trip-requests?new=1" action={ar ? 'خطط رحلتك' : 'Plan your trip'} /></section>
  }

  const d = placed.draft
  const tourTitle = d.tourSlug ? catalogTours.find((item) => item.slug === d.tourSlug)?.title : undefined
  const destTitle = d.customTitle || tourTitle || destinations.find((item) => item.slug === d.destinationSlug)?.title || (ar ? 'رحلة مخصصة' : 'Custom trip')
  const dateText = d.preferredFrom && d.preferredTo && d.preferredFrom !== d.preferredTo
    ? `${d.preferredFrom} → ${d.preferredTo}`
    : d.preferredFrom || d.preferredTo || (ar ? 'موعد مرن' : 'Flexible date')
  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const travelEnd = d.preferredTo || d.preferredFrom || ''
  const isPast = travelEnd !== '' && travelEnd < today
  const shown = dateFilter === 'all' || (dateFilter === 'past' ? isPast : !isPast)
  const dateTabs = [
    { id: 'all', en: 'All', ar: 'الكل' },
    { id: 'upcoming', en: 'Upcoming', ar: 'القادمة' },
    { id: 'past', en: 'Past', ar: 'السابقة' },
  ] as const
  return (
    <section className="customer-account-block customer-full-block">
      <div className="customer-filterbar">
        <div role="tablist" aria-label={ar ? 'فلترة طلبات الرحلات' : 'Filter trip requests'}>
          {dateTabs.map((tab) => <button key={tab.id} type="button" className={dateFilter === tab.id ? 'active' : ''} onClick={() => setDateFilter(tab.id)}>{ar ? tab.ar : tab.en}</button>)}
        </div>
        <button type="button" className="account-icon-action" onClick={requestNew}><Plus size={16} />{ar ? 'طلب جديد' : 'New request'}</button>
      </div>
      {shown && <div className="trip-request-stack">
      <div className="customer-table-wrap"><table className="customer-table">
        <thead><tr><th>#</th><th>{ar ? 'الوجهة' : 'Destination'}</th><th>{ar ? 'التواريخ' : 'Dates'}</th><th>{ar ? 'المسافرون' : 'Travelers'}</th><th>{ar ? 'الميزانية' : 'Budget'}</th><th>{ar ? 'الحالة' : 'Status'}</th><th></th></tr></thead>
        <tbody><tr>
          <td className="customer-row-number">1</td>
          <td><span className="customer-trip-cell"><span><strong>{destTitle}</strong><small><span dir="ltr">{placed.localRef}</span></small></span></span></td>
          <td><span dir="ltr">{dateText}</span></td>
          <td>{d.adults + d.children + d.infants}</td>
          <td><span dir="ltr">{d.budgetMin.toLocaleString('en-US')} - {d.budgetMax.toLocaleString('en-US')} {d.currency}</span></td>
          <td><span className="customer-status local"><Clock3 size={13} />{ar ? 'معاينة محلية' : 'Local preview'}</span></td>
          <td><span className="customer-table-actions">
            <button type="button" onClick={startEdit} aria-label={ar ? 'تعديل الطلب' : 'Edit request'} title={ar ? 'تعديل الطلب' : 'Edit request'}><Pencil size={16} /></button>
            <button type="button" className="danger" onClick={() => setConfirmDiscard(true)} aria-label={ar ? 'تجاهل الطلب' : 'Discard request'} title={ar ? 'تجاهل الطلب' : 'Discard request'}><Ban size={16} /></button>
          </span></td>
        </tr></tbody>
      </table></div>
      <div style={{ padding: '14px 18px 18px' }}>
        <p className="car-request-notice" role="note"><Clock3 size={15} /><span>{ar ? 'طلب مبدئي محفوظ محليًا على هذا المتصفح فقط. لم يتم إرساله إلى STAR PYRAMIDS.' : 'Preliminary request saved locally on this browser only. It has not been submitted to STAR PYRAMIDS.'}</span></p>
      </div>
      </div>}
      {!shown && (
        <div className="customer-empty"><span><Clock3 size={24} /></span><h3>{ar ? 'لا توجد طلبات في هذا العرض' : 'No requests in this view'}</h3><p>{ar ? 'جرب فلتر تواريخ مختلف من الأعلى.' : 'Try a different date filter above.'}</p><button type="button" className="account-icon-action" onClick={() => setDateFilter('all')}>{ar ? 'عرض الكل' : 'Show all'}</button></div>
      )}
      <CustomerConfirmDialog
        open={confirmDiscard}
        onClose={() => setConfirmDiscard(false)}
        onConfirm={handleDiscard}
        title={ar ? 'تجاهل طلب الرحلة؟' : 'Discard the trip request?'}
        copy={ar ? 'سيؤدي هذا إلى إزالة الطلب المحفوظ في هذا المتصفح فقط. لن يتأثر أي شيء آخر.' : 'This removes only the browser-local request. Nothing else is affected.'}
        confirmLabel={ar ? 'تجاهل الطلب' : 'Discard request'}
      />
      <CustomerConfirmDialog
        open={confirmReplace}
        onClose={() => setConfirmReplace(false)}
        onConfirm={confirmNew}
        title={ar ? 'استبدال الطلب المحفوظ؟' : 'Replace the saved request?'}
        copy={ar ? 'يوجد طلب محفوظ بالفعل. إنشاء طلب جديد سيستبدله. لن يتأثر أي شيء آخر.' : 'A request is already saved. Creating a new one replaces it. Nothing else is affected.'}
        confirmLabel={ar ? 'طلب جديد' : 'New request'}
      />
    </section>
  )
}

export function CustomerTripRequestsPage({ startNew = false }: { startNew?: boolean }) {
  return (
    <LocaleProvider>
      <AccountShell
        section="trip-requests"
        headLeading={<HeadPlanTrip />}
      >
        <TripRequestsSection startNew={startNew} />
      </AccountShell>
    </LocaleProvider>
  )
}

function HeadPlanTrip() {
  const { locale } = useLocale()
  const ar = locale === 'ar'
  return <Link href="/account/trip-requests?new=1" className="account-icon-action"><Plus size={17} />{ar ? 'خطط رحلتك' : 'Plan your trip'}</Link>
}
