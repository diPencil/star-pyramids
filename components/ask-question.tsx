'use client'

import { useEffect, useRef, useState } from 'react'
import { Mail, X } from 'lucide-react'
import { whatsappNumber } from '@/data/company'
import { WhatsAppGlyph } from './whatsapp-chat'
import { saveInquiry, useBrandSettings } from '@/lib/admin-store'
import { buildQuestionMessage, buildQuestionSubject, type EnquirySubjectType } from '@/lib/enquiry-message'
import { useCurrentUser } from '@/lib/use-current-user'
import { tx, useLocale } from './locale'

export function AskQuestionButton({
  tourSlug,
  tourTitle,
  label,
  className = 'outline-btn booking-question',
  subjectType = 'tour',
}: {
  tourSlug: string
  tourTitle: string
  label: string
  className?: string
  subjectType?: EnquirySubjectType
}) {
  const { locale } = useLocale()
  const brand = useBrandSettings()
  const { user } = useCurrentUser()
  const [open, setOpen] = useState(false)
  const [channel, setChannel] = useState<'whatsapp' | 'email'>('whatsapp')
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const pendingRequest = useRef<{ payload: string; id: string } | null>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open ])

  useEffect(() => {
    if (!open || !user) return
    const customerName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.username || ''
    if (customerName) setName((current) => current || customerName)
    if (user.email) setContact((current) => current || user.email)
  }, [open, user])

  const openDialog = () => {
    setError('')
    setSent(false)
    setOpen(true)
  }

  const submit = async () => {
    if (submitting) return
    const trimmedName = name.trim()
    const trimmedContact = contact.trim().toLowerCase()
    const trimmedMessage = message.trim()
    if (!trimmedName) {
      setError(tx(locale, { en: 'Please enter your name first.', es: 'Escribe tu nombre primero.', it: 'Inserisci prima il tuo nome.', ar: 'اكتب اسمك أولا.' }))
      return
    }
    if (channel === 'email' && !/^\S+@\S+\.\S+$/.test(trimmedContact)) {
      setError(tx(locale, { en: 'Please enter a valid email address.', es: 'Escribe una dirección de correo válida.', it: 'Inserisci un indirizzo email valido.', ar: 'اكتب بريدا إلكترونيا صحيحا.' }))
      return
    }
    if (!trimmedMessage || (channel === 'email' && trimmedMessage.length < 10)) {
      setError(tx(locale, { en: 'Please write your message.', es: 'Escribe tu mensaje.', it: 'Scrivi il tuo messaggio.', ar: 'اكتب رسالتك.' }))
      return
    }
    setError('')
    if (channel === 'whatsapp') {
      saveInquiry({ channel, name: trimmedName, contact: '', message: trimmedMessage, tourSlug, tourTitle })
      const text = buildQuestionMessage(trimmedName, tourTitle, trimmedMessage, subjectType)
      window.open(`https://wa.me/${whatsappNumber(brand.whatsapp)}?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
      setSent(true)
      return
    }

    const enquiry = {
      name: trimmedName,
      email: trimmedContact,
      subject: buildQuestionSubject(tourTitle, subjectType),
      message: buildQuestionMessage(trimmedName, tourTitle, trimmedMessage, subjectType),
      sourcePage: subjectType === 'offer' ? `/special-offers/${tourSlug}` : `/egypt-tours/${tourSlug}`,
    }
    const payload = JSON.stringify(enquiry)
    if (pendingRequest.current?.payload !== payload) {
      pendingRequest.current = { payload, id: crypto.randomUUID() }
    }

    setSubmitting(true)
    try {
      const response = await fetch('/api/enquiries', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ ...enquiry, requestId: pendingRequest.current.id }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok || typeof data?.enquiry?.publicId !== 'string') throw new Error('Enquiry submission failed')
      saveInquiry({ channel, name: trimmedName, contact: trimmedContact, message: trimmedMessage, tourSlug, tourTitle })
      pendingRequest.current = null
      setSent(true)
    } catch {
      setError(tx(locale, { en: 'We could not send your message. Please try again.', es: 'No pudimos enviar tu mensaje. Inténtalo de nuevo.', it: 'Non siamo riusciti a inviare il messaggio. Riprova.', ar: 'تعذر إرسال رسالتك. حاول مرة أخرى.' }))
    } finally {
      setSubmitting(false)
    }
  }

  return <>
    <button type="button" className={className} onClick={openDialog}>{label}</button>
    {open && (
      <div className="ask-backdrop" role="presentation" onMouseDown={() => setOpen(false)}>
        <div className="ask-modal" role="dialog" aria-modal="true" aria-label={label} onMouseDown={(e) => e.stopPropagation()}>
          <div className="ask-modal-head">
            <h3>{label}</h3>
            <button type="button" className="ask-close" onClick={() => setOpen(false)} aria-label={tx(locale, { en: 'Close', es: 'Cerrar', it: 'Chiudi', ar: 'إغلاق' })}><X size={18} /></button>
          </div>
          <div className="ask-context">
            <small>{subjectType === 'offer' ? tx(locale, { en: 'Offer', es: 'Oferta', it: 'Offerta', ar: 'العرض' }) : tx(locale, { en: 'Trip', es: 'Viaje', it: 'Viaggio', ar: 'الرحلة' })}</small>
            <strong>{tourTitle}</strong>
          </div>
          {sent ? (
            <div className="ask-success" role="status">
              <strong>{tx(locale, { en: 'Your message is on its way!', es: '¡Tu mensaje está en camino!', it: 'Il tuo messaggio è in viaggio!', ar: 'وصلتنا رسالتك!' })}</strong>
              <p>{channel === 'whatsapp'
                ? tx(locale, { en: 'We opened WhatsApp to complete sending, and your message is recorded with our team.', es: 'Hemos abierto WhatsApp para completar el envío y tu mensaje queda registrado con nuestro equipo.', it: 'Abbiamo aperto WhatsApp per completare l’invio e il tuo messaggio resta registrato presso il nostro team.', ar: 'فتحنا واتساب لإتمام الإرسال، ورسالتك مسجلة لدى فريقنا.' })
                : tx(locale, { en: 'We received your message and our team will reply to your email.', es: 'Hemos recibido tu mensaje y nuestro equipo responderá a tu correo.', it: 'Abbiamo ricevuto il tuo messaggio e il nostro team risponderà alla tua email.', ar: 'استلمنا رسالتك وسيرد عليك فريقنا على بريدك.' })}</p>
              <button type="button" className="primary-btn" onClick={() => setOpen(false)}>{tx(locale, { en: 'Done', es: 'Listo', it: 'Fatto', ar: 'تم' })}</button>
            </div>
          ) : (
            <>
              <div className="ask-tabs" role="tablist" aria-label={label}>
                <button type="button" role="tab" aria-selected={channel === 'whatsapp'} className={channel === 'whatsapp' ? 'active' : ''} disabled={submitting} onClick={() => setChannel('whatsapp')}>
                  <WhatsAppGlyph size={16} />WhatsApp
                </button>
                <button type="button" role="tab" aria-selected={channel === 'email'} className={channel === 'email' ? 'active' : ''} disabled={submitting} onClick={() => setChannel('email')}>
                  <Mail size={16} />{tx(locale, { en: 'Email', es: 'Correo', it: 'Email', ar: 'البريد' })}
                </button>
              </div>
              <div className="ask-form">
                <label>{tx(locale, { en: 'Your name', es: 'Tu nombre', it: 'Il tuo nome', ar: 'اسمك' })}<input value={name} onChange={(e) => setName(e.target.value)} placeholder={tx(locale, { en: 'Your name', es: 'Tu nombre', it: 'Il tuo nome', ar: 'اكتب اسمك' })} autoComplete="name" disabled={submitting} maxLength={80} /></label>
                {channel === 'email' && <label>{tx(locale, { en: 'Your email', es: 'Tu correo', it: 'La tua email', ar: 'بريدك الإلكتروني' })}<input type="email" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="you@example.com" autoComplete="email" dir="ltr" disabled={submitting} maxLength={120} /></label>}
                <label>{tx(locale, { en: 'Your message', es: 'Tu mensaje', it: 'Il tuo messaggio', ar: 'رسالتك' })}<textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder={tx(locale, { en: `Ask us about ${tourTitle}`, es: `Pregúntanos sobre ${tourTitle}`, it: `Chiedici informazioni su ${tourTitle}`, ar: `اسألنا عن ${tourTitle}` })} rows={4} disabled={submitting} maxLength={1000} /></label>
              </div>
              {error && <p className="ask-error" role="alert">{error}</p>}
              <button type="button" className="primary-btn ask-submit" disabled={submitting} aria-busy={submitting} onClick={submit}>
                {submitting ? tx(locale, { en: 'Sending…', es: 'Enviando…', it: 'Invio…', ar: 'جارٍ الإرسال…' }) : channel === 'whatsapp' ? tx(locale, { en: 'Send via WhatsApp', es: 'Enviar por WhatsApp', it: 'Invia tramite WhatsApp', ar: 'إرسال عبر واتساب' }) : tx(locale, { en: 'Send by email', es: 'Enviar por correo', it: 'Invia via email', ar: 'إرسال بالبريد' })}
              </button>
            </>
          )}
        </div>
      </div>
    )}
  </>
}
