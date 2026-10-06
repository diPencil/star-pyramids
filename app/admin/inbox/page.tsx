'use client'

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { ArrowLeft, Inbox, MessageCircle, MessagesSquare, Send } from 'lucide-react'
import { PageHead } from '@/components/admin/admin-shell'
import { AdminEmpty, AdminStats, AdminText, Avatar, Card } from '@/components/admin/admin-ui'
import { useAdminLocale } from '@/components/admin/admin-locale'
import { formatSiteTime } from '@/components/locale'
import { useInquiries } from '@/lib/admin-store'
import { invalidateNotifications } from '@/lib/admin-notifications'
import { cn } from '@/lib/utils'

interface SupportThreadSummary {
  reference: string
  subject: string
  status: 'open' | 'closed'
  assignedStaffEmail: string | null
  lastMessageAt: string
  createdAt: string
  updatedAt: string
  closedAt: string | null
  unreadCount: number
  customer: { email: string; name: string }
  lastMessage: { senderRole: 'customer' | 'staff'; body: string; createdAt: string } | null
}

interface SupportThreadDetail {
  conversation: SupportThreadSummary
  messages: {
    id: string
    senderRole: 'customer' | 'staff'
    body: string
    readAt: string | null
    createdAt: string
  }[]
}

const tabs = [
  { id: 'support', en: 'Support', ar: 'الدعم' },
  { id: 'enquiries', en: 'Website enquiries', ar: 'استفسارات الموقع' },
] as const

export default function InboxPage() {
  const ar = useAdminLocale() === 'ar'
  const [tab, setTab] = useState<'support' | 'enquiries'>('support')
  const [threads, setThreads] = useState<SupportThreadSummary[]>([])
  const [globalUnread, setGlobalUnread] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [activeRef, setActiveRef] = useState<string | null>(null)
  const [detail, setDetail] = useState<SupportThreadDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const [query, setQuery] = useState('')
  const [mobileChatOpen, setMobileChatOpen] = useState(false)
  const inquiries = useInquiries()

  const fetchThreads = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/conversations', { credentials: 'same-origin' })
      if (!res.ok) {
        setLoadError(ar ? 'تعذر تحميل المحادثات.' : 'Could not load conversations.')
        return
      }
      const data = (await res.json()) as {
        conversations?: SupportThreadSummary[]
        unreadCount?: number
      }
      if (Array.isArray(data.conversations)) {
        setThreads(data.conversations)
        setLoadError('')
      }
      if (typeof data.unreadCount === 'number') setGlobalUnread(data.unreadCount)
    } catch {
      setLoadError(ar ? 'تعذر تحميل المحادثات.' : 'Could not load conversations.')
    } finally {
      setLoading(false)
    }
  }, [ar])

  useEffect(() => {
    void fetchThreads()
  }, [fetchThreads])

  // Deep link from staff notifications: /admin/inbox?conversation=SP-CV-XXXXXX
  useEffect(() => {
    try {
      const ref = new URLSearchParams(window.location.search).get('conversation')
      if (ref) {
        setActiveRef(ref.toUpperCase())
        setMobileChatOpen(true)
      }
    } catch {
      /* deep link is best-effort */
    }
  }, [])

  const openThread = useCallback(async (reference: string) => {
    setActiveRef(reference)
    setMobileChatOpen(true)
    setDetailLoading(true)
    try {
      const res = await fetch(`/api/admin/conversations/${encodeURIComponent(reference)}`, {
        credentials: 'same-origin',
      })
      if (!res.ok) return
      const data = (await res.json()) as SupportThreadDetail
      if (data && data.conversation) {
        setDetail(data)
        // Opening marks incoming customer messages read server-side —
        // refresh the list counts to match.
        void fetchThreads()
        // The server also resolved this thread's matching staff
        // notifications — revalidate the bell cache immediately.
        invalidateNotifications()
      }
    } finally {
      setDetailLoading(false)
    }
  }, [fetchThreads])

  // Auto-open the deep-linked thread once the list is available.
  useEffect(() => {
    if (activeRef && !detail && !detailLoading && threads.some((t) => t.reference === activeRef)) {
      void openThread(activeRef)
    }
  }, [activeRef, detail, detailLoading, threads, openThread])

  const send = async () => {
    const text = draft.trim()
    if (!text || !activeRef || sending) return
    setSending(true)
    setSendError('')
    try {
      const res = await fetch(`/api/admin/conversations/${encodeURIComponent(activeRef)}/messages`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ body: text }),
      })
      const data = (await res.json().catch(() => null)) as { error?: unknown } | null
      if (!res.ok) {
        setSendError(
          typeof data?.error === 'string'
            ? data.error
            : ar ? 'تعذر إرسال الرد.' : 'Could not send the reply.',
        )
        return
      }
      setDraft('')
      await openThread(activeRef)
    } catch {
      setSendError(ar ? 'تعذر إرسال الرد.' : 'Could not send the reply.')
    } finally {
      setSending(false)
    }
  }

  const composerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
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

  const runAction = async (action: 'close' | 'reopen' | 'assign') => {
    if (!activeRef) return
    try {
      const res = await fetch(`/api/admin/conversations/${encodeURIComponent(activeRef)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ action }),
      })
      if (!res.ok) return
      await openThread(activeRef)
    } catch {
      /* thread actions are best-effort from the UI; list refresh covers drift */
    }
  }

  const q = query.trim().toLowerCase()
  const supportList = threads.filter((t) => {
    if (!q) return true
    return `${t.reference} ${t.subject} ${t.customer.email} ${t.customer.name}`.toLowerCase().includes(q)
  })
  const active = detail && detail.conversation.reference === activeRef ? detail : null
  const openCount = threads.filter((t) => t.status === 'open').length
  const closedCount = threads.filter((t) => t.status === 'closed').length
  const locale = ar ? 'ar' : 'en'

  return (
    <>
      <PageHead eyebrow="Inbox" title="Inbox" titleAr="صندوق المراسلة" sub="Real customer support conversations" subAr="محادثات دعم العملاء الحقيقية" />
      <AdminStats items={[
        { label: <AdminText en="Conversations" ar="المحادثات" />, value: threads.length, note: <AdminText en="Support threads" ar="محادثات الدعم" />, icon: MessagesSquare },
        { label: <AdminText en="Unread" ar="غير المقروءة" />, value: globalUnread, note: <AdminText en="Customer messages needing attention" ar="رسائل عملاء تحتاج اهتماما" />, icon: MessageCircle, tone: 'orange' },
        { label: <AdminText en="Open" ar="المفتوحة" />, value: openCount, note: <AdminText en="Awaiting resolution" ar="بانتظار الحل" />, icon: Inbox, tone: 'green' },
        { label: <AdminText en="Closed" ar="المغلقة" />, value: closedCount, note: <AdminText en="Resolved history" ar="سجل المحادثات المحلولة" />, icon: Inbox },
      ]} />
      <Card title={<AdminText en="Conversations" ar="المحادثات" />} sub={<AdminText en="Customer support threads" ar="محادثات دعم العملاء" />} className="sp-inbox">
        <div className={cn('sp-conv-list', mobileChatOpen && 'mobile-hidden')}>
          <div className="sp-conv-tools">
            <label className="sp-conv-search"><MessageCircle size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={ar ? 'ابحث برقم المحادثة أو العميل...' : 'Search by reference or customer...'} /></label>
            <div className="sp-tabs">
              {tabs.map((t) => (
                <button key={t.id} type="button" className={tab === t.id ? 'active' : ''} onClick={() => { setTab(t.id); setMobileChatOpen(false) }}>
                  {ar ? t.ar : t.en}
                </button>
              ))}
            </div>
          </div>
          {tab === 'support' && loading && <AdminEmpty title={<AdminText en="Loading conversations…" ar="جارٍ تحميل المحادثات…" />} copy={<AdminText en="Fetching support threads." ar="جارٍ جلب محادثات الدعم." />} />}
          {tab === 'support' && !loading && loadError && threads.length === 0 && <AdminEmpty title={<AdminText en="Could not load conversations" ar="تعذر تحميل المحادثات" />} copy={<AdminText en="Check your connection and try again." ar="تحقق من الاتصال وحاول مجددًا." />} />}
          {tab === 'support' && !loading && supportList.map((c) => (
            <button key={c.reference} type="button" className={cn('sp-conv', c.reference === activeRef && 'active')} onClick={() => void openThread(c.reference)}>
              <Avatar name={c.customer.name} size={42} online={c.status === 'open'} />
              <div>
                <strong>{c.customer.name} · {c.reference}</strong>
                <p>{c.lastMessage ? c.lastMessage.body : (ar ? 'لا رسائل بعد' : 'No messages yet')}</p>
              </div>
              <span style={{ display: 'grid', justifyItems: 'end', gap: 6 }}>
                <time>{formatSiteTime(c.lastMessageAt, locale)}</time>
                {c.unreadCount > 0 && <span className="sp-unread">{c.unreadCount}</span>}
              </span>
            </button>
          ))}
          {tab === 'support' && !loading && !supportList.length && !loadError && <AdminEmpty title={<AdminText en="No conversations found" ar="لا توجد محادثات" />} copy={<AdminText en="Customer support threads will appear here." ar="ستظهر محادثات دعم العملاء هنا." />} />}
          {tab === 'enquiries' && (
            <div style={{ padding: '12px 16px', color: 'var(--sp-muted)', fontSize: 12 }}>
              <AdminText en="Website enquiries stored locally in this browser — not a connected channel. WhatsApp is not integrated." ar="استفسارات الموقع محفوظة محليًا في هذا المتصفح — ليست قناة متصلة. واتساب غير مرتبط." />
            </div>
          )}
          {tab === 'enquiries' && inquiries.map((inquiry) => (
            <div key={inquiry.id} className="sp-conv" role="listitem">
              <Avatar name={inquiry.name} size={42} />
              <div>
                <strong>{inquiry.name} · {inquiry.channel}</strong>
                <p>{inquiry.message}</p>
              </div>
              <span style={{ display: 'grid', justifyItems: 'end', gap: 6 }}>
                <time>{formatSiteTime(inquiry.at, locale)}</time>
              </span>
            </div>
          ))}
          {tab === 'enquiries' && !inquiries.length && <AdminEmpty title={<AdminText en="No enquiries" ar="لا استفسارات" />} copy={<AdminText en="Website form enquiries will appear here." ar="ستظهر استفسارات نماذج الموقع هنا." />} />}
        </div>

        {tab === 'support' && (
          <div className={cn('sp-chat', !mobileChatOpen && 'mobile-hidden')}>
            {!activeRef && <AdminEmpty title={<AdminText en="Select a conversation" ar="اختر محادثة" />} copy={<AdminText en="Choose a support thread to read and reply." ar="اختر محادثة دعم لقراءتها والرد عليها." />} />}
            {activeRef && detailLoading && !active && <AdminEmpty title={<AdminText en="Loading conversation…" ar="جارٍ تحميل المحادثة…" />} copy={<AdminText en="Fetching message history." ar="جارٍ جلب سجل الرسائل." />} />}
            {active && (
              <>
                <div className="sp-chat-head">
                  <button type="button" className="sp-icon-btn sp-chat-back only-mobile" onClick={() => setMobileChatOpen(false)} aria-label={ar ? 'عودة للمحادثات' : 'Back to conversations'} title={ar ? 'عودة للمحادثات' : 'Back to conversations'}>
                    <ArrowLeft size={18} />
                  </button>
                  <Avatar name={active.conversation.customer.name} size={38} online={active.conversation.status === 'open'} />
                  <div style={{ minWidth: 0 }}>
                    <strong style={{ display: 'block', overflowWrap: 'anywhere' }}>{active.conversation.customer.name}</strong>
                    <div style={{ color: 'var(--sp-muted)', fontSize: 12, overflowWrap: 'anywhere' }}>{active.conversation.customer.email} · {active.conversation.reference}{active.conversation.subject ? ` · ${active.conversation.subject}` : ''}</div>
                  </div>
                  <span style={{ marginInlineStart: 'auto' }} className={`sp-pill ${active.conversation.status === 'open' ? 'is-active' : 'is-inactive'}`}>{active.conversation.status}</span>
                </div>
                <div className="sp-chat-body">
                  {!active.messages.length && <AdminEmpty title={<AdminText en="No messages yet" ar="لا رسائل بعد" />} copy={<AdminText en="Messages will appear here." ar="ستظهر الرسائل هنا." />} />}
                  {active.messages.map((m) => (
                    <div key={m.id} className={m.senderRole === 'customer' ? 'sp-row customer' : 'sp-row agent'}>
                      <span className="sp-bubble">{m.body}</span>
                      <span className="sp-chat-time">{formatSiteTime(m.createdAt, locale)}{m.senderRole === 'staff' && m.readAt ? (ar ? ' · مقروءة' : ' · Seen') : ''}</span>
                    </div>
                  ))}
                </div>
                {active.conversation.status === 'closed'
                  ? <div className="sp-chat-form" style={{ color: 'var(--sp-muted)', fontSize: 12.5 }}>{ar ? 'هذه المحادثة مغلقة. أعد فتحها للرد.' : 'This conversation is closed. Reopen it to reply.'}</div>
                  : <form
                      className="sp-chat-form"
                      onSubmit={(e) => { e.preventDefault(); void send() }}
                    >
                      <textarea ref={composerRef} rows={1} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={composerKeyDown} placeholder={ar ? 'اكتب ردا...' : 'Write a reply...'} aria-label={ar ? 'اكتب ردا للعميل' : 'Write a reply to the customer'} disabled={sending} />
                      <button type="submit" className="sp-btn primary" aria-label={ar ? 'إرسال' : 'Send'} disabled={sending || !draft.trim()}><Send size={16} /></button>
                    </form>}
                {sendError && <div style={{ padding: '0 18px 12px', color: '#be123c', fontSize: 12 }}>{sendError}</div>}
              </>
            )}
          </div>
        )}

        {tab === 'support' && active && (
          <aside className="sp-chat-side">
            <span style={{ display: 'flex', gap: 10, alignItems: 'center', minWidth: 0 }}>
              <Avatar name={active.conversation.customer.name} size={46} />
              <span style={{ minWidth: 0, flex: 1 }}><strong style={{ display: 'block', overflowWrap: 'anywhere' }}>{active.conversation.customer.name}</strong><small style={{ display: 'block', overflowWrap: 'anywhere', color: 'var(--sp-muted)' }}>{active.conversation.customer.email}</small></span>
            </span>
            <div><small style={{ color: 'var(--sp-muted)' }}><AdminText en="Status" ar="الحالة" /></small><br /><strong style={{ textTransform: 'capitalize' }}>{active.conversation.status}</strong></div>
            <div><small style={{ color: 'var(--sp-muted)' }}><AdminText en="Assigned to" ar="مسندة إلى" /></small><br /><strong>{active.conversation.assignedStaffEmail ?? (ar ? 'غير مسندة' : 'Unassigned')}</strong></div>
            <div style={{ display: 'grid', gap: 8 }}>
              <button type="button" className="sp-btn" onClick={() => void runAction('assign')}><AdminText en="Assign to me" ar="إسناد إليّ" /></button>
              {active.conversation.status === 'open'
                ? <button type="button" className="sp-btn danger" onClick={() => void runAction('close')}><AdminText en="Close conversation" ar="إغلاق المحادثة" /></button>
                : <button type="button" className="sp-btn primary" onClick={() => void runAction('reopen')}><AdminText en="Reopen conversation" ar="إعادة فتح المحادثة" /></button>}
            </div>
          </aside>
        )}
      </Card>
    </>
  )
}
