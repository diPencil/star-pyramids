'use client'

import { BrandMark } from "@/components/branding/brand-mark";
// 'use client' is required here: the access token is read from the router
// rather than passed as a prop, so the credential never enters the
// server-rendered payload that ships in the HTML.
import Link from "next/link";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ArrowRight, ChevronRight, CheckCheck, MessageCircle, Plus, Send, ShieldCheck, ShoppingBag } from "lucide-react";
import { tx, useLocale } from "@/components/locale";
import { useBrandSettings } from "@/lib/admin-store";
import { clearMessageDraft, readMessageDraft } from "@/lib/account/customer-account";
import { useSupportChat } from "@/lib/support/support-chat";
import { whatsappHref } from "@/data/company";
import { WhatsAppGlyph } from "@/components/support/whatsapp-chat";
import { customerErrorText } from "@/lib/account/customer-error-copy";
import { useVisibleInquiries, useAccountProfile, useImpersonated } from "../shared/account-hooks"
import { useVisibleBookings } from "../bookings/booking-sections"
import { CustomerAvatar } from "../shared/account-ui"


function MessagesSection() {
  const { locale } = useLocale()

  const inquiries = useVisibleInquiries()
  const brand = useBrandSettings()
  const profile = useAccountProfile()
  // First name for the greeting; empty-safe so an unhydrated profile never
  // renders "Hi undefined".
  const firstName = profile.fullName.trim().split(/\s+/).filter(Boolean)[0] || profile.firstName.trim() || 'there'
  const impersonated = useImpersonated()
  const bookings = useVisibleBookings()
  const thread = useSupportChat()
  const messages = thread.messages
  const conversation = thread.conversation
  const closed = conversation?.status === 'closed'
  const [draft, setDraft] = useState('')
  const [sendError, setSendError] = useState('')

  useEffect(() => {
    const pending = readMessageDraft()
    if (pending) {
      setDraft(locale === 'es' ? `Hola, tengo una pregunta sobre la reserva ${pending.reference}${pending.title ? ` (${pending.title})` : ''}: ` : locale === 'it' ? `Ciao, ho una domanda sulla prenotazione ${pending.reference}${pending.title ? ` (${pending.title})` : ''}: ` : locale === 'ar' ? `مرحبا، عندي سؤال عن الحجز ${pending.reference}${pending.title ? ` (${pending.title})` : ''}: ` : `Hi, I have a question about booking ${pending.reference}${pending.title ? ` (${pending.title})` : ''}: `)
      clearMessageDraft()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const bodyRef = useRef<HTMLDivElement>(null)
  const latestBooking = bookings[0]

  useEffect(() => {
    if (!thread.loading && messages.some((message) => message.senderRole === 'staff' && !message.readAt)) {
      void thread.markRead()
    }
    const frame = window.requestAnimationFrame(() => bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' }))
    return () => window.cancelAnimationFrame(frame)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, thread.loading])

  const send = async () => {
    if (impersonated || thread.sending || !draft.trim()) return
    const result = await thread.send(draft)
    if (result.ok) {
      setDraft('')
      setSendError('')
    } else if (result.error) {
      setSendError(result.error)
    }
  }

  const keyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void send()
    }
  }

  // Auto-grow the composer up to the CSS max-height, then internal scroll.
  const composerRef = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const el = composerRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`
  }, [draft])

  return <div className="customer-chat-layout">
    <section className="customer-chat-panel">
      <header className="customer-chat-head">
        <span className="customer-chat-team-avatar"><BrandMark alt="" /></span>
        <div><strong>{tx(locale, { en: 'STAR PYRAMIDS travel team', es: 'Equipo de viajes de STAR PYRAMIDS', it: 'Team viaggi STAR PYRAMIDS', ar: 'فريق رحلات STAR PYRAMIDS' })}</strong><small><i />{tx(locale, { en: 'Account and booking support', es: 'Asistencia con tu cuenta y reservas', it: 'Assistenza account e prenotazioni', ar: 'دعم حسابك وحجوزاتك' })}</small></div>
        <span className="customer-chat-channel"><MessageCircle size={14} />{tx(locale, { en: 'Account chat', es: 'Chat de la cuenta', it: 'Chat account', ar: 'محادثة الحساب' })}</span>
      </header>

      <div className="customer-chat-body" ref={bodyRef} aria-live="polite">
        {thread.loading
          ? <div className="customer-chat-welcome"><span><MessageCircle size={25} /></span><h2>{tx(locale, { en: 'Loading messages…', es: 'Cargando mensajes…', it: 'Caricamento messaggi…', ar: 'جارٍ تحميل الرسائل…' })}</h2></div>
          : thread.loadError && !messages.length
            ? <div className="customer-chat-welcome"><span><MessageCircle size={25} /></span><h2>{tx(locale, { en: 'Messages unavailable', es: 'Mensajes no disponibles', it: 'Messaggi non disponibili', ar: 'الرسائل غير متاحة' })}</h2><p>{customerErrorText(locale, thread.loadError)}</p><div><button type="button" onClick={thread.refresh}>{tx(locale, { en: 'Try again', es: 'Reintentar', it: 'Riprova', ar: 'حاول مجددًا' })}</button></div></div>
            : <>
                {!messages.length && <div className="customer-chat-welcome"><span><MessageCircle size={25} /></span><h2>{locale === 'es' ? `Hola ${firstName}` : locale === 'it' ? `Ciao ${firstName}` : locale === 'ar' ? `أهلًا ${firstName}` : `Hi ${firstName}`}</h2><p>{tx(locale, { en: 'Ask about a booking, pricing, or trip details. The team reply will stay here in this conversation.', es: 'Pregunta por una reserva, precios o detalles del viaje. La respuesta del equipo quedará aquí, en esta conversación.', it: 'Chiedi info su una prenotazione, prezzi o dettagli del viaggio. La risposta del team resterà qui in questa conversazione.', ar: 'اكتب سؤالك عن الحجز أو الأسعار أو تفاصيل رحلتك، وسيظهر الرد هنا في نفس المحادثة.' })}</p><div>{(locale === 'es' ? ['Quiero seguir mi reserva', 'Quiero cambiar la fecha de mi viaje', 'Tengo una pregunta sobre un pago'] : locale === 'it' ? ['Voglio seguire la mia prenotazione', 'Voglio cambiare la data del viaggio', 'Ho una domanda su un pagamento'] : locale === 'ar' ? ['أريد متابعة حجزي', 'أحتاج تعديل موعد الرحلة', 'لدي سؤال عن الدفع'] : ['Track my booking', 'Change my travel date', 'I have a payment question']).map((prompt) => <button type="button" key={prompt} onClick={() => setDraft(prompt)}>{prompt}</button>)}</div></div>}
                {messages.map((message) => <div key={message.id} className={`customer-chat-row ${message.senderRole !== 'customer' ? 'agent' : 'customer'}`}>
                  {message.senderRole === 'staff' && <span className="customer-chat-bubble-avatar"><BrandMark alt="" /></span>}
                  <div>
                    <span className="customer-chat-bubble">
                      <p>{message.body}</p>
                    </span>
                    <small className="customer-chat-time">{message.senderRole === 'bot' && tx(locale, { en: 'Bot · ', es: 'Bot · ', it: 'Bot · ' })}{new Date(message.createdAt).toLocaleTimeString(locale === 'ar' ? 'ar-EG' : locale === 'es' ? 'es-ES' : locale === 'it' ? 'it-IT' : 'en-GB', { hour: '2-digit', minute: '2-digit' })}{message.senderRole === 'customer' && <CheckCheck size={13} aria-label={message.readAt ? (tx(locale, { en: 'Seen', es: 'Visto', it: 'Visualizzato', ar: 'مقروءة' })) : (tx(locale, { en: 'Sent', es: 'Enviado', it: 'Inviato', ar: 'تم الإرسال' }))} />}</small>
                  </div>
                </div>)}
              </>}
      </div>

      {closed && <p className="customer-chat-error">{tx(locale, { en: 'This conversation was closed by our team. Send a new message to start a fresh conversation.', es: 'Esta conversación fue cerrada por nuestro equipo. Envía un mensaje nuevo para abrir otra.', it: 'Questa conversazione è stata chiusa dal nostro team. Invia un nuovo messaggio per aprirne un’altra.', ar: 'أغلق فريقنا هذه المحادثة. أرسل رسالة جديدة لبدء محادثة جديدة.' })}</p>}
      {sendError && <p className="customer-chat-error">{customerErrorText(locale, sendError)}</p>}
      <form className="customer-chat-composer" onSubmit={(event) => { event.preventDefault(); void send() }}>
        <textarea ref={composerRef} rows={1} value={draft} disabled={Boolean(impersonated) || closed || thread.sending} onChange={(event) => setDraft(event.target.value)} onKeyDown={keyDown} aria-label={tx(locale, { en: 'Write a message to our travel team', es: 'Escribe un mensaje a nuestro equipo', it: 'Scrivi un messaggio al nostro team', ar: 'اكتب رسالة إلى فريقنا' })} placeholder={impersonated ? (tx(locale, { en: 'Sending is disabled during staff preview', es: 'El envío está desactivado durante la vista previa del personal', it: 'Invio disabilitato durante l’anteprima staff', ar: 'الإرسال متوقف أثناء معاينة الموظفين' })) : (tx(locale, { en: 'Write a message to our travel team...', es: 'Escribe un mensaje a nuestro equipo…', it: 'Scrivi un messaggio al nostro team…', ar: 'اكتب رسالة إلى فريقنا...' }))} />
        <button type="submit" disabled={Boolean(impersonated) || closed || thread.sending || !draft.trim()} aria-label={tx(locale, { en: 'Send message', es: 'Enviar mensaje', it: 'Invia messaggio', ar: 'إرسال الرسالة' })}><Send size={18} /></button>
      </form>
    </section>

    <aside className="customer-chat-context">
      <section className="customer-account-block">
        <header><div><span>{tx(locale, { en: 'Conversation context', es: 'Contexto de la conversación', it: 'Contesto conversazione', ar: 'عن المحادثة' })}</span><h2>{tx(locale, { en: 'Trip support', es: 'Asistencia de viaje', it: 'Assistenza viaggio', ar: 'مساعدة الرحلة' })}</h2></div><ShieldCheck size={19} /></header>
        <div className="customer-chat-profile"><CustomerAvatar avatar={profile.avatar} initials={profile.fullName.trim().slice(0, 2).toUpperCase() || 'SP'} className="customer-profile-avatar" name={profile.fullName} /><div><strong>{profile.fullName || profile.email || 'Your account'}</strong><small>{profile.email}</small></div></div>
        {latestBooking ? <Link href="/account/bookings" className="customer-chat-booking"><span><ShoppingBag size={16} /></span><div><small>{tx(locale, { en: 'Latest booking', es: 'Última reserva', it: 'Ultima prenotazione', ar: 'الحجز المرتبط' })}</small><strong>{latestBooking.reference}</strong></div><ChevronRight size={16} /></Link> : <Link href="/trips" className="customer-chat-booking"><span><Plus size={16} /></span><div><small>{tx(locale, { en: 'No current booking', es: 'Sin reserva actual', it: 'Nessuna prenotazione attiva', ar: 'لا يوجد حجز حالي' })}</small><strong>{tx(locale, { en: 'Explore trips', es: 'Explorar viajes', it: 'Esplora i viaggi', ar: 'استكشف الرحلات' })}</strong></div><ChevronRight size={16} /></Link>}
        <dl className="customer-chat-summary"><div><dt>{tx(locale, { en: 'Chat messages', es: 'Mensajes del chat', it: 'Messaggi chat', ar: 'رسائل المحادثة' })}</dt><dd>{messages.length}</dd></div><div><dt>{tx(locale, { en: 'Previous enquiries', es: 'Consultas anteriores', it: 'Richieste precedenti', ar: 'استفسارات سابقة' })}</dt><dd>{inquiries.length}</dd></div></dl>
      </section>
      <section className="customer-account-block customer-chat-alternative"><span><WhatsAppGlyph size={20} /></span><h2>{tx(locale, { en: 'Prefer WhatsApp?', es: '¿Prefieres WhatsApp?', it: 'Preferisci WhatsApp?', ar: 'تحتاج واتساب؟' })}</h2><p>{tx(locale, { en: 'Use the official number when you need another channel.', es: 'Usa el número oficial cuando necesites otro canal.', it: 'Usa il numero ufficiale se ti serve un altro canale.', ar: 'استخدم الرقم الرسمي إذا احتجت قناة بديلة.' })}</p><a href={whatsappHref(brand.whatsapp)} target="_blank" rel="noreferrer">WhatsApp <ArrowRight size={15} /></a><small>{brand.whatsapp}</small></section>
    </aside>
  </div>
}

export { MessagesSection }
