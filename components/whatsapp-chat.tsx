'use client'

import { useEffect, useRef, useState } from 'react'
import { CheckCheck, Send, X } from 'lucide-react'
import { useLocale } from './locale'
import { whatsappNumber } from '@/data/company'
import { useBrandSettings } from '@/lib/admin-store'

const OPENED_KEY = 'sp-wa-opened'

type WaMsg = { id: number; from: 'agent' | 'user'; text: string; time: string }

const copy = {
  en: {
    openLabel: 'Chat on WhatsApp', closeLabel: 'Close WhatsApp chat', sendLabel: 'Send via WhatsApp',
    name: 'STAR PYRAMIDS', online: 'Online', inputPh: 'Type your message...',
    welcome: 'Hi there! This is STAR PYRAMIDS. Tell us what you need (tours, prices, or booking help) and press send.',
    hint: 'Pressing send opens WhatsApp with your message ready.',
  },
  ar: {
    openLabel: 'كلمنا واتساب', closeLabel: 'إغلاق شات الواتساب', sendLabel: 'إرسال عبر واتساب',
    name: 'STAR PYRAMIDS', online: 'متصل الآن', inputPh: 'اكتب رسالتك...',
    welcome: 'أهلاً بك! هذه STAR PYRAMIDS. أخبرنا بما تحتاج (رحلات أو أسعار أو مساعدة في الحجز) ثم اضغط إرسال.',
    hint: 'سيؤدي الضغط على إرسال إلى فتح واتساب والرسالة جاهزة.',
  },
} as const

export function WhatsAppGlyph({ size = 28 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" /></svg>
}

export function WhatsAppWidget({ open, onOpen, onClose }: { open: boolean; onOpen: () => void; onClose: () => void }) {
  const { locale } = useLocale()
  const brand = useBrandSettings()
  const t = copy[locale]
  const [messages, setMessages] = useState<WaMsg[]>([])
  const [draft, setDraft] = useState('')
  const [typing, setTyping] = useState(false)
  const [unread, setUnread] = useState(() => (typeof window !== 'undefined' && localStorage.getItem(OPENED_KEY) ? 0 : 1))
  const idRef = useRef(1)
  const bodyRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<number | null>(null)
  const greetingPendingRef = useRef(false)
  const timeNow = () => new Date().toLocaleTimeString(locale === 'ar' ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' })

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, typing, open])
  useEffect(() => {
    if (open) {
      inputRef.current?.focus()
      const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
      window.addEventListener('keydown', onKey)
      return () => window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])
  useEffect(() => () => { if (timerRef.current) window.clearTimeout(timerRef.current) }, [])

  const openPanel = () => {
    onOpen()
    setUnread(0)
    try { localStorage.setItem(OPENED_KEY, '1') } catch { /* private mode */ }
    if (!messages.length && !greetingPendingRef.current) {
      greetingPendingRef.current = true
      setTyping(true)
      timerRef.current = window.setTimeout(() => {
        greetingPendingRef.current = false
        setTyping(false)
        setMessages((prev) => (prev.length ? prev : [{ id: idRef.current++, from: 'agent', text: copy[locale].welcome, time: timeNow() }]))
      }, 950)
    }
  }

  const send = (raw: string) => {
    const clean = raw.trim().slice(0, 500)
    if (!clean) return
    setMessages((prev) => [...prev, { id: idRef.current++, from: 'user', text: clean, time: timeNow() }])
    setDraft('')
    timerRef.current = window.setTimeout(() => {
      window.open(`https://wa.me/${whatsappNumber(brand.whatsapp)}?text=${encodeURIComponent(clean)}`, '_blank', 'noopener')
    }, 700)
  }

  return <div className="wa-wrap">
    {open && <section className="wa-panel" role="dialog" aria-label={t.name} aria-modal="false">
      <header className="wa-head">
        <span className="wa-avatar" aria-hidden="true"><img src="/favicon.png" alt="" /></span>
        <div><strong>{t.name}</strong><span className="wa-online"><i aria-hidden="true" />{t.online}</span></div>
        <button type="button" className="wa-close" onClick={onClose} aria-label={t.closeLabel}><X size={17} /></button>
      </header>
      <div className="wa-body" ref={bodyRef} aria-live="polite">
        {messages.map((m) => <div key={m.id} className={`wa-row ${m.from}`}>
          <div className="wa-bubble">{m.text}
            <span className="wa-meta">{m.time}{m.from === 'user' && <CheckCheck size={14} aria-hidden="true" />}</span>
          </div>
        </div>)}
        {typing && <div className="wa-row agent"><span className="wa-typing" aria-label={locale === 'ar' ? 'يكتب الآن' : 'Typing'}><i /><i /><i /></span></div>}
      </div>
      <form className="wa-form" onSubmit={(e) => { e.preventDefault(); send(draft) }}>
        <input ref={inputRef} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={t.inputPh} aria-label={t.inputPh} maxLength={500} autoComplete="off" />
        <button type="submit" className="wa-send" aria-label={t.sendLabel}><Send size={17} /></button>
      </form>
      <small className="wa-hint"><WhatsAppGlyph size={12} />{t.hint}</small>
    </section>}
    <button type="button" className="wa-fab" onClick={() => (open ? onClose() : openPanel())} aria-expanded={open} aria-label={open ? t.closeLabel : t.openLabel}>
      {open ? <X size={26} /> : <WhatsAppGlyph size={30} />}
      {!open && unread > 0 && <b>{unread}</b>}
    </button>
  </div>
}
