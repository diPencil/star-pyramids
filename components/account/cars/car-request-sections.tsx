'use client'

// 'use client' is required here: the access token is read from the router
// rather than passed as a prop, so the credential never enters the
// server-rendered payload that ships in the HTML.
import Link from "next/link";
import { CarQuoteSummary } from "../../cars/car-quote-summary";
import { useEffect, useState } from "react";
import { CarFront, Clock3, Eye, Pencil, Plus, X } from "lucide-react";
import { tx, useLocale, type Locale } from "@/components/locale";
import { useDbCars } from "@/lib/catalogue/events-cars-client";
import { cars } from "@/data/content";
import { carActivityLabel, carRequestStatusLabel, fleetVehicleTitle, type CarRequest, type CarRequestStatus } from "@/lib/cars/car-request";
import { usePagination } from "@/components/admin/admin-pagination";
import { CustomerConfirmDialog } from "../customer-confirm-dialog";
import { customerErrorText } from "@/lib/account/customer-error-copy";
import { EmptyState, CustomerPagination } from "../shared/account-ui"


/**
 * Customer car requests (Phase 2C). Database-backed records owned by the
 * signed-in customer: list, detail, edit (via /rent-car/request?edit=…),
 * and cancel run against `/api/account/car-requests/*`. Staff-only notes
 * never reach this UI  -  the customer serializer excludes them entirely.
 */
function carRequestVehicleTitle(liveCars: { slug: string; title: string }[], slug: string): string {
  return liveCars.find((car) => car.slug === slug)?.title ?? slug
}

function carTripLabel(tripType: string, locale: Locale): string {
  if (tripType === 'One Way') return tx(locale, { en: 'One Way', es: 'Solo ida', it: 'Solo andata', ar: 'ذهاب فقط' })
  if (tripType === 'Round Trip') return tx(locale, { en: 'Round Trip', es: 'Ida y vuelta', it: 'Andata e ritorno', ar: 'ذهاب وعودة' })
  return tx(locale, { en: 'Not set', es: 'Sin definir', it: 'Non impostato', ar: 'لم يحدد' })
}

/** Customer-friendly display date only (e.g. "27 Sep 2026"). Stored ISO is never modified. */
function formatCarDate(iso: string, locale: Locale): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso
  const parsed = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return iso
  if (locale === 'ar') return parsed.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', year: 'numeric' })
  if (locale === 'es') return parsed.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
  if (locale === 'it') return parsed.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${parsed.getDate()} ${months[parsed.getMonth()]} ${parsed.getFullYear()}`
}

function passengerCountLabel(count: number, locale: Locale): string {
  if (locale === 'es') return count === 1 ? '1 pasajero' : `${count} pasajeros`
  if (locale === 'it') return count === 1 ? '1 passeggero' : `${count} passeggeri`
  if (locale !== 'ar') return count === 1 ? '1 passenger' : `${count} passengers`
  if (count === 1) return 'مسافر واحد'
  if (count === 2) return 'مسافران'
  if (count <= 10) return `${count} مسافرين`
  return `${count} مسافر`
}


function CarStatusBadge({ status }: { status: CarRequestStatus }) {
  const { locale } = useLocale()

  const tone = status === 'new' ? 'request_received' : status === 'reviewing' ? 'reviewing' : status === 'confirmed' ? 'confirmed' : 'cancelled'
  return <span className={`customer-status ${tone}`}>{carRequestStatusLabel(status, locale)}</span>
}

async function apiCarList(): Promise<CarRequest[]> {
  const res = await fetch('/api/account/car-requests', { credentials: 'same-origin' })
  if (!res.ok) throw new Error('Could not load your car requests.')
  const data = (await res.json()) as { requests?: CarRequest[] }
  if (!Array.isArray(data.requests)) throw new Error('Could not load your car requests.')
  return data.requests
}

async function apiCarDetail(reference: string): Promise<CarRequest> {
  const res = await fetch(`/api/account/car-requests/${encodeURIComponent(reference)}`, { credentials: 'same-origin' })
  const data = (await res.json()) as CarRequest & { error?: string }
  if (!res.ok) throw new Error(data.error || 'Car request not found.')
  return data
}

async function apiCarCancel(reference: string): Promise<CarRequest> {
  const res = await fetch(`/api/account/car-requests/${encodeURIComponent(reference)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ action: 'cancel' }),
  })
  const data = (await res.json()) as CarRequest & { error?: string }
  if (!res.ok) throw new Error(data.error || 'Could not cancel the request.')
  return data
}

function CarRequestsSection() {
  const { locale } = useLocale()

  const liveCars = useDbCars(cars)
  const [requests, setRequests] = useState<CarRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [cancellingRef, setCancellingRef] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | CarRequestStatus>('all')

  // Load the customer's real requests once.
  useEffect(() => {
    let cancelled = false
    apiCarList()
      .then((rows) => { if (!cancelled) { setRequests(rows); setLoading(false) } })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : 'Could not load your car requests.')
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [])

  const visible = requests.filter((r) => filter === 'all' || r.status === filter)
  const paging = usePagination(visible)

  if (loading) {
    return <section className="customer-account-block customer-full-block"><div className="customer-empty" role="status"><h3>{tx(locale, { en: 'Loading your requests…', es: 'Cargando tus solicitudes…', it: 'Caricamento richieste…', ar: 'جارٍ تحميل طلباتك…' })}</h3></div></section>
  }

  if (loadError && !requests.length) {
    return (
      <section className="customer-account-block customer-full-block">
        <div className="customer-empty">
          <h3>{tx(locale, { en: 'Could not load requests', es: 'No se pudieron cargar las solicitudes', it: 'Impossibile caricare le richieste', ar: 'تعذر تحميل الطلبات' })}</h3>
          <p>{customerErrorText(locale, loadError)}</p>
          <button type="button" className="account-icon-action" onClick={() => {
            setLoading(true)
            setLoadError('')
            apiCarList()
              .then((rows) => { setRequests(rows); setLoading(false) })
              .catch((error: unknown) => {
                setLoadError(error instanceof Error ? error.message : 'Could not load your car requests.')
                setLoading(false)
              })
          }}>{tx(locale, { en: 'Retry', es: 'Reintentar', it: 'Riprova', ar: 'إعادة المحاولة' })}</button>
        </div>
      </section>
    )
  }

  if (!requests.length) {
    return <section className="customer-account-block customer-full-block"><EmptyState Icon={CarFront} title={tx(locale, { en: 'No car requests yet', es: 'Aún no hay solicitudes de coche', it: 'Ancora nessuna richiesta auto', ar: 'لا توجد طلبات سيارات بعد' })} copy={tx(locale, { en: 'Plan your transfer or vehicle request and it will appear here.', es: 'Planifica tu traslado o solicitud de vehículo y aparecerá aquí.', it: 'Pianifica il tuo transfer o la richiesta auto e apparirà qui.', ar: 'ابدأ طلب سيارة أو وسيلة انتقال وسيظهر هنا.' })} href="/rent-car" action={tx(locale, { en: 'Browse rental cars', es: 'Ver coches de alquiler', it: 'Sfoglia le auto a noleggio', ar: 'استكشف السيارات' })} /></section>
  }

  const tabs = [
    { id: 'all', en: 'All', es: 'Todos', it: 'Tutti', ar: 'الكل' },
    { id: 'new', en: 'New', es: 'Nueva', it: 'Nuova', ar: 'جديد' },
    { id: 'reviewing', en: 'Reviewing', es: 'En revisión', it: 'In revisione', ar: 'قيد المراجعة' },
    { id: 'confirmed', en: 'Confirmed', es: 'Confirmada', it: 'Confermata', ar: 'مؤكد' },
    { id: 'cancelled', en: 'Cancelled', es: 'Cancelada', it: 'Cancellata', ar: 'ملغي' },
  ] as const
  const viewLabel = tx(locale, { en: 'View request', es: 'Ver la solicitud', it: 'Vedi richiesta', ar: 'عرض الطلب' })
  return <>
    <section className="customer-account-block customer-full-block">
      {loadError && (
        <div style={{ padding: '18px 18px 0' }}>
          <p className="form-error" role="alert">{customerErrorText(locale, loadError)}</p>
        </div>
      )}
      <div className="customer-filterbar"><div role="tablist" aria-label={tx(locale, { en: 'Filter car requests', es: 'Filtrar solicitudes de coche', it: 'Filtra richieste auto', ar: 'فلترة طلبات السيارات' })}>{tabs.map((tab) => <button type="button" key={tab.id} className={filter === tab.id ? 'active' : ''} onClick={() => setFilter(tab.id)}>{tx(locale, tab)}</button>)}</div><Link href="/rent-car"><Plus size={16} />{tx(locale, { en: 'Request a car', es: 'Solicitar un coche', it: 'Richiedi un’auto', ar: 'طلب سيارة' })}</Link></div>
      {paging.pageRows.length ? <><div className="customer-table-wrap"><table className="customer-table">
        <thead><tr><th>#</th><th>{tx(locale, { en: 'Vehicle', es: 'Vehículo', it: 'Veicolo', ar: 'السيارة' })}</th><th>{tx(locale, { en: 'Route', es: 'Ruta', it: 'Percorso', ar: 'المسار' })}</th><th>{tx(locale, { en: 'Dates', es: 'Fechas', it: 'Date', ar: 'التواريخ' })}</th><th>{tx(locale, { en: 'Passengers', es: 'Pasajeros', it: 'Passeggeri', ar: 'المسافرون' })}</th><th>{tx(locale, { en: 'Status', es: 'Estado', it: 'Stato', ar: 'الحالة' })}</th><th></th></tr></thead>
        <tbody>{paging.pageRows.map((item, index) => {
          const detailHref = `/account/car-requests/detail?ref=${encodeURIComponent(item.reference)}`
          const editable = item.status === 'new' || item.status === 'reviewing'
          const vehicleTitle = carRequestVehicleTitle(liveCars, item.vehicleSlug)
          const vehicleImage = liveCars.find((car) => car.slug === item.vehicleSlug)?.image || '/egypt-hero.png'
          const showReturn = item.tripType === 'Round Trip' && item.preferredReturnDate !== ''
          return <tr key={item.reference}>
            <td className="customer-row-number">{paging.from + index}</td>
            <td><span className="customer-trip-cell"><img src={vehicleImage} alt="" /><span><strong><Link href={detailHref}>{vehicleTitle}</Link></strong><small><span dir="ltr">{item.reference}</span> · {carTripLabel(item.tripType, locale)}</small></span></span></td>
            <td><span dir="ltr">{item.pickup} → {item.dropoff}</span></td>
            <td><span dir="ltr">{formatCarDate(item.preferredPickupDate, locale)}</span>{showReturn && <><br /><small style={{ color: '#667283' }}><span dir="ltr">{formatCarDate(item.preferredReturnDate, locale)}</span></small></>}</td>
            <td>{passengerCountLabel(item.passengers, locale)}</td>
            <td><CarStatusBadge status={item.status} /></td>
            <td><span className="customer-table-actions">
              <Link href={detailHref} aria-label={viewLabel} title={viewLabel}><Eye size={16} /></Link>
              {editable && <Link href={`/rent-car/request?edit=${encodeURIComponent(item.reference)}`} aria-label={tx(locale, { en: 'Edit request', es: 'Editar la solicitud', it: 'Modifica richiesta', ar: 'تعديل الطلب' })} title={tx(locale, { en: 'Edit request', es: 'Editar la solicitud', it: 'Modifica richiesta', ar: 'تعديل الطلب' })}><Pencil size={16} /></Link>}
              {editable && <button type="button" className="danger" onClick={() => setCancellingRef(item.reference)} aria-label={tx(locale, { en: 'Cancel request', es: 'Cancelar la solicitud', it: 'Cancella richiesta', ar: 'إلغاء الطلب' })} title={tx(locale, { en: 'Cancel request', es: 'Cancelar la solicitud', it: 'Cancella richiesta', ar: 'إلغاء الطلب' })}><X size={16} /></button>}
            </span></td>
          </tr>
        })}</tbody>
      </table></div>
      <CustomerPagination page={paging.page} pageCount={paging.pageCount} onPage={paging.setPage} pageSize={paging.pageSize} onPageSize={paging.setPageSize} from={paging.from} to={paging.to} total={paging.total} />
      </> : <div className="customer-empty"><span><CarFront size={24} /></span><h3>{tx(locale, { en: 'No requests in this view', es: 'Sin solicitudes en esta vista', it: 'Nessuna richiesta in questa vista', ar: 'لا توجد طلبات في هذا العرض' })}</h3><p>{tx(locale, { en: 'Try a different filter above.', es: 'Prueba con otro filtro.', it: 'Prova un altro filtro.', ar: 'جرب فلترًا مختلفًا من الأعلى.' })}</p><button type="button" className="account-icon-action" onClick={() => setFilter('all')}>{tx(locale, { en: 'Show all', es: 'Mostrar todo', it: 'Mostra tutto', ar: 'عرض الكل' })}</button></div>}
      <div style={{ padding: '14px 18px 18px' }}>
        <p className="car-request-notice" role="note"><Clock3 size={15} /><span>{tx(locale, { en: 'Our team follows up on your request and will contact you by email with updates.', es: 'Nuestro equipo da seguimiento a tu solicitud y te contactará por correo electrónico con las novedades.', it: 'Il nostro team segue la tua richiesta e ti contatterà via email con gli aggiornamenti.', ar: 'يتابع فريقنا طلبك وسيتواصل معك على بريدك عند وجود تحديث.' })}</span></p>
      </div>
    </section>
    <CustomerConfirmDialog
      open={cancellingRef !== null}
      onClose={() => setCancellingRef(null)}
      onConfirm={() => {
        const ref = cancellingRef
        setCancellingRef(null)
        if (!ref) return
        apiCarCancel(ref)
          .then((saved) => {
            setLoadError('')
            setRequests((prev) => prev.map((r) => (r.reference === saved.reference ? saved : r)))
          })
          .catch((error: unknown) => {
            setLoadError(error instanceof Error ? error.message : 'Could not cancel the request.')
          })
      }}
      title={tx(locale, { en: 'Cancel this car request?', es: '¿Cancelar esta solicitud de coche?', it: 'Cancellare questa richiesta auto?', ar: 'إلغاء طلب السيارة؟' })}
      copy={tx(locale, { en: 'This request will remain in your history with a Cancelled status.', es: 'Esta solicitud quedará en tu historial como cancelada.', it: 'Questa richiesta resterà nella cronologia come cancellata.', ar: 'سيبقى هذا الطلب في سجلك بحالة ملغي.' })}
      confirmLabel={tx(locale, { en: 'Cancel request', es: 'Cancelar la solicitud', it: 'Cancella richiesta', ar: 'إلغاء الطلب' })}
      cancelLabel={tx(locale, { en: 'Keep request', es: 'Mantener la solicitud', it: 'Mantieni richiesta', ar: 'أبقِ الطلب' })}
    />
  </>
}

function CarRequestDetailSection({ reference }: { reference: string }) {
  const { locale } = useLocale()

  const liveCars = useDbCars(cars)
  const [item, setItem] = useState<CarRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [cancelling, setCancelling] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    apiCarDetail(reference)
      .then((record) => { if (!cancelled) { setItem(record); setLoading(false) } })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Car request not found.')
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [reference])

  if (loading) {
    return (
      <div className="customer-inline-empty" role="status">
        <Clock3 size={20} />
        <span><strong>{tx(locale, { en: 'Loading request…', es: 'Cargando la solicitud…', it: 'Caricamento richiesta…', ar: 'جارٍ تحميل الطلب…' })}</strong></span>
      </div>
    )
  }

  if (!item) {
    return (
      <div className="customer-inline-empty">
        <Clock3 size={20} />
        <span>
          <strong>{tx(locale, { en: 'Car request not found', es: 'Solicitud de coche no encontrada', it: 'Richiesta auto non trovata', ar: 'طلب السيارة غير موجود' })}</strong>
          <small>{(error ? customerErrorText(locale, error) : '') || (tx(locale, { en: 'It may have been removed or belong to a different account.', es: 'Es posible que se haya eliminado o que pertenezca a otra cuenta.', it: 'Potrebbe essere stata rimossa o appartenere a un altro account.', ar: 'ربما تم حذفه أو أنه يخص حسابًا آخر.' }))}</small>
        </span>
        <Link href="/account/car-requests">{tx(locale, { en: 'Back to car requests', es: 'Volver a las solicitudes de coche', it: 'Torna alle richieste auto', ar: 'عودة لطلبات السيارات' })}</Link>
      </div>
    )
  }

  const editable = item.status === 'new' || item.status === 'reviewing'
  const vehicleTitle = carRequestVehicleTitle(liveCars, item.vehicleSlug)
  const assignedTitle = item.assignedVehicleSlug ? carRequestVehicleTitle(liveCars, item.assignedVehicleSlug) : ''
  return <>
    <section className="customer-account-block">
      <header><div><span>{tx(locale, { en: 'Car request', es: 'Solicitud de coche', it: 'Richiesta auto', ar: 'طلب سيارة' })}</span><h2>{vehicleTitle}</h2></div><CarStatusBadge status={item.status} /></header>
      <div className="customer-detail-grid">
        <div><small>{tx(locale, { en: 'Reference', es: 'Referencia', it: 'Riferimento', ar: 'المرجع' })}</small><strong dir="ltr">{item.reference}</strong></div>
        <div><small>{tx(locale, { en: 'Created', es: 'Creada', it: 'Creata', ar: 'أُنشئ في' })}</small><strong>{new Date(item.createdAt).toLocaleString(locale === 'ar' ? 'ar-EG' : locale === 'es' ? 'es-ES' : locale === 'it' ? 'it-IT' : 'en-US')}</strong></div>
        <div><small>{tx(locale, { en: 'Updated', es: 'Actualizada', it: 'Aggiornata', ar: 'آخر تحديث' })}</small><strong>{new Date(item.updatedAt).toLocaleString(locale === 'ar' ? 'ar-EG' : locale === 'es' ? 'es-ES' : locale === 'it' ? 'it-IT' : 'en-US')}</strong></div>
        <div><small>{tx(locale, { en: 'Requested vehicle', es: 'Vehículo solicitado', it: 'Veicolo richiesto', ar: 'السيارة المطلوبة' })}</small><strong>{vehicleTitle}</strong></div>
        <div><small>{tx(locale, { en: 'Trip type', es: 'Tipo de viaje', it: 'Tipo di viaggio', ar: 'النوع' })}</small><strong>{carTripLabel(item.tripType, locale)}</strong></div>
        <div><small>{tx(locale, { en: 'Passengers', es: 'Pasajeros', it: 'Passeggeri', ar: 'الركاب' })}</small><strong>{item.passengers}</strong></div>
        {assignedTitle !== '' && <div><small>{tx(locale, { en: 'Assigned vehicle', es: 'Vehículo asignado', it: 'Veicolo assegnato', ar: 'المركبة المخصصة' })}</small><strong>{assignedTitle}</strong></div>}
      </div>
    </section>

    <section className="customer-account-block">
      <header><div><span>{tx(locale, { en: 'Route', es: 'Ruta', it: 'Percorso', ar: 'المسار' })}</span><h2>{tx(locale, { en: 'Journey', es: 'Trayecto', it: 'Viaggio', ar: 'الرحلة' })}</h2></div></header>
      <div className="customer-detail-grid">
        <div><small>{tx(locale, { en: 'Pickup', es: 'Recogida', it: 'Prelievo', ar: 'نقطة الانطلاق' })}</small><strong>{item.pickup}</strong></div>
        <div><small>{tx(locale, { en: 'Drop-off', es: 'Destino', it: 'Destinazione', ar: 'الوجهة' })}</small><strong>{item.dropoff}</strong></div>
        <div><small>{tx(locale, { en: 'Pick-up date', es: 'Fecha de recogida', it: 'Data di prelievo', ar: 'تاريخ الانطلاق' })}</small><strong dir="ltr">{formatCarDate(item.preferredPickupDate, locale)}</strong></div>
        {item.pickupTime ? <div><small>{tx(locale, { en: 'Pick-up time', es: 'Hora de recogida', it: 'Ora di prelievo', ar: 'وقت الانطلاق' })}</small><strong dir="ltr">{item.pickupTime}</strong></div> : null}
        <div><small>{tx(locale, { en: 'Return date', es: 'Fecha de regreso', it: 'Data di ritorno', ar: 'تاريخ العودة' })}</small><strong dir="ltr">{item.tripType === 'Round Trip' && item.preferredReturnDate ? formatCarDate(item.preferredReturnDate, locale) : '-'}</strong></div>
        {item.tripType === 'Round Trip' && item.returnTime ? <div><small>{tx(locale, { en: 'Return time', es: 'Hora de regreso', it: 'Ora di ritorno', ar: 'وقت العودة' })}</small><strong dir="ltr">{item.returnTime}</strong></div> : null}
        <CarQuoteSummary quote={item.quote} locale={locale} tripType={item.tripType} saved/>
      </div>
    </section>

    <section className="customer-account-block">
      <header><div><span>{tx(locale, { en: 'Contact', es: 'Contacto', it: 'Contatto', ar: 'التواصل' })}</span><h2>{tx(locale, { en: 'Contact details', es: 'Datos de contacto', it: 'Dati di contatto', ar: 'بيانات التواصل' })}</h2></div></header>
      <div className="customer-detail-grid">
        <div><small>{tx(locale, { en: 'Full name', es: 'Nombre completo', it: 'Nome completo', ar: 'الاسم الكامل' })}</small><strong>{item.contact.name}</strong></div>
        <div><small>{tx(locale, { en: 'Email', es: 'Correo electrónico', it: 'Email', ar: 'البريد الإلكتروني' })}</small><strong dir="ltr">{item.contact.email}</strong></div>
        <div><small>{tx(locale, { en: 'Phone', es: 'Teléfono', it: 'Telefono', ar: 'رقم الهاتف' })}</small><strong dir="ltr">{item.contact.phone}</strong></div>
      </div>
    </section>

    <section className="customer-account-block">
      <header><div><span>{tx(locale, { en: 'Additional', es: 'Adicional', it: 'Aggiuntivo', ar: 'إضافي' })}</span><h2>{tx(locale, { en: 'Additional request', es: 'Solicitud adicional', it: 'Richiesta aggiuntiva', ar: 'طلب إضافي' })}</h2></div></header>
      {item.notes !== '' ? <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{item.notes}</p> : <p style={{ margin: 0, color: '#667085', fontSize: 12 }}>{tx(locale, { en: 'No additional notes.', es: 'Sin notas adicionales.', it: 'Nessuna nota aggiuntiva.', ar: 'لا توجد ملاحظات إضافية.' })}</p>}
    </section>

    {item.activity.length > 0 && (
      <section className="customer-activity" aria-label={tx(locale, { en: 'Request activity', es: 'Actividad de la solicitud', it: 'Attività richiesta', ar: 'سجل الطلب' })}>
        <h3>{tx(locale, { en: 'Activity', es: 'Actividad', it: 'Attività', ar: 'سجل الطلب' })}</h3>
        <ul>{item.activity.map((a, i) => <li key={`${a.at}-${i}`}><span>{new Date(a.at).toLocaleString(locale === 'ar' ? 'ar-EG' : locale === 'es' ? 'es-ES' : locale === 'it' ? 'it-IT' : 'en-US')}</span><strong>{carActivityLabel(a.action, locale)}</strong>{a.note && <small>{a.action === 'Assigned vehicle updated' ? fleetVehicleTitle(liveCars, a.note) : a.note}</small>}</li>)}</ul>
      </section>
    )}

    <section className="customer-account-block">
      <header><div><span>{tx(locale, { en: 'State', es: 'Estado', it: 'Stato', ar: 'الحالة' })}</span><h2>{tx(locale, { en: 'Request state', es: 'Estado de la solicitud', it: 'Stato della richiesta', ar: 'حالة الطلب' })}</h2></div></header>
      <p style={{ margin: '0 0 8px', fontSize: 13, lineHeight: 1.7 }}>{tx(locale, { en: 'Our team follows up on your request and will contact you by email with updates.', es: 'Nuestro equipo da seguimiento a tu solicitud y te contactará por correo electrónico con las novedades.', it: 'Il nostro team segue la tua richiesta e ti contatterà via email con gli aggiornamenti.', ar: 'يتابع فريقنا طلبك وسيتواصل معك على بريدك عند وجود تحديث.' })}</p>
      <p style={{ margin: 0, color: '#667085', fontSize: 12, lineHeight: 1.7 }}>{tx(locale, { en: 'Contact details shown are a historical snapshot of this request.', es: 'Los datos de contacto mostrados son una instantánea histórica de esta solicitud.', it: 'I dati di contatto mostrati sono un’istantanea storica di questa richiesta.', ar: 'بيانات التواصل المعروضة لقطة تاريخية لهذا الطلب.' })}</p>
      <div className="customer-detail-actions">
        <Link href="/account/car-requests" className="account-icon-action">{tx(locale, { en: 'Back to list', es: 'Volver a la lista', it: 'Torna all’elenco', ar: 'عودة للقائمة' })}</Link>
        {editable && <Link href={`/rent-car/request?edit=${encodeURIComponent(item.reference)}`} className="account-icon-action"><Pencil size={16} />{tx(locale, { en: 'Edit request', es: 'Editar la solicitud', it: 'Modifica richiesta', ar: 'تعديل الطلب' })}</Link>}
        {editable && <button type="button" className="account-icon-action danger" onClick={() => setCancelling(true)}><X size={16} />{tx(locale, { en: 'Cancel request', es: 'Cancelar la solicitud', it: 'Cancella richiesta', ar: 'إلغاء الطلب' })}</button>}
      </div>
    </section>
    <CustomerConfirmDialog
      open={cancelling}
      onClose={() => setCancelling(false)}
      onConfirm={() => {
        setCancelling(false)
        apiCarCancel(item.reference)
          .then((saved) => setItem(saved))
          .catch((err: unknown) => {
            setError(err instanceof Error ? err.message : 'Could not cancel the request.')
          })
      }}
      title={tx(locale, { en: 'Cancel this car request?', es: '¿Cancelar esta solicitud de coche?', it: 'Cancellare questa richiesta auto?', ar: 'إلغاء طلب السيارة؟' })}
      copy={tx(locale, { en: 'This request will remain in your history with a Cancelled status.', es: 'Esta solicitud quedará en tu historial como cancelada.', it: 'Questa richiesta resterà nella cronologia come cancellata.', ar: 'سيبقى هذا الطلب في سجلك بحالة ملغي.' })}
      confirmLabel={tx(locale, { en: 'Cancel request', es: 'Cancelar la solicitud', it: 'Cancella richiesta', ar: 'إلغاء الطلب' })}
      cancelLabel={tx(locale, { en: 'Keep request', es: 'Mantener la solicitud', it: 'Mantieni richiesta', ar: 'أبقِ الطلب' })}
    />
  </>
}

export { CarRequestsSection, CarRequestDetailSection }
