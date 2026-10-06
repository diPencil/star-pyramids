'use client'

import { useEffect, useState } from 'react'
import { Mail, X } from 'lucide-react'
import { whatsappNumber } from '@/data/company'
import { WhatsAppGlyph } from './whatsapp-chat'
import { saveInquiry, useBrandSettings } from '@/lib/admin-store'
import { tx, useLocale } from './locale'

export function AskQuestionButton({
  tourSlug,
  tourTitle,
  label,
  className = 'outline-btn booking-question',
}: {
  tourSlug: string
  tourTitle: string
  label: string
  className?: string
}) {
  const { locale } = useLocale()
  const brand = useBrandSettings()
  const [open, setOpen] = useState(false)
  const [channel, setChannel] = useState<'whatsapp' | 'email'>('whatsapp')
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open ])

  const openDialog = () => {
    setError('')
    setSent(false)
    setOpen(true)
  }

  const submit = () => {
    if (channel === 'whatsapp' && !name.trim()) {
      setError(tx(locale, { en: 'Please enter your name first.', es: 'Escribe tu nombre primero.', it: 'Inserisci prima il tuo nome.', ar: 'اكتب اسمك أولا.' }))
      return
    }
    if (channel === 'email' && !/^\S+@\S+\.\S+$/.test(contact.trim())) {
      setError(tx(locale, { en: 'Please enter a valid email address.', es: 'Escribe una dirección de correo válida.', it: 'Inserisci un indirizzo email valido.', ar: 'اكتب بريدا إلكترونيا صحيحا.' }))
      return
    }
    if (!message.trim()) {
      setError(tx(locale, { en: 'Please write your message.', es: 'Escribe tu mensaje.', it: 'Scrivi il tuo messaggio.', ar: 'اكتب رسالتك.' }))
      return
    }
    setError('')
    saveInquiry({
      channel,
      name: channel === 'whatsapp' ? name.trim() : contact.trim().split('@')[0],
      contact: channel === 'whatsapp' ? '' : contact.trim(),
      message: message.trim(),
      tourSlug,
      tourTitle,
    })
    if (channel === 'whatsapp') {
      const text = `Hello STAR PYRAMIDS,\nName: ${name.trim()}\nTour: ${tourTitle}\nQuestion: ${message.trim()}`
      window.open(`https://wa.me/${whatsappNumber(brand.whatsapp)}?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
    }
    setSent(true)
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
                <button type="button" role="tab" aria-selected={channel === 'whatsapp'} className={channel === 'whatsapp' ? 'active' : ''} onClick={() => setChannel('whatsapp')}>
                  <WhatsAppGlyph size={16} />WhatsApp
                </button>
                <button type="button" role="tab" aria-selected={channel === 'email'} className={channel === 'email' ? 'active' : ''} onClick={() => setChannel('email')}>
                  <Mail size={16} />{tx(locale, { en: 'Email', es: 'Correo', it: 'Email', ar: 'البريد' })}
                </button>
              </div>
              <div className="ask-form">
                {channel === 'whatsapp' ? (
                  <label>{tx(locale, { en: 'Your name', es: 'Tu nombre', it: 'Il tuo nome', ar: 'اسمك' })}<input value={name} onChange={(e) => setName(e.target.value)} placeholder={tx(locale, { en: 'Your name', es: 'Tu nombre', it: 'Il tuo nome', ar: 'اكتب اسمك' })} maxLength={80} /></label>
                ) : (
                  <label>{tx(locale, { en: 'Your email', es: 'Tu correo', it: 'La tua email', ar: 'بريدك الإلكتروني' })}<input type="email" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="you@example.com" dir="ltr" maxLength={120} /></label>
                )}
                <label>{tx(locale, { en: 'Your message', es: 'Tu mensaje', it: 'Il tuo messaggio', ar: 'رسالتك' })}<textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder={tx(locale, { en: `Ask us about ${tourTitle}`, es: `Pregúntanos sobre ${tourTitle}`, it: `Chiedici informazioni su ${tourTitle}`, ar: `اسألنا عن ${tourTitle}` })} rows={4} maxLength={1000} /></label>
              </div>
              {error && <p className="ask-error" role="alert">{error}</p>}
              <button type="button" className="primary-btn ask-submit" onClick={submit}>
                {channel === 'whatsapp' ? tx(locale, { en: 'Send via WhatsApp', es: 'Enviar por WhatsApp', it: 'Invia tramite WhatsApp', ar: 'إرسال عبر واتساب' }) : tx(locale, { en: 'Send by email', es: 'Enviar por correo', it: 'Invia via email', ar: 'إرسال بالبريد' })}
              </button>
            </>
          )}
        </div>
      </div>
    )}
  </>
}
