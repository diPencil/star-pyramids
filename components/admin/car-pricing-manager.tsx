'use client'
import { CURRENCY_OPTIONS } from '@/lib/currency'

import { useEffect, useMemo, useState } from 'react'
import { Pencil, Plus, Power, RefreshCw, Settings2, Trash2 } from 'lucide-react'
import { AdminEmpty, AdminIconAction, AdminTableActions, AdminTableTools, AdminTableWrap, Card } from './admin-ui'
import { AdminConfirmDialog } from './admin-confirm-dialog'
import { AdminPagination, usePagination } from './admin-pagination'
import { SortableTh, useAdminTableSort } from './admin-table-sort'
import { toast } from './admin-toaster'
import { SharedSelect } from '../shared-select'
import { useCurrentUser } from '@/lib/use-current-user'
import { useCarLocale } from '@/lib/use-car-locale'
import { parseVehicleCapacity, formatQuoteAmount } from '@/lib/car-request'
import { SUPPORTED_CURRENCIES, centsToDecimalString, parseMoneyToCents, passengerAmount, type CarPricingMode } from '@/lib/car-pricing'
import { tierDraftIssue, tierPayload, type PricingConfiguration, type PricingTier, type TierDraft, type TierIssue } from '@/lib/car-pricing-admin'
import './car-pricing-manager.css'

type Vehicle = { slug: string; title: string; seats: string; isPublished?: boolean }
type Route = { id: string; isActive: boolean; origin: { nameEn: string }; destination: { nameEn: string } }
type List<T> = { data: T[]; loading: boolean; error: string; refresh: () => void }

async function request<T>(url: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(url, { method, credentials: 'same-origin', cache: 'no-store', ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status}).`)
  return payload as T
}

function usePricingText() {
  const locale = useCarLocale()
  const t = (en: string, es: string, it: string) => locale === 'es' ? es : locale === 'it' ? it : en
  return { locale, t }
}

export function CarPricingManager({ list, routes, vehicles, vehicleLoading, vehicleError, onRetryVehicles }: { list: List<PricingTier>; routes: List<Route>; vehicles: Vehicle[]; vehicleLoading?: boolean; vehicleError?: string | null; onRetryVehicles?: () => void }) {
  const { t, locale } = usePricingText()
  const { user } = useCurrentUser()
  const can = (permission: string) => !!user && (user.roles.includes('SUPER_ADMIN') || user.permissions?.includes(permission))
  const [configurations, setConfigurations] = useState<PricingConfiguration[]>([])
  const [configError, setConfigError] = useState('')
  const [configLoading, setConfigLoading] = useState(true)
  const [version, setVersion] = useState(0)
  const [query, setQuery] = useState('')
  const [routeId, setRouteId] = useState('')
  const [carSlug, setCarSlug] = useState('')
  const [editor, setEditor] = useState<{ row?: PricingTier } | null>(null)
  const [settings, setSettings] = useState<PricingConfiguration | null>(null)
  const [remove, setRemove] = useState<PricingTier | null>(null)
  const [busy, setBusy] = useState(false)
  const refresh = () => { list.refresh(); setVersion(v => v + 1) }
  useEffect(() => {
    let cancelled = false
    setConfigLoading(true); setConfigError('')
    request<{ configurations: PricingConfiguration[] }>('/api/admin/rent-car/configurations')
      .then(data => { if (!cancelled) setConfigurations(data.configurations) })
      .catch(error => { if (!cancelled) setConfigError(error instanceof Error ? error.message : 'Request failed.') })
      .finally(() => { if (!cancelled) setConfigLoading(false) })
    return () => { cancelled = true }
  }, [version])
  const routeLabel = (id: string) => { const route = routes.data.find(row => row.id === id); return route ? `${route.origin.nameEn} → ${route.destination.nameEn}` : id }
  const vehicleLabel = (slug: string) => vehicles.find(row => row.slug === slug)?.title ?? slug
  const modeLabel = (mode: CarPricingMode) => mode === 'PER_PERSON' ? t('Per passenger', 'Por pasajero', 'Per passeggero') : t('Vehicle total', 'Total del vehículo', 'Totale veicolo')
  const selected = configurations.find(c => c.routeId === routeId && c.carSlug === carSlug)
  const rows = useMemo(() => list.data.filter(row => (!routeId || row.routeId === routeId) && (!carSlug || row.carSlug === carSlug) && `${routeLabel(row.routeId)} ${vehicleLabel(row.carSlug)} ${row.currency} ${row.pricingMode}`.toLowerCase().includes(query.trim().toLowerCase())), [list.data, routeId, carSlug, query, routes.data, vehicles])
  const sort = useAdminTableSort(rows, { route: row => routeLabel(row.routeId), vehicle: row => vehicleLabel(row.carSlug), passengers: row => row.minPassengers, amount: row => row.oneWayCents, status: row => Number(row.isActive) }, 'route', 'asc')
  const paging = usePagination(sort.sortedRows)
  const error = list.error || routes.error || vehicleError || configError
  const loading = list.loading || routes.loading || vehicleLoading || configLoading
  const mutate = async (url: string, method: string, body?: unknown) => {
    if (busy) return
    setBusy(true)
    try { await request(url, method, body); setRemove(null); refresh(); toast.success(t('Pricing saved.', 'Precios guardados.', 'Prezzi salvati.')) }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Request failed.') }
    finally { setBusy(false) }
  }

  return <Card title={t('Passenger pricing', 'Precios por pasajeros', 'Prezzi per passeggeri')} sub={t('Vehicle and route configurations', 'Configuraciones de vehículo y ruta', 'Configurazioni veicolo e percorso')}
    action={<AdminTableActions><AdminIconAction icon={RefreshCw} label={t('Refresh pricing', 'Actualizar precios', 'Aggiorna prezzi')} disabled={busy || loading} onClick={refresh}/>{can('cars.create') && <button className="sp-btn primary" type="button" disabled={loading || !!error || !routes.data.length || !vehicles.length} onClick={() => setEditor({})}><Plus size={16}/>{t('Add passenger tier', 'Añadir tramo', 'Aggiungi fascia')}</button>}</AdminTableActions>}>
    <div className="sp-car-pricing-filters">
      <label>{t('Route', 'Ruta', 'Percorso')}<SharedSelect locale={locale} label={t('Route', 'Ruta', 'Percorso')} value={routeId} onChange={setRouteId} options={[{ value: '', label: t('All routes', 'Todas las rutas', 'Tutti i percorsi') }, ...routes.data.map(row => ({ value: row.id, label: routeLabel(row.id) }))]}/></label>
      <label>{t('Vehicle', 'Vehículo', 'Veicolo')}<SharedSelect locale={locale} label={t('Vehicle', 'Vehículo', 'Veicolo')} value={carSlug} onChange={setCarSlug} options={[{ value: '', label: t('All vehicles', 'Todos los vehículos', 'Tutti i veicoli') }, ...vehicles.map(row => ({ value: row.slug, label: `${row.title} · ${row.seats}` }))]}/></label>
    </div>
    {selected && <div className="sp-car-pricing-configuration"><span><strong>{modeLabel(selected.pricingMode)}</strong> · {selected.currency}</span>{can('cars.edit') && <button className="sp-btn" type="button" disabled={busy || loading || !!error} onClick={() => setSettings(selected)}><Settings2 size={16}/>{t('Configuration', 'Configuración', 'Configurazione')}</button>}</div>}
    <AdminTableTools query={query} onQueryChange={setQuery} placeholder={t('Search route, vehicle or currency', 'Buscar ruta, vehículo o moneda', 'Cerca percorso, veicolo o valuta')}/>
    {loading ? <AdminEmpty title={t('Loading pricing…', 'Cargando precios…', 'Caricamento prezzi…')}/> : error ? <div role="alert"><AdminEmpty title={error}/><button className="sp-btn" type="button" onClick={() => { routes.refresh(); onRetryVehicles?.(); refresh() }}>{t('Retry', 'Reintentar', 'Riprova')}</button></div> : !rows.length ? <AdminEmpty title={t('No passenger tiers', 'Sin tramos de pasajeros', 'Nessuna fascia passeggeri')} copy={t('Uncovered passenger counts receive Price on Request.', 'Los pasajeros sin tarifa reciben un precio a consultar.', 'Per passeggeri senza tariffa il prezzo è su richiesta.')}/> : <AdminTableWrap><table className="sp-table sp-car-pricing-table">
      <thead><tr><SortableTh label={t('Route', 'Ruta', 'Percorso')} column="route" {...sort} onSort={sort.sortBy}/><SortableTh label={t('Vehicle', 'Vehículo', 'Veicolo')} column="vehicle" {...sort} onSort={sort.sortBy}/><SortableTh label={t('Passengers', 'Pasajeros', 'Passeggeri')} column="passengers" {...sort} onSort={sort.sortBy}/><th>{t('Pricing mode', 'Modo de precio', 'Modalità prezzo')}</th><th>{t('Currency', 'Moneda', 'Valuta')}</th><SortableTh label={t('One way', 'Solo ida', 'Solo andata')} column="amount" {...sort} onSort={sort.sortBy}/><th>{t('Round trip', 'Ida y vuelta', 'Andata e ritorno')}</th><SortableTh label={t('Status', 'Estado', 'Stato')} column="status" {...sort} onSort={sort.sortBy}/><th>{t('Actions', 'Acciones', 'Azioni')}</th></tr></thead>
      <tbody>{paging.pageRows.map(row => <tr key={row.id}><td>{routeLabel(row.routeId)}</td><td>{vehicleLabel(row.carSlug)}</td><td>{row.minPassengers}–{row.maxPassengers}</td><td>{modeLabel(row.pricingMode)}</td><td>{row.currency}</td><td>{centsToDecimalString(row.oneWayCents)}<small className="sp-car-pricing-note">{modeLabel(row.pricingMode)}</small></td><td>{row.roundTripMode === 'MANUAL' ? `${centsToDecimalString(row.roundTripCents ?? 0)} ${row.currency} · ${t('Manual', 'Manual', 'Manuale')}` : `×${centsToDecimalString(row.roundTripMultiplierBp)} · ${t('Automatic', 'Automático', 'Automatico')}`}<small className="sp-car-pricing-note">{row.roundTripMode === 'MANUAL' ? modeLabel(row.pricingMode) : t('Reverse leg first; multiplier fallback', 'Primero regreso; multiplicador si falta', 'Prima il ritorno; moltiplicatore se assente')}</small></td><td><span className={`sp-pill is-${row.isActive ? 'active' : 'hidden'}`}>{row.isActive ? t('Active', 'Activo', 'Attivo') : t('Inactive', 'Inactivo', 'Inattivo')}</span></td><td><AdminTableActions>
        {can('cars.edit') && <><AdminIconAction icon={Pencil} label={t('Edit tier', 'Editar tramo', 'Modifica fascia')} disabled={busy} onClick={() => setEditor({ row })}/><AdminIconAction icon={Power} label={row.isActive ? t('Disable tier', 'Desactivar tramo', 'Disattiva fascia') : t('Enable tier', 'Activar tramo', 'Attiva fascia')} disabled={busy} onClick={() => void mutate(`/api/admin/rent-car/prices/${encodeURIComponent(row.id)}`, 'PATCH', { isActive: !row.isActive })}/><AdminIconAction icon={Settings2} label={t('Configuration', 'Configuración', 'Configurazione')} disabled={busy} onClick={() => { const config = configurations.find(c => c.routeId === row.routeId && c.carSlug === row.carSlug); if (config) setSettings(config) }}/></>}
        {can('cars.delete') && <AdminIconAction icon={Trash2} tone="danger" label={t('Delete tier', 'Eliminar tramo', 'Elimina fascia')} disabled={busy} onClick={() => setRemove(row)}/>}
      </AdminTableActions></td></tr>)}</tbody></table></AdminTableWrap>}
    {!!rows.length && <AdminPagination page={paging.page} pageCount={paging.pageCount} onPage={paging.setPage} pageSize={paging.pageSize} onPageSize={paging.setPageSize} from={paging.from} to={paging.to} total={paging.total}/>}
    {editor && <TierEditor row={editor.row} initialRoute={routeId} initialVehicle={carSlug} configurations={configurations} tiers={list.data} routes={routes.data} vehicles={vehicles} onClose={() => setEditor(null)} onSaved={() => { setEditor(null); refresh() }}/>}
    {settings && <ConfigurationEditor configuration={settings} onClose={() => setSettings(null)} onSaved={() => { setSettings(null); refresh() }}/>}
    <AdminConfirmDialog open={!!remove} title={t('Delete passenger tier', 'Eliminar tramo de pasajeros', 'Elimina fascia passeggeri')} description={remove ? `${vehicleLabel(remove.carSlug)} · ${routeLabel(remove.routeId)} · ${remove.minPassengers}–${remove.maxPassengers}. ${t('Existing request quotes stay unchanged. This range may become Price on Request.', 'Los presupuestos guardados no cambian. Este tramo puede quedar a consultar.', 'I preventivi salvati non cambiano. Questa fascia potrebbe diventare su richiesta.')}` : ''} confirmLabel={t('Delete', 'Eliminar', 'Elimina')} cancelLabel={t('Cancel', 'Cancelar', 'Annulla')} tone="danger" canConfirm={!busy} onClose={() => { if (!busy) setRemove(null) }} onConfirm={() => { if (remove) void mutate(`/api/admin/rent-car/prices/${encodeURIComponent(remove.id)}`, 'DELETE') }}/>
  </Card>
}

function ConfigurationEditor({ configuration: config, onClose, onSaved }: { configuration: PricingConfiguration; onClose: () => void; onSaved: () => void }) {
  const { t, locale } = usePricingText()
  const [mode, setMode] = useState<CarPricingMode>(config.pricingMode)
  const [currency, setCurrency] = useState(config.currency)
  const [acknowledge, setAcknowledge] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const save = async () => {
    if (busy || !acknowledge) return
    setBusy(true); setError('')
    try { await request('/api/admin/rent-car/configurations', 'PATCH', { id: config.id, pricingMode: mode, currency, previousMode: config.pricingMode, previousCurrency: config.currency, acknowledge }); toast.success(t('Configuration saved.', 'Configuración guardada.', 'Configurazione salvata.')); onSaved() }
    catch (error) { setError(error instanceof Error ? error.message : 'Request failed.'); setBusy(false) }
  }
  return <AdminConfirmDialog open title={t('Vehicle-route configuration', 'Configuración de vehículo y ruta', 'Configurazione veicolo-percorso')} confirmLabel={t('Save configuration', 'Guardar configuración', 'Salva configurazione')} cancelLabel={t('Cancel', 'Cancelar', 'Annulla')} canConfirm={!busy && acknowledge && (mode !== config.pricingMode || currency !== config.currency)} onClose={() => { if (!busy) onClose() }} onConfirm={() => void save()}>
    <div className="sp-form sp-car-pricing-form" aria-busy={busy}><ModeFields mode={mode} setMode={setMode} currency={currency} setCurrency={setCurrency} disabled={busy} locale={locale} t={t}/>
      <p>{t('Applies to every tier in this vehicle-route configuration. Numeric amounts are not converted; their meaning or currency changes. Saved request quotes do not change.', 'Se aplica a todos los tramos de esta configuración. Los importes no se convierten: cambia su significado o moneda. Los presupuestos guardados no cambian.', 'Si applica a tutte le fasce della configurazione. Gli importi non vengono convertiti: cambia il significato o la valuta. I preventivi salvati non cambiano.')}</p>
      <label className="sp-car-pricing-check"><input type="checkbox" checked={acknowledge} disabled={busy} onChange={e => setAcknowledge(e.target.checked)}/>{t('I confirm the new meaning of every tier amount.', 'Confirmo el nuevo significado de los importes.', 'Confermo il nuovo significato degli importi.')}</label>
      {error && <p role="alert" className="sp-car-pricing-error">{error}</p>}
    </div>
  </AdminConfirmDialog>
}

type Text = (en: string, es: string, it: string) => string
function ModeFields({ mode, setMode, currency, setCurrency, disabled, locale, t }: { mode: CarPricingMode; setMode: (v: CarPricingMode) => void; currency: string; setCurrency: (v: string) => void; disabled: boolean; locale: 'en' | 'es' | 'it'; t: Text }) {
  return <div className="sp-car-pricing-fields"><label>{t('Pricing mode', 'Modo de precio', 'Modalità prezzo')}<SharedSelect locale={locale} value={mode} disabled={disabled} onChange={v => setMode(v as CarPricingMode)} options={[{ value: 'FIXED_TOTAL', label: t('Fixed vehicle total', 'Total fijo del vehículo', 'Totale fisso del veicolo') }, { value: 'PER_PERSON', label: t('Per passenger', 'Por pasajero', 'Per passeggero') }]}/></label><label>{t('Currency', 'Moneda', 'Valuta')}<SharedSelect locale={locale} value={currency} onChange={setCurrency} disabled={disabled} options={CURRENCY_OPTIONS}/></label></div>
}

export function TierEditor({ row, initialRoute, initialVehicle, configurations, tiers, routes, vehicles, onClose, onSaved }: { row?: PricingTier; initialRoute: string; initialVehicle: string; configurations: PricingConfiguration[]; tiers: PricingTier[]; routes: Route[]; vehicles: Vehicle[]; onClose: () => void; onSaved: () => void }) {
  const { t, locale } = usePricingText()
  const [routeId, setRouteId] = useState(row?.routeId ?? initialRoute)
  const [carSlug, setCarSlug] = useState(row?.carSlug ?? initialVehicle)
  const [newMode, setNewMode] = useState<CarPricingMode>('FIXED_TOTAL')
  const [newCurrency, setNewCurrency] = useState('USD')
  const [draft, setDraft] = useState<TierDraft>({ minPassengers: String(row?.minPassengers ?? 1), maxPassengers: String(row?.maxPassengers ?? ''), oneWay: row ? centsToDecimalString(row.oneWayCents) : '', roundTripMode: row?.roundTripMode ?? 'AUTOMATIC', roundTrip: row?.roundTripCents ? centsToDecimalString(row.roundTripCents) : '', roundTripMultiplier: row ? centsToDecimalString(row.roundTripMultiplierBp) : '2.00', isActive: row?.isActive ?? true })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const config = configurations.find(c => c.routeId === routeId && c.carSlug === carSlug)
  const mode = config?.pricingMode ?? newMode, currency = config?.currency ?? newCurrency
  const vehicle = vehicles.find(v => v.slug === carSlug)
  const capacity = vehicle ? parseVehicleCapacity(vehicle.seats) : null
  const siblings = tiers.filter(tier => tier.routeId === routeId && tier.carSlug === carSlug)
  const issue = routeId && vehicle ? tierDraftIssue(draft, vehicle.seats, siblings, mode, row?.id) : null
  const issueLabel: Record<TierIssue, string> = {
    capacity: t('Set an unambiguous vehicle seat capacity first.', 'Primero define una capacidad de asientos válida.', 'Imposta prima una capacità posti chiara.'),
    range: t('Enter a whole-number passenger range within vehicle capacity.', 'Introduce un tramo entero dentro de la capacidad.', 'Inserisci una fascia intera entro la capacità.'),
    overlap: t('This range overlaps another tier, including inactive tiers.', 'El tramo se solapa con otro, incluso inactivo.', 'La fascia si sovrappone a un’altra, anche inattiva.'),
    money: t('Enter a positive one-way amount with at most two decimals.', 'Introduce un importe de ida positivo con hasta dos decimales.', 'Inserisci un importo andata positivo con massimo due decimali.'),
    manual: t('Enter a positive manual round-trip amount.', 'Introduce un importe manual de ida y vuelta positivo.', 'Inserisci un importo manuale andata e ritorno positivo.'),
    multiplier: t('Multiplier must be between 1.00 and 10.00.', 'El multiplicador debe estar entre 1,00 y 10,00.', 'Il moltiplicatore deve essere tra 1,00 e 10,00.'),
    limit: t('Computed totals exceed the supported amount limit.', 'Los totales superan el límite permitido.', 'I totali superano il limite consentito.'),
  }
  const patch = (value: Partial<TierDraft>) => { setDraft(d => ({ ...d, ...value })); setError('') }
  const save = async () => {
    if (busy || issue || !routeId || !vehicle) return
    setBusy(true); setError('')
    try {
      await request(row ? `/api/admin/rent-car/prices/${encodeURIComponent(row.id)}` : '/api/admin/rent-car/prices', row ? 'PATCH' : 'POST', { ...tierPayload(draft), ...(row ? { expectedPricingMode: mode, expectedCurrency: currency } : { routeId, carSlug, pricingMode: mode, currency }) })
      toast.success(t('Passenger tier saved.', 'Tramo guardado.', 'Fascia salvata.')); onSaved()
    } catch (error) { setError(error instanceof Error ? error.message : 'Request failed.'); setBusy(false) }
  }
  const examplePassengers = Math.min(Number(draft.maxPassengers), Math.max(2, Number(draft.minPassengers)))
  const unit = parseMoneyToCents(draft.oneWay)
  let example: string | null = null
  if (routeId && vehicle && !issue && unit !== null && Number.isSafeInteger(examplePassengers) && examplePassengers >= 1) {
    const amount = passengerAmount(unit, examplePassengers, mode)
    example = mode === 'PER_PERSON' ? `${examplePassengers} × ${formatQuoteAmount(unit, currency, locale)} = ${formatQuoteAmount(amount, currency, locale)}` : `${examplePassengers} ${t('passengers', 'pasajeros', 'passeggeri')} = ${formatQuoteAmount(amount, currency, locale)}`
  }
  return <AdminConfirmDialog open title={row ? t('Edit passenger tier', 'Editar tramo', 'Modifica fascia') : t('Add passenger tier', 'Añadir tramo', 'Aggiungi fascia')} confirmLabel={busy ? t('Saving…', 'Guardando…', 'Salvataggio…') : t('Save tier', 'Guardar tramo', 'Salva fascia')} cancelLabel={t('Cancel', 'Cancelar', 'Annulla')} canConfirm={!busy && !issue && !!routeId && !!vehicle} onClose={() => { if (!busy) onClose() }} onConfirm={() => void save()}>
    <div className="sp-form sp-car-pricing-form" aria-busy={busy}>
      <label>{t('Route', 'Ruta', 'Percorso')}<SharedSelect locale={locale} disabled={busy || !!row} value={routeId} onChange={setRouteId} options={[{ value: '', label: t('Select route', 'Selecciona ruta', 'Seleziona percorso') }, ...routes.map(route => ({ value: route.id, label: `${route.origin.nameEn} → ${route.destination.nameEn}${route.isActive ? '' : ` (${t('inactive', 'inactiva', 'inattivo')})`}` }))]}/></label>
      <label>{t('Vehicle', 'Vehículo', 'Veicolo')}<SharedSelect locale={locale} disabled={busy || !!row} value={carSlug} onChange={setCarSlug} options={[{ value: '', label: t('Select vehicle', 'Selecciona vehículo', 'Seleziona veicolo') }, ...vehicles.map(v => ({ value: v.slug, label: `${v.title} · ${v.seats}${v.isPublished === false ? ` (${t('hidden', 'oculto', 'nascosto')})` : ''}` }))]}/></label>
      <ModeFields mode={mode} setMode={setNewMode} currency={currency} setCurrency={setNewCurrency} disabled={busy || !!config} locale={locale} t={t}/>
      {config && <p className="sp-car-pricing-note">{t('Mode and currency are shared by all tiers. Change them from Configuration.', 'Modo y moneda son comunes a todos los tramos. Cámbialos en Configuración.', 'Modalità e valuta sono comuni a tutte le fasce. Modificale in Configurazione.')}</p>}
      <p>{mode === 'PER_PERSON' ? t('Amounts are per passenger. Total = unit amount × passengers.', 'Los importes son por pasajero. Total = importe unitario × pasajeros.', 'Gli importi sono per passeggero. Totale = importo unitario × passeggeri.') : t('Amounts cover the entire vehicle transfer for this passenger range.', 'Los importes cubren el traslado completo para este tramo de pasajeros.', 'Gli importi coprono il trasferimento completo per questa fascia di passeggeri.')}</p>
      <div className="sp-car-pricing-fields"><label>{t('Minimum passengers', 'Pasajeros mínimos', 'Passeggeri minimi')}<input type="number" min={1} max={capacity ?? undefined} step={1} value={draft.minPassengers} disabled={busy} onChange={e => patch({ minPassengers: e.target.value })}/></label><label>{t('Maximum passengers', 'Pasajeros máximos', 'Passeggeri massimi')}<input type="number" min={1} max={capacity ?? undefined} step={1} value={draft.maxPassengers} disabled={busy} onChange={e => patch({ maxPassengers: e.target.value })}/></label></div>
      {capacity !== null && <small>{t('Vehicle capacity', 'Capacidad del vehículo', 'Capacità veicolo')}: {capacity}</small>}
      <label>{mode === 'PER_PERSON' ? t('One way per passenger', 'Ida por pasajero', 'Andata per passeggero') : t('One-way vehicle total', 'Total del vehículo de ida', 'Totale veicolo andata')} ({currency})<input type="number" min="0.01" step="0.01" value={draft.oneWay} disabled={busy} onChange={e => patch({ oneWay: e.target.value })}/></label>
      {example && <output className="sp-car-pricing-example">{example}</output>}
      <label>{t('Round-trip calculation', 'Cálculo de ida y vuelta', 'Calcolo andata e ritorno')}<SharedSelect locale={locale} disabled={busy} value={draft.roundTripMode} onChange={value => patch({ roundTripMode: value as TierDraft['roundTripMode'] })} options={[{ value: 'AUTOMATIC', label: t('Automatic', 'Automático', 'Automatico') }, { value: 'MANUAL', label: t('Manual', 'Manual', 'Manuale') }]}/></label>
      {draft.roundTripMode === 'MANUAL' ? <label>{mode === 'PER_PERSON' ? t('Full round trip per passenger', 'Ida y vuelta completa por pasajero', 'Andata e ritorno per passeggero') : t('Full round-trip vehicle total', 'Total del vehículo de ida y vuelta', 'Totale veicolo andata e ritorno')} ({currency})<input type="number" min="0.01" step="0.01" value={draft.roundTrip} disabled={busy} onChange={e => patch({ roundTrip: e.target.value })}/></label> : <><label>{t('Fallback round-trip multiplier', 'Multiplicador alternativo de ida y vuelta', 'Moltiplicatore alternativo andata e ritorno')}<input type="number" min={1} max={10} step="0.01" value={draft.roundTripMultiplier} disabled={busy} onChange={e => patch({ roundTripMultiplier: e.target.value })}/></label><p className="sp-car-pricing-note">{t('Uses the matching reverse-leg tier first. If unavailable, multiplies the outbound total. Different currencies cannot be added.', 'Usa primero el tramo de regreso. Si falta, multiplica el total de ida. No se suman monedas diferentes.', 'Usa prima la fascia del ritorno. Se assente, moltiplica il totale andata. Valute diverse non vengono sommate.')}</p></>}
      <label className="sp-car-pricing-check"><input type="checkbox" checked={draft.isActive} disabled={busy} onChange={e => patch({ isActive: e.target.checked })}/>{t('Active', 'Activo', 'Attivo')}</label>
      {(error || issue) && <p className="sp-car-pricing-error" role="alert">{error || (issue && issueLabel[issue])}</p>}
    </div>
  </AdminConfirmDialog>
}
