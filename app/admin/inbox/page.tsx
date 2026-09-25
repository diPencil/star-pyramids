'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, MessageCircle, MessagesSquare, Send, Users } from 'lucide-react'
import { PageHead } from '@/components/admin/admin-shell'
import { AdminEmpty, AdminStats, AdminText, Avatar, Card } from '@/components/admin/admin-ui'
import { useAdminLocale } from '@/components/admin/admin-locale'
import { conversations, type ChatMessage, type Conversation } from '@/components/admin/admin-data'
import { formatSiteTime } from '@/components/locale'
import { WhatsAppGlyph } from '@/components/whatsapp-chat'
import { useInquiries } from '@/lib/admin-store'
import { useCustomerProfile } from '@/lib/customer-account'
import { markCustomerChatRead, sendAgentChatMessage, useCustomerChatMessages } from '@/lib/customer-chat'
import { cn } from '@/lib/utils'

const CUSTOMER_ACCOUNT_CHAT_ID = 'customer-account-support'

const tabs = [
  { id: 'all', en: 'All', ar: 'الكل' },
  { id: 'live', en: 'Live Chat', ar: 'المحادثة المباشرة' },
  { id: 'whatsapp', en: 'WhatsApp', ar: 'واتساب' },
] as const

export default function InboxPage() {
  const ar = useAdminLocale() === 'ar'
  const [tab, setTab] = useState<'all' | 'live' | 'whatsapp'>('all')
  const [activeId, setActiveId] = useState(conversations[0].id)
  const [draft, setDraft] = useState('')
  const [threads, setThreads] = useState(conversations)
  const [query, setQuery] = useState('')
  const [mobileChatOpen, setMobileChatOpen] = useState(false)
  const [readInquiries, setReadInquiries] = useState<string[]>([])
  const inquiries = useInquiries()
  const customerProfile = useCustomerProfile()
  const accountMessages = useCustomerChatMessages()

  const latestAccountMessage = accountMessages.at(-1)
  const accountConversation: Conversation | null = accountMessages.length ? {
    id: CUSTOMER_ACCOUNT_CHAT_ID,
    name: customerProfile.fullName,
    avatar: customerProfile.avatar,
    channel: 'live',
    country: customerProfile.country,
    lastText: latestAccountMessage?.text || latestAccountMessage?.attachment?.name || '',
    time: latestAccountMessage ? formatSiteTime(latestAccountMessage.createdAt, ar ? 'ar' : 'en') : '',
    unread: accountMessages.filter((message) => message.sender === 'customer' && !message.readByAdmin).length,
    online: true,
    tourInterest: ar ? 'دعم حساب العميل' : 'Customer account support',
    messages: accountMessages.map((message) => ({
      id: message.id,
      from: message.sender,
      text: message.text || message.attachment?.name || '',
      time: formatSiteTime(message.createdAt, ar ? 'ar' : 'en'),
      seen: message.sender === 'agent' ? message.readByCustomer : message.readByAdmin,
    })),
  } : null

  const inquiryConvs: Conversation[] = inquiries
    .filter((inquiry) => inquiry.channel === 'whatsapp')
    .map((inquiry) => {
      const time = formatSiteTime(inquiry.at, ar ? 'ar' : 'en')
      return {
        id: inquiry.id,
        name: inquiry.name,
        avatar: '',
        channel: 'whatsapp',
        country: '—',
        lastText: inquiry.message,
        time,
        unread: readInquiries.includes(inquiry.id) ? 0 : 1,
        online: false,
        tourInterest: inquiry.tourTitle,
        messages: [{ id: `${inquiry.id}-m`, from: 'customer', text: inquiry.message, time }],
      } as Conversation
    })
  const merged = [...(accountConversation ? [accountConversation] : []), ...inquiryConvs, ...threads]
  const list = merged.filter((c) => (tab === 'all' ? true : c.channel === tab)).filter((c) => `${c.name} ${c.country} ${c.tourInterest}`.toLowerCase().includes(query.trim().toLowerCase()))
  const active = merged.find((c) => c.id === activeId) ?? list[0]

  const send = () => {
    const text = draft.trim()
    if (!text || !active) return
    if (active.id === CUSTOMER_ACCOUNT_CHAT_ID) {
      sendAgentChatMessage(text)
      markCustomerChatRead('admin')
      setDraft('')
      return
    }
    const reply: ChatMessage = { id: `m-${Date.now()}`, from: 'agent', text, time: 'now', seen: false }
    if (threads.some((c) => c.id === active.id)) {
      setThreads((prev) =>
        prev.map((c) =>
          c.id === active.id
            ? { ...c, lastText: text, unread: 0, messages: [...c.messages, reply] }
            : c
        )
      )
    } else {
      setThreads((prev) => [{ ...active, lastText: text, unread: 0, messages: [...active.messages, reply] }, ...prev])
      setReadInquiries((prev) => (prev.includes(active.id) ? prev : [...prev, active.id]))
    }
    setDraft('')
  }

  const openConversation = (id: string) => {
    setActiveId(id)
    setMobileChatOpen(true)
    if (id === CUSTOMER_ACCOUNT_CHAT_ID) markCustomerChatRead('admin')
    setReadInquiries((prev) => (prev.includes(id) ? prev : [...prev, id]))
  }

  useEffect(() => {
    if (activeId === CUSTOMER_ACCOUNT_CHAT_ID && accountMessages.some((message) => message.sender === 'customer' && !message.readByAdmin)) {
      markCustomerChatRead('admin')
    }
  }, [accountMessages, activeId])

  return (
    <>
      <PageHead eyebrow="Inbox" title="Inbox" titleAr="صندوق المراسلة" sub="Live chat + WhatsApp in one Messenger-style view" subAr="المحادثة المباشرة وواتساب في عرض واحد بأسلوب ماسنجر" />
      <AdminStats items={[
        { label: <AdminText en="Conversations" ar="المحادثات" />, value: merged.length, note: <AdminText en="Across every channel" ar="عبر كل القنوات" />, icon: MessagesSquare },
        { label: <AdminText en="Unread" ar="غير المقروءة" />, value: merged.reduce((sum, thread) => sum + thread.unread, 0), note: <AdminText en="Messages needing attention" ar="رسائل تحتاج اهتماما" />, icon: MessageCircle, tone: 'orange' },
        { label: <AdminText en="Online customers" ar="عملاء متصلون" />, value: merged.filter((thread) => thread.online).length, note: <AdminText en="Available now" ar="متاحون الآن" />, icon: Users, tone: 'green' },
        { label: <AdminText en="WhatsApp threads" ar="محادثات واتساب" />, value: merged.filter((thread) => thread.channel === 'whatsapp').length, note: <AdminText en="Connected conversations" ar="محادثات متصلة" />, icon: WhatsAppGlyph, tone: 'violet' },
      ]} />
      <Card title={<AdminText en="Conversations" ar="المحادثات" />} sub={<AdminText en="Live chat and WhatsApp enquiries" ar="استفسارات المحادثة المباشرة وواتساب" />} className="sp-inbox">
        <div className={cn('sp-conv-list', mobileChatOpen && 'mobile-hidden')}>
          <div className="sp-conv-tools">
            <label className="sp-conv-search"><MessageCircle size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={ar ? 'ابحث في المحادثات...' : 'Search conversations...'} /></label>
            <div className="sp-tabs">
              {tabs.map((t) => (
                <button key={t.id} type="button" className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
                  {ar ? t.ar : t.en}
                </button>
              ))}
            </div>
          </div>
          {list.map((c) => (
            <button key={c.id} type="button" className={cn('sp-conv', c.id === active?.id && 'active')} onClick={() => openConversation(c.id)}>
              <Avatar name={c.name} src={c.avatar} size={42} online={c.online} />
              <div>
                <strong>{c.name} {c.channel === 'whatsapp' ? '· WA' : ''}</strong>
                <p>{c.lastText}</p>
              </div>
              <span style={{ display: 'grid', justifyItems: 'end', gap: 6 }}>
                <time>{c.time}</time>
                {c.unread > 0 && <span className="sp-unread">{c.unread}</span>}
              </span>
            </button>
          ))}
          {!list.length && <AdminEmpty title={<AdminText en="No conversations found" ar="لا توجد محادثات" />} copy={<AdminText en="Try changing the search or filters." ar="جرب تغيير البحث أو الفلاتر." />} />}
        </div>

        {active && (
          <div className={cn('sp-chat', !mobileChatOpen && 'mobile-hidden')}>
            <div className="sp-chat-head">
              <button type="button" className="sp-icon-btn sp-chat-back only-mobile" onClick={() => setMobileChatOpen(false)} aria-label={ar ? 'عودة للمحادثات' : 'Back to conversations'} title={ar ? 'عودة للمحادثات' : 'Back to conversations'}>
                <ArrowLeft size={18} />
              </button>
              <Avatar name={active.name} src={active.avatar} size={38} online={active.online} />
              <div style={{ minWidth: 0 }}>
                <strong>{active.name}</strong>
                <div style={{ color: 'var(--sp-muted)', fontSize: 12 }}>{active.online ? (ar ? 'متصل الآن' : 'Active now') : active.time} · {active.country} · {active.tourInterest}</div>
              </div>
              <span style={{ marginInlineStart: 'auto' }} className="sp-pill is-active">{active.channel}</span>
            </div>
            <div className="sp-chat-body">
              {active.messages.map((m) => (
                <div key={m.id} className={m.from === 'customer' ? 'sp-row customer' : 'sp-row agent'}>
                  <span className={cn('sp-bubble', m.from === 'agent' && active.channel === 'whatsapp' && 'wa')}>{m.text}</span>
                  <span className="sp-chat-time">{m.time}{m.seen ? (ar ? ' · مقروءة' : ' · Seen') : ''}</span>
                </div>
              ))}
            </div>
            <form
              className="sp-chat-form"
              onSubmit={(e) => { e.preventDefault(); send() }}
            >
              <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={ar ? 'اكتب ردا...' : 'Write a reply...'} />
              <button type="submit" className="sp-btn primary" aria-label={ar ? 'إرسال' : 'Send'}><Send size={16} /></button>
            </form>
          </div>
        )}

        {active && (
          <aside className="sp-chat-side">
            <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <Avatar name={active.name} src={active.avatar} size={46} />
              <span><strong>{active.name}</strong><br /><small style={{ color: 'var(--sp-muted)' }}>{active.country}</small></span>
            </span>
            <div><small style={{ color: 'var(--sp-muted)' }}><AdminText en="Interested in" ar="مهتم بـ" /></small><br /><strong>{active.tourInterest}</strong></div>
            <button type="button" className="sp-btn primary"><AdminText en="Create booking from chat" ar="إنشاء حجز من المحادثة" /></button>
            <button type="button" className="sp-btn"><AdminText en="Assign to agent" ar="تعيين لموظف" /></button>
          </aside>
        )}
      </Card>
    </>
  )
}
