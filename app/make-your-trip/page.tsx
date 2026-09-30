'use client'
import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, ArrowRight, Check, CircleAlert, Minus, Plus } from 'lucide-react'
import { SiteShell, Breadcrumb } from '@/components/site'
import { useLocale } from '@/components/locale'
import { localizeTourLocation } from '@/lib/tour-format'
import { destinations } from '@/data/content'
import { parseMakeTripQuery } from '@/lib/query'
import {
  TRIP_BUDGET_CAP,
  TRIP_NOTE_MAX,
  createTripRequest,
  getTripRequest,
  hasTripErrors,
  sanitizeTripDraft,
  updateTripRequest,
  useTripRequests,
  validateTripRequest,
  type MakeYourTripRequestDraft,
  type TripFieldErrors,
  type TripRequest,
  type TripTimeMode,
} from '@/lib/trip-request'
import { resolveTripCustomer, type PendingCustomer } from '@/lib/trip-customers'
import { PendingAccountBox } from '@/components/trip-pending-account'
import { findTour } from '@/data/tours'
import { readCustomerProfile, saveCustomerProfile } from '@/lib/customer-account'
import { countries, countryByDialCode, countryCode as resolveCountryCode, countryDisplayName, defaultCountry, nationalPhone } from '@/data/countries'
import { CountrySelect } from '@/components/country-select'
import { SharedSelect } from '@/components/shared-select'
import { InternationalPhoneInput } from '@/components/international-phone-input'
import { displayInternationalPhone } from '@/lib/phone'
import { DateInput } from '@/components/date-input'

const stepLabels = ['Quick information', 'Personal information', 'Confirmation']
const timeOptions: ReadonlyArray<readonly [TripTimeMode, string]> = [['exact', 'Have An Exact Time'], ['approx', 'Have An Approximate Time'], ['unsure', 'Not Sure Yet']] as const
const timeNames: Record<string, string> = { exact: 'Exact time', approx: 'Approximate time', unsure: 'Not sure yet' }
const PRICE_CAP = TRIP_BUDGET_CAP
const ar: Record<string, string> = {
  'Make Your Trip': 'خطط رحلتك', 'Quick information': 'تفاصيل الرحلة', 'Personal information': 'بيانات التواصل', Confirmation: 'التأكيد',
  'When will you be traveling?': 'متى تحب السفر؟', 'Have An Exact Time': 'موعد محدد', 'Have An Approximate Time': 'موعد تقريبي', 'Not Sure Yet': 'لم أحدد بعد',
  'Preferred ship call date': 'تاريخ توقف السفينة المفضل',
  'Selected tour:': 'الرحلة المختارة:', Change: 'تغيير', Destination: 'الوجهة', 'Choose a place in Egypt': 'اختر وجهة في مصر',
  'Preferred start date': 'تاريخ البدء المفضل', 'Preferred end date': 'تاريخ الانتهاء المفضل',
  'Select your preferred start date': 'حدد تاريخ البدء المفضل', 'Select your preferred end date': 'حدد تاريخ الانتهاء المفضل',
  'Next up': 'التالي', Edit: 'تعديل', 'Full Name': 'الاسم الكامل', Email: 'البريد الإلكتروني',
  'your full name here': 'اكتب اسمك الكامل', 'Type your email..': 'اكتب بريدك الإلكتروني', 'Include flight options in my request': 'تضمين خيارات الطيران في طلبي',
  'Ask STAR PYRAMIDS to include suitable flight options when preparing your trip proposal.': 'اطلب من STAR PYRAMIDS تضمين خيارات طيران مناسبة عند إعداد مقترح الرحلة.',
  Nationality: 'الجنسية', 'Choose your nationality': 'اختر جنسيتك', Phone: 'الهاتف', 'Country code': 'مفتاح الدولة', 'Type your phone': 'اكتب رقم الهاتف',
  Adults: 'البالغون', Children: 'الأطفال', Infants: 'الرضع',
  Min: 'الحد الأدنى', Max: 'الحد الأقصى',
  'Price range': 'نطاق السعر', 'Minimum price': 'أقل سعر', 'Maximum price': 'أعلى سعر', Note: 'ملاحظات',
  'Additional Notes.........': 'أي تفاصيل إضافية عن رحلتك', Back: 'رجوع', 'Prepare request': 'جهّز طلبك', 'Go back': 'رجوع',
  'Exact time': 'موعد محدد', 'Approximate time': 'موعد تقريبي', 'Not sure yet': 'لم أحدد بعد',
  Home: 'الرئيسية', 'Contact our team': 'تواصل مع فريقنا',
  'Editing these details applies to this request only.': 'تعديل هذه البيانات سيطبق على هذا الطلب فقط.',
  'Save these details to my profile': 'حفظ هذه البيانات في حسابي',
  Egyptian: 'مصرية', American: 'أمريكية', British: 'بريطانية', French: 'فرنسية', German: 'ألمانية', Spanish: 'إسبانية', Italian: 'إيطالية', Saudi: 'سعودية', Emirati: 'إماراتية', Canadian: 'كندية', Australian: 'أسترالية', Other: 'أخرى',
  'Cairo & Giza': 'القاهرة والجيزة',
}

const FIELD_IDS: Record<string, string> = {
  destination: 'myt-destination', from: 'myt-from', to: 'myt-to', travelers: 'myt-travelers',
  name: 'myt-name', email: 'myt-email', nationality: 'myt-nationality', phone: 'myt-phone',
  budget: 'myt-budget-min', notes: 'myt-note',
}

function todayLocal(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function DatePill({ id, label, placeholder, value, onChange, min, invalid, describedBy, errorId, error }: { id: string; label: string; placeholder: string; value: string; onChange: (v: string) => void; min?: string; invalid?: boolean; describedBy?: string; errorId?: string; error?: string }) {
  return <label className="myt-date" htmlFor={id}><span>{label}</span><span className="myt-date-pill"><DateInput id={id} aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} placeholderMode hideNativeIndicator min={min} dir="ltr" aria-invalid={invalid === true} aria-describedby={describedBy} /></span>{error ? <span className="field-error" id={errorId} role="alert" style={{ display: 'block', marginTop: 8 }}>{error}</span> : null}</label>
}

function Counter({ id, label, sub, value, set, min = 0 }: { id: string; label: string; sub: string; value: number; set: (v: number) => void; min?: number }) {
  const { locale } = useLocale()
  return <div className="myt-counter"><span id={id}>{label} <small>({sub})</small></span><div className="myt-counter-box" role="group" aria-labelledby={id}><button type="button" aria-label={(locale === 'ar' ? 'تقليل ' : 'Decrease ') + label} onClick={() => set(Math.max(min, value - 1))}><Minus size={16} /></button><b aria-live="polite">{value}</b><button type="button" aria-label={(locale === 'ar' ? 'زيادة ' : 'Increase ') + label} onClick={() => set(Math.min(50, value + 1))}><Plus size={16} /></button></div></div>
}

function focusById(id: string) {
  const el = document.getElementById(id)
  if (el) {
    if (!el.hasAttribute('tabindex') && !/^(INPUT|SELECT|TEXTAREA|BUTTON|A)$/.test(el.tagName)) el.setAttribute('tabindex', '-1')
    el.focus({ preventScroll: false })
    el.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }
}

function formatBudget(amount: number, currency: 'USD' | 'EUR' | 'EGP', locale: 'en' | 'ar'): string {
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-EG' : 'en-US', {
    style: 'currency', currency, maximumFractionDigits: currency === 'EGP' ? 0 : 2,
  }).format(amount)
}

function PlannerInner() {
  const { locale, currency } = useLocale()
  const t = (key: string) => locale === 'ar' ? ar[key] ?? key : key
  const params = useSearchParams()
  const router = useRouter()
  const initialQuery = useMemo(() => parseMakeTripQuery(params), [params])
  const isShore = initialQuery.tour?.category === 'shore-excursions'
  const [step, setStep] = useState<number>(initialQuery.step)
  // Committed record shown in the confirmation step (v2 multi-request store).
  const [placed, setPlaced] = useState<TripRequest | null>(null)
  // Ref being edited via `?edit=SP-…`. Null means a brand-new request.
  const [editRef, setEditRef] = useState<string | null>(null)
  const savedRequests = useTripRequests()
  // Optional, default off: copy the entered contact details into the
  // browser-local customer profile on submit. Never automatic.
  const [saveProfile, setSaveProfile] = useState(false)
  // Pending stub freshly prepared for this submit (account completion UX).
  const [pendingAccount, setPendingAccount] = useState<PendingCustomer | null>(null)
  const [existingEmail, setExistingEmail] = useState(false)
  const [showComplete, setShowComplete] = useState(false)
  const [time, setTime] = useState<TripTimeMode>('exact')
  const [from, setFrom] = useState(initialQuery.from)
  const [to, setTo] = useState(isShore ? initialQuery.from : initialQuery.to)
  const [destination, setDestination] = useState(initialQuery.destination)
  const destName = destinations.find((d) => d.slug === destination)?.title ?? ''
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [flightOffer, setFlightOffer] = useState(false)
  // Nationality stores the ISO country code. Phone country lives in its
  // own state owned by the shared phone input and never follows nationality.
  const [nationality, setNationality] = useState('')
  const [phoneCountry, setPhoneCountry] = useState(defaultCountry.code)
  const [phone, setPhone] = useState('')
  const hasBreakdown = initialQuery.adults + initialQuery.children + initialQuery.infants > 0
  const [adults, setAdults] = useState(hasBreakdown ? initialQuery.adults : initialQuery.guests)
  const [children, setChildren] = useState(hasBreakdown ? initialQuery.children : 0)
  const [infants, setInfants] = useState(hasBreakdown ? initialQuery.infants : 0)
  const [priceMin, setPriceMin] = useState(1000)
  const [priceMax, setPriceMax] = useState(3000)
  const [note, setNote] = useState(initialQuery.addOns.length ? `Requested add-ons: ${initialQuery.addOns.join(', ')}` : '')
  const [errors, setErrors] = useState<TripFieldErrors>({})
  const [summary, setSummary] = useState('')
  const tourSlug = initialQuery.tour?.slug ?? ''
  const tourName = locale === 'ar' ? initialQuery.tour?.titleAr ?? initialQuery.tour?.title ?? '' : initialQuery.tour?.title ?? ''
  const today = useMemo(todayLocal, [])

  // Entry modes: `?edit=SP-…` loads that exact record for editing;
  // a trip query signal prefills a fresh form; otherwise the form starts
  // blank with contact details prefilled as editable copies from the
  // browser-local customer profile (never written back automatically).
  // Malformed data is ignored.
  useEffect(() => {
    const editParam = params.get('edit') ?? ''
    if (/^SP-[A-Z0-9]{6,12}$/.test(editParam)) {
      const record = getTripRequest(editParam)
      if (record && (record.status === 'new' || record.status === 'reviewing')) {
        applyRecord(record)
        setEditRef(record.localRef)
        return
      }
    }
    const hasQuerySignal = initialQuery.from !== '' || initialQuery.to !== '' || initialQuery.destination !== '' || initialQuery.addOns.length > 0 || hasBreakdown
    if (hasQuerySignal) return
    const profile = readCustomerProfile()
    if (profile.fullName.trim()) {
      setFullName(profile.fullName.trim())
      setEmail(profile.email.includes('@') ? profile.email : '')
      // Profile country is already an ISO code; phone country follows the
      // stored dial code. Neither writes back automatically.
      setNationality(resolveCountryCode(profile.country))
      setPhoneCountry(countryByDialCode(profile.dialCode).code)
      setPhone(profile.phone)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const applyRecord = (record: TripRequest) => {
    const clean = sanitizeTripDraft({
      destinationSlug: record.destinationSlug,
      tourSlug: record.tourSlug,
      customTitle: record.customTitle,
      requestedAddOns: record.requestedAddOns,
      timeMode: record.timeMode,
      preferredFrom: record.preferredFrom,
      preferredTo: record.preferredTo,
      adults: record.adults,
      children: record.children,
      infants: record.infants,
      budgetMin: record.budgetMin,
      budgetMax: record.budgetMax,
      currency: record.currency,
      flightOffer: record.flightOffer,
      nationality: record.contact.nationality,
      dialCode: record.contact.dialCode,
      notes: record.notes,
      contact: { name: record.contact.name, email: record.contact.email, phone: record.contact.phone },
    })
    if (!clean) return
    setTime(clean.timeMode)
    setFrom(clean.preferredFrom)
    setTo(clean.preferredTo)
    setDestination(clean.destinationSlug)
    setFullName(clean.contact.name)
    setEmail(clean.contact.email)
    // Legacy records may carry a country NAME; normalize to ISO code.
    // Phone country hydrates independently from the stored dial code.
    setNationality(resolveCountryCode(clean.nationality))
    const requestPhoneCountry = countryByDialCode(clean.dialCode)
    setPhoneCountry(requestPhoneCountry.code)
    setPhone(clean.contact.phone)
    setAdults(clean.adults)
    setChildren(clean.children)
    setInfants(clean.infants)
    setPriceMin(clean.budgetMin)
    setPriceMax(clean.budgetMax)
    setNote(clean.notes)
    setFlightOffer(clean.flightOffer)
  }

  const errText = (field: keyof TripFieldErrors): string => {
    const code = errors[field]
    if (!code) return ''
    const en: Record<string, string> = {
      destination: code === 'required' ? 'Choose a destination, or keep the selected tour as your request.' : 'Choose a valid destination.',
      from: code === 'required' ? 'Enter your preferred start date.' : 'Enter a valid preferred start date (today or later).',
      to: code === 'required' ? 'Enter your preferred end date.' : 'Enter a valid preferred end date on or after the start date.',
      travelers: 'Travelers must include at least 1 adult (max 50 per group).',
      name: code === 'required' ? 'Enter your full name.' : 'Enter a name with at least 2 letters.',
      email: code === 'required' ? 'Enter your email address.' : 'Enter a valid email address (name@example.com).',
      nationality: 'Choose your nationality.',
      phone: code === 'required' ? 'Enter your phone number.' : 'Enter a valid phone number (at least 7 digits).',
      budget: `Preferred budget must be between 0 and ${PRICE_CAP.toLocaleString('en-US')} with min below max.`,
      notes: `Notes must be ${TRIP_NOTE_MAX} characters or fewer.`,
    }
    const arText: Record<string, string> = {
      destination: code === 'required' ? 'اختر وجهة أو أبقِ الرحلة المختارة موضوعًا للطلب.' : 'اختر وجهة صالحة.',
      from: code === 'required' ? 'أدخل تاريخ البدء المفضل.' : 'أدخل تاريخ بدء مفضلًا صالحًا (اليوم أو بعده).',
      to: code === 'required' ? 'أدخل تاريخ الانتهاء المفضل.' : 'أدخل تاريخ انتهاء مفضلًا صالحًا في تاريخ البدء أو بعده.',
      travelers: 'يجب أن يشمل المسافرون بالغًا واحدًا على الأقل (بحد أقصى 50).',
      name: code === 'required' ? 'أدخل اسمك الكامل.' : 'أدخل اسمًا من حرفين على الأقل.',
      email: code === 'required' ? 'أدخل بريدك الإلكتروني.' : 'أدخل بريدًا إلكترونيًا صالحًا (name@example.com).',
      nationality: 'اختر جنسيتك.',
      phone: code === 'required' ? 'أدخل رقم هاتفك.' : 'أدخل رقم هاتف صالحًا (7 أرقام على الأقل).',
      budget: `يجب أن تكون الميزانية المفضلة بين 0 و${PRICE_CAP.toLocaleString('en-US')} والحد الأدنى أقل من الأقصى.`,
      notes: `يجب ألا تتجاوز الملاحظات ${TRIP_NOTE_MAX} حرف.`,
    }
    return locale === 'ar' ? arText[field] : en[field]
  }

  const buildDraft = (): MakeYourTripRequestDraft => {
    return {
      destinationSlug: destination,
      tourSlug,
      customTitle: '',
      requestedAddOns: initialQuery.addOns,
      timeMode: time,
      preferredFrom: isShore ? from.trim() : from.trim(),
      preferredTo: isShore ? from.trim() : to.trim(),
      adults, children, infants,
      budgetMin: priceMin, budgetMax: priceMax,
      currency,
      flightOffer,
      nationality: nationality.trim(),
      dialCode: (countries.find((country) => country.code === phoneCountry) ?? defaultCountry).dialCode,
      notes: note.trim().slice(0, TRIP_NOTE_MAX + 1),
      contact: {
        name: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
      },
    }
  }

  const focusFirstError = (errs: TripFieldErrors, fields: Array<keyof TripFieldErrors>) => {
    for (const field of fields) {
      if (errs[field]) {
        focusById(FIELD_IDS[field])
        return
      }
    }
  }

  const step1Fields: Array<keyof TripFieldErrors> = ['destination', 'from', 'to']
  const step2Fields: Array<keyof TripFieldErrors> = ['name', 'email', 'nationality', 'phone', 'travelers', 'budget', 'notes']

  const handleNext = (e?: { preventDefault?: () => void }) => {
    e?.preventDefault?.()
    const errs = validateTripRequest(buildDraft(), { isShore })
    const step1: TripFieldErrors = {}
    for (const f of step1Fields) if (errs[f]) step1[f] = errs[f]
    setErrors(step1)
    if (hasTripErrors(step1)) {
      setSummary(locale === 'ar' ? 'راجع الحقول المطلوبة في هذه الخطوة.' : 'Review the required fields in this step.')
      focusFirstError(step1, step1Fields)
      return
    }
    setSummary('')
    setStep(2)
    focusById('myt-step2-title')
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const raw = buildDraft()
    const errs = validateTripRequest(raw, { isShore })
    setErrors(errs)
    if (hasTripErrors(errs)) {
      setSummary(locale === 'ar' ? 'تعذر إنشاء المعاينة. راجع الحقول الموضحة أدناه.' : 'Could not create the preview. Review the highlighted fields below.')
      const all = [...step1Fields, ...step2Fields]
      const firstStep1 = step1Fields.find((f) => errs[f])
      if (firstStep1) {
        setStep(1)
        window.setTimeout(() => focusFirstError(errs, step1Fields), 50)
      } else {
        focusFirstError(errs, all)
      }
      return
    }
    if (editRef) {
      const updated = updateTripRequest(editRef, { ...raw, notes: raw.notes.slice(0, TRIP_NOTE_MAX) }, 'customer')
      if (!updated) {
        setSummary(locale === 'ar' ? 'تعذر حفظ التعديلات. ربما تغيرت حالة الطلب.' : 'Could not save the changes. The request status may have changed.')
        return
      }
      if (saveProfile) persistProfileFromForm()
      setErrors({})
      setSummary('')
      setPendingAccount(null)
      setExistingEmail(false)
      setShowComplete(false)
      setPlaced(updated)
      setStep(3)
      window.setTimeout(() => focusById('myt-preview-title'), 50)
      return
    }
    // Ownership is resolved before creation: link a pending stub for new
    // emails, leave existing-customer emails unlinked (unverified).
    const preResolution = resolveTripCustomer(raw.contact.email, {
      name: raw.contact.name,
      phone: raw.contact.phone,
      dialCode: raw.dialCode,
      nationality: raw.nationality,
    })
    const created = createTripRequest({ ...raw, notes: raw.notes.slice(0, TRIP_NOTE_MAX) }, {
      customerId: preResolution.customerId,
      ownership: preResolution.ownership,
    })
    if (!created) {
      setSummary(locale === 'ar' ? 'تعذر إنشاء المعاينة. راجع الحقول الموضحة أدناه.' : 'Could not create the preview. Review the highlighted fields below.')
      return
    }
    if (saveProfile) persistProfileFromForm()
    setErrors({})
    setSummary('')
    setPendingAccount(preResolution.stubCreated ? preResolution.stub : null)
    setExistingEmail(preResolution.existingCustomer)
    setShowComplete(false)
    setPlaced(created)
    setStep(3)
    window.setTimeout(() => focusById('myt-preview-title'), 50)
  }

  /** Optional, default-off copy of entered contact details into the local profile. */
  const persistProfileFromForm = () => {
    try {
      const current = readCustomerProfile()
      const parts = fullName.trim().split(/\s+/).filter(Boolean)
      const dial = (countries.find((country) => country.code === phoneCountry) ?? defaultCountry).dialCode
      saveCustomerProfile({
        ...current,
        firstName: parts[0] ?? current.firstName,
        lastName: parts.slice(1).join(' ') || current.lastName,
        fullName: fullName.trim() || current.fullName,
        email: email.trim() || current.email,
        country: nationality || current.country,
        dialCode: dial,
        phone: nationalPhone(phone, dial),
      })
    } catch { /* profile write is best-effort only */ }
  }

  const handleEdit = () => {
    setPlaced(null)
    setPendingAccount(null)
    setExistingEmail(false)
    setShowComplete(false)
    setStep(2)
    window.setTimeout(() => focusById('myt-step2-title'), 50)
  }

  const goStep = (n: number) => {
    if (placed) return
    if (n === 1) { setErrors({}); setSummary(''); setStep(1) }
    if (n === 2) handleNext()
  }

  const clampMin = (v: number) => {
    const n = Number.isFinite(v) ? v : 0
    setPriceMin(Math.max(0, Math.min(n, (Number.isFinite(priceMax) ? priceMax : PRICE_CAP) - 100)))
  }
  const clampMax = (v: number) => {
    const n = Number.isFinite(v) ? v : PRICE_CAP
    setPriceMax(Math.min(PRICE_CAP, Math.max(n, (Number.isFinite(priceMin) ? priceMin : 0) + 100)))
  }

  const inPreview = placed !== null
  const shownStep = inPreview ? 3 : step

  const renderPreview = (record: TripRequest) => {
    const d = record
    const destTitle = destinations.find((item) => item.slug === d.destinationSlug)?.title ?? ''
    const tourTitle = d.tourSlug ? findTour(d.tourSlug)?.title ?? d.tourSlug : ''
    const requestSubject = d.customTitle || tourTitle || destTitle || (locale === 'ar' ? tourName || d.tourSlug : d.tourSlug || '')
    const dateText = d.preferredFrom && d.preferredTo && d.preferredFrom !== d.preferredTo
      ? `${d.preferredFrom} → ${d.preferredTo}`
      : d.preferredFrom || d.preferredTo || ''
    const travelerParts: string[] = []
    travelerParts.push(locale === 'ar' ? `${d.adults} بالغ` : `${d.adults} adult${d.adults === 1 ? '' : 's'}`)
    if (d.children > 0) travelerParts.push(locale === 'ar' ? `${d.children} أطفال` : `${d.children} child${d.children === 1 ? '' : 'ren'}`)
    if (d.infants > 0) travelerParts.push(locale === 'ar' ? `${d.infants} رضع` : `${d.infants} infant${d.infants === 1 ? '' : 's'}`)
    return <div className="myt-success">
      <h2 id="myt-preview-title" tabIndex={-1}>{locale === 'ar' ? 'تم إنشاء طلب الرحلة' : 'Trip request created'}</h2>
      <span className="req-ref" dir="ltr">{locale === 'ar' ? 'المرجع المحلي: ' : 'Local ref: '}{record.localRef}</span>
      <div className="req-summary-rows" style={{ maxWidth: 520, margin: '18px auto', textAlign: 'start' }}>
        {requestSubject !== '' && <div><span>{locale === 'ar' ? 'الطلب' : 'Request'}</span><strong>{requestSubject}</strong></div>}
        <div><span>{locale === 'ar' ? 'المواعيد' : 'Preferred dates'}</span><strong dir="ltr">{dateText || (locale === 'ar' ? 'مرنة، بدون تواريخ ثابتة' : 'Flexible, no fixed dates')}</strong></div>
        <div><span>{locale === 'ar' ? 'إيقاع المواعيد' : 'Date flexibility'}</span><strong>{t(timeNames[d.timeMode] ?? d.timeMode)}</strong></div>
        <div><span>{locale === 'ar' ? 'المسافرون' : 'Travelers'}</span><strong>{travelerParts.join(locale === 'ar' ? '، ' : ' · ')}</strong></div>
        <div><span>{locale === 'ar' ? 'الميزانية المفضلة' : 'Preferred budget'}</span><strong dir="ltr">{formatBudget(d.budgetMin, d.currency, locale)} – {formatBudget(d.budgetMax, d.currency, locale)}</strong></div>
        {d.flightOffer && <div><span>{locale === 'ar' ? 'خيارات الطيران' : 'Flight options'}</span><strong>{locale === 'ar' ? 'تم طلب تضمين خيارات طيران' : 'Flight options requested'}</strong></div>}
        {d.contact.nationality !== '' && <div><span>{t('Nationality')}</span><strong>{countryDisplayName(d.contact.nationality, locale)}</strong></div>}
        <div><span>{t('Full Name')}</span><strong>{d.contact.name}</strong></div>
        <div><span>{t('Email')}</span><strong dir="ltr">{d.contact.email}</strong></div>
        <div><span>{t('Phone')}</span><strong dir="ltr">{displayInternationalPhone(d.contact.dialCode, d.contact.phone)}</strong></div>
        {d.requestedAddOns.length > 0 && <div><span>{locale === 'ar' ? 'إضافات مطلوبة' : 'Requested add-ons'}</span><strong>{d.requestedAddOns.join(locale === 'ar' ? '، ' : ', ')}</strong></div>}
        {d.notes !== '' && <div><span>{t('Note')}</span><strong style={{ whiteSpace: 'pre-wrap' }}>{d.notes}</strong></div>}
      </div>
      <p><CircleAlert size={15} style={{ verticalAlign: '-2px', marginInlineEnd: 6 }} />{locale === 'ar' ? 'طلبات النموذج التجريبي محفوظة على هذا المتصفح فقط ولا تُرسل إلى نظام STAR PYRAMIDS الفعلي.' : 'Prototype requests are stored on this browser only and are not submitted to a live STAR PYRAMIDS backend.'}</p>
      <p>{locale === 'ar' ? 'الميزانية أعلاه تفضيل منك وليست عرض سعر أو حجزًا مؤكدًا.' : 'The budget above is your preference. It is not a quote or a confirmed booking.'}</p>
      {pendingAccount && <PendingAccountBox stub={pendingAccount} onCompleted={(updated) => setPendingAccount(updated)} />}
      {!pendingAccount && existingEmail && <p><CircleAlert size={15} style={{ verticalAlign: '-2px', marginInlineEnd: 6 }} />{locale === 'ar' ? 'يوجد حساب بالفعل لهذا البريد. سجّل الدخول لإدارة الطلبات المرتبطة بحسابك.' : 'An account already exists for this email. Sign in to manage requests associated with your account.'}</p>}
      <div className="myt-success-actions">
        <button type="button" className="outline-btn" onClick={handleEdit}>{locale === 'ar' ? 'تعديل الطلب' : 'Edit request'}</button>
        <Link className="primary-btn" href={`/account/trip-requests/detail?ref=${encodeURIComponent(record.localRef)}`}>{locale === 'ar' ? 'عرض تفاصيل الطلب' : 'View request details'}</Link>
        <Link className="outline-btn" href="/contact">{t('Contact our team')}</Link>
      </div>
    </div>
  }

  return <><Breadcrumb items={[t('Make Your Trip')]} /><main className="planner-page">
    {inPreview && placed ? renderPreview(placed) : <>
      <div className="planner-card"><h1><button type="button" className="myt-back" onClick={() => router.back()} aria-label={t('Go back')}><ArrowLeft size={20} /></button> {t('Make Your Trip')}</h1><div className="stepper">{[0, 1, 2].map((i) => {
        const state = shownStep > i + 1 ? 'done' : shownStep === i + 1 ? 'active' : 'todo'
        const done = shownStep > i + 1
        const isPreviewPill = i === 2
        const disabled = isPreviewPill || shownStep === i + 1
        return <span key={stepLabels[i]} style={{ display: 'contents' }}>{i > 0 && <span className={'step-line' + (shownStep > i ? ' done' : '')} aria-hidden="true" />}<button type="button" className={'step-pill ' + state} onClick={() => goStep(i + 1)} disabled={disabled} aria-current={shownStep === i + 1 ? 'step' : undefined} aria-disabled={disabled}>{<b className="step-num">{done ? <Check size={18} /> : i + 1}</b>}{t(stepLabels[i])}</button></span>
      })}</div></div>
      {savedRequests.length > 0 && <div className="planner-card" role="note" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}><p className="myt-tour-note" style={{ margin: 0 }}>{locale === 'ar' ? `لديك ${savedRequests.length} من طلبات الرحلات المحفوظة في هذا المتصفح.` : `You have ${savedRequests.length} saved trip request${savedRequests.length === 1 ? '' : 's'} in this browser.`}</p><div style={{ display: 'flex', gap: 10 }}><Link className="outline-btn" href="/account/trip-requests">{locale === 'ar' ? 'عرض طلباتي' : 'View my requests'}</Link></div></div>}
      <form className="planner-card planner-form" onSubmit={step === 1 ? handleNext : handleSubmit} noValidate>
        {summary !== '' && <p className="co-error" role="alert" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 0 }}><CircleAlert size={15} />{summary}</p>}
        {step === 1 && <><div className="trip-question"><strong>{t('When will you be traveling?')}</strong>{timeOptions.map(([v, l]) => <button key={v} type="button" className={time === v ? 'selected-radio' : ''} aria-pressed={time === v} onClick={() => setTime(v)}><i className={time === v ? 'checked' : ''} />{t(l)}</button>)}</div>{tourName !== '' && <p className="myt-tour-note">{t('Selected tour:')} <strong>{tourName}</strong>, <Link href={`/egypt-tours/${initialQuery.tour?.category ?? 'one-day-tours'}`}>{t('Change')}</Link></p>}<label className="myt-field"><span className="myt-label" id="myt-destination-label">{t('Destination')}{tourSlug === '' && <em className="req" aria-hidden="true">*</em>}</span><SharedSelect id="myt-destination" labelledBy="myt-destination-label" value={destination} onChange={setDestination} locale={locale} popupWidth="trigger" invalid={Boolean(errors.destination)} describedBy={errors.destination ? 'myt-destination-error' : undefined} options={[{ value: '', label: t('Choose a place in Egypt') }, ...destinations.map((d) => ({ value: d.slug, label: locale === 'ar' ? t(localizeTourLocation(d.title)) : d.title }))]} /></label>{errors.destination && <span className="field-error" id="myt-destination-error" role="alert">{errText('destination')}</span>}<div className="myt-dates"><DatePill id="myt-from" label={t(isShore ? 'Preferred ship call date' : 'Preferred start date')} placeholder={t('Select your preferred start date')} value={from} onChange={isShore ? (value) => { setFrom(value); setTo(value) } : setFrom} min={today} invalid={Boolean(errors.from)} describedBy={errors.from ? 'myt-from-error' : undefined} errorId="myt-from-error" error={errText('from')} />{!isShore && <DatePill id="myt-to" label={t('Preferred end date')} placeholder={t('Select your preferred end date')} value={to} onChange={setTo} min={from || today} invalid={Boolean(errors.to)} describedBy={errors.to ? 'myt-to-error' : undefined} errorId="myt-to-error" error={errText('to')} />}</div><div className="planner-actions"><button type="submit" className="navy-btn">{t('Next up')} <ArrowRight size={19} /></button></div></>}
        {step === 2 && <><h2 id="myt-step2-title" tabIndex={-1} style={{ marginTop: 0 }}>{t('Personal information')}</h2>{(destName !== '' || from !== '') && <p className="myt-tour-note">{[destName, from && to ? `${from} → ${to}` : '', locale === 'ar' ? `${adults + children + infants} مسافرين` : `${adults + children + infants} guest${adults + children + infants === 1 ? '' : 's'}`].filter(Boolean).join(', ')}, <button type="button" className="text-link" style={{ border: 0, background: 'none', cursor: 'pointer', padding: 0, font: 'inherit', textDecoration: 'underline' }} onClick={() => setStep(1)}>{t('Edit')}</button></p>}<div className="myt-grid">
          <label className="myt-field" htmlFor="myt-name"><span className="myt-label">{t('Full Name')} <em className="req" aria-hidden="true">*</em></span><input id="myt-name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={t('your full name here')} maxLength={80} autoComplete="name" required aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'myt-name-error' : undefined} />{errors.name && <span className="field-error" id="myt-name-error" role="alert">{errText('name')}</span>}</label>
          <label className="myt-field" htmlFor="myt-email"><span className="myt-label">{t('Email')} <em className="req" aria-hidden="true">*</em></span><input id="myt-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('Type your email..')} maxLength={120} autoComplete="email" dir="ltr" required aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'myt-email-error' : undefined} />{errors.email && <span className="field-error" id="myt-email-error" role="alert">{errText('email')}</span>}</label>
        </div>
          <p className="myt-tour-note" style={{ margin: '10px 0 0' }}>{t('Editing these details applies to this request only.')}</p>
          <label className="myt-check" htmlFor="myt-save-profile" style={{ marginTop: 10 }}><input id="myt-save-profile" type="checkbox" checked={saveProfile} onChange={(e) => setSaveProfile(e.target.checked)} /><span className="box" aria-hidden="true">{saveProfile && <Check size={16} />}</span> {t('Save these details to my profile')}</label>
          <label className="myt-check" htmlFor="myt-flight"><input id="myt-flight" type="checkbox" checked={flightOffer} onChange={(e) => setFlightOffer(e.target.checked)} aria-describedby="myt-flight-hint" /><span className="box" aria-hidden="true">{flightOffer && <Check size={16} />}</span> {t('Include flight options in my request')}</label>
          <p className="myt-tour-note" id="myt-flight-hint" style={{ marginTop: -14 }}>{t('Ask STAR PYRAMIDS to include suitable flight options when preparing your trip proposal.')}</p>
          <div className="myt-grid">
            <label className="myt-field"><span className="myt-label" id="myt-nationality-label">{t('Nationality')} <em className="req" aria-hidden="true">*</em></span><CountrySelect id="myt-nationality" labelledBy="myt-nationality-label" value={nationality} onChange={setNationality} locale={locale} placeholder={t('Choose your nationality')} invalid={Boolean(errors.nationality)} describedBy={errors.nationality ? 'myt-nationality-error' : undefined} />{errors.nationality && <span className="field-error" id="myt-nationality-error" role="alert">{errText('nationality')}</span>}</label>
            <div className="myt-field"><span className="myt-label" id="myt-phone-label">{t('Phone')} <em className="req" aria-hidden="true">*</em></span><InternationalPhoneInput id="myt-phone" required value={phone} onChange={setPhone} locale={locale} countryCode={phoneCountry} onCountryChange={setPhoneCountry} placeholder={t('Type your phone')} invalid={Boolean(errors.phone)} describedBy={errors.phone ? 'myt-phone-error' : undefined} />{errors.phone && <span className="field-error" id="myt-phone-error" role="alert">{errText('phone')}</span>}</div>
          </div>
          <fieldset className="myt-group" style={{ border: 0, padding: 0, margin: '26px 0 0' }}><legend className="myt-group-title" id="myt-travelers">{locale === 'ar' ? 'المسافرون' : 'Travelers'}</legend><div className="myt-counters">
            <Counter id="myt-travelers-adults" label={t('Adults')} sub="12+" value={adults} set={setAdults} min={1} />
            <Counter id="myt-travelers-children" label={t('Children')} sub="3 - 11" value={children} set={setChildren} />
            <Counter id="myt-travelers-infants" label={t('Infants')} sub="0 - 2" value={infants} set={setInfants} />
          </div>{errors.travelers && <span className="field-error" role="alert">{errText('travelers')}</span>}</fieldset>
          <fieldset className="myt-group" style={{ border: 0, padding: 0, margin: '26px 0 0' }}><legend className="myt-group-title">{locale === 'ar' ? `الميزانية المفضلة (${currency})` : `Preferred budget (${currency})`}</legend><p className="myt-tour-note">{locale === 'ar' ? 'تفضيل منك فقط، وليست عرض سعر أو سعرًا مؤكدًا.' : 'Your preference only. Not a quote or confirmed price.'}</p><div className="price-values">
            <label className="myt-field" htmlFor="myt-budget-min"><span className="myt-minmax">{t('Min')}</span><input id="myt-budget-min" type="number" min={0} max={PRICE_CAP} value={priceMin} onChange={(e) => clampMin(Number(e.target.value))} dir="ltr" aria-invalid={Boolean(errors.budget)} aria-describedby={errors.budget ? 'myt-budget-error' : undefined} /></label>
            <label className="myt-field" htmlFor="myt-budget-max"><span className="myt-minmax right">{t('Max')}</span><input id="myt-budget-max" type="number" min={0} max={PRICE_CAP} value={priceMax} onChange={(e) => clampMax(Number(e.target.value))} dir="ltr" aria-invalid={Boolean(errors.budget)} aria-describedby={errors.budget ? 'myt-budget-error' : undefined} /></label>
          </div><div className="price-slider" role="group" aria-label={t('Price range')} dir={locale === 'ar' ? 'rtl' : 'ltr'}><span className="rail" aria-hidden="true" /><span className="fill" aria-hidden="true" style={locale === 'ar' ? { right: (priceMin / PRICE_CAP * 100) + '%', left: (100 - priceMax / PRICE_CAP * 100) + '%' } : { left: (priceMin / PRICE_CAP * 100) + '%', right: (100 - priceMax / PRICE_CAP * 100) + '%' }} /><input type="range" aria-label={t('Minimum price')} min={0} max={PRICE_CAP} step={100} value={priceMin} onChange={(e) => clampMin(Number(e.target.value))} /><input type="range" aria-label={t('Maximum price')} min={0} max={PRICE_CAP} step={100} value={priceMax} onChange={(e) => clampMax(Number(e.target.value))} /></div>{errors.budget && <span className="field-error" id="myt-budget-error" role="alert">{errText('budget')}</span>}</fieldset>
          <div className="myt-group"><label className="myt-field" htmlFor="myt-note">{t('Note')}<textarea id="myt-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('Additional Notes.........')} maxLength={TRIP_NOTE_MAX + 1} aria-invalid={Boolean(errors.notes)} aria-describedby={errors.notes ? 'myt-note-error' : 'myt-note-hint'} />{errors.notes && <span className="field-error" id="myt-note-error" role="alert">{errText('notes')}</span>}<small id="myt-note-hint" style={{ color: 'var(--muted)', fontWeight: 500 }}>{locale === 'ar' ? `${note.length}/${TRIP_NOTE_MAX}` : `${note.length}/${TRIP_NOTE_MAX}`}</small></label></div>
          <div className="planner-actions"><button type="button" className="outline-btn" onClick={() => { setErrors({}); setSummary(''); setStep(1) }}>{t('Back')}</button><button type="submit" className="navy-btn">{t('Prepare request')}</button></div></>}
      </form>
    </>}
  </main></>
}

export default function MakeYourTrip() { return <SiteShell><Suspense><PlannerInner /></Suspense></SiteShell> }
