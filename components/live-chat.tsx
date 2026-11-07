'use client'
import { BrandMark } from '@/components/brand-mark'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { ArrowLeft, Headset, Send, X } from 'lucide-react'
import { whatsappHref } from '@/data/company'
import { useBrandSettings } from '@/lib/admin-store'
import { tx, useLocale } from './locale'
import { baseChipHrefs, chipsHome, copy, getBotReply, type ChipId } from '@/lib/live-chat-bot'
import { useLiveChat } from '@/lib/live-chat-client'
import styles from './live-chat.module.css'
export { getBotReply } from '@/lib/live-chat-bot'
import { SupportChatPanel } from './support-chat-panel'

export function LiveChatWidget({ open, onOpen, onClose }: { open: boolean; onOpen: () => void; onClose: () => void }) {
  const { locale } = useLocale()
  const brand = useBrandSettings()
  const t = copy[locale]
  const [mobileTarget, setMobileTarget] = useState<HTMLElement | null>(null)
  useEffect(() => { setMobileTarget(document.getElementById('mobile-livechat-trigger')) }, [])
  const chat = useLiveChat(open)
  const messages = chat.thread?.messages ?? []
  const lastQuestion = messages.findLast(m => m.senderRole === 'customer')
  const chips: ChipId[] = lastQuestion && !chat.thread?.agentRequested ? getBotReply(lastQuestion.body, locale, '').chips : [...chipsHome]
  const [draft, setDraft] = useState('')
  const [handoff, setHandoff] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')
  const [sentHandoff, setSentHandoff] = useState(false)
  const [teaser, setTeaser] = useState(false)
  const bodyRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const lang = locale === 'es' || locale === 'it' ? locale : 'en'
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, chat.busy, open, handoff])
  useEffect(() => { if (handoff) nameRef.current?.focus() }, [handoff])
  useEffect(() => {
    if (open) { setTeaser(false); return }
    const timer = window.setTimeout(() => setTeaser(true), 5000)
    return () => window.clearTimeout(timer)
  }, [open])
  const openPanel = () => { setTeaser(false); onOpen() }
  const send = async (raw: string) => {
    if (!raw.trim() || chat.busy) return
    if (await chat.send({ action: 'message', body: raw.trim(), locale: lang })) setDraft('')
  }
  const requestAgent = async () => {
    if (await chat.send({ action: 'handoff', body: note.trim(), name: name.trim(), phone: phone.trim(), locale: lang })) {
      setHandoff(false); setSentHandoff(true); setName(''); setPhone(''); setNote('')
    }
  }
  return <div className="livechat-wrap">
    {mobileTarget && createPortal(<button type="button" className="mobile-support-trigger" onClick={() => (open ? onClose() : openPanel())} aria-expanded={open} aria-label={open ? t.closeLabel : t.openLabel}><Headset size={21} aria-hidden="true"/><span>{({ en: 'Live Chat', es: 'Chat en vivo', it: 'Chat dal vivo', ar: 'دردشة مباشرة' })[locale]}</span></button>, mobileTarget)}
    {teaser && !open && <button type="button" className="livechat-teaser" onClick={openPanel}>{t.teaser}</button>}
    {open && <SupportChatPanel className="livechat-panel" label={t.name} onClose={onClose}>{mobile => <>
      <header className="livechat-head">
        <span className="livechat-avatar" aria-hidden="true"><BrandMark alt="" /></span>
        <div><strong>{t.name}</strong><span className="livechat-online">{t.online}</span></div>
        <button type="button" className="livechat-close" onClick={onClose} aria-label={mobile ? tx(locale,{en:'Back to page',es:'Volver a la página',it:'Torna alla pagina'}) : t.closeLabel}>{mobile ? <ArrowLeft size={22} /> : <X size={17} />}</button>
      </header>
      <div className="livechat-body" ref={bodyRef} aria-live="polite">
        {!messages.length && <div className="livechat-row agent"><div className="livechat-bubble">{t.greeting}</div></div>}
        {messages.map((m) => <div key={m.id} className={`livechat-row ${m.senderRole === 'customer' ? 'user' : 'agent'}`}>
          <div className="livechat-bubble">{m.body}</div>
          <span className="livechat-time">{m.senderRole === 'bot' ? tx(locale,{en:'Bot',es:'Bot',it:'Bot'}) : m.senderRole === 'staff' ? tx(locale,{en:'Staff',es:'Equipo',it:'Team'}) : tx(locale,{en:'You',es:'Tú',it:'Tu'})} · {new Date(m.createdAt).toLocaleTimeString(lang, {hour:'2-digit',minute:'2-digit'})}</span>
        </div>)}
        {chat.busy && <div className="livechat-row agent"><span className="livechat-typing" aria-label={t.online}><i /><i /><i /></span></div>}
        {chat.error && <p className={styles.feedback} role="alert">{tx(locale,{en:'Chat could not be updated. Your text is kept. Retry sending, or wait for reconnection.',es:'No se pudo actualizar el chat. Conservamos tu texto. Vuelve a enviarlo o espera a que se restablezca la conexión.',it:'Impossibile aggiornare la chat. Il testo è conservato. Riprova a inviarlo o attendi la riconnessione.'})}</p>}
        {sentHandoff && <p className={styles.feedback} role="status">{tx(locale,{en:'Your request was saved for our team. Replies will appear here.',es:'Tu solicitud se ha guardado para nuestro equipo. Las respuestas aparecerán aquí.',it:'La richiesta è stata salvata per il nostro team. Le risposte appariranno qui.'})}</p>}
        {handoff && <form className={styles.handoff} onSubmit={e => {e.preventDefault();void requestAgent()}}>
          <h3>{t.chipLabels.agent}</h3>
          <label>{tx(locale,{en:'Full name',es:'Nombre completo',it:'Nome e cognome'})}<input ref={nameRef} required maxLength={120} autoComplete="name" value={name} onChange={e=>setName(e.target.value)} disabled={chat.busy}/></label>
          <label>{tx(locale,{en:'Mobile / WhatsApp',es:'Móvil / WhatsApp',it:'Cellulare / WhatsApp'})}<input type="tel" required minLength={7} maxLength={32} autoComplete="tel" value={phone} onChange={e=>setPhone(e.target.value)} disabled={chat.busy}/></label>
          <label>{tx(locale,{en:'Message (optional)',es:'Mensaje (opcional)',it:'Messaggio (facoltativo)'})}<input maxLength={500} value={note} onChange={e=>setNote(e.target.value)} disabled={chat.busy}/></label>
          <button type="submit" className="outline-btn" disabled={chat.busy}>{tx(locale,{en:'Request a staff reply',es:'Solicitar respuesta del equipo',it:'Richiedi una risposta del team'})}</button>
          <button type="button" className="text-link" onClick={()=>setHandoff(false)} disabled={chat.busy}>{tx(locale,{en:'Cancel',es:'Cancelar',it:'Annulla'})}</button>
        </form>}
      </div>
      {chips.length > 0 && <div className="livechat-chips">
        {chips.map((id) => {
          const label = t.chipLabels[id]
          const href = id === 'wa' ? whatsappHref(brand.whatsapp) : baseChipHrefs[id]
          return href
            ? (href.startsWith('http')
              ? <a key={id} href={href} target="_blank" rel="noreferrer">{label}</a>
              : <Link key={id} href={href} onClick={mobile ? onClose : undefined}>{label}</Link>)
            : <button key={id} type="button" disabled={chat.busy} onClick={() => { if (id === 'agent') {setSentHandoff(false);setHandoff(true)} else void send(label) }}>{label}</button>
        })}
      </div>}
      <form className="livechat-form" onSubmit={(e) => { e.preventDefault(); void send(draft) }}>
        <input ref={inputRef} disabled={chat.busy || handoff} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={t.inputPh} aria-label={t.inputPh} maxLength={500} autoComplete="off" />
        <button type="submit" className="livechat-send" disabled={chat.busy || handoff || !draft.trim()} aria-label={t.sendLabel}><Send size={17} /></button>
      </form>
    </>}</SupportChatPanel>}
    <button type="button" className="livechat-fab" onClick={() => (open ? onClose() : openPanel())} aria-expanded={open} aria-label={open ? t.closeLabel : t.openLabel}>
      {open ? <X size={24} /> : <Headset size={26} />}
    </button>
  </div>
}
