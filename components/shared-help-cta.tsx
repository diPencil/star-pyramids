'use client'
import { useRef, useState, type FormEvent } from 'react'
import { extra } from '@/lib/site-copy'
import { defaultCountry } from '@/data/countries'
import { useLocale, tx } from './locale'
import { useSharedCopy } from './presentation-content-context'
import { CountrySelect } from './country-select'
import { InternationalPhoneInput } from './international-phone-input'
import './shared-help-cta.css'

export function SharedHelpCTA() {
  const { locale } = useLocale()
  const copy = useSharedCopy(extra[locale], 'help')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [country, setCountry] = useState(defaultCountry.code)
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')
  const [error, setError] = useState('')
  const lock = useRef(false)
  const pending = useRef<{ payload: string; requestId: string } | null>(null)
  const emailLabel = tx(locale, { en: 'Email address', es: 'Correo electrónico', it: 'Indirizzo email', ar: 'البريد الإلكتروني' })
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (lock.current) return
    if (!name.trim() || name.trim().length > 120 || !/^[^\s@]{1,120}@[^\s@]{1,120}\.[^\s@]{2,24}$/.test(email.trim()) || !/^\+?[0-9 ()-]{6,24}$/.test(phone.trim()) || phone.replace(/\D/g, '').length < 6 || phone.replace(/\D/g, '').length > 15) {
      setStatus('error'); setError(tx(locale, { en: 'Check your name, email and phone number.', es: 'Revisa tu nombre, correo y teléfono.', it: 'Controlla nome, email e telefono.', ar: 'راجع الاسم والبريد ورقم الهاتف.' })); return
    }
    const payload = JSON.stringify({ name: name.trim(), email: email.trim().toLowerCase(), phone: phone.trim(), subject: 'Trip help request', message: `Please contact me to help plan my Egypt trip. Nationality: ${country}.`, sourcePage: window.location.pathname })
    if (pending.current?.payload !== payload) pending.current = { payload, requestId: crypto.randomUUID() }
    lock.current = true; setStatus('sending'); setError('')
    try {
      const response = await fetch('/api/enquiries', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...JSON.parse(payload), requestId: pending.current.requestId }) })
      const data = await response.json().catch(() => null)
      if (!response.ok || typeof data?.enquiry?.publicId !== 'string' || typeof data?.enquiry?.createdAt !== 'string') throw new Error()
      pending.current = null; setStatus('success')
    } catch { setStatus('error'); setError(tx(locale, { en: 'We could not send your request. Please try again.', es: 'No se pudo enviar tu solicitud. Inténtalo de nuevo.', it: 'Non è stato possibile inviare la richiesta. Riprova.', ar: 'تعذر إرسال طلبك. حاول مرة أخرى.' })) }
    finally { lock.current = false }
  }
  if (status === 'success') return <section className="help container" role="status"><h2>{copy.helpDoneT}</h2><p>{copy.helpDoneP1}{name ? ` ${name}` : ''}{copy.helpDoneP2}</p></section>
  const disabled = status === 'sending'
  return <section className="help container shared-trip-help"><h2>{copy.helpTitle}</h2><p>{copy.helpSub}</p><div className="shared-help-fields"><form style={{ display: 'contents' }} onSubmit={submit} aria-busy={disabled}>
    <input placeholder={copy.helpName} aria-label={copy.helpName} required maxLength={120} value={name} disabled={disabled} onChange={event => setName(event.target.value)} />
    <input placeholder={emailLabel} aria-label={emailLabel} type="email" required maxLength={190} value={email} disabled={disabled} onChange={event => setEmail(event.target.value)} />
    <CountrySelect value={country} onChange={setCountry} locale={locale} label={copy.helpNat} disabled={disabled} />
    <InternationalPhoneInput required disabled={disabled} value={phone} onChange={setPhone} locale={locale} countryCode={country} onCountryChange={setCountry} placeholder={copy.helpPhone} />
    <button type="submit" className="primary-btn" disabled={disabled}>{disabled ? tx(locale, { en: 'Sending...', es: 'Enviando...', it: 'Invio...', ar: 'جارٍ الإرسال...' }) : copy.helpBtn}</button>
  </form></div>{error && <p role="alert">{error}</p>}</section>
}
