'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Copy, RefreshCw, Search, Save } from 'lucide-react'
import { SharedSelect } from '@/components/shared-select'
import { useRouter } from 'next/navigation'
import { AdminConfirmDialog } from './admin-confirm-dialog'
import { useCurrentUser } from '@/lib/use-current-user'
import { pickLocaleText, type Locale } from '@/lib/locale-config'
import { AdminEmpty } from './admin-ui'
import { protectEnquiryNavigation } from '@/lib/enquiry-navigation'

type Status = 'NEW' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'
type StaffRole = { role: { key: string; name: string } }
type Staff = { publicId: string; email: string; firstName: string | null; lastName: string | null; roles?: StaffRole[] }
type Enquiry = {
  publicId: string; name: string; email: string; phone: string | null
  subject: string; message: string; sourcePage: string | null
  status: Status; assignedTo: Staff | null; internalNotes: string | null
  createdAt: string; updatedAt: string
}
type Draft = { status: Status; assignedToId: string; internalNotes: string }
const statuses: Status[] = ['NEW', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']
const labels = {
  title: ['Travel Enquiries', 'Consultas de viaje', 'Richieste di viaggio', 'استفسارات السفر'],
  intro: ['Review traveller requests and coordinate the team follow-up.', 'Revisa las solicitudes de los viajeros y coordina el seguimiento del equipo.', 'Esamina le richieste dei viaggiatori e coordina il follow-up del team.', 'راجع طلبات المسافرين ونسّق متابعة الفريق.'],
  search: ['Search by traveller, reference or message', 'Buscar por viajero, referencia o mensaje', 'Cerca per viaggiatore, riferimento o messaggio', 'ابحث بالمسافر أو المرجع أو الرسالة'],
  all: ['All statuses', 'Todos los estados', 'Tutti gli stati', 'كل الحالات'],
  NEW: ['New', 'Nueva', 'Nuova', 'جديد'],
  IN_PROGRESS: ['In progress', 'En curso', 'In corso', 'قيد المعالجة'],
  RESOLVED: ['Resolved', 'Resuelta', 'Risolta', 'تم الحل'],
  CLOSED: ['Closed', 'Cerrada', 'Chiusa', 'مغلق'],
  status: ['Request Status', 'Estado de la solicitud', 'Stato della richiesta', 'حالة الطلب'],
  filter: ['Filter by status', 'Filtrar por estado', 'Filtra per stato', 'تصفية حسب الحالة'],
  assigned: ['Assigned Team Member', 'Miembro del equipo asignado', 'Membro del team assegnato', 'عضو الفريق المسؤول'],
  assign: ['Assigned Team Member', 'Miembro del equipo asignado', 'Membro del team assegnato', 'عضو الفريق المسؤول'],
  unassigned: ['Not assigned', 'Sin asignar', 'Non assegnato', 'غير مُسند'],
  assigneeHint: ['No team member selected.', 'Ningún miembro del equipo seleccionado.', 'Nessun membro del team selezionato.', 'لم يتم اختيار أي عضو في الفريق.'],
  unassign: ['Remove assignment', 'Quitar asignación', 'Rimuovi assegnazione', 'إزالة الإسناد'],
  reference: ['Request Reference', 'Referencia de la solicitud', 'Riferimento richiesta', 'مرجع الطلب'],
  subject: ['Trip type and subject', 'Tipo de viaje y asunto', 'Tipo di viaggio e oggetto', 'نوع الرحلة والموضوع'],
  source: ['Source page', 'Página de origen', 'Pagina di origine', 'صفحة المصدر'],
  submitted: ['Submitted', 'Recibida', 'Ricevuta', 'تاريخ الاستلام'],
  message: ['Traveller’s Message', 'Mensaje del viajero', 'Messaggio del viaggiatore', 'رسالة المسافر'],
  notes: ['Team Notes', 'Notas del equipo', 'Note del team', 'ملاحظات الفريق'],
  private: ['Team only - saving here does not email the traveller.', 'Solo equipo - guardar aquí no envía correo al viajero.', 'Solo team - salvare qui non invia email al viaggiatore.', 'للفريق فقط - الحفظ هنا لا يرسل بريدًا إلى المسافر.'],
  save: ['Save Updates', 'Guardar cambios', 'Salva modifiche', 'حفظ التغييرات'],
  saving: ['Saving…', 'Guardando…', 'Salvataggio…', 'جارٍ الحفظ…'],
  saved: ['Changes saved.', 'Cambios guardados.', 'Modifiche salvate.', 'تم حفظ التغييرات.'],
  dirty: ['You have unsaved changes.', 'Tienes cambios sin guardar.', 'Hai modifiche non salvate.', 'لديك تغييرات غير محفوظة.'],
  discardAction: ['Discard changes', 'Descartar cambios', 'Scarta modifiche', 'تجاهل التغييرات'],
  keepEditing: ['Keep editing', 'Seguir editando', 'Continua a modificare', 'متابعة التعديل'],
  discard: ['Discard unsaved changes?', '¿Descartar los cambios sin guardar?', 'Scartare le modifiche non salvate?', 'تجاهل التغييرات غير المحفوظة؟'],
  reload: ['Refresh', 'Actualizar', 'Aggiorna', 'تحديث'],
  retry: ['Try again', 'Reintentar', 'Riprova', 'إعادة المحاولة'],
  copy: ['Copy reference', 'Copiar referencia', 'Copia riferimento', 'نسخ المرجع'],
  copied: ['Copied', 'Copiado', 'Copiato', 'تم النسخ'],
  travellerDetails: ['Traveller details', 'Datos del viajero', 'Dati del viaggiatore', 'بيانات المسافر'],
  teamActions: ['Team follow-up', 'Seguimiento del equipo', 'Gestione del team', 'متابعة الفريق'],
  loading: ['Loading requests…', 'Cargando solicitudes…', 'Caricamento richieste…', 'جارٍ تحميل الطلبات…'],
  loadingDetail: ['Loading request…', 'Cargando solicitud…', 'Caricamento richiesta…', 'جارٍ تحميل الطلب…'],
  empty: ['No requests found', 'No hay solicitudes', 'Nessuna richiesta trovata', 'لا توجد طلبات'],
  emptyCopy: ['Traveller requests will appear here. Try adjusting your search or filter.', 'Las solicitudes aparecerán aquí. Prueba con otra búsqueda o filtro.', 'Le richieste appariranno qui. Prova a modificare ricerca o filtro.', 'ستظهر طلبات المسافرين هنا. جرّب تعديل البحث أو الفلتر.'],
  select: ['Select a request', 'Selecciona una solicitud', 'Seleziona una richiesta', 'اختر طلبًا'],
  selectCopy: ['Choose a request from the list to review the traveller’s details.', 'Elige una solicitud de la lista para ver sus detalles.', 'Scegli una richiesta dall’elenco per vederne i dettagli.', 'اختر طلبًا من القائمة لعرض تفاصيل المسافر.'],
  error: ['Could not load requests.', 'No se pudieron cargar las solicitudes.', 'Impossibile caricare le richieste.', 'تعذر تحميل الطلبات.'],
  saveError: ['Could not confirm changes. Refresh the request to check before retrying.', 'No se confirmaron los cambios. Actualiza antes de reintentar.', 'Modifiche non confermate. Aggiorna prima di riprovare.', 'تعذر تأكيد التغييرات. حدّث الطلب للتحقق قبل المحاولة.'],
  staffError: ['Could not load the team list. Try again to assign this request.', 'No se pudo cargar el equipo. Reintenta para asignar.', 'Impossibile caricare il team. Riprova per assegnare.', 'تعذر تحميل قائمة الفريق. أعد المحاولة للإسناد.'],
  staffLoading: ['Loading team members…', 'Cargando miembros del equipo…', 'Caricamento membri del team…', 'جارٍ تحميل أعضاء الفريق…'],
  noStaff: ['No eligible team members available.', 'No hay miembros del equipo disponibles.', 'Nessun membro del team disponibile.', 'لا يوجد أعضاء فريق مؤهلون.'],
  back: ['Back to requests', 'Volver a solicitudes', 'Torna alle richieste', 'عودة إلى الطلبات'],
  previous: ['Previous page', 'Página anterior', 'Pagina precedente', 'الصفحة السابقة'],
  next: ['Next page', 'Página siguiente', 'Pagina successiva', 'الصفحة التالية'],
  page: ['Page', 'Página', 'Pagina', 'صفحة'],
  of: ['of', 'de', 'di', 'من'],
  results: ['requests', 'solicitudes', 'richieste', 'طلبات'],
  readonly: ['You can view this request. Updating it requires permission.', 'Puedes ver esta solicitud. Para editarla necesitas permiso.', 'Puoi leggere questa richiesta. Per modificarla serve un’autorizzazione.', 'يمكنك عرض هذا الطلب. تحديثه يتطلب صلاحية.'],
  'one-day': ['One-day tour', 'Excursión de un día', 'Tour di un giorno', 'رحلة يوم واحد'],
  'multi-day': ['Multi-day package', 'Paquete de varios días', 'Pacchetto di più giorni', 'باقة متعددة الأيام'],
  'nile-cruise': ['Nile cruise', 'Crucero por el Nilo', 'Crociera sul Nilo', 'رحلة نيلية'],
  shore: ['Shore excursion', 'Excursión en tierra', 'Escursione a terra', 'رحلة شاطئية'],
  car: ['Car hire or transfer', 'Coche o traslado', 'Auto o trasferimento', 'تأجير سيارة أو نقل'],
  custom: ['Custom journey', 'Viaje a medida', 'Viaggio su misura', 'رحلة مخصصة'],
} as const
type Label = keyof typeof labels

function staffRoles(staff: Staff): Array<{ key: string; name: string }> {
  return (staff.roles ?? []).map((entry) => entry.role).filter((role) => role && role.key && role.name)
}
function staffPrimaryRole(staff: Staff): string | null {
  const roles = staffRoles(staff)
  if (!roles.length) return null
  const superAdmin = roles.find((role) => role.key === 'SUPER_ADMIN')
  return (superAdmin ?? roles[0]).name
}
function staffDisplayName(staff: Staff): string {
  const full = [staff.firstName, staff.lastName].filter(Boolean).join(' ').trim()
  if (full) return full
  return staffPrimaryRole(staff) ?? 'Team member'
}
function staffSearchText(staff: Staff): string {
  return `${staffDisplayName(staff)} ${staff.email} ${staffPrimaryRole(staff) ?? ''}`.trim()
}
// Presentation only: turn a raw site path (e.g. "/egypt-tours/nile-cruises")
// into a readable label ("Egypt Tours - Nile Cruises"). Search and storage
// keep using the raw path.
function sourceLabel(raw: string | null, locale: Locale): string {
  if (!raw) return '-'
  const clean = raw.split('?')[0].split('#')[0].trim()
  const parts = clean.split('/').map((part) => part.trim()).filter(Boolean)
  const home = pickLocaleText(locale, { en: 'Homepage', es: 'Inicio', it: 'Homepage', ar: 'الرئيسية' })
  if (!parts.length) return home
  if (parts.length === 1 && parts[0] === 'contact') return pickLocaleText(locale, { en: 'Contact', es: 'Contacto', it: 'Contatti', ar: 'التواصل' })
  const words = (segment: string) => {
    let text = segment
    try { text = decodeURIComponent(text) } catch { /* keep the raw segment */ }
    return text.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/\b\w/g, (ch) => ch.toUpperCase())
  }
  return parts.map(words).filter(Boolean).join(' - ') || home
}
function draftFrom(enquiry: Enquiry): Draft { return { status: enquiry.status, assignedToId: enquiry.assignedTo?.publicId ?? '', internalNotes: enquiry.internalNotes ?? '' } }
async function readResponse<T>(response: Response, fallback: string): Promise<T> {
  const body = await response.json().catch(() => null)
  if (!response.ok || !body) throw new Error(typeof body?.error === 'string' ? body.error : fallback)
  return body as T
}

export function useEnquiryLocale() {
  const [locale, setLocale] = useState<Locale>('en')
  useEffect(() => {
    const sync = () => { const value = localStorage.getItem('star-locale'); setLocale(value === 'es' || value === 'it' || value === 'ar' ? value : 'en') }
    sync(); window.addEventListener('sp-admin-locale', sync); window.addEventListener('storage', sync)
    return () => { window.removeEventListener('sp-admin-locale', sync); window.removeEventListener('storage', sync) }
  }, [])
  return locale
}

export function WebsiteEnquiries({ onDirtyChange, onSavingChange, navigationGuard }: { onDirtyChange: (dirty: boolean) => void; onSavingChange: (saving: boolean) => void; navigationGuard: { current: ((action: () => void) => void) | null } }) {
  const router = useRouter()
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null)
  const pendingNavigationRef = useRef(false)
  const locale = useEnquiryLocale()
  const t = useCallback((key: Label) => {
    const [en, es, it, ar] = labels[key]
    return pickLocaleText(locale, { en, es, it, ar })
  }, [locale])
  const { user } = useCurrentUser()
  const canManage = !!user && (user.roles.includes('SUPER_ADMIN') || user.permissions?.includes('enquiries.manage'))
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [rows, setRows] = useState<Enquiry[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState('')
  const [listVersion, setListVersion] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [detail, setDetail] = useState<Enquiry | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [detailVersion, setDetailVersion] = useState(0)
  const [staff, setStaff] = useState<Staff[]>([])
  const [staffLoading, setStaffLoading] = useState(false)
  const [staffError, setStaffError] = useState('')
  const [staffVersion, setStaffVersion] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)
  const savingRef = useRef(false)
  const baseline = detail ? draftFrom(detail) : null
  const dirty = !!baseline && !!draft && (draft.status !== baseline.status || draft.assignedToId !== baseline.assignedToId || draft.internalNotes !== baseline.internalNotes)
  const requestNavigation = useCallback((action: () => void) => {
    if (savingRef.current) return
    if (dirty) {
      if (pendingNavigationRef.current) return
      pendingNavigationRef.current = true
      setPendingNavigation(() => action)
    }
    else action()
  }, [dirty])
  const dirtyRef = useRef(dirty)
  dirtyRef.current = dirty
  const requestNavigationRef = useRef(requestNavigation)
  requestNavigationRef.current = requestNavigation
  useEffect(() => protectEnquiryNavigation(window, () => dirtyRef.current, (action) => requestNavigationRef.current(action)), [])
  useEffect(() => { navigationGuard.current = requestNavigation; return () => { navigationGuard.current = null } }, [navigationGuard, requestNavigation])
  useEffect(() => {
    if (!saved) return
    const timer = setTimeout(() => setSaved(false), 4000)
    return () => clearTimeout(timer)
  }, [saved])
  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])
  useEffect(() => { onDirtyChange(dirty); return () => onDirtyChange(false) }, [dirty, onDirtyChange])
  useEffect(() => { onSavingChange(saving); return () => onSavingChange(false) }, [saving, onSavingChange])
  useEffect(() => {
    if (!dirty) return
    const navigate = (event: MouseEvent) => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return
      const link = event.target instanceof Element ? event.target.closest('a[href]') : null
      if (!link || link.getAttribute('target') === '_blank' || link.hasAttribute('download')) return
      const url = new URL(link.getAttribute('href')!, window.location.href)
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return
      if (url.href === window.location.href || (url.pathname === window.location.pathname && url.search === window.location.search && url.hash)) return
      event.preventDefault(); event.stopPropagation()
      requestNavigation(() => {
        if (url.origin === window.location.origin) router.push(url.pathname + url.search + url.hash)
        else window.location.assign(url.href)
      })
    }
    document.addEventListener('click', navigate, true)
    return () => document.removeEventListener('click', navigate, true)
  }, [dirty, requestNavigation, router])
  useEffect(() => { setSelected(new URLSearchParams(window.location.search).get('enquiry')) }, [])
  useEffect(() => {
    const controller = new AbortController()
    setListLoading(true); setListError('')
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ page: String(page), limit: '15' })
        if (query.trim()) params.set('q', query.trim())
        if (filter) params.set('status', filter)
        const response = await fetch(`/api/admin/enquiries?${params}`, { signal: controller.signal })
        const data = await readResponse<{ enquiries: Enquiry[]; pagination: { total: number; totalPages: number } }>(response, t('error'))
        if (!Array.isArray(data.enquiries) || !data.pagination) throw new Error(t('error'))
        if (controller.signal.aborted) return
        setRows(data.enquiries); setTotal(data.pagination.total); setPages(Math.max(1, data.pagination.totalPages))
        if (page > Math.max(1, data.pagination.totalPages)) setPage(Math.max(1, data.pagination.totalPages))
      } catch (error) {
        if (!controller.signal.aborted) setListError(error instanceof Error ? error.message : t('error'))
      } finally { if (!controller.signal.aborted) setListLoading(false) }
    }, 250)
    return () => { clearTimeout(timer); controller.abort() }
  }, [query, filter, page, listVersion, t])
  useEffect(() => {
    if (!selected) { setDetail(null); setDraft(null); return }
    const controller = new AbortController()
    setDetail(null); setDraft(null); setDetailLoading(true); setDetailError(''); setSaveError(''); setSaved(false); setCopied(false)
    void (async () => {
      try {
        const response = await fetch(`/api/admin/enquiries/${encodeURIComponent(selected)}`, { signal: controller.signal })
        const data = await readResponse<{ enquiry: Enquiry }>(response, t('error'))
        if (!data.enquiry || data.enquiry.publicId !== selected) throw new Error(t('error'))
        if (!controller.signal.aborted) { setDetail(data.enquiry); setDraft(draftFrom(data.enquiry)) }
      } catch (error) {
        if (!controller.signal.aborted) setDetailError(error instanceof Error ? error.message : t('error'))
      } finally { if (!controller.signal.aborted) setDetailLoading(false) }
    })()
    return () => controller.abort()
  }, [selected, detailVersion]) // Locale changes must never discard an unsaved draft.
  useEffect(() => {
    if (!canManage) return
    const controller = new AbortController()
    setStaffLoading(true); setStaffError('')
    void (async () => {
      try {
        const data = await readResponse<{ staff: Staff[] }>(await fetch('/api/admin/enquiries/staff', { signal: controller.signal }), t('staffError'))
        if (!Array.isArray(data.staff)) throw new Error(t('staffError'))
        if (!controller.signal.aborted) setStaff(data.staff)
      } catch { if (!controller.signal.aborted) setStaffError(t('staffError')) }
      finally { if (!controller.signal.aborted) setStaffLoading(false) }
    })()
    return () => controller.abort()
  }, [canManage, staffVersion, t])
  const choose = (id: string | null) => {
    if (id === selected) return
    requestNavigation(() => {
      setSelected(id)
      const url = new URL(window.location.href)
      url.searchParams.set('view', 'enquiries')
      if (id) url.searchParams.set('enquiry', id); else url.searchParams.delete('enquiry')
      window.history.replaceState(window.history.state, '', url)
    })
  }
  const refreshAll = () => {
    requestNavigation(() => { setListVersion((version) => version + 1); if (selected) setDetailVersion((version) => version + 1) })
  }
  const change = (patch: Partial<Draft>) => { setDraft((previous) => previous ? { ...previous, ...patch } : previous); setSaved(false); setSaveError('') }
  const save = async () => {
    if (!detail || !draft || !dirty || !canManage || savingRef.current) return
    savingRef.current = true; onSavingChange(true); setSaving(true); setSaveError(''); setSaved(false)
    try {
      const updates = {
        status: draft.status,
        internalNotes: draft.internalNotes,
        ...(draft.assignedToId !== (detail.assignedTo?.publicId ?? '') ? { assignedToId: draft.assignedToId || null } : {}),
        expectedUpdatedAt: detail.updatedAt,
      }
      const response = await fetch(`/api/admin/enquiries/${encodeURIComponent(detail.publicId)}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(updates) })
      const data = await readResponse<{ enquiry: Enquiry }>(response, t('saveError'))
      if (!data.enquiry || data.enquiry.publicId !== detail.publicId) throw new Error(t('saveError'))
      setDetail(data.enquiry); setDraft(draftFrom(data.enquiry)); setSaved(true); setListVersion((version) => version + 1)
    } catch (error) { setSaveError(error instanceof Error ? error.message : t('saveError')) }
    finally { savingRef.current = false; onSavingChange(false); setSaving(false) }
  }
  const copyReference = async () => {
    if (!detail) return
    const value = detail.publicId
    const legacyCopy = () => {
      const area = document.createElement('textarea')
      area.value = value; area.setAttribute('readonly', ''); area.style.position = 'absolute'; area.style.opacity = '0'
      document.body.appendChild(area); area.select()
      const ok = document.execCommand('copy'); document.body.removeChild(area)
      if (!ok) throw new Error('copy failed')
    }
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(value)
      else legacyCopy()
      setCopied(true)
    } catch {
      try { legacyCopy(); setCopied(true) } catch { setCopied(false) }
    }
  }
  const subject = (value: string) => value in labels ? t(value as Label) : value
  const date = (value: string) => new Date(value).toLocaleString(locale === 'ar' ? 'ar-EG' : locale, { dateStyle: 'medium', timeStyle: 'short' })
  const assignees = [...staff]
  if (detail?.assignedTo && !assignees.some((item) => item.publicId === detail.assignedTo?.publicId)) assignees.unshift(detail.assignedTo)
  const footerStatus = saving ? t('saving') : saved ? t('saved') : dirty ? t('dirty') : !canManage && detail ? t('readonly') : ''
  return <section className="sp-enquiries" dir={locale === 'ar' ? 'rtl' : 'ltr'} aria-label={t('title')}>
    <header className="sp-enquiries-heading"><div><h2>{t('title')}</h2><p>{t('intro')}</p></div><button className="sp-btn" type="button" onClick={refreshAll} disabled={listLoading || saving || detailLoading}><RefreshCw size={15} />{t('reload')}</button></header>
    <div className={`sp-enquiries-panels${selected ? ' has-selection' : ''}`}>
      <aside className="sp-enquiries-list" aria-label={t('title')}>
        <div className="sp-enquiries-tools">
          <label className="sp-conv-search"><Search size={16} /><input aria-label={t('search')} placeholder={t('search')} value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} /></label>
          <SharedSelect value={filter} onChange={(value) => { setFilter(value); setPage(1) }} label={t('filter')} locale={locale} options={[{ value: '', label: t('all') }, ...statuses.map((status) => ({ value: status, label: t(status) }))]} placeholder={t('all')} popupWidth="trigger" />
          <small aria-live="polite">{total} {t('results')}</small>
        </div>
        {listLoading ? <p className="sp-enquiries-state" role="status">{t('loading')}</p> : listError ? <div className="sp-enquiries-state" role="alert"><p>{listError}</p><button className="sp-btn" type="button" onClick={refreshAll}>{t('retry')}</button></div> : <div className="sp-enquiry-rows">{rows.length ? rows.map((row) => <button key={row.publicId} type="button" className={`sp-enquiry-row${row.publicId === selected ? ' active' : ''}`} aria-pressed={row.publicId === selected} onClick={() => choose(row.publicId)} disabled={saving}>
          <strong>{row.name}</strong><span className="sp-enquiry-email" dir="ltr">{row.email}</span><span>{subject(row.subject)}</span><span className="sp-enquiry-row-meta"><span className={`sp-pill is-${row.status.toLowerCase()}`}>{t(row.status)}</span><time dateTime={row.createdAt}>{new Date(row.createdAt).toLocaleDateString(locale)}</time></span>
        </button>) : <AdminEmpty title={t('empty')} copy={t('emptyCopy')} />}</div>}
        <nav className="sp-enquiries-pagination" aria-label={t('page')}><button className="sp-icon-btn" type="button" aria-label={t('previous')} disabled={page <= 1 || listLoading} onClick={() => setPage((value) => value - 1)}><ChevronLeft size={16} /></button><span>{t('page')} {page} {t('of')} {pages}</span><button className="sp-icon-btn" type="button" aria-label={t('next')} disabled={page >= pages || listLoading} onClick={() => setPage((value) => value + 1)}><ChevronRight size={16} /></button></nav>
      </aside>
      <article className="sp-enquiry-detail" aria-busy={detailLoading}>
        {selected && <div className="sp-enquiry-detail-tools"><button className="sp-btn sp-enquiry-back" type="button" onClick={() => choose(null)} disabled={saving}><ArrowLeft size={16} />{t('back')}</button></div>}
        {!selected ? <AdminEmpty title={t('select')} copy={t('selectCopy')} /> : detailLoading ? <p role="status">{t('loadingDetail')}</p> : detailError ? <div className="sp-enquiries-state" role="alert"><p>{detailError}</p><button className="sp-btn" type="button" onClick={() => setDetailVersion((version) => version + 1)}>{t('retry')}</button></div> : detail && draft ? <>
          <section className="sp-enquiry-traveller" aria-label={t('travellerDetails')}>
            <p className="sp-enquiry-eyebrow">{t('travellerDetails')}</p>
            <header className="sp-enquiry-customer"><h2>{detail.name}</h2><span className={`sp-pill is-${detail.status.toLowerCase()}`}>{t(detail.status)}</span></header>
            <p className="sp-enquiry-contact"><a href={`mailto:${detail.email}`} dir="ltr">{detail.email}</a>{detail.phone && <span dir="ltr">{detail.phone}</span>}</p>
            <dl className="sp-enquiry-meta">
              <div className="sp-enquiry-ref"><dt>{t('reference')}</dt><dd><span className="sp-enquiry-ref-value" dir="ltr">{detail.publicId}</span><button className="sp-icon-btn sp-enquiry-copy" type="button" onClick={() => void copyReference()} aria-label={t('copy')} title={t('copy')}><Copy size={14} />{copied && <span className="sp-enquiry-copied" role="status"><Check size={12} />{t('copied')}</span>}</button></dd></div>
              <div><dt>{t('subject')}</dt><dd>{subject(detail.subject)}</dd></div>
              <div><dt>{t('source')}</dt><dd>{sourceLabel(detail.sourcePage, locale)}</dd></div>
              <div><dt>{t('submitted')}</dt><dd><time dateTime={detail.createdAt}>{date(detail.createdAt)}</time></dd></div>
            </dl>
            <div className="sp-enquiry-message"><h3>{t('message')}</h3><p dir="auto">{detail.message}</p></div>
          </section>
          <form className="sp-enquiry-workflow" onSubmit={(event) => { event.preventDefault(); void save() }}>
            <p className="sp-enquiry-eyebrow">{t('teamActions')}</p>
            <div className="sp-enquiry-fields"><label><span>{t('status')}</span><SharedSelect value={draft.status} onChange={(value) => change({ status: value as Status })} options={statuses.map((status) => ({ value: status, label: t(status) }))} locale={locale} label={t('status')} disabled={!canManage || saving} popupWidth="trigger" /></label>
              <div className="sp-enquiry-assignment"><label><span>{t('assigned')}</span><SharedSelect value={draft.assignedToId} onChange={(value) => change({ assignedToId: value })} options={[{ value: '', label: t('unassigned'), text: t('unassigned') }, ...assignees.map((item) => {                const name = staffDisplayName(item)
                const role = staffPrimaryRole(item)
                return { value: item.publicId, text: staffSearchText(item), label: (<span className="sp-staff-option"><strong className="sp-staff-option-name">{name}</strong><span className="sp-staff-option-meta" dir="ltr">{item.email}{role ? ` · ${role}` : ''}</span></span>) }
              })]} placeholder={t('assigneeHint')} locale={locale} label={t('assigned')} disabled={!canManage || saving || staffLoading || !!staffError} popupWidth="trigger" /></label>
                {draft.assignedToId && canManage && <button className="sp-enquiry-unassign" type="button" disabled={saving} onClick={() => change({ assignedToId: '' })}>{t('unassign')}</button>}</div>
            </div>
            {canManage && staffLoading && <p role="status">{t('staffLoading')}</p>}
            {canManage && staffError && <div role="alert"><p>{staffError}</p><button className="sp-btn" type="button" onClick={() => setStaffVersion((version) => version + 1)}>{t('retry')}</button></div>}
            {canManage && !staffLoading && !staffError && !staff.length && !detail.assignedTo && <p>{t('noStaff')}</p>}
            <label className="sp-enquiry-notes"><span>{t('notes')}</span><textarea dir="auto" value={draft.internalNotes} onChange={(event) => change({ internalNotes: event.target.value })} disabled={!canManage || saving} maxLength={10000} rows={4} aria-label={t('notes')} /></label>
            <p className="sp-enquiry-private">{t('private')}</p>
            <div className="sp-enquiry-save"><span className={dirty && !saving ? 'sp-enquiry-dirty' : saved && !saving ? 'sp-enquiry-saved' : undefined} role="status" aria-live="polite">{dirty && !saving && <i aria-hidden="true" />}{footerStatus}</span>{canManage && <button className="sp-btn primary" type="submit" disabled={!dirty || saving}><Save size={16} />{saving ? t('saving') : t('save')}</button>}</div>
            {saveError && <p className="sp-enquiry-error" role="alert">{saveError}</p>}
          </form>
        </> : null}
      </article>
    </div>
    <AdminConfirmDialog open={!!pendingNavigation} title={t('discard')} description={t('dirty')} confirmLabel={t('discardAction')} cancelLabel={t('keepEditing')} onClose={() => { pendingNavigationRef.current = false; setPendingNavigation(null) }} onConfirm={() => { const action = pendingNavigation; pendingNavigationRef.current = false; dirtyRef.current = false; if (baseline) setDraft(baseline); setPendingNavigation(null); action?.() }} />
  </section>
}
