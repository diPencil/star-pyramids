'use client'

import { useEffect, useState } from 'react'
import { Mail, X } from 'lucide-react'
import { whatsappNumber } from '@/data/company'
import { WhatsAppGlyph } from './whatsapp-chat'
import { saveInquiry, useBrandSettings } from '@/lib/admin-store'
import { useLocale } from './locale'

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
  const ar = locale === 'ar'
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
      setError(ar ? 'اكتب اسمك أولا.' : 'Please enter your name first.')
      return
    }
    if (channel === 'email' && !/^\S+@\S+\.\S+$/.test(contact.trim())) {
      setError(ar ? 'اكتب بريدا إلكترونيا صحيحا.' : 'Please enter a valid email address.')
      return
    }
    if (!message.trim()) {
      setError(ar ? 'اكتب رسالتك.' : 'Please write your message.')
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
            <button type="button" className="ask-close" onClick={() => setOpen(false)} aria-label={ar ? 'إغلاق' : 'Close'}><X size={18} /></button>
          </div>
          {sent ? (
            <div className="ask-success" role="status">
              <strong>{ar ? 'وصلتنا رسالتك!' : 'Your message is on its way!'}</strong>
              <p>{channel === 'whatsapp'
                ? (ar ? 'فتحنا واتساب لإتمام الإرسال، ورسالتك مسجلة لدى فريقنا.' : 'We opened WhatsApp to complete sending, and your message is recorded with our team.')
                : (ar ? 'استلمنا رسالتك وسيرد عليك فريقنا على بريدك.' : 'We received your message and our team will reply to your email.')}</p>
              <button type="button" className="primary-btn" onClick={() => setOpen(false)}>{ar ? 'تم' : 'Done'}</button>
            </div>
          ) : (
            <>
              <div className="ask-tabs" role="tablist" aria-label={label}>
                <button type="button" role="tab" aria-selected={channel === 'whatsapp'} className={channel === 'whatsapp' ? 'active' : ''} onClick={() => setChannel('whatsapp')}>
                  <WhatsAppGlyph size={16} />WhatsApp
                </button>
                <button type="button" role="tab" aria-selected={channel === 'email'} className={channel === 'email' ? 'active' : ''} onClick={() => setChannel('email')}>
                  <Mail size={16} />{ar ? 'البريد' : 'Email'}
                </button>
              </div>
              <div className="ask-form">
                {channel === 'whatsapp' ? (
                  <label>{ar ? 'اسمك' : 'Your name'}<input value={name} onChange={(e) => setName(e.target.value)} placeholder={ar ? 'اكتب اسمك' : 'Your name'} maxLength={80} /></label>
                ) : (
                  <label>{ar ? 'بريدك الإلكتروني' : 'Your email'}<input type="email" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="you@example.com" dir="ltr" maxLength={120} /></label>
                )}
                <label>{ar ? 'رسالتك' : 'Your message'}<textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder={ar ? `اسألنا عن ${tourTitle}` : `Ask us about ${tourTitle}`} rows={4} maxLength={1000} /></label>
              </div>
              {error && <p className="ask-error" role="alert">{error}</p>}
              <button type="button" className="primary-btn ask-submit" onClick={submit}>
                {channel === 'whatsapp' ? (ar ? 'إرسال عبر واتساب' : 'Send via WhatsApp') : (ar ? 'إرسال بالبريد' : 'Send by email')}
              </button>
            </>
          )}
        </div>
      </div>
    )}
  </>
}
