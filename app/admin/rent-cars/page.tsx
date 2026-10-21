'use client'

// Rent Cars operations (Stages 2-4): chauffeur locations, directional
// routes, and vehicle/route pricing. This module never holds prices on the
// client: every mutation is server-validated and the request endpoints
// enforce RBAC. Collection state lives here so the header stats and every
// tab share one source of truth per resource.

import { useMemo, useState } from 'react'
import { CircleDollarSign, MapPin, Pencil, Plus, Route as RouteIcon, Trash2 } from 'lucide-react'
import { PageHead } from '@/components/admin/admin-shell'
import { AdminEmpty, AdminIconAction, AdminStats, AdminTableActions, AdminTableTools, AdminTableWrap, AdminText, Card, StatusPill } from '@/components/admin/admin-ui'
import { SortableTh, useAdminTableSort } from '@/components/admin/admin-table-sort'
import { useAdminLocale } from '@/components/admin/admin-locale'
import { AdminPagination, usePagination } from '@/components/admin/admin-pagination'
import { SharedSelect } from '@/components/shared-select'
import { useDbCarsStatus } from '@/lib/events-cars-client'
import { AdminConfirmDialog } from '@/components/admin/admin-confirm-dialog'
import { toast } from '@/components/admin/admin-toaster'
import { formatQuoteAmount } from '@/lib/car-request'

type LocationRow = {
  id: string
  slug: string
  nameEn: string
  nameEs: string | null
  nameIt: string | null
  nameAr: string | null
  kind: string
  isActive: boolean
  sortOrder: number
}

type RouteRow = {
  id: string
  originSlug: string
  destinationSlug: string
  isActive: boolean
  sortOrder: number
  origin: { slug: string; nameEn: string }
  destination: { slug: string; nameEn: string }
}

type PriceRow = {
  id: string
  routeId: string
  carSlug: string
  currency: string
  oneWayCents: number
  roundTripMode: 'AUTOMATIC' | 'MANUAL'
  roundTripCents: number | null
  roundTripMultiplierBp: number
  isActive: boolean
}

type CarRow = { slug: string; title: string; isPublished?: boolean; seats: string }

const centsText = (cents: number) => (cents / 100).toFixed(2)
const multiplierText = (bp: number) => (bp / 100).toFixed(2)

async function staffRequest<T>(url: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  })
  const data = (await res.json().catch(() => ({} as { error?: string }))) as T & { error?: string }
  if (!res.ok) throw new Error(data.error || 'Request failed.')
  return data
}

function useList<T>(url: string, pick: (payload: { locations?: T[]; routes?: T[]; prices?: T[] }) => T[]) {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const refresh = () => {
    setLoading(true)
    setError('')
    staffRequest<{ locations?: T[]; routes?: T[]; prices?: T[] }>(url, 'GET')
      .then((payload) => {
        setData(pick(payload))
        setLoading(false)
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Request failed.')
        setLoading(false)
      })
  }
  // Simple load-on-mount list; tabs re-render when their dialog/confirm flows
  // call refresh() after a successful mutation.
  useMemo(() => refresh(), [])
  return { data, loading, error, refresh }
}

type Tab = 'locations' | 'routes' | 'prices'

const KIND_OPTIONS = ['AIRPORT', 'HOTEL', 'CITY', 'CUSTOM'] as const
const CURRENCY_OPTIONS = ['USD', 'EUR', 'EGP'] as const

export default function RentCarsOpsPage() {
  const ar = useAdminLocale() === 'ar'
  const [tab, setTab] = useState<Tab>('locations')
  const cars = useDbCarsStatus()
  const vehicles = (cars.data ?? []) as CarRow[]
  const locations = useList<LocationRow>('/api/admin/rent-car/locations', (payload) => payload.locations ?? [])
  const routes = useList<RouteRow>('/api/admin/rent-car/routes', (payload) => payload.routes ?? [])
  const prices = useList<PriceRow>('/api/admin/rent-car/prices', (payload) => payload.prices ?? [])

  const tabs: { key: Tab; en: string; ar: string }[] = [
    { key: 'locations', en: 'Locations', ar: 'المواقع' },
    { key: 'routes', en: 'Routes', ar: 'الخطوط' },
    { key: 'prices', en: 'Pricing', ar: 'الأسعار' },
  ]

  return <>
    <PageHead
      eyebrow="Fleet"
      title="Rent Cars Routes & Prices"
      titleAr="خطوط وأسعار التأجير"
      sub="Chauffeur locations, directional routes, and per-vehicle transfer pricing"
      subAr="مواقع النقل، والخطوط الاتجاهية، وأسعار كل مركبة"
    />
    <AdminStats items={[
      { label: <AdminText en="Locations" ar="المواقع" />, value: locations.data.filter((row) => row.isActive).length, note: <AdminText en="Active pick-up points" ar="نقاط استلام نشطة" />, icon: MapPin },
      { label: <AdminText en="Routes" ar="الخطوط" />, value: routes.data.filter((row) => row.isActive).length, note: <AdminText en="Directional pairs (A→B, B→A)" ar="أزواج اتجاهية (أ→ب، ب→أ)" />, icon: RouteIcon },
      { label: <AdminText en="Priced routes" ar="أسعار مسجّلة" />, value: prices.data.filter((row) => row.isActive).length, note: <AdminText en="Active route × vehicle entries" ar="سجلات خط × مركبة نشطة" />, icon: CircleDollarSign },
      { label: <AdminText en="Fleet vehicles" ar="مركبات الأسطول" />, value: vehicles.length, note: <AdminText en="Available for pricing" ar="متاحة للأسعار" />, icon: CircleDollarSign, tone: 'violet' },
    ]} />
    <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
      {tabs.map((item) => (
        <button key={item.key} type="button" className={`sp-btn${tab === item.key ? ' primary' : ''}`} onClick={() => setTab(item.key)}>
          <AdminText en={item.en} ar={item.ar} />
        </button>
      ))}
    </div>
    {tab === 'locations' && <LocationsTab ar={ar} list={locations} />}
    {tab === 'routes' && <RoutesTab ar={ar} list={routes} locations={locations} />}
    {tab === 'prices' && <PricesTab ar={ar} list={prices} routes={routes} vehicles={vehicles} />}
  </>
}

type ListState<T> = { data: T[]; loading: boolean; error: string; refresh: () => void }

function LocationsTab({ ar, list }: { ar: boolean; list: ListState<LocationRow> }) {
  const [query, setQuery] = useState('')
  const [dialog, setDialog] = useState<{ mode: 'create' | 'edit'; row?: LocationRow } | null>(null)
  const [removeTarget, setRemoveTarget] = useState<LocationRow | null>(null)

  const rows = useMemo(() => list.data
    .filter((row) => `${row.nameEn} ${row.slug} ${row.kind}`.toLowerCase().includes(query.trim().toLowerCase())), [list.data, query])
  const sort = useAdminTableSort(rows, {
    name: (row) => row.nameEn,
    type: (row) => row.kind,
    sort: (row) => row.sortOrder,
    status: (row) => (row.isActive ? 'active' : 'hidden'),
  }, 'sort', 'asc')
  const paging = usePagination(sort.sortedRows)

  return <Card
    title={<AdminText en="Locations" ar="المواقع" />}
    sub={<AdminText en={`${rows.length} of ${list.data.length} locations shown`} ar={`عرض ${rows.length} من ${list.data.length} موقع`} />}
    action={<button type="button" className="sp-btn primary" onClick={() => setDialog({ mode: 'create' })}><Plus size={16} /> <AdminText en="New location" ar="موقع جديد" /></button>}
  >
    <AdminTableTools query={query} onQueryChange={setQuery} placeholder={ar ? 'ابحث بالموقع أو المعرف…' : 'Search by name or slug…'} />
    {list.loading ? <AdminEmpty title={<AdminText en="Loading locations…" ar="جارٍ تحميل المواقع…" />} />
      : list.error ? <><AdminEmpty title={<AdminText en="Could not load locations" ar="تعذر تحميل المواقع" />} copy={<AdminText en={list.error} ar={list.error} />} /><div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}><button type="button" className="sp-btn" onClick={list.refresh}><AdminText en="Retry" ar="إعادة المحاولة" /></button></div></>
        : rows.length ? <AdminTableWrap><table className="sp-table">
          <thead><tr>
            <th className="sp-row-number">#</th>
            <SortableTh label={<AdminText en="Name" ar="الاسم" />} column="name" {...sort} onSort={sort.sortBy} />
            <SortableTh label={<AdminText en="Type" ar="النوع" />} column="type" {...sort} onSort={sort.sortBy} />
            <th><AdminText en="Slug" ar="المعرف" /></th>
            <SortableTh label={<AdminText en="Sort" ar="الترتيب" />} column="sort" {...sort} onSort={sort.sortBy} />
            <SortableTh label={<AdminText en="Status" ar="الحالة" />} column="status" {...sort} onSort={sort.sortBy} />
            <th></th>
          </tr></thead>
          <tbody>{paging.pageRows.map((row, index) => <tr key={row.id}>
            <td className="sp-row-number">{paging.from + index}</td>
            <td><strong>{row.nameEn}</strong><small style={{ display: 'block', color: 'var(--muted)' }}>{[row.nameEs, row.nameIt, row.nameAr].filter(Boolean).join(' · ')}</small></td>
            <td>{row.kind}</td>
            <td><code dir="ltr">{row.slug}</code></td>
            <td>{row.sortOrder}</td>
            <td><StatusPill status={row.isActive ? 'active' : 'hidden'} /></td>
            <td><AdminTableActions>
              <AdminIconAction icon={Pencil} label={ar ? `تعديل ${row.nameEn}` : `Edit ${row.nameEn}`} onClick={() => setDialog({ mode: 'edit', row })} />
              <AdminIconAction icon={Trash2} label={ar ? `حذف ${row.nameEn}` : `Delete ${row.nameEn}`} tone="danger" onClick={() => setRemoveTarget(row)} />
            </AdminTableActions></td>
          </tr>)}</tbody>
        </table></AdminTableWrap>
          : <AdminEmpty title={<AdminText en="No locations yet" ar="لا مواقع بعد" />} copy={<AdminText en="Create the first pick-up point, e.g. the airport." ar="أضف أول نقطة استلام، مثل المطار." />} />}
    {rows.length > 0 && <AdminPagination page={paging.page} pageCount={paging.pageCount} onPage={paging.setPage} pageSize={paging.pageSize} onPageSize={paging.setPageSize} from={paging.from} to={paging.to} total={paging.total} />}
    {dialog && <LocationDialog mode={dialog.mode} row={dialog.row} onClose={() => setDialog(null)} onSaved={() => { setDialog(null); list.refresh() }} />}
    <AdminConfirmDialog
      open={removeTarget !== null}
      onClose={() => setRemoveTarget(null)}
      onConfirm={() => {
        if (!removeTarget) return
        staffRequest(`/api/admin/rent-car/locations/${encodeURIComponent(removeTarget.slug)}`, 'DELETE')
          .then(() => {
            toast.success(ar ? `تم حذف "${removeTarget.nameEn}".` : `"${removeTarget.nameEn}" deleted.`, { dedupeKey: 'rentcar-location-delete' })
            setRemoveTarget(null)
            list.refresh()
          })
          .catch((err: unknown) => toast.error(err instanceof Error ? err.message : 'Delete failed.', { dedupeKey: 'rentcar-location-delete-error' }))
      }}
      title={<AdminText en="Delete location" ar="حذف الموقع" />}
      description={<AdminText en={`Remove "${removeTarget?.nameEn ?? ''}"? Locations referenced by routes cannot be deleted.`} ar={`حذف "${removeTarget?.nameEn ?? ''}"؟ المواقع المرتبطة بخطوط لا يمكن حذفها.`} />}
      confirmLabel={<AdminText en="Delete" ar="حذف" />}
      tone="danger"
    />
  </Card>
}

function LocationDialog({ mode, row, onClose, onSaved }: { mode: 'create' | 'edit'; row?: LocationRow; onClose: () => void; onSaved: () => void }) {
  const ar = useAdminLocale() === 'ar'
  const [slug, setSlug] = useState(row?.slug ?? '')
  const [names, setNames] = useState({ en: row?.nameEn ?? '', es: row?.nameEs ?? '', it: row?.nameIt ?? '', ar: row?.nameAr ?? '' })
  const [kind, setKind] = useState(row?.kind ?? 'CITY')
  const [isActive, setIsActive] = useState(row?.isActive ?? true)
  const [sortOrder, setSortOrder] = useState(String(row?.sortOrder ?? 999))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const save = () => {
    setBusy(true)
    setError('')
    const payload = mode === 'create'
      ? { slug, nameEn: names.en, nameEs: names.es || null, nameIt: names.it || null, nameAr: names.ar || null, kind, isActive, sortOrder: Number(sortOrder) || 0 }
      : { nameEn: names.en, nameEs: names.es || null, nameIt: names.it || null, nameAr: names.ar || null, kind, isActive, sortOrder: Number(sortOrder) || 0 }
    staffRequest<{ location: unknown }>(mode === 'create' ? '/api/admin/rent-car/locations' : `/api/admin/rent-car/locations/${encodeURIComponent(row?.slug ?? '')}`, mode === 'create' ? 'POST' : 'PATCH', payload)
      .then(() => {
        toast.success(ar
          ? (mode === 'create' ? 'تم إنشاء الموقع.' : 'تم حفظ تعديلات الموقع.')
          : (mode === 'create' ? 'Location created.' : 'Location updated.'), { dedupeKey: 'rentcar-location-save' })
        onSaved()
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Save failed.')
        setBusy(false)
      })
  }

  return <AdminConfirmDialog
    open
    onClose={onClose}
    onConfirm={save}
    title={<AdminText en={mode === 'create' ? 'New location' : `Edit ${row?.nameEn}`} ar={mode === 'create' ? 'موقع جديد' : `تعديل ${row?.nameEn}`} />}
    confirmLabel={<AdminText en={mode === 'create' ? 'Create location' : 'Save changes'} ar={mode === 'create' ? 'إنشاء' : 'حفظ التعديلات'} />}
    canConfirm={!busy && names.en.trim() !== '' && (mode === 'edit' || slug.trim() !== '')}
    description={error !== '' ? <span role="alert" style={{ color: 'var(--danger, #b3261e)' }}>{error}</span> : undefined}
  >
    <div className="sp-form">
      {mode === 'create' && <label><AdminText en="Slug (immutable once created)" ar="المعرف (لا يتغير بعد الإنشاء)" />
        <input dir="ltr" value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))} placeholder="cairo-airport" />
      </label>}
      <label><AdminText en="Name (English, required)" ar="الاسم (إنجليزي، مطلوب)" />
        <input value={names.en} onChange={(e) => setNames({ ...names, en: e.target.value })} maxLength={120} />
      </label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <label><AdminText en="Name (Español)" ar="الاسم (إسباني)" /><input value={names.es} onChange={(e) => setNames({ ...names, es: e.target.value })} maxLength={120} /></label>
        <label><AdminText en="Name (Italiano)" ar="الاسم (إيطالي)" /><input value={names.it} onChange={(e) => setNames({ ...names, it: e.target.value })} maxLength={120} /></label>
        <label dir="rtl"><AdminText en="Name (العربية)" ar="الاسم (العربية)" /><input value={names.ar} onChange={(e) => setNames({ ...names, ar: e.target.value })} maxLength={120} /></label>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8 }}>
        <label><AdminText en="Type" ar="النوع" />
          <SharedSelect value={kind} onChange={setKind} locale={ar ? 'ar' : 'en'} options={KIND_OPTIONS.map((value) => ({ value, label: { AIRPORT: ar ? 'مطار' : 'Airport', HOTEL: ar ? 'فندق' : 'Hotel', CITY: ar ? 'مدينة' : 'City', CUSTOM: ar ? 'مخصص' : 'Custom' }[value] }))} />
        </label>
        <label><AdminText en="Sort order" ar="الترتيب" /><input type="number" min={0} max={100000} value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} /></label>
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
        <AdminText en="Active (visible on the public request form)" ar="نشط (يظهر في نموذج الطلب العام)" />
      </label>
    </div>
  </AdminConfirmDialog>
}

function RoutesTab({ ar, list, locations }: { ar: boolean; list: ListState<RouteRow>; locations: ListState<LocationRow> }) {
  const [query, setQuery] = useState('')
  const [dialog, setDialog] = useState<{ mode: 'create' | 'edit'; row?: RouteRow } | null>(null)
  const [removeTarget, setRemoveTarget] = useState<RouteRow | null>(null)
  const locationName = (slug: string) => locations.data.find((row) => row.slug === slug)?.nameEn ?? slug

  const rows = useMemo(() => list.data.filter((row) => `${row.originSlug} ${row.destinationSlug} ${locationName(row.originSlug)} ${locationName(row.destinationSlug)}`.toLowerCase().includes(query.trim().toLowerCase())), [list.data, query, locations.data])
  const sort = useAdminTableSort(rows, {
    origin: (row) => locationName(row.originSlug),
    destination: (row) => locationName(row.destinationSlug),
    sort: (row) => row.sortOrder,
    status: (row) => (row.isActive ? 'active' : 'hidden'),
  }, 'origin', 'asc')
  const paging = usePagination(sort.sortedRows)

  return <Card
    title={<AdminText en="Routes" ar="الخطوط" />}
    sub={<AdminText en="A→B and B→A are priced separately" ar="أ→ب وب→أ يُسعّران بشكل منفصل" />}
    action={<button type="button" className="sp-btn primary" disabled={locations.data.length < 2} onClick={() => setDialog({ mode: 'create' })}><Plus size={16} /> <AdminText en="New route" ar="خط جديد" /></button>}
  >
    <AdminTableTools query={query} onQueryChange={setQuery} placeholder={ar ? 'ابحث بالخط…' : 'Search routes…'} />
    {list.loading || locations.loading ? <AdminEmpty title={<AdminText en="Loading routes…" ar="جارٍ تحميل الخطوط…" />} />
      : list.error || locations.error ? <><AdminEmpty title={<AdminText en="Could not load routes" ar="تعذر تحميل الخطوط" />} copy={<AdminText en={list.error || locations.error} ar={list.error || locations.error} />} /><div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}><button type="button" className="sp-btn" onClick={list.refresh}><AdminText en="Retry" ar="إعادة المحاولة" /></button></div></>
        : rows.length ? <AdminTableWrap><table className="sp-table">
          <thead><tr>
            <th className="sp-row-number">#</th>
            <SortableTh label={<AdminText en="Origin" ar="الانطلاق" />} column="origin" {...sort} onSort={sort.sortBy} />
            <SortableTh label={<AdminText en="Destination" ar="الوصول" />} column="destination" {...sort} onSort={sort.sortBy} />
            <SortableTh label={<AdminText en="Sort" ar="الترتيب" />} column="sort" {...sort} onSort={sort.sortBy} />
            <SortableTh label={<AdminText en="Status" ar="الحالة" />} column="status" {...sort} onSort={sort.sortBy} />
            <th></th>
          </tr></thead>
          <tbody>{paging.pageRows.map((row, index) => <tr key={row.id}>
            <td className="sp-row-number">{paging.from + index}</td>
            <td><MapPin size={13} style={{ display: 'inline', verticalAlign: '-2px', marginInlineEnd: 4 }} />{locationName(row.originSlug)}<small style={{ display: 'block', color: 'var(--muted)' }}><code dir="ltr">{row.originSlug}</code></small></td>
            <td>{locationName(row.destinationSlug)}<small style={{ display: 'block', color: 'var(--muted)' }}><code dir="ltr">{row.destinationSlug}</code></small></td>
            <td>{row.sortOrder}</td>
            <td><StatusPill status={row.isActive ? 'active' : 'hidden'} /></td>
            <td><AdminTableActions>
              <AdminIconAction icon={Pencil} label={ar ? 'تعديل' : 'Edit'} onClick={() => setDialog({ mode: 'edit', row })} />
              <AdminIconAction icon={Trash2} label={ar ? 'حذف' : 'Delete'} tone="danger" onClick={() => setRemoveTarget(row)} />
            </AdminTableActions></td>
          </tr>)}</tbody>
        </table></AdminTableWrap>
          : <AdminEmpty title={<AdminText en="No routes yet" ar="لا خطوط بعد" />} copy={<AdminText en="Create a directional pair, e.g. Airport → Giza hotels." ar="أنشئ زوجًا اتجاهيًا، مثل المطار → فنادق الجيزة." />} />}
    {rows.length > 0 && <AdminPagination page={paging.page} pageCount={paging.pageCount} onPage={paging.setPage} pageSize={paging.pageSize} onPageSize={paging.setPageSize} from={paging.from} to={paging.to} total={paging.total} />}
    {dialog && <RouteDialog mode={dialog.mode} row={dialog.row} locations={locations.data} onClose={() => setDialog(null)} onSaved={() => { setDialog(null); list.refresh() }} />}
    <AdminConfirmDialog
      open={removeTarget !== null}
      onClose={() => setRemoveTarget(null)}
      onConfirm={() => {
        if (!removeTarget) return
        staffRequest(`/api/admin/rent-car/routes/${encodeURIComponent(removeTarget.id)}`, 'DELETE')
          .then(() => {
            toast.success(ar ? 'تم حذف الخط.' : 'Route deleted.', { dedupeKey: 'rentcar-route-delete' })
            setRemoveTarget(null)
            list.refresh()
          })
          .catch((err: unknown) => toast.error(err instanceof Error ? err.message : 'Delete failed.', { dedupeKey: 'rentcar-route-delete-error' }))
      }}
      title={<AdminText en="Delete route" ar="حذف الخط" />}
      description={<AdminText en={`Delete ${removeTarget ? `${removeTarget.originSlug} → ${removeTarget.destinationSlug}` : ''}? Routes with prices must be deactivated instead.`} ar={`حذف ${removeTarget ? `${removeTarget.originSlug} → ${removeTarget.destinationSlug}` : ''}؟ الخطوط ذات الأسعار تُإلغى بدلًا من الحذف.`} />}
      confirmLabel={<AdminText en="Delete" ar="حذف" />}
      tone="danger"
    />
  </Card>
}

function RouteDialog({ mode, row, locations, onClose, onSaved }: { mode: 'create' | 'edit'; row?: RouteRow; locations: LocationRow[]; onClose: () => void; onSaved: () => void }) {
  const ar = useAdminLocale() === 'ar'
  const [origin, setOrigin] = useState(row?.originSlug ?? '')
  const [destination, setDestination] = useState(row?.destinationSlug ?? '')
  const [isActive, setIsActive] = useState(row?.isActive ?? true)
  const [sortOrder, setSortOrder] = useState(String(row?.sortOrder ?? 999))
  const [alsoReverse, setAlsoReverse] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const options = locations.map((item) => ({ value: item.slug, label: item.nameEn }))

  const save = () => {
    setBusy(true)
    setError('')
    const payload = mode === 'create'
      ? { originSlug: origin, destinationSlug: destination, isActive, sortOrder: Number(sortOrder) || 0 }
      : { isActive, sortOrder: Number(sortOrder) || 0 }
    staffRequest<{ route: unknown }>(mode === 'create' ? '/api/admin/rent-car/routes' : `/api/admin/rent-car/routes/${encodeURIComponent(row?.id ?? '')}`, mode === 'create' ? 'POST' : 'PATCH', payload)
      .then(() => {
        if (mode === 'create' && alsoReverse && origin !== destination) {
          return staffRequest('/api/admin/rent-car/routes', 'POST', { originSlug: destination, destinationSlug: origin, isActive, sortOrder: Number(sortOrder) || 0 })
        }
        return undefined
      })
      .then(() => {
        toast.success(ar
          ? (mode === 'create' ? 'تم إنشاء الخط.' : 'تم حفظ تعديلات الخط.')
          : (mode === 'create' ? 'Route created.' : 'Route updated.'), { dedupeKey: 'rentcar-route-save' })
        onSaved()
      })
      .catch((err: unknown) => { setError(err instanceof Error ? err.message : 'Save failed.'); setBusy(false) })
  }

  return <AdminConfirmDialog
    open
    onClose={onClose}
    onConfirm={save}
    title={<AdminText en={mode === 'create' ? 'New route' : `Edit ${row?.originSlug} → ${row?.destinationSlug}` } ar={mode === 'create' ? 'خط جديد' : 'تعديل الخط'} />}
    confirmLabel={<AdminText en={mode === 'create' ? 'Create route' : 'Save changes'} ar={mode === 'create' ? 'إنشاء' : 'حفظ التعديلات'} />}
    canConfirm={!busy && origin !== '' && destination !== '' && (mode === 'edit' || origin !== destination)}
    description={error !== '' ? <span role="alert" style={{ color: 'var(--danger, #b3261e)' }}>{error}</span> : undefined}
  >
    <div className="sp-form">
      {mode === 'create' ? <>
        <label><AdminText en="Origin (pick-up)" ar="الانطلاق" />
          <SharedSelect value={origin} onChange={setOrigin} locale={ar ? 'ar' : 'en'} options={[{ value: '', label: ar ? 'اختر' : 'Select…' }, ...options]} />
        </label>
        <label><AdminText en="Destination (drop-off)" ar="الوصول" />
          <SharedSelect value={destination} onChange={setDestination} locale={ar ? 'ar' : 'en'} options={[{ value: '', label: ar ? 'اختر' : 'Select…' }, ...options]} />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={alsoReverse} onChange={(e) => setAlsoReverse(e.target.checked)} />
          <AdminText en="Also create the reverse direction (B→A)" ar="إنشاء الاتجاه المعاكس أيضًا (ب→أ)" />
        </label>
      </> : <p><AdminText en="The location pair is the route identity and cannot be changed." ar="زوج المواقع هو هوية الخط ولا يمكن تغييره." /></p>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <label><AdminText en="Sort order" ar="الترتيب" /><input type="number" min={0} max={100000} value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} /></label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          <AdminText en="Active" ar="نشط" />
        </label>
      </div>
    </div>
  </AdminConfirmDialog>
}

function PricesTab({ ar, list, routes, vehicles }: { ar: boolean; list: ListState<PriceRow>; routes: ListState<RouteRow>; vehicles: CarRow[] }) {
  const [query, setQuery] = useState('')
  const [dialog, setDialog] = useState<{ mode: 'create' | 'edit'; row?: PriceRow } | null>(null)
  const [removeTarget, setRemoveTarget] = useState<PriceRow | null>(null)
  const routeLabel = (id: string) => {
    const route = routes.data.find((row) => row.id === id)
    return route ? `${route.origin.nameEn} → ${route.destination.nameEn}` : id
  }
  const vehicleLabel = (slug: string) => vehicles.find((car) => car.slug === slug)?.title ?? slug

  const rows = useMemo(() => list.data.filter((row) => `${routeLabel(row.routeId)} ${vehicleLabel(row.carSlug)} ${row.currency}`.toLowerCase().includes(query.trim().toLowerCase())), [list.data, query, routes.data, vehicles])
  const sort = useAdminTableSort(rows, {
    route: (row) => routeLabel(row.routeId),
    vehicle: (row) => vehicleLabel(row.carSlug),
    oneway: (row) => row.oneWayCents,
    round: (row) => (row.roundTripMode === 'MANUAL' ? row.roundTripCents ?? 0 : Math.round(row.oneWayCents * row.roundTripMultiplierBp / 100)),
    status: (row) => (row.isActive ? 'active' : 'hidden'),
  }, 'route', 'asc')
  const paging = usePagination(sort.sortedRows)

  return <Card
    title={<AdminText en="Pricing" ar="الأسعار" />}
    sub={<AdminText en="All amounts are stored as exact integer cents" ar="كل المبالغ محفوظة بالسنت الصحيح" />}
    action={<button type="button" className="sp-btn primary" disabled={routes.data.length < 1 || vehicles.length < 1} onClick={() => setDialog({ mode: 'create' })}><Plus size={16} /> <AdminText en="New price" ar="سعر جديد" /></button>}
  >
    <AdminTableTools query={query} onQueryChange={setQuery} placeholder={ar ? 'ابحث بالخط أو المركبة…' : 'Search by route or vehicle…'} />
    {list.loading || routes.loading ? <AdminEmpty title={<AdminText en="Loading prices…" ar="جارٍ تحميل الأسعار…" />} />
      : list.error || routes.error ? <><AdminEmpty title={<AdminText en="Could not load prices" ar="تعذر تحميل الأسعار" />} copy={<AdminText en={list.error || routes.error} ar={list.error || routes.error} />} /><div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}><button type="button" className="sp-btn" onClick={list.refresh}><AdminText en="Retry" ar="إعادة المحاولة" /></button></div></>
        : rows.length ? <AdminTableWrap><table className="sp-table">
          <thead><tr>
            <th className="sp-row-number">#</th>
            <SortableTh label={<AdminText en="Route" ar="الخط" />} column="route" {...sort} onSort={sort.sortBy} />
            <SortableTh label={<AdminText en="Vehicle" ar="المركبة" />} column="vehicle" {...sort} onSort={sort.sortBy} />
            <SortableTh label={<AdminText en="One-way" ar="ذهاب" />} column="oneway" {...sort} onSort={sort.sortBy} />
            <SortableTh label={<AdminText en="Round trip" ar="ذهاب وعودة" />} column="round" {...sort} onSort={sort.sortBy} />
            <SortableTh label={<AdminText en="Status" ar="الحالة" />} column="status" {...sort} onSort={sort.sortBy} />
            <th></th>
          </tr></thead>
          <tbody>{paging.pageRows.map((row, index) => <tr key={row.id}>
            <td className="sp-row-number">{paging.from + index}</td>
            <td>{routeLabel(row.routeId)}</td>
            <td>{vehicleLabel(row.carSlug)}</td>
            <td dir="ltr">{centsText(row.oneWayCents)} {row.currency}</td>
            <td dir="ltr" style={{ whiteSpace: 'nowrap' }}>
              {row.roundTripMode === 'MANUAL'
                ? `${row.roundTripCents !== null ? centsText(row.roundTripCents) : '-'} ${row.currency}` + (ar ? ' (ثابت)' : ' (fixed)')
                : (ar ? `×${multiplierText(row.roundTripMultiplierBp)} تلقائي` : `×${multiplierText(row.roundTripMultiplierBp)} automatic`)}
            </td>
            <td><StatusPill status={row.isActive ? 'active' : 'hidden'} /></td>
            <td><AdminTableActions>
              <AdminIconAction icon={Pencil} label={ar ? 'تعديل' : 'Edit'} onClick={() => setDialog({ mode: 'edit', row })} />
              <AdminIconAction icon={Trash2} label={ar ? 'حذف' : 'Delete'} tone="danger" onClick={() => setRemoveTarget(row)} />
            </AdminTableActions></td>
          </tr>)}</tbody>
        </table></AdminTableWrap>
          : <AdminEmpty title={<AdminText en="No prices yet" ar="لا أسعار بعد" />} copy={<AdminText en="Unpriced trips show as Price on request." ar="الرحلات غير المسعّرة تظهر كـ«السعر عند الطلب»." />} />}
    {rows.length > 0 && <AdminPagination page={paging.page} pageCount={paging.pageCount} onPage={paging.setPage} pageSize={paging.pageSize} onPageSize={paging.setPageSize} from={paging.from} to={paging.to} total={paging.total} />}
    {dialog && <PriceDialog mode={dialog.mode} row={dialog.row} routes={routes.data} vehicles={vehicles} onClose={() => setDialog(null)} onSaved={() => { setDialog(null); list.refresh() }} />}
    <AdminConfirmDialog
      open={removeTarget !== null}
      onClose={() => setRemoveTarget(null)}
      onConfirm={() => {
        if (!removeTarget) return
        staffRequest(`/api/admin/rent-car/prices/${encodeURIComponent(removeTarget.id)}`, 'DELETE')
          .then(() => {
            toast.success(ar ? 'تم حذف السعر.' : 'Price deleted.', { dedupeKey: 'rentcar-price-delete' })
            setRemoveTarget(null)
            list.refresh()
          })
          .catch((err: unknown) => toast.error(err instanceof Error ? err.message : 'Delete failed.', { dedupeKey: 'rentcar-price-delete-error' }))
      }}
      title={<AdminText en="Delete price" ar="حذف السعر" />}
      description={<AdminText en="Remove this route × vehicle price? Associated trips fall back to Price on request." ar="إزالة سعر هذا الخط × المركبة؟ الرحلات المرتبطة تعود إلى «السعر عند الطلب»." />}
      confirmLabel={<AdminText en="Delete" ar="حذف" />}
      tone="danger"
    />
  </Card>
}

function PriceDialog({ mode, row, routes, vehicles, onClose, onSaved }: { mode: 'create' | 'edit'; row?: PriceRow; routes: RouteRow[]; vehicles: CarRow[]; onClose: () => void; onSaved: () => void }) {
  const ar = useAdminLocale() === 'ar'
  const [routeId, setRouteId] = useState(row?.routeId ?? '')
  const [carSlug, setCarSlug] = useState(row?.carSlug ?? '')
  const [currency, setCurrency] = useState(row?.currency ?? 'USD')
  const [oneWay, setOneWay] = useState(row ? centsText(row.oneWayCents) : '')
  const [roundMode, setRoundMode] = useState<'AUTOMATIC' | 'MANUAL'>(row?.roundTripMode ?? 'AUTOMATIC')
  const [roundTrip, setRoundTrip] = useState(row?.roundTripCents != null ? centsText(row.roundTripCents) : '')
  const [multiplier, setMultiplier] = useState(row ? multiplierText(row.roundTripMultiplierBp) : '2.00')
  const [isActive, setIsActive] = useState(row?.isActive ?? true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // Display-only draft estimate: MANUAL shows the entered amount verbatim;
  // AUTOMATIC multiplies the outbound leg (the live request-time quote may
  // instead use a priced reverse leg when one exists). Integer-safe: this is
  // presentational only — the server recomputes every saved figure.
  const draftRound: string | null = roundMode === 'MANUAL'
    ? (roundTrip.trim() === '' ? null : roundTrip.trim())
    : (oneWay.trim() === '' ? null : (Math.round(Number(oneWay) * Number(multiplier) * 100) / 100).toFixed(2))
  const draftRoundCents = draftRound === null ? null : Math.round(Number(draftRound) * 100)

  const routeOptions = routes.map((route) => ({ value: route.id, label: `${route.origin.nameEn} → ${route.destination.nameEn}` }))
  const vehicleOptions = vehicles.filter((car) => car.isPublished !== false).map((car) => ({ value: car.slug, label: `${car.title} · ${car.seats}` }))

  const save = () => {
    setBusy(true)
    setError('')
    const payload: Record<string, unknown> = { currency, oneWay, roundTripMode: roundMode, isActive }
    if (roundMode === 'MANUAL') payload.roundTrip = roundTrip
    if (roundMode === 'AUTOMATIC') payload.roundTripMultiplier = multiplier
    const url = mode === 'create'
      ? '/api/admin/rent-car/prices'
      : `/api/admin/rent-car/prices/${encodeURIComponent(row?.id ?? '')}`
    staffRequest<{ price: unknown }>(url, mode === 'create' ? 'POST' : 'PATCH', mode === 'create' ? { ...payload, routeId, carSlug } : payload)
      .then(() => {
        toast.success(ar
          ? (mode === 'create' ? 'تم إنشاء السعر.' : 'تم حفظ تعديلات السعر.')
          : (mode === 'create' ? 'Price created.' : 'Price updated.'), { dedupeKey: 'rentcar-price-save' })
        onSaved()
      })
      .catch((err: unknown) => { setError(err instanceof Error ? err.message : 'Save failed.'); setBusy(false) })
  }

  return <AdminConfirmDialog
    open
    onClose={onClose}
    onConfirm={save}
    title={<AdminText en={mode === 'create' ? 'New route price' : 'Edit route price'} ar={mode === 'create' ? 'سعر جديد' : 'تعديل السعر'} />}
    confirmLabel={<AdminText en={mode === 'create' ? 'Create price' : 'Save changes'} ar={mode === 'create' ? 'إنشاء' : 'حفظ التعديلات'} />}
    canConfirm={!busy && routeId !== '' && carSlug !== '' && oneWay.trim() !== '' && (roundMode === 'AUTOMATIC' || roundTrip.trim() !== '')}
    description={error !== '' ? <span role="alert" style={{ color: 'var(--danger, #b3261e)' }}>{error}</span> : undefined}
  >
    <div className="sp-form">
      {mode === 'create' ? <>
        <label><AdminText en="Route" ar="الخط" />
          <SharedSelect value={routeId} onChange={setRouteId} locale={ar ? 'ar' : 'en'} options={[{ value: '', label: ar ? 'اختر خطًا' : 'Select a route…' }, ...routeOptions]} />
        </label>
        <label><AdminText en="Fleet vehicle" ar="مركبة الأسطول" />
          <SharedSelect value={carSlug} onChange={setCarSlug} locale={ar ? 'ar' : 'en'} options={[{ value: '', label: ar ? 'اختر مركبة' : 'Select a vehicle…' }, ...vehicleOptions]} />
        </label>
      </> : <p><AdminText en="Route and vehicle are fixed for this price entry." ar="الخط والمركبة ثابتان لهذا السعر." /></p>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <label><AdminText en="Currency" ar="العملة" />
          <SharedSelect value={currency} onChange={setCurrency} locale={ar ? 'ar' : 'en'} options={CURRENCY_OPTIONS.map((value) => ({ value, label: value }))} />
        </label>
        <label><AdminText en="One-way price" ar="سعر الذهاب" />
          <input type="number" min={0} step="0.01" dir="ltr" value={oneWay} onChange={(e) => setOneWay(e.target.value)} placeholder="0.00" />
        </label>
      </div>
      <label><AdminText en="Round-trip pricing mode" ar="طريقة تسعير الذهاب والعودة" />
        <SharedSelect value={roundMode} onChange={(next) => setRoundMode(next as 'AUTOMATIC' | 'MANUAL')} locale={ar ? 'ar' : 'en'} options={[
          { value: 'AUTOMATIC', label: ar ? 'تلقائي (معامل العودة)' : 'Automatic (return multiplier)' },
          { value: 'MANUAL', label: ar ? 'يدوي (سعر ثابت)' : 'Manual (fixed round-trip rate)' },
        ]} />
      </label>
      <p style={{ margin: '4px 0 10px', color: 'var(--muted)', fontSize: 13 }}>
        {roundMode === 'AUTOMATIC'
          ? (ar
            ? 'العودة = سعر الذهاب × المعامل. إذا وُجد خط معاكس مسعّر، تُستخدم لوجته الحقيقية بدلًا من المعامل.'
            : 'Return = outbound × multiplier. When a priced reverse route exists, its real legs are used instead of the multiplier.')
          : (ar
            ? 'مبلغ ثابت يُعرض كما هو لرحلة ذهاب وعودة كاملة.'
            : 'A fixed amount shown verbatim for the full two-way trip.')}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {roundMode === 'AUTOMATIC'
          ? <label><AdminText en="Round-trip multiplier (e.g. 2.00)" ar="معامل الذهاب والعودة (مثال 2.00)" />
            <input type="number" min={1} max={10} step="0.01" dir="ltr" value={multiplier} onChange={(e) => setMultiplier(e.target.value)} />
          </label>
          : <label><AdminText en="Fixed round-trip amount" ar="مبلغ ذهاب وعودة ثابت" />
            <input type="number" min={0} step="0.01" dir="ltr" value={roundTrip} onChange={(e) => setRoundTrip(e.target.value)} placeholder="0.00" />
          </label>}
        <label><AdminText en="Estimated round trip" ar="تقدير الذهاب والعودة" />
          <input value={draftRoundCents === null ? '' : formatQuoteAmount(draftRoundCents, currency, ar ? 'ar' : 'en')} dir="ltr" readOnly disabled />
        </label>
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
        <AdminText en="Active" ar="نشط" />
      </label>
    </div>
  </AdminConfirmDialog>
}
