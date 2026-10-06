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
import { tx, useLocale } from './locale'

/**
 * Event Request form (Phase 2D: real backend).
 * Persists to MySQL (`POST /api/event-requests`) with an official SP-ER-
 * reference. Ownership links automatically when a CUSTOMER is signed in;
 * guests stay unlinked. Never claims confirmation, payment, or ticket issuance.
 */
export function EventRequestForm({ event }: { event: Event }) {
  const { locale } = useLocale()
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
        <h2>{tx(locale, { en: 'Request submitted', es: 'Solicitud enviada', it: 'Richiesta inviata', ar: 'تم إرسال الطلب' })}</h2>
        <span className="req-ref">{tx(locale, { en: 'Official reference: ', es: 'Referencia oficial: ', it: 'Riferimento ufficiale: ', ar: 'المرجع الرسمي: ' })}{ref}</span>
        <p>
          {tx(locale, {
            en: 'This is a preliminary request pending review. It is not a confirmed ticket. Track it under My Event Requests in your account.',
            es: 'Esta es una solicitud preliminar pendiente de revisión. No es una entrada confirmada. Sigue su estado en Mis solicitudes de eventos de tu cuenta.',
            it: 'Questa è una richiesta preliminare in attesa di revisione. Non è un biglietto confermato. Seguila in Le mie richieste eventi nel tuo account.',
            ar: 'هذا طلب مبدئي قيد المراجعة، وليس تذكرة مؤكدة. يمكنك متابعته من طلبات الفعاليات في حسابك.',
          })}
        </p>
        <Link href="/account/event-requests" className="primary-btn">
          {tx(locale, { en: 'View My Event Requests', es: 'Ver mis solicitudes de eventos', it: 'Vedi le mie richieste eventi', ar: 'عرض طلبات الفعاليات' })} <ArrowRight size={17} />
        </Link>
      </div>
    )
  }

  if (!requestable) {
    return (
      <div className="event-book-closed" role="status">
        <ShieldCheck size={20} />
        <p>
          {tx(locale, {
            en: 'This event has ended and is no longer accepting requests. Browse upcoming events.',
            es: 'Este evento ya ha terminado y no acepta más solicitudes. Descubre los próximos eventos.',
            it: 'Questo evento si è concluso e non accetta più richieste. Scopri i prossimi eventi.',
            ar: 'انتهت هذه الفعالية ولا تقبل طلبات جديدة. تصفح الفعاليات القادمة.',
          })}
        </p>
        <Link href="/events" className="primary-btn">
          {tx(locale, { en: 'See upcoming events', es: 'Ver próximos eventos', it: 'Vedi i prossimi eventi', ar: 'شاهد الفعاليات القادمة' })} <ArrowRight size={17} />
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
    const submitFailed = tx(locale, { en: 'Could not submit the request. Please try again.', es: 'No se pudo enviar la solicitud. Inténtalo de nuevo.', it: 'Impossibile inviare la richiesta. Riprova.', ar: 'تعذر إرسال الطلب. حاول مجددًا.' })
    const validation = validateEventRequestDraft(draft)
    if (hasEventRequestErrors(validation)) {
      if (validation.name) setErrors(tx(locale, { en: 'Full name is required.', es: 'Escribe tu nombre completo.', it: 'Inserisci il nome completo.', ar: 'اكتب الاسم الكامل.' }))
      else if (validation.email === 'required') setErrors(tx(locale, { en: 'Email is required.', es: 'El correo electrónico es obligatorio.', it: "L'email è obbligatoria.", ar: 'البريد الإلكتروني مطلوب.' }))
      else if (validation.email === 'invalid') setErrors(tx(locale, { en: 'Check the email format.', es: 'Revisa el formato del correo electrónico.', it: "Controlla il formato dell'email.", ar: 'تحقق من صيغة البريد الإلكتروني.' }))
      else if (validation.phone) setErrors(tx(locale, { en: 'Check the phone number (at least 7 digits).', es: 'Revisa el número de teléfono (mínimo 7 dígitos).', it: 'Controlla il numero di telefono (almeno 7 cifre).', ar: 'تحقق من رقم الهاتف (7 أرقام على الأقل).' }))
      else if (validation.attendees) setErrors(tx(locale, { en: 'Attendees must be 1–50.', es: 'Los asistentes deben ser de 1 a 50.', it: 'I partecipanti devono essere da 1 a 50.', ar: 'عدد الحضور من 1 إلى 50.' }))
      else setErrors(tx(locale, { en: 'Check the required fields.', es: 'Revisa los campos obligatorios.', it: 'Controlla i campi obbligatori.', ar: 'تحقق من الحقول المطلوبة.' }))
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
        if (!res.ok) throw new Error(data.error || submitFailed)
        setRef(data.reference)
      })
      .catch((error: unknown) => {
        setErrors(error instanceof Error ? error.message : submitFailed)
      })
      .finally(() => setSending(false))
  }

  return (
    <>
      <span className="eyebrow">{tx(locale, { en: 'Request your place', es: 'Reserva tu plaza', it: 'Richiedi il tuo posto', ar: 'طلب حضور الفعالية' })}</span>
      <h2>{tx(locale, { en: 'Event request', es: 'Solicitud de evento', it: 'Richiesta evento', ar: 'اطلب مكانك' })}</h2>
      <p className="event-book-meta">{event.date}</p>
      <form className="contact-form" onSubmit={submit} noValidate>
        <div className="form-grid">
          <label className="full">{tx(locale, { en: 'Full name *', es: 'Nombre completo *', it: 'Nome completo *', ar: 'الاسم الكامل *' })}<input required value={name} onChange={(e) => setName(e.target.value)} placeholder={tx(locale, { en: 'Your full name', es: 'Tu nombre completo', it: 'Il tuo nome completo', ar: 'اكتب اسمك الكامل' })} maxLength={80} autoComplete="name" /></label>
          <label className="full">{tx(locale, { en: 'Nationality *', es: 'Nacionalidad *', it: 'Nazionalità *', ar: 'الجنسية *' })}<CountrySelect value={countryCode} onChange={setCountryCode} locale={locale} /></label>
          <label className="full">{tx(locale, { en: 'Mobile number *', es: 'Número de móvil *', it: 'Numero di cellulare *', ar: 'رقم الموبايل *' })}<InternationalPhoneInput required value={phone} onChange={setPhone} locale={locale} countryCode={phoneCountry} onCountryChange={setPhoneCountry} placeholder={tx(locale, { en: 'Mobile number', es: 'Número de móvil', it: 'Numero di cellulare', ar: 'رقم الموبايل' })} /></label>
          <label className="full">{tx(locale, { en: 'Email *', es: 'Correo electrónico *', it: 'Email *', ar: 'البريد الإلكتروني *' })}<input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" maxLength={120} autoComplete="email" /></label>
          <label className="full">{tx(locale, { en: 'Notes (optional)', es: 'Notas (opcional)', it: 'Note (facoltativo)', ar: 'ملاحظات (اختياري)' })}<textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder={tx(locale, { en: 'Anything we should know...', es: 'Algo que debamos saber...', it: 'Qualcosa che dovremmo sapere...', ar: 'أي تفاصيل إضافية...' })} /></label>
        </div>
        <div className="guest-row"><span><b>{tx(locale, { en: 'Attendees', es: 'Asistentes', it: 'Partecipanti', ar: 'عدد الحضور' })}</b></span><div><button type="button" aria-label={tx(locale, { en: 'Decrease attendees', es: 'Reducir asistentes', it: 'Riduci partecipanti', ar: 'إنقاص العدد' })} disabled={attendees <= 1} onClick={() => setAttendees(Math.max(1, attendees - 1))}><Minus size={14} /></button><b aria-live="polite">{attendees}</b><button type="button" aria-label={tx(locale, { en: 'Increase attendees', es: 'Aumentar asistentes', it: 'Aumenta partecipanti', ar: 'زيادة العدد' })} disabled={attendees >= 50} onClick={() => setAttendees(Math.min(50, attendees + 1))}><Plus size={14} /></button></div></div>
        {errors && <p role="alert" className="form-error">{errors}</p>}
        <button className="primary-btn" type="submit" disabled={sending}>{sending ? tx(locale, { en: 'Sending...', es: 'Enviando...', it: 'Invio in corso...', ar: 'جارٍ الإرسال...' }) : tx(locale, { en: 'Send event request', es: 'Enviar solicitud', it: 'Invia richiesta', ar: 'إرسال طلب الحضور' })} <ArrowRight size={17} /></button>
      </form>
      <p className="event-book-note"><ShieldCheck size={14} />{tx(locale, { en: 'A preliminary request pending review. Not a confirmed ticket, no payment now.', es: 'Una solicitud preliminar pendiente de revisión. No es una entrada confirmada ni requiere pago ahora.', it: 'Una richiesta preliminare in attesa di revisione. Non è un biglietto confermato, nessun pagamento ora.', ar: 'طلب مبدئي قيد المراجعة. ليس تذكرة مؤكدة ولا دفع الآن.' })}</p>
    </>
  )
}
