'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ArrowRight, Check, Minus, Plus, ShieldCheck } from 'lucide-react'
import type { Event } from '@/data/types'
import { getEventStatus } from '@/lib/events'
import { hasEventRequestErrors, validateEventRequestDraft, type EventRequest } from '@/lib/event-request'
import { countries, defaultCountry } from '@/data/countries'
import { CountrySelect } from '@/components/country-select'
import { InternationalPhoneInput } from '@/components/international-phone-input'
import { useLocale } from './locale'

/**
 * Event Request form (Phase 2D: real backend).
 * Persists to MySQL (`POST /api/event-requests`) with an official SP-ER-
 * reference. Ownership links automatically when a CUSTOMER is signed in;
 * guests stay unlinked. Never claims confirmation, payment, or ticket issuance.
 */
export function EventRequestForm({ event }: { event: Event }) {
  const { locale } = useLocale()
  const ar = locale === 'ar'
  const [name, setName] = useState('')
  const [countryCode, setCountryCode] = useState(defaultCountry.code)
  const [phoneCountry, setPhoneCountry] = useState(defaultCountry.code)
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [attendees, setAttendees] = useState(2)
  const [note, setNote] = useState('')
  const [errors, setErrors] = useState<string | null>(null)
  const [ref, setRef] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  const status = getEventStatus(event)
  const requestable = status === 'upcoming' || status === 'ongoing'

  if (ref) {
    return (
      <div className="form-success" role="status">
        <Check size={34} />
        <h2>{ar ? 'تم إرسال الطلب' : 'Request submitted'}</h2>
        <span className="req-ref">{ar ? 'المرجع الرسمي: ' : 'Official reference: '}{ref}</span>
        <p>
          {ar
            ? 'هذا طلب مبدئي قيد المراجعة، وليس تذكرة مؤكدة. يمكنك متابعته من طلبات الفعاليات في حسابك.'
            : 'This is a preliminary request pending review. It is not a confirmed ticket. Track it under My Event Requests in your account.'}
        </p>
        <Link href="/account/event-requests" className="primary-btn">
          {ar ? 'عرض طلبات الفعاليات' : 'View My Event Requests'} <ArrowRight size={17} />
        </Link>
      </div>
    )
  }

  if (!requestable) {
    return (
      <div className="event-book-closed" role="status">
        <ShieldCheck size={20} />
        <p>
          {ar
            ? 'انتهت هذه الفعالية ولا تقبل طلبات جديدة. تصفح الفعاليات القادمة.'
            : 'This event has ended and is no longer accepting requests. Browse upcoming events.'}
        </p>
        <Link href="/events" className="primary-btn">
          {ar ? 'شاهد الفعاليات القادمة' : 'See upcoming events'} <ArrowRight size={17} />
        </Link>
      </div>
    )
  }

  const submit = (e: { preventDefault: () => void }) => {
    e.preventDefault()
    if (sending) return
    const draft = {
      eventSlug: event.slug,
      eventTitle: event.title,
      eventDate: event.date,
      eventLocation: event.location,
      name: name.trim(),
      nationality: countryCode,
      dialCode: (countries.find((c) => c.code === phoneCountry) ?? defaultCountry).dialCode,
      phone: phone.trim(),
      email: email.trim(),
      attendees,
      note: note.trim() || undefined,
    }
    const validation = validateEventRequestDraft(draft)
    if (hasEventRequestErrors(validation)) {
      if (validation.name) setErrors(ar ? 'اكتب الاسم الكامل.' : 'Full name is required.')
      else if (validation.email === 'required') setErrors(ar ? 'البريد الإلكتروني مطلوب.' : 'Email is required.')
      else if (validation.email === 'invalid') setErrors(ar ? 'تحقق من صيغة البريد الإلكتروني.' : 'Check the email format.')
      else if (validation.phone) setErrors(ar ? 'تحقق من رقم الهاتف (7 أرقام على الأقل).' : 'Check the phone number (at least 7 digits).')
      else if (validation.attendees) setErrors(ar ? 'عدد الحضور من 1 إلى 50.' : 'Attendees must be 1–50.')
      else setErrors(ar ? 'تحقق من الحقول المطلوبة.' : 'Check the required fields.')
      return
    }
    setErrors(null)
    setSending(true)
    fetch('/api/event-requests', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(draft),
    })
      .then(async (res) => {
        const data = (await res.json()) as EventRequest & { error?: string }
        if (!res.ok) throw new Error(data.error || (ar ? 'تعذر إرسال الطلب. حاول مجددًا.' : 'Could not submit the request. Please try again.'))
        setRef(data.reference)
      })
      .catch((error: unknown) => {
        setErrors(error instanceof Error ? error.message : (ar ? 'تعذر إرسال الطلب. حاول مجددًا.' : 'Could not submit the request. Please try again.'))
      })
      .finally(() => setSending(false))
  }

  return (
    <>
      <span className="eyebrow">{ar ? 'طلب حضور الفعالية' : 'Request your place'}</span>
      <h2>{ar ? 'اطلب مكانك' : 'Event request'}</h2>
      <p className="event-book-meta">{event.date}</p>
      <form className="contact-form" onSubmit={submit} noValidate>
        <div className="form-grid">
          <label className="full">{ar ? 'الاسم الكامل *' : 'Full name *'}<input required value={name} onChange={(e) => setName(e.target.value)} placeholder={ar ? 'اكتب اسمك الكامل' : 'Your full name'} maxLength={80} autoComplete="name" /></label>
          <label className="full">{ar ? 'الجنسية *' : 'Nationality *'}<CountrySelect value={countryCode} onChange={setCountryCode} locale={locale} /></label>
          <label className="full">{ar ? 'رقم الموبايل *' : 'Mobile number *'}<InternationalPhoneInput required value={phone} onChange={setPhone} locale={locale} countryCode={phoneCountry} onCountryChange={setPhoneCountry} placeholder={ar ? 'رقم الموبايل' : 'Mobile number'} /></label>
          <label className="full">{ar ? 'البريد الإلكتروني *' : 'Email *'}<input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" maxLength={120} autoComplete="email" /></label>
          <label className="full">{ar ? 'ملاحظات (اختياري)' : 'Notes (optional)'}<textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder={ar ? 'أي تفاصيل إضافية...' : 'Anything we should know...'} /></label>
        </div>
        <div className="guest-row"><span><b>{ar ? 'عدد الحضور' : 'Attendees'}</b></span><div><button type="button" aria-label={ar ? 'إنقاص العدد' : 'Decrease attendees'} disabled={attendees <= 1} onClick={() => setAttendees(Math.max(1, attendees - 1))}><Minus size={14} /></button><b aria-live="polite">{attendees}</b><button type="button" aria-label={ar ? 'زيادة العدد' : 'Increase attendees'} disabled={attendees >= 50} onClick={() => setAttendees(Math.min(50, attendees + 1))}><Plus size={14} /></button></div></div>
        {errors && <p role="alert" className="form-error">{errors}</p>}
        <button className="primary-btn" type="submit" disabled={sending}>{sending ? (ar ? 'جارٍ الإرسال...' : 'Sending...') : (ar ? 'إرسال طلب الحضور' : 'Send event request')} <ArrowRight size={17} /></button>
      </form>
      <p className="event-book-note"><ShieldCheck size={14} />{ar ? 'طلب مبدئي قيد المراجعة. ليس تذكرة مؤكدة ولا دفع الآن.' : 'A preliminary request pending review. Not a confirmed ticket, no payment now.'}</p>
    </>
  )
}
