'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Headset, Send, X } from 'lucide-react'
import { getToursByCategory } from '@/data/tours'
import { whatsappHref } from '@/data/company'
import { useBrandSettings } from '@/lib/admin-store'
import { formatPrice, useLocale } from './locale'

type ChatMsg = { id: number; from: 'agent' | 'user'; text: string; time: string }
type ChipId = 'prices' | 'agent' | 'booking' | 'browse' | 'trips' | 'plan' | 'contact' | 'wa'

const chipsHome: ChipId[] = ['prices', 'agent', 'booking']
const chipsBrowse: ChipId[] = ['browse', 'trips']
const chipsPlan: ChipId[] = ['plan', 'browse']
const chipsContact: ChipId[] = ['wa', 'contact']

const minNilePrice = Math.min(...getToursByCategory('nile-cruises').map((tour) => tour.price))
const baseChipHrefs: Record<ChipId, string | undefined> = {
  prices: undefined, agent: undefined, booking: undefined,
  browse: '/egypt-tours/nile-cruises', trips: '/trips', plan: '/make-your-trip', contact: '/contact', wa: undefined,
}
const STORE_KEY = 'sp-livechat-msgs-v2'
const OPENED_KEY = 'sp-livechat-opened'

const copy = {
  en: {
    openLabel: 'Open live chat', closeLabel: 'Close live chat', sendLabel: 'Send message',
    name: 'STAR PYRAMIDS', online: 'Online, replies instantly', inputPh: 'Write a message...',
    teaser: 'Need help planning your Egypt trip? Chat with us!',
    greeting: "Hi there! I'm Nour from STAR PYRAMIDS. Ask me about Nile cruises, prices, or booking. Or pick a topic:",
    price: 'Our Nile cruises start from {price} per person, depending on the season and group size. Every cruise page has a season price table (Solo / pair / group). Open any cruise and check "Cruise Prices".',
    cruise: 'We have 4 cruise levels: Standard, Deluxe, Superior, and Luxury, from 3 to 7 nights between Luxor and Aswan, with full board and guided temple visits.',
    booking: 'Booking is easy: open any trip and press "Book now", or tell us your dates on the Make Your Trip page and we will arrange everything.',
    human: 'Of course! Our team is on WhatsApp and on the Contact page. Someone will get back to you shortly.',
    thanks: 'You are welcome! I am here if you need anything else.',
    fallback: 'Got it! Someone from our team will follow up shortly. Meanwhile, pick a topic so I can help faster:',
    chipLabels: { prices: 'Nile cruise prices', agent: 'Talk to an agent', booking: 'How do I book?', browse: 'View Nile cruises', trips: 'See all trips', plan: 'Plan my trip', contact: 'Contact page', wa: 'WhatsApp us' },
  },
  ar: {
    openLabel: 'فتح المحادثة', closeLabel: 'إغلاق المحادثة', sendLabel: 'إرسال الرسالة',
    name: 'STAR PYRAMIDS', online: 'متصل الآن، يرد فورًا', inputPh: 'اكتب رسالة...',
    teaser: 'هل تحتاج إلى مساعدة في رحلتك إلى مصر؟ تحدث معنا!',
    greeting: 'أهلاً بك! أنا نور من STAR PYRAMIDS. اسألني عن الكروز النيلية أو الأسعار أو الحجز. أو اختر موضوعًا:',
    price: 'تبدأ أسعار الكروز النيلية من {price} للفرد حسب الموسم وعدد المسافرين. تتضمن كل رحلة جدول أسعار المواسم (فردي / زوجي / مجموعات). افتح أي رحلة واطلع على قسم Cruise Prices.',
    cruise: 'لدينا ٤ فئات: عادية وديلوكس وسوبريور وفاخرة، من ٣ إلى ٧ ليالٍ بين الأقصر وأسوان بإقامة شاملة وزيارات معابد مع مرشد.',
    booking: 'الحجز سهل: افتح أي رحلة وانقر Book now، أو أرسل لنا مواعيدك في صفحة Make Your Trip وسنجهز لك كل شيء.',
    human: 'بالطبع! فريقنا متاح عبر واتساب وفي صفحة اتصل بنا. سيرد عليك أحد أفراد الفريق في أقرب وقت.',
    thanks: 'على الرحب والسعة! أنا هنا إن احتجت إلى أي شيء آخر.',
    fallback: 'حسنًا! سيتابع أحد أفراد فريقنا معك قريبًا. ويمكنك اختيار موضوع لأساعدك بشكل أسرع:',
    chipLabels: { prices: 'أسعار الكروز النيلية', agent: 'التحدث إلى موظف', booking: 'كيف أحجز؟', browse: 'استعرض الكروز النيلية', trips: 'كل الرحلات', plan: 'خطط رحلتك', contact: 'صفحة اتصل بنا', wa: 'واتساب' },
  },
} as const

function getBotReply(text: string, lang: 'en' | 'ar', priceStr: string): { text: string; chips: ChipId[] } {
  const t = copy[lang]
  const s = text.toLocaleLowerCase()
  const has = (...words: string[]) => words.some((w) => s.includes(w))
  if (/^(hi|hello|hey|good morning|good evening|hii+)\b/.test(s) || has('سلام', 'مرحبا', 'أهلا', 'اهلا', 'ازيك', 'هاي', 'صباح', 'مساء'))
    return { text: t.greeting, chips: [...chipsHome] }
  if (has('price', 'cost', 'much', 'cheap', 'discount', 'سعر', 'أسعار', 'اسعار', 'بكام', 'تكلفة', 'تكلفه', 'خصم'))
    return { text: t.price.replace('{price}', priceStr), chips: [...chipsBrowse] }
  if (has('book', 'reserve', 'حجز', 'احجز', 'الحجز'))
    return { text: t.booking, chips: [...chipsPlan] }
  if (has('cruise', 'nile', 'ship', 'luxor', 'aswan', 'كروز', 'نيل', 'النيل', 'مركب', 'الأقصر', 'الاقصر', 'أسوان', 'اسوان'))
    return { text: t.cruise, chips: [...chipsBrowse] }
  if (has('human', 'agent', 'person', 'someone', 'call', 'phone', 'contact', 'whatsapp', 'موظف', 'إنسان', 'انسان', 'بشر', 'مندوب', 'حد يكلمني', 'اتصل', 'تليفون', 'رقم', 'واتس', 'تواصل'))
    return { text: t.human, chips: [...chipsContact] }
  if (has('thank', 'thanks', 'شكرا', 'متشكر', 'ميرسي'))
    return { text: t.thanks, chips: [...chipsHome] }
  return { text: t.fallback, chips: [...chipsHome] }
}

function cleanText(s: string): string {
  return s.replace(/[—–…“”‘’·]/g, (ch) => (ch === '·' ? ',' : ch === '…' ? '...' : ch === '“' || ch === '”' ? '"' : ch === '‘' || ch === '’' ? "'" : ch === '–' ? '-' : ' '))
}

function loadStored(): ChatMsg[] {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as ChatMsg[]
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((m): m is ChatMsg => Boolean(m) && (m.from === 'agent' || m.from === 'user') && typeof m.text === 'string')
      .map((m, i) => ({ ...m, id: i + 1, text: cleanText(m.text) }))
      .slice(-50)
  } catch { return [] }
}

export function LiveChatWidget({ open, onOpen, onClose }: { open: boolean; onOpen: () => void; onClose: () => void }) {
  const { currency, locale } = useLocale()
  const brand = useBrandSettings()
  const t = copy[locale]
  const [messages, setMessages] = useState<ChatMsg[]>(() => loadStored())
  const [chips, setChips] = useState<ChipId[]>(() => (loadStored().length ? [] : [...chipsHome]))
  const [draft, setDraft] = useState('')
  const [typing, setTyping] = useState(false)
  const [unread, setUnread] = useState(() => (typeof window !== 'undefined' && (localStorage.getItem(STORE_KEY) || localStorage.getItem(OPENED_KEY)) ? 0 : 1))
  const [teaser, setTeaser] = useState(false)
  const idRef = useRef(1)
  const openRef = useRef(false)
  const bodyRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<number | null>(null)
  const greetingPendingRef = useRef(false)
  const priceStr = formatPrice(minNilePrice, currency, locale)
  const timeNow = () => new Date().toLocaleTimeString(locale === 'ar' ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' })

  useEffect(() => { openRef.current = open }, [open])
  useEffect(() => {
    idRef.current = messages.reduce((max, m) => Math.max(max, m.id), 0) + 1
  }, [])
  useEffect(() => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(messages.slice(-50))) } catch { /* private mode */ }
  }, [messages])
  useEffect(() => {
    if (localStorage.getItem(OPENED_KEY)) return
    const show = window.setTimeout(() => { if (!openRef.current) setTeaser(true) }, 5000)
    return () => window.clearTimeout(show)
  }, [])
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
    setTeaser(false)
    try { localStorage.setItem(OPENED_KEY, '1') } catch { /* private mode */ }
    if (!messages.length && !greetingPendingRef.current) {
      greetingPendingRef.current = true
      setTyping(true)
      setChips([])
      timerRef.current = window.setTimeout(() => {
        greetingPendingRef.current = false
        setTyping(false)
        setMessages((prev) => (prev.length ? prev : [{ id: idRef.current++, from: 'agent', text: copy[locale].greeting, time: timeNow() }]))
        setChips([...chipsHome])
      }, 950)
    }
  }

  const send = (raw: string) => {
    const clean = raw.trim().slice(0, 500)
    if (!clean || typing) return
    const userMsg: ChatMsg = { id: idRef.current++, from: 'user', text: clean, time: timeNow() }
    setMessages((prev) => [...prev, userMsg])
    setDraft('')
    setTyping(true)
    const reply = getBotReply(clean, locale, priceStr)
    timerRef.current = window.setTimeout(() => {
      setTyping(false)
      setMessages((prev) => [...prev, { id: idRef.current++, from: 'agent', text: reply.text, time: timeNow() }])
      setChips(reply.chips)
      if (!openRef.current) setUnread((u) => u + 1)
    }, 900)
  }

  return <div className="livechat-wrap">
    {teaser && !open && <button type="button" className="livechat-teaser" onClick={openPanel}>{t.teaser}</button>}
    {open && <section className="livechat-panel" role="dialog" aria-label={t.name} aria-modal="false">
      <header className="livechat-head">
        <span className="livechat-avatar" aria-hidden="true"><img src="/favicon.png" alt="" /></span>
        <div><strong>{t.name}</strong><span className="livechat-online"><i aria-hidden="true" />{t.online}</span></div>
        <button type="button" className="livechat-close" onClick={onClose} aria-label={t.closeLabel}><X size={17} /></button>
      </header>
      <div className="livechat-body" ref={bodyRef} aria-live="polite">
        {messages.map((m) => <div key={m.id} className={`livechat-row ${m.from}`}>
          <div className="livechat-bubble">{m.text}</div>
          <span className="livechat-time">{m.time}</span>
        </div>)}
        {typing && <div className="livechat-row agent"><span className="livechat-typing" aria-label={t.online}><i /><i /><i /></span></div>}
      </div>
      {chips.length > 0 && <div className="livechat-chips">
        {chips.map((id) => {
          const label = t.chipLabels[id]
          const href = id === 'wa' ? whatsappHref(brand.whatsapp) : baseChipHrefs[id]
          return href
            ? (href.startsWith('http')
              ? <a key={id} href={href} target="_blank" rel="noreferrer">{label}</a>
              : <Link key={id} href={href}>{label}</Link>)
            : <button key={id} type="button" onClick={() => send(label)}>{label}</button>
        })}
      </div>}
      <form className="livechat-form" onSubmit={(e) => { e.preventDefault(); send(draft) }}>
        <input ref={inputRef} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={t.inputPh} aria-label={t.inputPh} maxLength={500} autoComplete="off" />
        <button type="submit" className="livechat-send" aria-label={t.sendLabel}><Send size={17} /></button>
      </form>
    </section>}
    <button type="button" className="livechat-fab" onClick={() => (open ? onClose() : openPanel())} aria-expanded={open} aria-label={open ? t.closeLabel : t.openLabel}>
      {open ? <X size={24} /> : <Headset size={26} />}
      {!open && unread > 0 && <b>{unread}</b>}
    </button>
  </div>
}
