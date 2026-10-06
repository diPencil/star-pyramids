'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Eye, Plus, ShieldCheck, Ticket, X } from 'lucide-react'
import { LocaleProvider, tx, useLocale } from '@/components/locale'
import { AccountShell, CustomerConfirmDialog, CustomerPagination, EmptyState } from './account-portal'
import { usePagination } from '@/components/admin/admin-pagination'
import { useDbEvents } from '@/lib/events-cars-client'
import { events } from '@/data/content'
import { CUSTOMER_EVENT_CANCELLABLE_STATUSES, eventActivityLabel, eventDisplayTitle, eventRequestStatusLabel, type EventRequest, type EventRequestStatus } from '@/lib/event-request'
import { displayInternationalPhone } from '@/lib/phone'

function StatusBadge({ status }: { status: Parameters<typeof eventRequestStatusLabel>[0] }) {
  const { locale } = useLocale()
  const tone = status === 'new' ? 'request_received' : status === 'reviewing' ? 'reviewing' : status === 'approved' ? 'confirmed' : 'cancelled'
  return <span className={`customer-status ${tone}`}>{eventRequestStatusLabel(status, locale)}</span>
}

async function apiEventList(): Promise<EventRequest[]> {
  const res = await fetch('/api/account/event-requests', { credentials: 'same-origin' })
  if (!res.ok) throw new Error('Could not load your event requests.')
  const data = (await res.json()) as { requests?: EventRequest[] }
  if (!Array.isArray(data.requests)) throw new Error('Could not load your event requests.')
  return data.requests
}

async function apiEventDetail(reference: string): Promise<EventRequest> {
  const res = await fetch(`/api/account/event-requests/${encodeURIComponent(reference)}`, { credentials: 'same-origin' })
  const data = (await res.json()) as EventRequest & { error?: string }
  if (!res.ok) throw new Error(data.error || 'Event request not found.')
  return data
}

async function apiEventCancel(reference: string): Promise<EventRequest> {
  const res = await fetch(`/api/account/event-requests/${encodeURIComponent(reference)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ action: 'cancel' }),
  })
  const data = (await res.json()) as EventRequest & { error?: string }
  if (!res.ok) throw new Error(data.error || 'Could not cancel the request.')
  return data
}

export function EventRequestsSection() {
  const { locale } = useLocale()
  const liveEvents = useDbEvents(events)
  const [requests, setRequests] = useState<EventRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [filter, setFilter] = useState<'all' | EventRequestStatus>('all')
  const eventTitle = (slug: string, fallback: string) => liveEvents.find((e) => e.slug === slug)?.title ?? eventDisplayTitle(slug, fallback)
  const eventImage = (slug: string) => liveEvents.find((e) => e.slug === slug)?.image || '/placeholder.jpg'
  const viewLabel = tx(locale, { en: 'View request', es: 'Ver solicitud', it: 'Vedi richiesta', ar: 'عرض الطلب' })
  const visible = filter === 'all' ? requests : requests.filter((r) => r.status === filter)
  const paging = usePagination(visible)
  const filters = ['all', 'new', 'reviewing', 'approved', 'rejected', 'cancelled'] as const
  const dateLocale = locale === 'ar' ? 'ar-EG' : locale === 'es' ? 'es-ES' : locale === 'it' ? 'it-IT' : 'en-US'

  // Load the customer's real requests once.
  useEffect(() => {
    let cancelled = false
    apiEventList()
      .then((rows) => { if (!cancelled) { setRequests(rows); setLoading(false) } })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : 'Could not load your event requests.')
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [])

  if (loading) {
    return <section className="customer-account-block customer-full-block"><div className="customer-empty" role="status"><h3>{tx(locale, { en: 'Loading your requests…', es: 'Cargando tus solicitudes…', it: 'Caricamento delle tue richieste…', ar: 'جارٍ تحميل طلباتك…' })}</h3></div></section>
  }

  if (loadError && !requests.length) {
    return (
      <section className="customer-account-block customer-full-block">
        <div className="customer-empty">
          <h3>{tx(locale, { en: 'Could not load requests', es: 'No se pudieron cargar las solicitudes', it: 'Impossibile caricare le richieste', ar: 'تعذر تحميل الطلبات' })}</h3>
          <p>{loadError}</p>
          <button type="button" className="account-icon-action" onClick={() => {
            setLoading(true)
            setLoadError('')
            apiEventList()
              .then((rows) => { setRequests(rows); setLoading(false) })
              .catch((error: unknown) => {
                setLoadError(error instanceof Error ? error.message : 'Could not load your event requests.')
                setLoading(false)
              })
          }}>{tx(locale, { en: 'Retry', es: 'Reintentar', it: 'Riprova', ar: 'إعادة المحاولة' })}</button>
        </div>
      </section>
    )
  }

  return (
    <section className="customer-account-block customer-full-block">
      <div className="customer-filterbar">
        <div role="tablist" aria-label={tx(locale, { en: 'Filter event requests', es: 'Filtrar solicitudes de eventos', it: 'Filtra richieste eventi', ar: 'فلترة طلبات الفعاليات' })}>
          {filters.map((status) => (
            <button type="button" key={status} className={filter === status ? 'active' : ''} onClick={() => setFilter(status)}>
              {status === 'all' ? tx(locale, { en: 'All', es: 'Todas', it: 'Tutte', ar: 'الكل' }) : eventRequestStatusLabel(status, locale)}
            </button>
          ))}
        </div>
        <Link href="/events"><Plus size={16} />{tx(locale, { en: 'Browse events', es: 'Explorar eventos', it: 'Sfoglia eventi', ar: 'تصفح الفعاليات' })}</Link>
      </div>
      {visible.length ? (
        <>
          <div className="customer-table-wrap"><table className="customer-table">
            <thead><tr><th>#</th><th>{tx(locale, { en: 'Event', es: 'Evento', it: 'Evento', ar: 'الفعالية' })}</th><th>{tx(locale, { en: 'Date', es: 'Fecha', it: 'Data', ar: 'الموعد' })}</th><th>{tx(locale, { en: 'Attendees', es: 'Asistentes', it: 'Partecipanti', ar: 'الحضور' })}</th><th>{tx(locale, { en: 'Submitted', es: 'Enviada', it: 'Inviata', ar: 'أُرسل' })}</th><th>{tx(locale, { en: 'Status', es: 'Estado', it: 'Stato', ar: 'الحالة' })}</th><th></th></tr></thead>
            <tbody>{paging.pageRows.map((r, index) => {
              const detailHref = `/account/event-requests/detail?ref=${encodeURIComponent(r.reference)}`
              return <tr key={r.reference}>
                <td className="customer-row-number">{paging.from + index}</td>
                <td><span className="customer-trip-cell"><img src={eventImage(r.eventSlug)} alt="" loading="lazy" onError={(e) => { if (!e.currentTarget.src.endsWith('/placeholder.jpg')) e.currentTarget.src = '/placeholder.jpg' }} /><span><strong><Link href={detailHref}>{eventTitle(r.eventSlug, r.eventTitle)}</Link></strong><small><span dir="ltr">{r.reference}</span> · {r.eventLocation}</small></span></span></td>
                <td><span dir="ltr">{r.eventDate}</span></td>
                <td>{r.attendees}</td>
                <td><span dir="ltr">{new Date(r.createdAt).toLocaleDateString(dateLocale)}</span></td>
                <td><StatusBadge status={r.status} /></td>
                <td><span className="customer-table-actions"><Link href={detailHref} aria-label={viewLabel} title={viewLabel}><Eye size={16} /></Link></span></td>
              </tr>
            })}</tbody>
          </table></div>
          <CustomerPagination page={paging.page} pageCount={paging.pageCount} onPage={paging.setPage} pageSize={paging.pageSize} onPageSize={paging.setPageSize} from={paging.from} to={paging.to} total={paging.total} />
          <div style={{ padding: '0 18px 18px' }}>
            <p className="car-request-notice" role="note"><ShieldCheck size={15} /><span>{tx(locale, { en: 'Preliminary requests pending review. They are not confirmed tickets.', es: 'Solicitudes preliminares pendientes de revisión. No son entradas confirmadas.', it: 'Richieste preliminari in attesa di revisione. Non sono biglietti confermati.', ar: 'طلبات مبدئية قيد المراجعة. وهي ليست تذاكر مؤكدة.' })}</span></p>
          </div>
        </>
      ) : (
        <EmptyState Icon={Ticket} title={requests.length ? tx(locale, { en: 'No requests in this view', es: 'Sin solicitudes en esta vista', it: 'Nessuna richiesta in questa vista', ar: 'لا توجد طلبات في هذه الحالة' }) : tx(locale, { en: 'No event requests yet', es: 'Aún no hay solicitudes de eventos', it: 'Ancora nessuna richiesta evento', ar: 'لا توجد طلبات فعاليات بعد' })} copy={requests.length ? tx(locale, { en: 'Try a different status from the filter above.', es: 'Prueba con otro estado en el filtro de arriba.', it: 'Prova un altro stato dal filtro qui sopra.', ar: 'جرب حالة مختلفة من الفلتر بالأعلى.' }) : tx(locale, { en: 'Pick an event, send an attendance request, and it will appear here.', es: 'Elige un evento, envía una solicitud de asistencia y aparecerá aquí.', it: 'Scegli un evento, invia una richiesta di partecipazione e apparirà qui.', ar: 'اختر فعالية وأرسل طلب حضور وسيظهر هنا.' })} href="/events" action={tx(locale, { en: 'Explore events', es: 'Explorar eventos', it: 'Scopri gli eventi', ar: 'استكشف الفعاليات' })} />
      )}
    </section>
  )
}

export function EventRequestDetailSection({ reference }: { reference: string }) {
  const { locale } = useLocale()
  const liveEvents = useDbEvents(events)
  const [item, setItem] = useState<EventRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const [actionError, setActionError] = useState('')
  const dateTimeLocale = locale === 'ar' ? 'ar-EG' : locale === 'es' ? 'es-ES' : locale === 'it' ? 'it-IT' : 'en-US'

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError('')
    apiEventDetail(reference)
      .then((row) => { if (!cancelled) { setItem(row); setLoading(false) } })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : 'Event request not found.')
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [reference])

  if (loading) {
    return <div className="customer-account-block"><div className="customer-empty" role="status"><h3>{tx(locale, { en: 'Loading request…', es: 'Cargando solicitud…', it: 'Caricamento richiesta…', ar: 'جارٍ تحميل الطلب…' })}</h3></div></div>
  }

  if (!item) {
    return (
      <div className="customer-inline-empty">
        <Ticket size={20} />
        <span>
          <strong>{tx(locale, { en: 'Event request not found', es: 'Solicitud de evento no encontrada', it: 'Richiesta evento non trovata', ar: 'طلب الفعالية غير موجود' })}</strong>
          <small>{loadError || tx(locale, { en: 'Check the reference and try again.', es: 'Comprueba la referencia e inténtalo de nuevo.', it: 'Controlla il riferimento e riprova.', ar: 'تأكد من المرجع وحاول مجددًا.' })}</small>
        </span>
        <Link href="/account/event-requests">{tx(locale, { en: 'Back to event requests', es: 'Volver a solicitudes de eventos', it: 'Torna alle richieste eventi', ar: 'عودة لطلبات الفعاليات' })}</Link>
      </div>
    )
  }

  const title = liveEvents.find((e) => e.slug === item.eventSlug)?.title ?? eventDisplayTitle(item.eventSlug, item.eventTitle)
  const cancellable = (CUSTOMER_EVENT_CANCELLABLE_STATUSES as readonly string[]).includes(item.status)
  return (
    <div className="customer-account-block">
      <header>
        <div>
          <span>{tx(locale, { en: 'Event request detail', es: 'Detalle de la solicitud', it: 'Dettaglio richiesta evento', ar: 'تفاصيل طلب الفعالية' })}</span>
          <h2>{title}</h2>
        </div>
        <StatusBadge status={item.status} />
      </header>
      <dl className="customer-detail-grid">
        <div><dt>{tx(locale, { en: 'Reference', es: 'Referencia', it: 'Riferimento', ar: 'المرجع' })}</dt><dd dir="ltr">{item.reference}</dd></div>
        <div><dt>{tx(locale, { en: 'Event', es: 'Evento', it: 'Evento', ar: 'الفعالية' })}</dt><dd><Link href={`/events/${item.eventSlug}`}>{title}</Link></dd></div>
        <div><dt>{tx(locale, { en: 'Date', es: 'Fecha', it: 'Data', ar: 'الموعد' })}</dt><dd>{item.eventDate}</dd></div>
        <div><dt>{tx(locale, { en: 'Location', es: 'Ubicación', it: 'Luogo', ar: 'الموقع' })}</dt><dd>{item.eventLocation}</dd></div>
        <div><dt>{tx(locale, { en: 'Name', es: 'Nombre', it: 'Nome', ar: 'الاسم' })}</dt><dd>{item.contact.name}</dd></div>
        <div><dt>{tx(locale, { en: 'Phone', es: 'Teléfono', it: 'Telefono', ar: 'الهاتف' })}</dt><dd dir="ltr">{displayInternationalPhone(item.dialCode, item.contact.phone)}</dd></div>
        <div><dt>{tx(locale, { en: 'Email', es: 'Correo electrónico', it: 'Email', ar: 'البريد' })}</dt><dd dir="ltr">{item.contact.email}</dd></div>
        <div><dt>{tx(locale, { en: 'Attendees', es: 'Asistentes', it: 'Partecipanti', ar: 'عدد الحضور' })}</dt><dd>{item.attendees}</dd></div>
        <div><dt>{tx(locale, { en: 'Submitted', es: 'Enviada', it: 'Inviata', ar: 'أُرسل في' })}</dt><dd>{new Date(item.createdAt).toLocaleString(dateTimeLocale)}</dd></div>
        {item.notes && <div className="full"><dt>{tx(locale, { en: 'Notes', es: 'Notas', it: 'Note', ar: 'ملاحظات' })}</dt><dd>{item.notes}</dd></div>}
      </dl>
      {item.activity.length > 0 && (
        <section className="customer-activity" aria-label={tx(locale, { en: 'Request activity', es: 'Historial de la solicitud', it: 'Attività della richiesta', ar: 'سجل الطلب' })}>
          <h3>{tx(locale, { en: 'Activity', es: 'Actividad', it: 'Attività', ar: 'سجل الطلب' })}</h3>
          <ul>{item.activity.map((a, i) => <li key={`${a.at}-${i}`}><span>{new Date(a.at).toLocaleString(dateTimeLocale)}</span><strong>{eventActivityLabel(a.action, locale)}</strong>{a.note && <small>{a.note}</small>}</li>)}</ul>
        </section>
      )}
      {actionError && <p role="alert" className="form-error">{actionError}</p>}
      <div className="customer-detail-actions">
        <Link href="/account/event-requests" className="account-icon-action">{tx(locale, { en: 'Back to list', es: 'Volver a la lista', it: 'Torna alla lista', ar: 'عودة للقائمة' })}</Link>
        {cancellable && (
          <button type="button" className="account-icon-action danger" onClick={() => setCancelling(true)}><X size={16} />{tx(locale, { en: 'Cancel request', es: 'Cancelar solicitud', it: 'Annulla richiesta', ar: 'إلغاء الطلب' })}</button>
        )}
      </div>
      <CustomerConfirmDialog
        open={cancelling}
        onClose={() => setCancelling(false)}
        onConfirm={() => {
          setActionError('')
          apiEventCancel(item.reference)
            .then((row) => { setItem(row); setCancelling(false) })
            .catch((error: unknown) => {
              setActionError(error instanceof Error ? error.message : tx(locale, { en: 'Could not cancel the request.', es: 'No se pudo cancelar la solicitud.', it: 'Impossibile annullare la richiesta.', ar: 'تعذر إلغاء الطلب.' }))
              setCancelling(false)
            })
        }}
        title={tx(locale, { en: 'Cancel this event request?', es: '¿Cancelar esta solicitud de evento?', it: 'Annullare questa richiesta evento?', ar: 'إلغاء طلب الفعالية؟' })}
        copy={tx(locale, { en: 'This request will remain in your history with a Cancelled status.', es: 'Esta solicitud quedará en tu historial como cancelada.', it: 'Questa richiesta resterà nella tua cronologia come annullata.', ar: 'سيبقى هذا الطلب في سجلك بحالة ملغي.' })}
        confirmLabel={tx(locale, { en: 'Cancel request', es: 'Cancelar solicitud', it: 'Annulla richiesta', ar: 'إلغاء الطلب' })}
        cancelLabel={tx(locale, { en: 'Keep request', es: 'Mantener solicitud', it: 'Mantieni richiesta', ar: 'أبقِ الطلب' })}
      />
      <p className="customer-block-note">{tx(locale, { en: 'Official reference issued at submission. Not a ticket.', es: 'Referencia oficial emitida al enviar. No es una entrada.', it: 'Riferimento ufficiale emesso all’invio. Non è un biglietto.', ar: 'المرجع الرسمي الصادر عند الإرسال. وليس تذكرة.' })}</p>
    </div>
  )
}

export function CustomerEventRequestsPage() {
  return <LocaleProvider><AccountShell section="event-requests"><EventRequestsSection /></AccountShell></LocaleProvider>
}

export function CustomerEventRequestDetailPage({ reference }: { reference: string }) {
  return (
    <LocaleProvider>
      <EventRequestDetailShell reference={reference} />
    </LocaleProvider>
  )
}

function EventRequestDetailShell({ reference }: { reference: string }) {
  const { locale } = useLocale()
  return (
    <AccountShell section="event-requests" headLeading={<Link href="/account/event-requests" className="account-icon-action">{tx(locale, { en: 'Back to event requests', es: 'Volver a solicitudes de eventos', it: 'Torna alle richieste eventi', ar: 'عودة لطلبات الفعاليات' })}</Link>}>
      <EventRequestDetailSection reference={reference} />
    </AccountShell>
  )
}
