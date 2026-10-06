'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Clock3, Eye, Minus, Pencil, Plus, X } from 'lucide-react'
import { LocaleProvider, tx, useLocale, type Locale } from '@/components/locale'
import { AccountShell, CustomerConfirmDialog, CustomerPagination, EmptyState } from './account-portal'
import { usePagination } from '@/components/admin/admin-pagination'
import { destinations } from '@/data/content'
import { catalogTours } from '@/data/tours'
import { countries, countryByDialCode, countryCode as resolveCountryCode, countryDisplayName, defaultCountry } from '@/data/countries'
import { CountrySelect } from '@/components/country-select'
import { SharedSelect } from '@/components/shared-select'
import { displayInternationalPhone } from '@/lib/phone'
import { InternationalPhoneInput } from '@/components/international-phone-input'
import { DateInput } from '@/components/date-input'
import { useAuthenticatedUser } from '@/components/authenticated-user'
import {
  TRIP_BUDGET_CAP,
  TRIP_NOTE_MAX,
  hasTripErrors,
  tripRequestStatusLabel,
  tripActivityLabel,
  validateTripRequest,
  type MakeYourTripRequestDraft,
  type TripFieldErrors,
  type TripRequest,
  type TripRequestStatus,
  type TripTimeMode,
} from '@/lib/trip-request'

function errText(field: keyof TripFieldErrors, code: 'required' | 'invalid', locale: Locale): string {
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
  const es: Record<string, string> = {
    destination: 'Escribe el nombre del viaje arriba, elige un tour o selecciona un destino.',
    from: code === 'required' ? 'Indica tu fecha de inicio preferida.' : 'Indica una fecha de inicio válida (hoy o posterior).',
    to: code === 'required' ? 'Indica tu fecha de fin preferida.' : 'Indica una fecha de fin válida, igual o posterior a la fecha de inicio.',
    travelers: 'El grupo debe incluir al menos 1 adulto (máx. 50 por grupo).',
    name: code === 'required' ? 'Escribe tu nombre completo.' : 'Escribe un nombre de al menos 2 letras.',
    email: code === 'required' ? 'Escribe tu correo electrónico.' : 'Escribe un correo electrónico válido (nombre@ejemplo.com).',
    nationality: 'Elige tu nacionalidad.',
    phone: code === 'required' ? 'Escribe tu número de teléfono.' : 'Escribe un número de teléfono válido (mínimo 7 dígitos).',
    budget: `El presupuesto preferido debe estar entre 0 y ${TRIP_BUDGET_CAP.toLocaleString('en-US')}, con el mínimo por debajo del máximo.`,
    notes: `Las notas deben tener ${TRIP_NOTE_MAX} caracteres como máximo.`,
  }
  const it: Record<string, string> = {
    destination: 'Digita il nome del viaggio qui sopra, scegli un tour o seleziona una destinazione.',
    from: code === 'required' ? 'Inserisci la data di inizio preferita.' : 'Inserisci una data di inizio valida (oggi o successiva).',
    to: code === 'required' ? 'Inserisci la data di fine preferita.' : 'Inserisci una data di fine valida, uguale o successiva a quella di inizio.',
    travelers: 'Il gruppo deve includere almeno 1 adulto (max 50 per gruppo).',
    name: code === 'required' ? 'Inserisci il tuo nome completo.' : 'Inserisci un nome di almeno 2 lettere.',
    email: code === 'required' ? 'Inserisci il tuo indirizzo email.' : 'Inserisci un indirizzo email valido (nome@esempio.com).',
    nationality: 'Seleziona la tua nazionalità.',
    phone: code === 'required' ? 'Inserisci il tuo numero di telefono.' : 'Inserisci un numero di telefono valido (almeno 7 cifre).',
    budget: `Il budget preferito deve essere compreso tra 0 e ${TRIP_BUDGET_CAP.toLocaleString('en-US')}, con il minimo inferiore al massimo.`,
    notes: `Le note devono contenere al massimo ${TRIP_NOTE_MAX} caratteri.`,
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
  return tx(locale, { en: en[field], es: es[field], it: it[field], ar: arText[field] })
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
  const tone = status === 'new' ? 'request_received' : status === 'reviewing' ? 'reviewing' : status === 'proposal_ready' ? 'proposal_ready' : status === 'approved' ? 'confirmed' : 'cancelled'
  return <span className={`customer-status ${tone}`}>{tripRequestStatusLabel(status, locale)}</span>
}

type LastCreated = { ref: string } | null

async function apiList(): Promise<TripRequest[]> {
  const res = await fetch('/api/account/trip-requests', { credentials: 'same-origin' })
  if (!res.ok) throw new Error('Could not load your trip requests.')
  const data = (await res.json()) as { requests?: TripRequest[] }
  if (!Array.isArray(data.requests)) throw new Error('Could not load your trip requests.')
  return data.requests
}

async function apiDetail(reference: string): Promise<TripRequest> {
  const res = await fetch(`/api/account/trip-requests/${encodeURIComponent(reference)}`, { credentials: 'same-origin' })
  const data = (await res.json()) as TripRequest & { error?: string }
  if (!res.ok) throw new Error(data.error || 'Trip request not found.')
  return data
}

async function apiSubmit(draft: MakeYourTripRequestDraft): Promise<TripRequest> {
  const res = await fetch('/api/trip-requests', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(draft),
  })
  const data = (await res.json()) as TripRequest & { error?: string }
  if (!res.ok) throw new Error(data.error || 'Could not save the request.')
  return data
}

async function apiUpdate(reference: string, draft: MakeYourTripRequestDraft): Promise<TripRequest> {
  const res = await fetch(`/api/account/trip-requests/${encodeURIComponent(reference)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ action: 'update', draft }),
  })
  const data = (await res.json()) as TripRequest & { error?: string }
  if (!res.ok) throw new Error(data.error || 'Could not save the changes.')
  return data
}

async function apiCancel(reference: string): Promise<TripRequest> {
  const res = await fetch(`/api/account/trip-requests/${encodeURIComponent(reference)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ action: 'cancel' }),
  })
  const data = (await res.json()) as TripRequest & { error?: string }
  if (!res.ok) throw new Error(data.error || 'Could not cancel the request.')
  return data
}

function TripRequestsSection({ startNew = false, editRef = null }: { startNew?: boolean; editRef?: string | null }) {
  const { locale, currency } = useLocale()
  const router = useRouter()
  const accountUser = useAuthenticatedUser()
  const [requests, setRequests] = useState<TripRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
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
  const [submitting, setSubmitting] = useState(false)
  const [dateFilter, setDateFilter] = useState<'all' | 'upcoming' | 'past'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | TripRequestStatus>('all')

  const prefillContact = () => {
    const name = `${accountUser.firstName ?? ''} ${accountUser.lastName ?? ''}`.trim()
    if (name) setFullName(name)
    if (accountUser.email) setEmail(accountUser.email)
    if (accountUser.countryCode) {
      setNationality(accountUser.countryCode)
      setPhoneCountry(accountUser.countryCode)
    }
    if (accountUser.phone) setPhone(accountUser.phone)
  }

  // Load the customer's real requests once. Contact details prefill from
  // the signed-in account as editable copies.
  useEffect(() => {
    let cancelled = false
    prefillContact()
    apiList()
      .then((rows) => { if (!cancelled) { setRequests(rows); setLoading(false) } })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : 'Could not load your trip requests.')
          setLoading(false)
        }
      })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Deep links: `?edit=SP-TR-…` loads the customer's own record;
  // `?new=1` opens a blank form. The query is consumed once so refresh
  // stays on the list.
  useEffect(() => {
    if (editRef) {
      let cancelled = false
      apiDetail(editRef)
        .then((record) => {
          if (cancelled) return
          if (record.status !== 'new' && record.status !== 'reviewing') {
            setSummary(tx(locale, { en: 'This request can no longer be edited.', es: 'Esta solicitud ya no se puede editar.', it: 'Questa richiesta non può più essere modificata.', ar: 'هذا الطلب لم يعد قابلًا للتعديل.' }))
            return
          }
          applyDraftRecord(record)
          setEditingRef(record.reference)
          setMode('form')
        })
        .catch((error: unknown) => {
          if (!cancelled) setSummary(error instanceof Error ? error.message : 'Could not load the request.')
        })
      router.replace('/account/trip-requests', { scroll: false })
      return () => { cancelled = true }
    }
    if (startNew && mode === 'list') {
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
    prefillContact()
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
    setTripName(t ? (locale === 'ar' ? t.titleAr ?? t.title : t.title) : slug)
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
    if (submitting) return
    const errs = validateTripRequest(buildDraft())
    setErrors(errs)
    if (hasTripErrors(errs)) {
      setSummary(tx(locale, { en: 'Could not save the request. Review the highlighted fields below.', es: 'No se pudo guardar la solicitud. Revisa los campos marcados abajo.', it: 'Impossibile salvare la richiesta. Controlla i campi evidenziati qui sotto.', ar: 'تعذر حفظ الطلب. راجع الحقول الموضحة أدناه.' }))
      return
    }
    setSubmitting(true)
    const draft = { ...buildDraft(), notes: note.trim().slice(0, TRIP_NOTE_MAX) }
    const request = editingRef ? apiUpdate(editingRef, draft) : apiSubmit(draft)
    request
      .then((saved) => {
        setErrors({})
        setSummary('')
        setEditingRef(null)
        setRequests((prev) => {
          const rest = prev.filter((r) => r.reference !== saved.reference)
          return [saved, ...rest]
        })
        if (!editingRef) setLastCreated({ ref: saved.reference })
        else setLastCreated(null)
        setMode('list')
      })
      .catch((error: unknown) => {
        setSummary(error instanceof Error ? error.message : tx(locale, { en: 'Could not save the request. Please try again.', es: 'No se pudo guardar la solicitud. Inténtalo de nuevo.', it: 'Impossibile salvare la richiesta. Riprova.', ar: 'تعذر حفظ الطلب. حاول مجددًا.' }))
      })
      .finally(() => setSubmitting(false))
  }

  const requestNew = () => {
    blankForm()
    setEditingRef(null)
    setLastCreated(null)
    setMode('form')
  }

  const startEdit = (ref: string) => {
    const record = requests.find((r) => r.reference === ref)
    if (!record || (record.status !== 'new' && record.status !== 'reviewing')) return
    applyDraftRecord(record)
    setErrors({})
    setSummary('')
    setEditingRef(record.reference)
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
    errors[field] ? <em className="form-error" role="alert">{errText(field, errors[field]!, locale)}</em> : null

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
    const timeTabs: { id: TripTimeMode; en: string; es: string; it: string; ar: string }[] = [
      { id: 'exact', en: 'Exact time', es: 'Fecha exacta', it: 'Data esatta', ar: 'موعد محدد' },
      { id: 'approx', en: 'Approximate time', es: 'Fecha aproximada', it: 'Data approssimativa', ar: 'موعد تقريبي' },
      { id: 'unsure', en: 'Not sure yet', es: 'Aún no lo sé', it: 'Non lo so ancora', ar: 'لم أحدد بعد' },
    ]
    return (
      <section className="customer-account-block">
        <header>
          <div>
            <span>{tx(locale, { en: 'Trip request', es: 'Solicitud de viaje', it: 'Richiesta di viaggio', ar: 'طلب رحلة' })}</span>
            <h2>{editingRef ? tx(locale, { en: 'Edit trip request', es: 'Editar solicitud de viaje', it: 'Modifica richiesta di viaggio', ar: 'تعديل طلب الرحلة' }) : tx(locale, { en: 'New trip request', es: 'Nueva solicitud de viaje', it: 'Nuova richiesta di viaggio', ar: 'طلب رحلة جديدة' })}</h2>
          </div>
          <button type="button" className="account-icon-action" onClick={backToList}>{tx(locale, { en: 'Back to my requests', es: 'Volver a mis solicitudes', it: 'Torna alle mie richieste', ar: 'عودة لطلباتي' })}</button>
        </header>
        <form className="contact-form" onSubmit={handleSubmit} noValidate>
          <div className="customer-form-grid">
            <label className="full">{tx(locale, { en: 'Trip name', es: 'Nombre del viaje', it: 'Nome del viaggio', ar: 'اسم الرحلة' })}
              <input value={tripName} onChange={(e) => setTripName(e.target.value)} disabled={tourSlug !== ''} placeholder={tx(locale, { en: 'e.g. Honeymoon in Aswan', es: 'p. ej., luna de miel en Asuán', it: 'es. luna di miele ad Assuan', ar: 'مثال: شهر عسل في أسوان' })} maxLength={120} aria-label={tx(locale, { en: 'Trip name', es: 'Nombre del viaje', it: 'Nome del viaggio', ar: 'اسم الرحلة' })} />
              {tourSlug === '' && fieldError('destination')}
              {tourSlug !== '' && <small className="customer-field-hint">{tx(locale, { en: 'Name taken from the selected tour', es: 'Nombre tomado del tour seleccionado', it: 'Nome preso dal tour selezionato', ar: 'الاسم من الرحلة المختارة' })}</small>}
            </label>
            <label className="full">{tx(locale, { en: 'Choose from our tours (optional)', es: 'Elige entre nuestros tours (opcional)', it: 'Scegli tra i nostri tour (facoltativo)', ar: 'اختر من رحلاتنا (اختياري)' })}
              <SharedSelect value={tourSlug} onChange={pickTour} locale={locale} label={tx(locale, { en: 'Ready-made tour', es: 'Tour organizado', it: 'Tour organizzato', ar: 'رحلة جاهزة' })} popupWidth="trigger" options={[{ value: '', label: tx(locale, { en: 'Fully custom trip in my own words', es: 'Viaje totalmente a medida según mi idea', it: 'Viaggio completamente su misura secondo la mia idea', ar: 'رحلة حرة بوصفك الخاص' }) }, ...catalogTours.map((tour) => ({ value: tour.slug, label: locale === 'ar' ? tour.titleAr ?? tour.title : tour.title }))]} />
            </label>
            <label className="full">{tx(locale, { en: 'Destination (optional)', es: 'Destino (opcional)', it: 'Destinazione (facoltativo)', ar: 'الوجهة (اختياري)' })}
              <SharedSelect value={destination} onChange={setDestination} locale={locale} label={tx(locale, { en: 'Destination', es: 'Destino', it: 'Destinazione', ar: 'الوجهة' })} popupWidth="trigger" options={[{ value: '', label: tx(locale, { en: 'Choose a place in Egypt', es: 'Elige un lugar de Egipto', it: 'Scegli un luogo in Egitto', ar: 'اختر وجهة في مصر' }) }, ...destinations.map((item) => ({ value: item.slug, label: locale === 'ar' ? item.nameAr ?? item.title : item.title }))]} />
            </label>
          </div>
          <div className="customer-time-tabs" role="radiogroup" aria-label={tx(locale, { en: 'Travel time', es: 'Fecha del viaje', it: 'Data del viaggio', ar: 'موعد السفر' })}>
            {timeTabs.map((tab) => (
              <button key={tab.id} type="button" role="radio" aria-checked={time === tab.id} className={time === tab.id ? 'active' : ''} onClick={() => setTime(tab.id)}>
                {tx(locale, tab)}
              </button>
            ))}
          </div>
          <div className="customer-form-grid">
            <label>{tx(locale, { en: 'Preferred start date', es: 'Fecha de inicio preferida', it: 'Data di inizio preferita', ar: 'تاريخ البدء المفضل' })}<DateInput dir="ltr" value={from} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setFrom(e.target.value)} />{fieldError('from')}</label>
            <label>{tx(locale, { en: 'Preferred end date', es: 'Fecha de fin preferida', it: 'Data di fine preferita', ar: 'تاريخ الانتهاء المفضل' })}<DateInput dir="ltr" value={to} min={from || new Date().toISOString().slice(0, 10)} onChange={(e) => setTo(e.target.value)} />{fieldError('to')}</label>
          </div>
          <div className="guest-rows">
            <Stepper label={tx(locale, { en: 'Adults', es: 'Adultos', it: 'Adulti', ar: 'البالغون' })} sub={tx(locale, { en: 'Ages 12+', es: '12 años o más', it: '12+ anni', ar: '12 سنة فأكثر' })} value={adults} set={setAdults} min={1} />
            <Stepper label={tx(locale, { en: 'Children', es: 'Niños', it: 'Bambini', ar: 'الأطفال' })} sub={tx(locale, { en: 'Ages 3-11', es: 'De 3 a 11 años', it: '3–11 anni', ar: '3 - 11 سنة' })} value={children} set={setChildren} />
            <Stepper label={tx(locale, { en: 'Infants', es: 'Bebés', it: 'Neonati', ar: 'الرضع' })} sub={tx(locale, { en: 'Under 3', es: 'Menores de 3 años', it: 'Sotto i 3 anni', ar: 'أقل من 3 سنوات' })} value={infants} set={setInfants} />
          </div>
          {errors.travelers && <em className="form-error" role="alert">{errText('travelers', errors.travelers, locale)}</em>}
          <div className="customer-form-grid">
            <label>{tx(locale, { en: `Min (${currency})`, es: `Mín. (${currency})`, it: `Min. (${currency})`, ar: `الحد الأدنى (${currency})` })}<input type="number" dir="ltr" min={0} max={TRIP_BUDGET_CAP} value={priceMin} onChange={(e) => setPriceMin(Math.max(0, Math.min(Number(e.target.value) || 0, priceMax - 100)))} /></label>
            <label>{tx(locale, { en: `Max (${currency})`, es: `Máx. (${currency})`, it: `Max. (${currency})`, ar: `الحد الأقصى (${currency})` })}<input type="number" dir="ltr" min={0} max={TRIP_BUDGET_CAP} value={priceMax} onChange={(e) => setPriceMax(Math.min(TRIP_BUDGET_CAP, Math.max(Number(e.target.value) || 0, priceMin + 100)))} /></label>
          </div>
          {fieldError('budget')}
          <label className="customer-check-row"><input type="checkbox" checked={flightOffer} onChange={(e) => setFlightOffer(e.target.checked)} />{tx(locale, { en: 'Include flight options in my request', es: 'Incluir opciones de vuelo en mi solicitud', it: 'Includi opzioni di volo nella mia richiesta', ar: 'تضمين خيارات الطيران في طلبي' })}</label>
          <div className="customer-form-grid">
            <label className="full">{tx(locale, { en: 'Full name *', es: 'Nombre completo *', it: 'Nome completo *', ar: 'الاسم الكامل *' })}<input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={tx(locale, { en: 'Your full name', es: 'Tu nombre completo', it: 'Il tuo nome completo', ar: 'اكتب اسمك الكامل' })} maxLength={80} autoComplete="name" />{fieldError('name')}</label>
            <label className="full">{tx(locale, { en: 'Email *', es: 'Correo electrónico *', it: 'Email *', ar: 'البريد الإلكتروني *' })}<input type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" maxLength={120} autoComplete="email" />{fieldError('email')}</label>
            <label>{tx(locale, { en: 'Nationality *', es: 'Nacionalidad *', it: 'Nazionalità *', ar: 'الجنسية *' })}
              <CountrySelect value={nationality} onChange={setNationality} locale={locale} placeholder={tx(locale, { en: 'Choose your nationality', es: 'Elige tu nacionalidad', it: 'Seleziona la tua nazionalità', ar: 'اختر جنسيتك' })} invalid={Boolean(errors.nationality)} />
              {fieldError('nationality')}
            </label>
            <label>{tx(locale, { en: 'Phone *', es: 'Teléfono *', it: 'Telefono *', ar: 'رقم الهاتف *' })}<InternationalPhoneInput value={phone} onChange={setPhone} locale={locale} countryCode={phoneCountry} onCountryChange={setPhoneCountry} />{fieldError('phone')}</label>
            <label className="full">{tx(locale, { en: 'Additional notes', es: 'Notas adicionales', it: 'Note aggiuntive', ar: 'ملاحظات إضافية' })}<textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={TRIP_NOTE_MAX + 50} placeholder={tx(locale, { en: 'Describe your custom trip here: places, pace, anything', es: 'Describe aquí tu viaje a medida: lugares, ritmo, lo que quieras', it: 'Descrivi qui il tuo viaggio su misura: luoghi, ritmo, tutto ciò che vuoi', ar: 'اوصف رحلتك الحرة هنا: الأماكن والإيقاع وأي تفاصيل' })} />{fieldError('notes')}</label>
          </div>
          {summary && <p className="form-error" role="alert">{summary}</p>}
          <button className="primary-btn" type="submit" disabled={submitting}>{submitting ? tx(locale, { en: 'Saving…', es: 'Guardando…', it: 'Salvataggio…', ar: 'جارٍ الحفظ…' }) : editingRef ? tx(locale, { en: 'Save changes', es: 'Guardar cambios', it: 'Salva modifiche', ar: 'حفظ التعديلات' }) : tx(locale, { en: 'Save trip request', es: 'Guardar solicitud', it: 'Salva richiesta', ar: 'حفظ طلب الرحلة' })}</button>
        </form>
        <p className="customer-block-note">{tx(locale, { en: 'Your request is saved to your account on submit. The budget is your preference, not a quote.', es: 'Tu solicitud se guarda en tu cuenta al enviarla. El presupuesto es orientativo, no una cotización final.', it: 'La tua richiesta viene salvata nel tuo account all’invio. Il budget è la tua preferenza, non un preventivo.', ar: 'يُحفظ طلبك في حسابك فور الإرسال. الميزانية تفضيل منك وليست عرض سعر.' })}</p>
      </section>
    )
  }

  if (loading) {
    return <section className="customer-account-block customer-full-block"><div className="customer-empty" role="status"><h3>{tx(locale, { en: 'Loading your requests…', es: 'Cargando tus solicitudes…', it: 'Caricamento delle tue richieste…', ar: 'جارٍ تحميل طلباتك…' })}</h3></div></section>
  }

  if (loadError && !requests.length) {
    return (
      <section className="customer-account-block customer-full-block">
        <div className="customer-empty">
          <h3>{tx(locale, { en: 'Could not load requests', es: 'No se pudieron cargar las solicitudes', it: 'Impossibile caricare le richieste', ar: 'تعذر تحميل الطلبات' })}</h3>
          <p>{loadError}</p>
          <button type="button" className="account-icon-action" onClick={() => {
            setLoading(true)
            setLoadError('')
            apiList()
              .then((rows) => { setRequests(rows); setLoading(false) })
              .catch((error: unknown) => {
                setLoadError(error instanceof Error ? error.message : 'Could not load your trip requests.')
                setLoading(false)
              })
          }}>{tx(locale, { en: 'Retry', es: 'Reintentar', it: 'Riprova', ar: 'إعادة المحاولة' })}</button>
        </div>
      </section>
    )
  }

  if (!requests.length && !lastCreated) {
    return <section className="customer-account-block customer-full-block"><EmptyState Icon={Plus} title={tx(locale, { en: 'No trip request yet', es: 'Aún no hay solicitudes de viaje', it: 'Ancora nessuna richiesta di viaggio', ar: 'لا يوجد طلب رحلة بعد' })} copy={tx(locale, { en: 'Plan your custom trip and it will appear here.', es: 'Planifica tu viaje a medida y aparecerá aquí.', it: 'Pianifica il tuo viaggio su misura e apparirà qui.', ar: 'خطط رحلتك المخصصة وستظهر هنا.' })} href="/account/trip-requests?new=1" action={tx(locale, { en: 'Plan your trip', es: 'Planifica tu viaje', it: 'Pianifica il tuo viaggio', ar: 'خطط رحلتك' })} /></section>
  }

  const dateTabs = [
    { id: 'all', en: 'All', es: 'Todas', it: 'Tutte', ar: 'الكل' },
    { id: 'upcoming', en: 'Upcoming', es: 'Próximas', it: 'Prossime', ar: 'القادمة' },
    { id: 'past', en: 'Past', es: 'Anteriores', it: 'Passate', ar: 'السابقة' },
  ] as const
  const statusOptions = ['new', 'reviewing', 'proposal_ready', 'approved', 'rejected', 'cancelled'] as const
  const viewLabel = tx(locale, { en: 'View request', es: 'Ver solicitud', it: 'Vedi richiesta', ar: 'عرض الطلب' })
  return (
    <section className="customer-account-block customer-full-block">
      {loadError && requests.length > 0 && (
        <div style={{ padding: '18px 18px 0' }}>
          <p className="form-error" role="alert">{loadError}</p>
        </div>
      )}
      {lastCreated && (
        <div style={{ padding: '18px 18px 0' }}>
          <div className="customer-inline-success" role="status">
            <strong>{tx(locale, { en: 'Trip request saved', es: 'Solicitud de viaje guardada', it: 'Richiesta di viaggio salvata', ar: 'تم حفظ طلب الرحلة' })}</strong>
            <span dir="ltr">{lastCreated.ref}</span>
            <Link className="account-icon-action" href={`/account/trip-requests/detail?ref=${encodeURIComponent(lastCreated.ref)}`}>{tx(locale, { en: 'View details', es: 'Ver detalles', it: 'Vedi dettagli', ar: 'عرض التفاصيل' })}</Link>
            <button type="button" className="account-icon-action" onClick={() => setLastCreated(null)}>{tx(locale, { en: 'Dismiss', es: 'Descartar', it: 'Ignora', ar: 'إخفاء' })}</button>
          </div>
        </div>
      )}
      <div className="customer-filterbar">
        <div role="tablist" aria-label={tx(locale, { en: 'Filter trip requests', es: 'Filtrar solicitudes de viaje', it: 'Filtra richieste di viaggio', ar: 'فلترة طلبات الرحلات' })}>
          {dateTabs.map((tab) => <button key={tab.id} type="button" className={dateFilter === tab.id ? 'active' : ''} onClick={() => setDateFilter(tab.id)}>{tx(locale, tab)}</button>)}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <SharedSelect value={statusFilter} onChange={(next) => setStatusFilter(next as typeof statusFilter)} locale={locale} label={tx(locale, { en: 'Filter by status', es: 'Filtrar por estado', it: 'Filtra per stato', ar: 'فلترة حسب الحالة' })} options={[{ value: 'all', label: tx(locale, { en: 'All statuses', es: 'Todos los estados', it: 'Tutti gli stati', ar: 'كل الحالات' }) }, ...statusOptions.map((s) => ({ value: s, label: tripRequestStatusLabel(s, locale) }))]} />
          <button type="button" className="account-icon-action" onClick={requestNew}><Plus size={16} />{tx(locale, { en: 'New request', es: 'Nueva solicitud', it: 'Nuova richiesta', ar: 'طلب جديد' })}</button>
        </div>
      </div>
      {paging.pageRows.length ? (
        <>
          <div className="customer-table-wrap"><table className="customer-table">
            <thead><tr><th>#</th><th>{tx(locale, { en: 'Destination', es: 'Destino', it: 'Destinazione', ar: 'الوجهة' })}</th><th>{tx(locale, { en: 'Dates', es: 'Fechas', it: 'Date', ar: 'التواريخ' })}</th><th>{tx(locale, { en: 'Travelers', es: 'Viajeros', it: 'Viaggiatori', ar: 'المسافرون' })}</th><th>{tx(locale, { en: 'Budget', es: 'Presupuesto', it: 'Budget', ar: 'الميزانية' })}</th><th>{tx(locale, { en: 'Status', es: 'Estado', it: 'Stato', ar: 'الحالة' })}</th><th></th></tr></thead>
            <tbody>{paging.pageRows.map((r, index) => {
              const detailHref = `/account/trip-requests/detail?ref=${encodeURIComponent(r.reference)}`
              const editable = r.status === 'new' || r.status === 'reviewing'
              return <tr key={r.reference}>
                <td className="customer-row-number">{paging.from + index}</td>
                <td><span className="customer-trip-cell"><span><strong><Link href={detailHref}>{titleOf(r)}</Link></strong><small><span dir="ltr">{r.reference}</span></small></span></span></td>
                <td><span dir="ltr">{dateTextOf(r)}</span></td>
                <td>{r.adults + r.children + r.infants}</td>
                <td><span dir="ltr">{r.budgetMin.toLocaleString('en-US')} - {r.budgetMax.toLocaleString('en-US')} {r.currency}</span></td>
                <td><StatusBadge status={r.status} /></td>
                <td><span className="customer-table-actions">
                  <Link href={detailHref} aria-label={viewLabel} title={viewLabel}><Eye size={16} /></Link>
                  {editable && <button type="button" onClick={() => startEdit(r.reference)} aria-label={tx(locale, { en: 'Edit request', es: 'Editar solicitud', it: 'Modifica richiesta', ar: 'تعديل الطلب' })} title={tx(locale, { en: 'Edit request', es: 'Editar solicitud', it: 'Modifica richiesta', ar: 'تعديل الطلب' })}><Pencil size={16} /></button>}
                  {editable && <button type="button" className="danger" onClick={() => setCancellingRef(r.reference)} aria-label={tx(locale, { en: 'Cancel request', es: 'Cancelar solicitud', it: 'Annulla richiesta', ar: 'إلغاء الطلب' })} title={tx(locale, { en: 'Cancel request', es: 'Cancelar solicitud', it: 'Annulla richiesta', ar: 'إلغاء الطلب' })}><X size={16} /></button>}
                </span></td>
              </tr>
            })}</tbody>
          </table></div>
          <CustomerConfirmDialog
            open={cancellingRef !== null}
            onClose={() => setCancellingRef(null)}
            onConfirm={() => {
              const ref = cancellingRef
              setCancellingRef(null)
              if (!ref) return
              apiCancel(ref)
                .then((saved) => {
                  setLoadError('')
                  setRequests((prev) => prev.map((r) => (r.reference === saved.reference ? saved : r)))
                })
                .catch((error: unknown) => {
                  setLoadError(error instanceof Error ? error.message : 'Could not cancel the request.')
                })
            }}
            title={tx(locale, { en: 'Cancel this trip request?', es: '¿Cancelar esta solicitud de viaje?', it: 'Annullare questa richiesta di viaggio?', ar: 'إلغاء طلب الرحلة؟' })}
            copy={tx(locale, { en: 'This request will remain in your history with a Cancelled status.', es: 'Esta solicitud quedará en tu historial como cancelada.', it: 'Questa richiesta resterà nella tua cronologia come annullata.', ar: 'سيبقى هذا الطلب في سجلك بحالة ملغي.' })}
            confirmLabel={tx(locale, { en: 'Cancel request', es: 'Cancelar solicitud', it: 'Annulla richiesta', ar: 'إلغاء الطلب' })}
            cancelLabel={tx(locale, { en: 'Keep request', es: 'Mantener solicitud', it: 'Mantieni richiesta', ar: 'أبقِ الطلب' })}
          />
          <CustomerPagination page={paging.page} pageCount={paging.pageCount} onPage={paging.setPage} pageSize={paging.pageSize} onPageSize={paging.setPageSize} from={paging.from} to={paging.to} total={paging.total} />
          <div style={{ padding: '0 18px 18px' }}>
            <p className="car-request-notice" role="note"><Clock3 size={15} /><span>{tx(locale, { en: 'Our team follows up on your request and will contact you by email with updates.', es: 'Nuestro equipo da seguimiento a tu solicitud y te contactará por correo con novedades.', it: 'Il nostro team segue la tua richiesta e ti contatterà via email con aggiornamenti.', ar: 'يتابع فريقنا طلبك وسيتواصل معك على بريدك عند وجود تحديث.' })}</span></p>
          </div>
        </>
      ) : (
        <div className="customer-empty"><span><Clock3 size={24} /></span><h3>{tx(locale, { en: 'No requests in this view', es: 'Sin solicitudes en esta vista', it: 'Nessuna richiesta in questa vista', ar: 'لا توجد طلبات في هذا العرض' })}</h3><p>{tx(locale, { en: 'Try a different filter above.', es: 'Prueba con otro filtro arriba.', it: 'Prova un altro filtro qui sopra.', ar: 'جرب فلترًا مختلفًا من الأعلى.' })}</p><button type="button" className="account-icon-action" onClick={() => { setDateFilter('all'); setStatusFilter('all') }}>{tx(locale, { en: 'Show all', es: 'Ver todo', it: 'Mostra tutto', ar: 'عرض الكل' })}</button></div>
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
  return <Link href="/account/trip-requests?new=1" className="account-icon-action"><Plus size={17} />{tx(locale, { en: 'Plan your trip', es: 'Planifica tu viaje', it: 'Pianifica il tuo viaggio', ar: 'خطط رحلتك' })}</Link>
}

export function TripRequestDetailSection({ reference }: { reference: string }) {
  const { locale } = useLocale()
  const [item, setItem] = useState<TripRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const dateTimeLocale = locale === 'ar' ? 'ar-EG' : locale === 'es' ? 'es-ES' : locale === 'it' ? 'it-IT' : 'en-US'
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    apiDetail(reference)
      .then((record) => { if (!cancelled) { setItem(record); setLoading(false) } })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Trip request not found.')
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [reference])
  if (loading) {
    return (
      <div className="customer-inline-empty" role="status">
        <Clock3 size={20} />
        <span><strong>{tx(locale, { en: 'Loading request…', es: 'Cargando solicitud…', it: 'Caricamento richiesta…', ar: 'جارٍ تحميل الطلب…' })}</strong></span>
      </div>
    )
  }
  if (!item) {
    return (
      <div className="customer-inline-empty">
        <Clock3 size={20} />
        <span>
          <strong>{tx(locale, { en: 'Trip request not found', es: 'Solicitud de viaje no encontrada', it: 'Richiesta di viaggio non trovata', ar: 'طلب الرحلة غير موجود' })}</strong>
          <small>{error || tx(locale, { en: 'It may have been removed or belong to a different account.', es: 'Puede que se haya eliminado o pertenezca a otra cuenta.', it: 'Potrebbe essere stata rimossa o appartenere a un altro account.', ar: 'ربما تم حذفه أو أنه يخص حسابًا آخر.' })}</small>
        </span>
        <Link href="/account/trip-requests">{tx(locale, { en: 'Back to trip requests', es: 'Volver a solicitudes de viaje', it: 'Torna alle richieste di viaggio', ar: 'عودة لطلبات الرحلات' })}</Link>
      </div>
    )
  }
  const editable = item.status === 'new' || item.status === 'reviewing'
  const timeLabel = item.timeMode === 'exact' ? tx(locale, { en: 'Exact time', es: 'Fecha exacta', it: 'Data esatta', ar: 'موعد محدد' }) : item.timeMode === 'approx' ? tx(locale, { en: 'Approximate time', es: 'Fecha aproximada', it: 'Data approssimativa', ar: 'موعد تقريبي' }) : tx(locale, { en: 'Not sure yet', es: 'Aún no lo sé', it: 'Non lo so ancora', ar: 'لم يحدد بعد' })
  return (
    <div className="customer-account-block">
      <header>
        <div>
          <span>{tx(locale, { en: 'Trip request detail', es: 'Detalle de la solicitud', it: 'Dettaglio richiesta di viaggio', ar: 'تفاصيل طلب الرحلة' })}</span>
          <h2>{titleOf(item)}</h2>
        </div>
        <StatusBadge status={item.status} />
      </header>
      <dl className="customer-detail-grid">
        <div><dt>{tx(locale, { en: 'Reference', es: 'Referencia', it: 'Riferimento', ar: 'المرجع' })}</dt><dd dir="ltr">{item.reference}</dd></div>
        <div><dt>{tx(locale, { en: 'Created', es: 'Creada', it: 'Creata', ar: 'أُنشئ في' })}</dt><dd>{new Date(item.createdAt).toLocaleString(dateTimeLocale)}</dd></div>
        <div><dt>{tx(locale, { en: 'Updated', es: 'Actualizada', it: 'Aggiornata', ar: 'آخر تحديث' })}</dt><dd>{new Date(item.updatedAt).toLocaleString(dateTimeLocale)}</dd></div>
        <div><dt>{tx(locale, { en: 'Destination', es: 'Destino', it: 'Destinazione', ar: 'الوجهة' })}</dt><dd>{titleOf(item)}</dd></div>
        <div><dt>{tx(locale, { en: 'Dates', es: 'Fechas', it: 'Date', ar: 'التواريخ' })}</dt><dd dir="ltr">{dateTextOf(item) || tx(locale, { en: 'Flexible date', es: 'Fecha flexible', it: 'Data flessibile', ar: 'موعد مرن' })}</dd></div>
        <div><dt>{tx(locale, { en: 'Date flexibility', es: 'Flexibilidad de fechas', it: 'Flessibilità date', ar: 'إيقاع المواعيد' })}</dt><dd>{timeLabel}</dd></div>
        <div><dt>{tx(locale, { en: 'Travelers', es: 'Viajeros', it: 'Viaggiatori', ar: 'المسافرون' })}</dt><dd>{tx(locale, { en: `${item.adults} adults, ${item.children} children, ${item.infants} infants`, es: `${item.adults} adultos, ${item.children} niños, ${item.infants} bebés`, it: `${item.adults} adulti, ${item.children} bambini, ${item.infants} neonati`, ar: `${item.adults} بالغ، ${item.children} أطفال، ${item.infants} رضع` })}</dd></div>
        <div><dt>{tx(locale, { en: 'Flight options', es: 'Opciones de vuelo', it: 'Opzioni di volo', ar: 'خيارات الطيران' })}</dt><dd>{item.flightOffer ? tx(locale, { en: 'Requested', es: 'Solicitadas', it: 'Richieste', ar: 'مطلوبة' }) : tx(locale, { en: 'Not requested', es: 'No solicitadas', it: 'Non richieste', ar: 'غير مطلوبة' })}</dd></div>
        {item.requestedAddOns.length > 0 && <div className="full"><dt>{tx(locale, { en: 'Requested add-ons', es: 'Extras solicitados', it: 'Extra richiesti', ar: 'إضافات مطلوبة' })}</dt><dd>{item.requestedAddOns.join(locale === 'ar' ? '، ' : ', ')}</dd></div>}
        <div><dt>{tx(locale, { en: 'Budget', es: 'Presupuesto', it: 'Budget', ar: 'الميزانية' })}</dt><dd dir="ltr">{item.budgetMin.toLocaleString('en-US')} - {item.budgetMax.toLocaleString('en-US')} {item.currency}</dd></div>
        <div><dt>{tx(locale, { en: 'Name', es: 'Nombre', it: 'Nome', ar: 'الاسم' })}</dt><dd>{item.contact.name}</dd></div>
        <div><dt>{tx(locale, { en: 'Email', es: 'Correo electrónico', it: 'Email', ar: 'البريد الإلكتروني' })}</dt><dd dir="ltr">{item.contact.email}</dd></div>
        <div><dt>{tx(locale, { en: 'Phone', es: 'Teléfono', it: 'Telefono', ar: 'الهاتف' })}</dt><dd dir="ltr">{displayInternationalPhone(item.contact.dialCode, item.contact.phone)}</dd></div>
        <div><dt>{tx(locale, { en: 'Nationality', es: 'Nacionalidad', it: 'Nazionalità', ar: 'الجنسية' })}</dt><dd>{countryDisplayName(item.contact.nationality, locale)}</dd></div>
        {item.notes && <div className="full"><dt>{tx(locale, { en: 'Notes', es: 'Notas', it: 'Note', ar: 'ملاحظات' })}</dt><dd>{item.notes}</dd></div>}
      </dl>
      {item.activity.length > 0 && (
        <section className="customer-activity" aria-label={tx(locale, { en: 'Request activity', es: 'Historial de la solicitud', it: 'Attività della richiesta', ar: 'سجل الطلب' })}>
          <h3>{tx(locale, { en: 'Activity', es: 'Actividad', it: 'Attività', ar: 'سجل الطلب' })}</h3>
          <ul>{item.activity.map((a, i) => <li key={`${a.at}-${i}`}><span>{new Date(a.at).toLocaleString(dateTimeLocale)}</span><strong>{tripActivityLabel(a.action, locale)}</strong>{a.note && <small>{a.note}</small>}</li>)}</ul>
        </section>
      )}
      <div className="customer-detail-actions">
        {error && <p className="form-error" role="alert" style={{ flexBasis: '100%' }}>{error}</p>}
        <Link href="/account/trip-requests" className="account-icon-action">{tx(locale, { en: 'Back to list', es: 'Volver a la lista', it: 'Torna alla lista', ar: 'عودة للقائمة' })}</Link>
        {editable && <Link href={`/account/trip-requests?edit=${encodeURIComponent(item.reference)}`} className="account-icon-action"><Pencil size={16} />{tx(locale, { en: 'Edit request', es: 'Editar solicitud', it: 'Modifica richiesta', ar: 'تعديل الطلب' })}</Link>}
        {editable && (
          <button type="button" className="account-icon-action danger" onClick={() => setCancelling(true)}><X size={16} />{tx(locale, { en: 'Cancel request', es: 'Cancelar solicitud', it: 'Annulla richiesta', ar: 'إلغاء الطلب' })}</button>
        )}
      </div>
      <CustomerConfirmDialog
        open={cancelling}
        onClose={() => setCancelling(false)}
        onConfirm={() => {
          setCancelling(false)
          apiCancel(item.reference)
            .then((saved) => setItem(saved))
            .catch((err: unknown) => {
              setError(err instanceof Error ? err.message : 'Could not cancel the request.')
            })
        }}
        title={tx(locale, { en: 'Cancel this trip request?', es: '¿Cancelar esta solicitud de viaje?', it: 'Annullare questa richiesta di viaggio?', ar: 'إلغاء طلب الرحلة؟' })}
        copy={tx(locale, { en: 'This request will remain in your history with a Cancelled status.', es: 'Esta solicitud quedará en tu historial como cancelada.', it: 'Questa richiesta resterà nella tua cronologia come annullata.', ar: 'سيبقى هذا الطلب في سجلك بحالة ملغي.' })}
        confirmLabel={tx(locale, { en: 'Cancel request', es: 'Cancelar solicitud', it: 'Annulla richiesta', ar: 'إلغاء الطلب' })}
        cancelLabel={tx(locale, { en: 'Keep request', es: 'Mantener solicitud', it: 'Mantieni richiesta', ar: 'أبقِ الطلب' })}
      />
      <p className="customer-block-note">{tx(locale, { en: 'Contact details shown are a historical snapshot of this request.', es: 'Los datos de contacto mostrados son los registrados en esta solicitud.', it: 'I dati di contatto mostrati sono quelli registrati in questa richiesta.', ar: 'بيانات التواصل المعروضة لقطة تاريخية لهذا الطلب.' })}</p>
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
  return (
    <AccountShell section="trip-requests" headLeading={<Link href="/account/trip-requests" className="account-icon-action">{tx(locale, { en: 'Back to trip requests', es: 'Volver a solicitudes de viaje', it: 'Torna alle richieste di viaggio', ar: 'عودة لطلبات الرحلات' })}</Link>}>
      <TripRequestDetailSection reference={reference} />
    </AccountShell>
  )
}
