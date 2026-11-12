'use client'

import { beginFormLead, confirmFormLead } from "@/lib/tracking/leads/form-lead";
import { trackPublicInteraction } from "@/lib/tracking/tracking-events";
import { EmptyFleetHero } from "./empty-fleet-hero";
import { carTripTypeForKey } from "@/lib/cars/car-request";
import { CmsPublicLink } from "@/components/cms/cms-public-link";
import { usePresentation, PresentationSection } from "@/components/cms/presentation-content-context";
import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, Check, CircleAlert, CarFront, ShieldCheck, Users } from "lucide-react";
import { cars } from "@/data/content";
import { useBrandSettings } from "@/lib/admin-store";
import { vehicleTransmissionLabel } from "@/lib/catalogue/catalogue-translations";
import { useDbCars, useDbCarsStatus } from "@/lib/catalogue/events-cars-client";
import { useCarQuote } from "@/lib/cars/car-quote-client";
import { CarQuoteSummary } from "./car-quote-summary";
import { parseVehicleCapacity } from "@/lib/cars/car-request";
import { whatsappHref } from "@/data/company";
import type { Car } from "@/data/types";
import { parseCarRequestQuery } from "@/lib/query";
import { CAR_LOCATION_MAX, CAR_NOTE_MAX, hasCarErrors, isCarReference, sanitizeCarDraft, validateCarRequest, type CarFieldErrors, type CarRequest, type CarRequestDraft } from "@/lib/cars/car-request";
import { useLocale, tx, type Locale } from "../locale";
import { Breadcrumb, PageShowcaseHero, SiteShell } from "@/components/site";
import { InternationalPhoneInput } from "../shared/forms/international-phone-input";
import { useCurrentUser } from "@/lib/use-current-user";
import { SharedSelect } from "@/components/shared/forms/shared-select";
import { DateInput } from "@/components/shared/forms/date-input";


export function CarsPage() {
  return <SiteShell><CarsPageContent /></SiteShell>
}

function CarsPageContent() {
  const cms = usePresentation("cars")

  const { locale } = useLocale()
  const ar = locale === 'ar'
  const liveCars = useDbCars(cars).filter((car) => car.isPublished !== false)
  const featured = liveCars[2] ?? liveCars[0]
  const maxSeats = liveCars.length ? Math.max(...liveCars.map((car) => Number.parseInt(car.seats, 10) || 0)) : 0
  if (!featured) return <main><EmptyFleetHero /><div className="container"><PresentationSection pageId="cars" id="content"><section id="fleet" className="section"><div className="section-heading"><span className="eyebrow">{cms.text("content","description0",tx(locale, { en: 'Our fleet', es: 'Nuestra flota', it: 'La nostra flotta', ar: 'الأسطول' }))}</span><h2>{cms.text("content","description1",tx(locale, { en: 'No vehicles listed right now', es: 'Sin vehículos disponibles ahora mismo', it: 'Nessun veicolo disponibile al momento', ar: 'لا توجد سيارات متاحة حاليًا' }))}</h2><p>{cms.text("content","description2",tx(locale, { en: 'Check back later or contact us and we will help arrange your transfer.', es: 'Vuelve más tarde o contáctanos y te ayudaremos a organizar tu traslado.', it: 'Torna più tardi o contattaci: ti aiuteremo a organizzare il trasferimento.', ar: 'عُد لاحقًا أو تواصل معنا وسنساعدك في ترتيب انتقالك.' }))}</p><CmsPublicLink href={cms.link("content","links0","/contact")} className="primary-btn">{cms.text("content","description3",tx(locale, { en: 'Contact us', es: 'Contáctanos', it: 'Contattaci', ar: 'تواصل معنا' }))} <ArrowRight size={16} /></CmsPublicLink></div></section></PresentationSection></div></main>
  return <main>
    <PageShowcaseHero image={featured.image} eyebrow={tx(locale, { en: 'Private drivers & modern fleet', es: 'Conductores privados y flota moderna', it: 'Autisti privati e flotta moderna', ar: 'سائقون خصوصيون وأسطول حديث' })} title={tx(locale, { en: 'Move through Egypt with ease', es: 'Muévete por Egipto con total comodidad', it: 'Muoviti in Egitto in totale comfort', ar: 'تنقّل في مصر براحة تامة' })} intro={tx(locale, { en: 'Airport pickups, day trips, and multi-city routes with a private driver and modern air-conditioned cars.', es: 'Recogidas en el aeropuerto, excursiones de un día y rutas entre ciudades con conductor privado y coches modernos con aire acondicionado.', it: 'Trasferimenti aeroportuali, gite giornaliere e itinerari tra più città con autista privato e auto moderne climatizzate.', ar: 'استقبال من المطار ورحلات يومية وخطوط بين المدن مع سائق خاص وسيارات حديثة مكيفة.' })} primaryLabel={tx(locale, { en: 'Explore the fleet', es: 'Descubre la flota', it: 'Scopri la flotta', ar: 'استكشف الأسطول' })} primaryHref="#fleet" secondaryLabel={tx(locale, { en: 'Request this vehicle', es: 'Solicita este vehículo', it: 'Richiedi questo veicolo', ar: 'اطلب هذه السيارة' })} secondaryHref={`/rent-car/request?vehicle=${featured.slug}`} railLabel={tx(locale, { en: 'Featured vehicle', es: 'Vehículo destacado', it: 'Veicolo in evidenza', ar: 'سيارة مميزة' })} railTitle={featured.title} railHref={`/rent-car/request?vehicle=${featured.slug}`} railMeta={[{ Icon: Users, label: featured.seats }, { Icon: CarFront, label: featured.transmission }]} statsLabel={tx(locale, { en: 'Fleet summary', es: 'Resumen de la flota', it: 'Riepilogo flotta', ar: 'ملخص الأسطول' })} stats={[{ value: liveCars.length, label: tx(locale, { en: 'Fleet choices', es: 'Opciones de vehículos', it: 'Scelte di veicoli', ar: 'خيارات سيارات' }) }, { value: maxSeats, label: tx(locale, { en: 'Seats maximum', es: 'Asientos máximos', it: 'Posti massimi', ar: 'مقعدًا كحد أقصى' }) }]}/>
    <div className="container">
    <PresentationSection pageId="cars" id="fleet"><section id="fleet" className="section">
      <div className="section-heading inline-heading"><div><span className="eyebrow">{cms.text("fleet","description0",tx(locale, { en: 'Our fleet', es: 'Nuestra flota', it: 'La nostra flotta', ar: 'الأسطول' }))}</span><h2>{cms.text("fleet","description1",tx(locale, { en: 'Comfort for every kind of journey', es: 'Comodidad para cada tipo de viaje', it: 'Comfort per ogni tipo di viaggio', ar: 'راحة لكل نوع رحلة' }))}</h2></div><CmsPublicLink className="text-link" href={cms.link("fleet","links0","/rent-car/request")}>{cms.text("fleet","description2",tx(locale, { en: 'Need a custom vehicle?', es: '¿Necesitas un vehículo a medida?', it: 'Serve un veicolo su misura?', ar: 'هل تحتاج إلى سيارة مخصصة؟' }))} <ArrowRight size={15} /></CmsPublicLink></div>
      <div className="fleet-grid">{liveCars.map((car) => <CarCard key={car.slug} car={car} />)}</div>
    </section></PresentationSection>
    </div>
  </main>
}

export function CarCard({ car }: { car: Car }) {
  const { currency, locale } = useLocale()
  const ar = locale === 'ar'
  return <article className="fleet-card">
    <div className="fleet-card-img">
      <img
        src={car.image}
        alt={car.title}
        loading="lazy"
        onError={(event) => {
          event.currentTarget.onerror = null
          event.currentTarget.src = '/fleet-vehicle-fallback.svg'
        }}
      />
      <span className="fleet-price-badge">{tx(locale, { en: 'Price on request', es: 'Precio a consultar', it: 'Prezzo su richiesta', ar: 'السعر عند الطلب' })}</span>
    </div>
    <div className="fleet-card-body">
      <div className="fleet-specs"><span><Users size={14} />{car.seats}</span><span><CarFront size={14} />{vehicleTransmissionLabel(car.transmission, locale)}</span></div>
      <h3>{car.title}</h3>
      <p>{car.copy}</p>
      {car.credit && <small className="fleet-credit"><a href={car.credit.url} target="_blank" rel="noreferrer">{car.credit.label}</a></small>}
      <Link href={`/rent-car/request?vehicle=${car.slug}`} className="primary-btn fleet-cta">{tx(locale, { en: 'Request this car', es: 'Solicita este coche', it: 'Richiedi quest\'auto', ar: 'اطلب هذه السيارة' })} <ArrowRight size={16} /></Link>
    </div>
  </article>
}

type CarRequestValues = { vehicleSlug: string; tripType: '' | 'One Way' | 'Round Trip'; pickup: string; dropoff: string; pickupLocationSlug: string; dropoffLocationSlug: string; pickupTime: string; returnTime: string; pickupDate: string; returnDate: string; passengers: string; fullName: string; email: string; phone: string; notes: string }

/** Select sentinel: "no structured location  -  free-text address". */
const CAR_OTHER_LOCATION = '__other__'

type CarLocationOption = { id: string; slug: string; nameEn: string; nameEs: string; nameIt: string; nameAr: string; kind: string }

function carLocationKindLabel(kind: string, locale: Locale): string {
  const label: Record<string, { en: string; es: string; it: string; ar: string }> = {
    AIRPORT: { en: 'Airport', es: 'Aeropuerto', it: 'Aeroporto', ar: 'مطار' },
    HOTEL: { en: 'Hotel', es: 'Hotel', it: 'Hotel', ar: 'فندق' },
    CITY: { en: 'City', es: 'Ciudad', it: 'Città', ar: 'مدينة' },
    CUSTOM: { en: 'Custom', es: 'Personalizado', it: 'Personalizzato', ar: 'مخصص' },
  }
  const entry = label[kind] ?? label.CUSTOM
  return tx(locale, entry)
}

function carLocationName(item: CarLocationOption, locale: Locale): string {
  const name = tx(locale, { en: item.nameEn, es: item.nameEs, it: item.nameIt, ar: item.nameAr })
  return name || item.nameEn
}

/** Display name for the summary card: resolved location name, custom text, or the Not set/placeholder fallback. */
function carLocationDisplayName(slug: string, customText: string, list: CarLocationOption[], locale: Locale, fallback: string): string {
  if (slug === '' || slug === CAR_OTHER_LOCATION) {
    const text = customText.trim()
    return text !== '' ? text : fallback
  }
  const item = list.find((entry) => entry.slug === slug)
  return item ? carLocationName(item, locale) : fallback
}

/** Joined chauffeur locations  -  public API; on failure use the legacy free-text flow. */
function useCarLocations() {
  const [locations, setLocations] = useState<CarLocationOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [version, setVersion] = useState(0)
  useEffect(() => {
    let cancelled = false
    setLoading(true); setError(false)
    fetch('/api/rent-car/locations', { credentials: 'same-origin' })
      .then(async (res) => {
        if (!res.ok) throw new Error('Locations unavailable')
        const data = (await res.json()) as { locations?: CarLocationOption[] }
        if (!cancelled) setLocations(Array.isArray(data.locations) ? data.locations : [])
      })
      .catch(() => { if (!cancelled) setError(true) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [version])
  return { locations, loading, error, retry: () => setVersion(value => value + 1) }
}


function carTodayLocal(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function focusCarField(id: string) {
  const el = document.getElementById(id)
  if (el) {
    if (!el.hasAttribute('tabindex') && !/^(INPUT|SELECT|TEXTAREA|BUTTON|A)$/.test(el.tagName)) el.setAttribute('tabindex', '-1')
    el.focus({ preventScroll: false })
    el.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }
}

export function CarRequestForm({ values, errors, summary, submitting, editing, locations, onChange, onSubmit }: { values: CarRequestValues; errors: CarFieldErrors; summary: string; submitting: boolean; editing: boolean; locations: CarLocationOption[]; onChange: (patch: Partial<CarRequestValues>) => void; onSubmit: (e: React.FormEvent) => void }) {
  const { locale } = useLocale()
  const ar = locale === 'ar'
  const fleet = useDbCarsStatus()
  const liveCars = fleet.data ?? []
  const today = carTodayLocal()
  const errText = (field: keyof CarFieldErrors): string => {
    const code = errors[field]
    if (!code) return ''
    if (field === 'passengers' && values.passengers.trim() === '') return tx(locale, { en: 'Enter the number of passengers.', es: 'Indica el número de pasajeros.', it: 'Indica il numero di passeggeri.', ar: 'أدخل عدد الركاب.' })
    const en: Record<string, string> = {
      vehicle: code === 'required' ? 'Select a vehicle.' : 'Select a vehicle from the fleet list.',
      tripType: 'Choose One Way or Round Trip.',
      pickup: code === 'required' ? 'Enter the pick-up location.' : `Pick-up location must be ${CAR_LOCATION_MAX} characters or fewer.`,
      dropoff: code === 'required' ? 'Enter the drop-off location.' : `Drop-off location must be ${CAR_LOCATION_MAX} characters or fewer.`,
      pickupDate: code === 'required' ? 'Enter your preferred pick-up date.' : 'Enter a valid preferred pick-up date (today or later).',
      returnDate: code === 'required' ? 'Enter your preferred return date.' : 'Enter a valid preferred return date on or after the pick-up date.',
      passengers: 'Passengers must be a whole number from 1 to 50.',
      pickupTime: 'Enter a valid pick-up time (HH:MM).',
      returnTime: 'Enter a valid return time (HH:MM).',
      name: code === 'required' ? 'Enter your full name.' : 'Enter a name with at least 2 letters.',
      email: code === 'required' ? 'Enter your email address.' : 'Enter a valid email address (name@example.com).',
      phone: code === 'required' ? 'Enter your phone number.' : 'Enter a valid phone number (at least 7 digits).',
      notes: `Notes must be ${CAR_NOTE_MAX} characters or fewer.`,
    }
    const arText: Record<string, string> = {
      vehicle: code === 'required' ? 'اختر السيارة.' : 'اختر سيارة من قائمة الأسطول.',
      tripType: 'اختر ذهاب فقط أو ذهاب وعودة.',
      pickup: code === 'required' ? 'أدخل مكان الاستلام.' : `يجب ألا يتجاوز مكان الاستلام ${CAR_LOCATION_MAX} حرفًا.`,
      dropoff: code === 'required' ? 'أدخل مكان الوصول.' : `يجب ألا يتجاوز مكان الوصول ${CAR_LOCATION_MAX} حرفًا.`,
      pickupDate: code === 'required' ? 'أدخل تاريخ الاستلام المفضل.' : 'أدخل تاريخ استلام مفضلًا صالحًا (اليوم أو بعده).',
      returnDate: code === 'required' ? 'أدخل تاريخ العودة المفضل.' : 'أدخل تاريخ عودة مفضلًا صالحًا في تاريخ الاستلام أو بعده.',
      passengers: 'يجب أن يكون عدد الركاب رقمًا صحيحًا من 1 إلى 50.',
      pickupTime: 'أدخل وقت استلام صالحًا (HH:MM).',
      returnTime: 'أدخل وقت عودة صالحًا (HH:MM).',
      name: code === 'required' ? 'أدخل اسمك الكامل.' : 'أدخل اسمًا من حرفين على الأقل.',
      email: code === 'required' ? 'أدخل بريدك الإلكتروني.' : 'أدخل بريدًا إلكترونيًا صالحًا (name@example.com).',
      phone: code === 'required' ? 'أدخل رقم هاتفك.' : 'أدخل رقم هاتف صالحًا (7 أرقام على الأقل).',
      notes: `يجب ألا تتجاوز الملاحظات ${CAR_NOTE_MAX} حرف.`,
    }
    const esText: Record<string, string> = {
      vehicle: code === 'required' ? 'Selecciona un vehículo.' : 'Selecciona un vehículo de la lista de la flota.',
      tripType: 'Elige Solo ida o Ida y vuelta.',
      pickup: code === 'required' ? 'Indica el lugar de recogida.' : `El lugar de recogida debe tener ${CAR_LOCATION_MAX} caracteres como máximo.`,
      dropoff: code === 'required' ? 'Indica el lugar de entrega.' : `El lugar de entrega debe tener ${CAR_LOCATION_MAX} caracteres como máximo.`,
      pickupDate: code === 'required' ? 'Indica la fecha de recogida preferida.' : 'Indica una fecha de recogida válida (hoy o posterior).',
      returnDate: code === 'required' ? 'Indica la fecha de regreso preferida.' : 'Indica una fecha de regreso válida igual o posterior a la de recogida.',
      passengers: 'El número de pasajeros debe ser un número entero entre 1 y 50.',
      pickupTime: 'Indica una hora de recogida válida (HH:MM).',
      returnTime: 'Indica una hora de regreso válida (HH:MM).',
      name: code === 'required' ? 'Indica tu nombre completo.' : 'Indica un nombre con al menos 2 letras.',
      email: code === 'required' ? 'Indica tu correo electrónico.' : 'Indica un correo válido (nombre@ejemplo.com).',
      phone: code === 'required' ? 'Indica tu número de teléfono.' : 'Indica un teléfono válido (al menos 7 dígitos).',
      notes: `Las notas deben tener ${CAR_NOTE_MAX} caracteres como máximo.`,
    }
    const itText: Record<string, string> = {
      vehicle: code === 'required' ? 'Seleziona un veicolo.' : 'Seleziona un veicolo dalla lista della flotta.',
      tripType: 'Scegli Solo andata o Andata e ritorno.',
      pickup: code === 'required' ? 'Indica il luogo di ritiro.' : `Il luogo di ritiro deve avere al massimo ${CAR_LOCATION_MAX} caratteri.`,
      dropoff: code === 'required' ? 'Indica il luogo di riconsegna.' : `Il luogo di riconsegna deve avere al massimo ${CAR_LOCATION_MAX} caratteri.`,
      pickupDate: code === 'required' ? 'Indica la data di ritiro preferita.' : 'Indica una data di ritiro valida (oggi o successiva).',
      returnDate: code === 'required' ? 'Indica la data di ritorno preferita.' : 'Indica una data di ritorno valida pari o successiva a quella di ritiro.',
      passengers: 'Il numero di passeggeri deve essere un intero da 1 a 50.',
      pickupTime: 'Indica un orario di ritiro valido (HH:MM).',
      returnTime: 'Indica un orario di ritorno valido (HH:MM).',
      name: code === 'required' ? 'Indica il tuo nome completo.' : 'Indica un nome di almeno 2 lettere.',
      email: code === 'required' ? 'Indica il tuo indirizzo email.' : 'Indica un indirizzo email valido (nome@esempio.com).',
      phone: code === 'required' ? 'Indica il tuo numero di telefono.' : 'Indica un numero valido (almeno 7 cifre).',
      notes: `Le note devono avere al massimo ${CAR_NOTE_MAX} caratteri.`,
    }
    return tx(locale, { en: en[field], es: esText[field], it: itText[field], ar: arText[field] })
  }
  return <form className="contact-form car-request-form" onSubmit={onSubmit} noValidate>
    <fieldset aria-label={tx(locale, { en: 'Transfer request details', es: 'Datos de la solicitud de traslado', it: 'Dettagli della richiesta di trasferimento' })} disabled={submitting} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
    {summary !== '' && <p className="co-error" role="alert" style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 6px' }}><CircleAlert size={15} />{summary}</p>}
    <div className="form-grid">
      <label className="full" htmlFor="car-vehicle"><span className="car-field-label">{tx(locale, { en: 'Vehicle', es: 'Vehículo', it: 'Veicolo', ar: 'السيارة' })} <em className="req" aria-hidden="true">*</em></span><SharedSelect id="car-vehicle" value={values.vehicleSlug} onChange={(next) => onChange({ vehicleSlug: next })} locale={locale} invalid={Boolean(errors.vehicle)} describedBy={errors.vehicle ? 'car-vehicle-error' : undefined} options={[{ value: '', label: tx(locale, { en: 'Select a vehicle', es: 'Selecciona un vehículo', it: 'Seleziona un veicolo', ar: 'اختر السيارة' }) }, ...liveCars.filter((c) => c.isPublished !== false).map((c) => ({ value: c.slug, label: `${c.title} · ${c.seats}` }))]} />{errors.vehicle && <span className="field-error" id="car-vehicle-error" role="alert">{errText('vehicle')}</span>}</label>
      <div className="full req-trip-type"><span id="req-trip-label">{tx(locale, { en: 'Trip type', es: 'Tipo de viaje', it: 'Tipo di viaggio', ar: 'نوع الرحلة' })} <em className="req" aria-hidden="true">*</em></span><div role="radiogroup" aria-labelledby="req-trip-label" aria-describedby={errors.tripType ? 'car-triptype-error' : undefined}>{(['One Way', 'Round Trip'] as const).map((opt) => <button key={opt} type="button" role="radio" aria-checked={values.tripType === opt} tabIndex={values.tripType === opt || (!values.tripType && opt === 'One Way') ? 0 : -1} onKeyDown={event => { const next = carTripTypeForKey(values.tripType, event.key); if (next) { event.preventDefault(); onChange({ tripType: next }); event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('button')[next === 'One Way' ? 0 : 1]?.focus() } }} className={values.tripType === opt ? 'active' : ''} onClick={() => onChange({ tripType: opt })}>{opt === 'One Way' ? (tx(locale, { en: 'One Way', es: 'Solo ida', it: 'Solo andata', ar: 'ذهاب فقط' })) : (tx(locale, { en: 'Round Trip', es: 'Ida y vuelta', it: 'Andata e ritorno', ar: 'ذهاب وعودة' }))}</button>)}</div>{errors.tripType && <span className="field-error" id="car-triptype-error" role="alert">{errText('tripType')}</span>}</div>
      {locations.length > 0 ? <>
        <div className="car-location-field"><label htmlFor="car-pickup"><span className="car-field-label">{tx(locale, { en: 'Pick-up location', es: 'Lugar de recogida', it: 'Luogo di ritiro', ar: 'مكان الاستلام' })} <em className="req" aria-hidden="true">*</em></span><SharedSelect id="car-pickup" value={values.pickupLocationSlug} onChange={(next) => onChange({ pickupLocationSlug: next })} locale={locale} invalid={Boolean(errors.pickup)} describedBy={errors.pickup ? 'car-pickup-error' : undefined} options={[{ value: '', label: tx(locale, { en: 'Select a pick-up location', es: 'Selecciona un lugar de recogida', it: 'Seleziona il luogo di ritiro', ar: 'اختر مكان الاستلام' }) }, ...locations.map((item) => ({ value: item.slug, label: `${carLocationName(item, locale)}${item.kind !== 'CUSTOM' ? ` · ${carLocationKindLabel(item.kind, locale)}` : ''}` })), { value: CAR_OTHER_LOCATION, label: tx(locale, { en: 'Other  -  enter address manually', es: 'Otro  -  introducir dirección manualmente', it: 'Altro  -  inserisci l\'indirizzo manualmente', ar: 'أخرى  -  أدخل العنوان يدويًا' }) }]} />{errors.pickup && <span className="field-error" id="car-pickup-error" role="alert">{errText('pickup')}</span>}</label>
        {values.pickupLocationSlug === '' ? <label className="full" htmlFor="car-pickup-custom"><span className="car-field-label">{tx(locale, { en: 'Pick-up address (custom)', es: 'Dirección de recogida (personalizada)', it: 'Indirizzo di ritiro (personalizzato)', ar: 'عنوان الاستلام (مخصص)' })}</span><input id="car-pickup-custom" placeholder={tx(locale, { en: 'Airport, hotel, or city', es: 'Aeropuerto, hotel o ciudad', it: 'Aeroporto, hotel o città', ar: 'المطار أو الفندق أو المدينة' })} maxLength={CAR_LOCATION_MAX} value={values.pickup} onChange={(e) => onChange({ pickup: e.target.value })} /></label> : null}
        </div><div className="car-location-field"><label htmlFor="car-dropoff"><span className="car-field-label">{tx(locale, { en: 'Drop-off location', es: 'Lugar de entrega', it: 'Luogo di riconsegna', ar: 'مكان الوصول' })} <em className="req" aria-hidden="true">*</em></span><SharedSelect id="car-dropoff" value={values.dropoffLocationSlug} onChange={(next) => onChange({ dropoffLocationSlug: next })} locale={locale} invalid={Boolean(errors.dropoff)} describedBy={errors.dropoff ? 'car-dropoff-error' : undefined} options={[{ value: '', label: tx(locale, { en: 'Select a drop-off location', es: 'Selecciona un lugar de entrega', it: 'Seleziona il luogo di riconsegna', ar: 'اختر مكان الوصول' }) }, ...locations.map((item) => ({ value: item.slug, label: `${carLocationName(item, locale)}${item.kind !== 'CUSTOM' ? ` · ${carLocationKindLabel(item.kind, locale)}` : ''}` })), { value: CAR_OTHER_LOCATION, label: tx(locale, { en: 'Other  -  enter address manually', es: 'Otro  -  introducir dirección manualmente', it: 'Altro  -  inserisci l\'indirizzo manualmente', ar: 'أخرى  -  أدخل العنوان يدويًا' }) }]} />{errors.dropoff && <span className="field-error" id="car-dropoff-error" role="alert">{errText('dropoff')}</span>}</label>
        {values.dropoffLocationSlug === '' ? <label className="full" htmlFor="car-dropoff-custom"><span className="car-field-label">{tx(locale, { en: 'Drop-off address (custom)', es: 'Dirección de entrega (personalizada)', it: 'Indirizzo di riconsegna (personalizzato)', ar: 'عنوان الوصول (مخصص)' })}</span><input id="car-dropoff-custom" placeholder={tx(locale, { en: 'Where are you going?', es: '¿A dónde vas?', it: 'Dove sei diretto?', ar: 'إلى أين تريد الذهاب؟' })} maxLength={CAR_LOCATION_MAX} value={values.dropoff} onChange={(e) => onChange({ dropoff: e.target.value })} /></label> : null}
        </div>
      </>
      : <>
        <label htmlFor="car-pickup"><span className="car-field-label">{tx(locale, { en: 'Pick-up location', es: 'Lugar de recogida', it: 'Luogo di ritiro', ar: 'مكان الاستلام' })} <em className="req" aria-hidden="true">*</em></span><input id="car-pickup" required placeholder={tx(locale, { en: 'Airport, hotel, or city', es: 'Aeropuerto, hotel o ciudad', it: 'Aeroporto, hotel o città', ar: 'المطار أو الفندق أو المدينة' })} maxLength={CAR_LOCATION_MAX} value={values.pickup} onChange={(e) => onChange({ pickup: e.target.value })} aria-invalid={Boolean(errors.pickup)} aria-describedby={errors.pickup ? 'car-pickup-error' : undefined} />{errors.pickup && <span className="field-error" id="car-pickup-error" role="alert">{errText('pickup')}</span>}</label>
        <label htmlFor="car-dropoff"><span className="car-field-label">{tx(locale, { en: 'Drop-off location', es: 'Lugar de entrega', it: 'Luogo di riconsegna', ar: 'مكان الوصول' })} <em className="req" aria-hidden="true">*</em></span><input id="car-dropoff" required placeholder={tx(locale, { en: 'Where are you going?', es: '¿A dónde vas?', it: 'Dove sei diretto?', ar: 'إلى أين تريد الذهاب؟' })} maxLength={CAR_LOCATION_MAX} value={values.dropoff} onChange={(e) => onChange({ dropoff: e.target.value })} aria-invalid={Boolean(errors.dropoff)} aria-describedby={errors.dropoff ? 'car-dropoff-error' : undefined} />{errors.dropoff && <span className="field-error" id="car-dropoff-error" role="alert">{errText('dropoff')}</span>}</label>
      </>}
      <label htmlFor="car-pickup-time"><span className="car-field-label">{tx(locale, { en: 'Pick-up time (optional)', es: 'Hora de recogida (opcional)', it: 'Orario di ritiro (facoltativo)', ar: 'وقت الاستلام (اختياري)' })}</span><input id="car-pickup-time" type="time" dir="ltr" value={values.pickupTime} onChange={(e) => onChange({ pickupTime: e.target.value.slice(0, 5) })} aria-invalid={Boolean(errors.pickupTime)} aria-describedby={errors.pickupTime ? 'car-pickup-time-error' : undefined} />{errors.pickupTime && <span className="field-error" id="car-pickup-time-error" role="alert">{errText('pickupTime')}</span>}</label>
      {values.tripType === 'Round Trip' && <label htmlFor="car-return-time"><span className="car-field-label">{tx(locale, { en: 'Return time (optional)', es: 'Hora de regreso (opcional)', it: 'Orario di ritorno (facoltativo)', ar: 'وقت العودة (اختياري)' })}</span><input id="car-return-time" type="time" dir="ltr" value={values.returnTime} onChange={(e) => onChange({ returnTime: e.target.value.slice(0, 5) })} aria-invalid={Boolean(errors.returnTime)} aria-describedby={errors.returnTime ? 'car-return-time-error' : undefined} />{errors.returnTime && <span className="field-error" id="car-return-time-error" role="alert">{errText('returnTime')}</span>}</label>}
      <label htmlFor="car-pickup-date"><span className="car-field-label">{tx(locale, { en: 'Preferred pick-up date', es: 'Fecha de recogida preferida', it: 'Data di ritiro preferita', ar: 'تاريخ الاستلام المفضل' })} <em className="req" aria-hidden="true">*</em></span><DateInput id="car-pickup-date" required min={today} dir="ltr" value={values.pickupDate} onChange={(e) => onChange({ pickupDate: e.target.value })} aria-invalid={Boolean(errors.pickupDate)} aria-describedby={errors.pickupDate ? 'car-pickup-date-error' : undefined} />{errors.pickupDate && <span className="field-error" id="car-pickup-date-error" role="alert">{errText('pickupDate')}</span>}</label>
      {values.tripType === 'Round Trip'
        ? <label htmlFor="car-return-date"><span className="car-field-label">{tx(locale, { en: 'Preferred return date', es: 'Fecha de regreso preferida', it: 'Data di ritorno preferita', ar: 'تاريخ العودة المفضل' })} <em className="req" aria-hidden="true">*</em></span><DateInput id="car-return-date" required min={values.pickupDate || today} dir="ltr" value={values.returnDate} onChange={(e) => onChange({ returnDate: e.target.value })} aria-invalid={Boolean(errors.returnDate)} aria-describedby={errors.returnDate ? 'car-return-date-error' : undefined} />{errors.returnDate && <span className="field-error" id="car-return-date-error" role="alert">{errText('returnDate')}</span>}</label>
        : <label htmlFor="car-passengers"><span className="car-field-label">{tx(locale, { en: 'Passengers', es: 'Pasajeros', it: 'Passeggeri', ar: 'عدد الركاب' })} <em className="req" aria-hidden="true">*</em></span><input id="car-passengers" required type="number" min="1" max="50" placeholder="2" dir="ltr" value={values.passengers} onChange={(e) => onChange({ passengers: e.target.value })} aria-invalid={Boolean(errors.passengers)} aria-describedby={errors.passengers ? 'car-passengers-error' : undefined} />{errors.passengers && <span className="field-error" id="car-passengers-error" role="alert">{errText('passengers')}</span>}</label>}
      {values.tripType === 'Round Trip' && <label className="full" htmlFor="car-passengers-rt"><span className="car-field-label">{tx(locale, { en: 'Passengers', es: 'Pasajeros', it: 'Passeggeri', ar: 'عدد الركاب' })} <em className="req" aria-hidden="true">*</em></span><input id="car-passengers-rt" required type="number" min="1" max="50" placeholder="2" dir="ltr" value={values.passengers} onChange={(e) => onChange({ passengers: e.target.value })} aria-invalid={Boolean(errors.passengers)} aria-describedby={errors.passengers ? 'car-passengers-error' : undefined} />{errors.passengers && <span className="field-error" id="car-passengers-error" role="alert">{errText('passengers')}</span>}</label>}
      <label className="full" htmlFor="car-name"><span className="car-field-label">{tx(locale, { en: 'Full name', es: 'Nombre completo', it: 'Nome completo', ar: 'الاسم الكامل' })} <em className="req" aria-hidden="true">*</em></span><input id="car-name" required placeholder={tx(locale, { en: 'Your full name', es: 'Tu nombre completo', it: 'Il tuo nome completo', ar: 'اكتب اسمك الكامل' })} maxLength={80} autoComplete="name" value={values.fullName} onChange={(e) => onChange({ fullName: e.target.value })} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'car-name-error' : undefined} />{errors.name && <span className="field-error" id="car-name-error" role="alert">{errText('name')}</span>}</label>
      <label htmlFor="car-email"><span className="car-field-label">{tx(locale, { en: 'Email', es: 'Correo electrónico', it: 'Email', ar: 'البريد الإلكتروني' })} <em className="req" aria-hidden="true">*</em></span><input id="car-email" required type="email" placeholder="you@example.com" maxLength={120} autoComplete="email" dir="ltr" value={values.email} onChange={(e) => onChange({ email: e.target.value })} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'car-email-error' : undefined} />{errors.email && <span className="field-error" id="car-email-error" role="alert">{errText('email')}</span>}</label>
      <label htmlFor="car-phone"><span className="car-field-label">{tx(locale, { en: 'Phone', es: 'Teléfono', it: 'Telefono', ar: 'رقم الهاتف' })} <em className="req" aria-hidden="true">*</em></span><InternationalPhoneInput id="car-phone" required value={values.phone} onChange={(phone) => onChange({ phone })} locale={locale} invalid={Boolean(errors.phone)} describedBy={errors.phone ? 'car-phone-error' : undefined} />{errors.phone && <span className="field-error" id="car-phone-error" role="alert">{errText('phone')}</span>}</label>
      <label className="full" htmlFor="car-notes"><span className="car-field-label">{tx(locale, { en: 'Notes (optional)', es: 'Notas (opcional)', it: 'Note (facoltativo)', ar: 'ملاحظات (اختياري)' })}</span><textarea id="car-notes" placeholder={tx(locale, { en: 'Tell us about your route', es: 'Cuéntanos tu ruta', it: 'Raccontaci il tuo itinerario', ar: 'حدثنا عن خط سيرك' })} maxLength={CAR_NOTE_MAX + 1} value={values.notes} onChange={(e) => onChange({ notes: e.target.value })} aria-invalid={Boolean(errors.notes)} aria-describedby={errors.notes ? 'car-notes-error' : 'car-notes-hint'} />{errors.notes && <span className="field-error" id="car-notes-error" role="alert">{errText('notes')}</span>}<small id="car-notes-hint" style={{ color: 'var(--muted)', fontWeight: 500 }}>{values.notes.length}/{CAR_NOTE_MAX}</small></label>
    </div>
    <button className="primary-btn" type="submit" disabled={submitting || fleet.loading || !!fleet.error || !liveCars.some(car => car.isPublished !== false)}>{submitting ? (tx(locale, { en: 'Submitting…', es: 'Enviando…', it: 'Invio…', ar: 'جارٍ الإرسال…' })) : editing ? (tx(locale, { en: 'Save changes', es: 'Guardar cambios', it: 'Salva modifiche', ar: 'حفظ التعديلات' })) : (tx(locale, { en: 'Submit request', es: 'Enviar solicitud', it: 'Invia richiesta', ar: 'إرسال الطلب' }))} <ArrowRight size={17} /></button>
    </fieldset>
  </form>
}

export function CarRequestPage() {
  return <SiteShell><Suspense><CarRequestContent /></Suspense></SiteShell>
}

function CarRequestContent() {
  const brand = useBrandSettings()
  const params = useSearchParams()
  const initial = parseCarRequestQuery(params)
  const rawVehicleSlug = (() => {
    const raw = (params.get('vehicle') ?? '').trim().slice(0, 80)
    return /^[a-z0-9-]{1,80}$/.test(raw) ? raw : ''
  })()
  const { currency, locale } = useLocale()
  const ar = locale === 'ar'
  const { user: sessionUser } = useCurrentUser()
  const fleet = useDbCarsStatus()
  const liveCars = fleet.data ?? []
  const [values, setValues] = useState<CarRequestValues>({ vehicleSlug: initial.vehicleSlug || rawVehicleSlug, tripType: initial.tripType ?? '', pickup: initial.pickup, dropoff: initial.dropoff, pickupLocationSlug: '', dropoffLocationSlug: '', pickupTime: '', returnTime: '', pickupDate: initial.date, returnDate: '', passengers: '', fullName: '', email: '', phone: '', notes: '' })
  const [placed, setPlaced] = useState<CarRequest | null>(null)
  const [editingRef, setEditingRef] = useState<string | null>(null)
  const [errors, setErrors] = useState<CarFieldErrors>({})
  const [summary, setSummary] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const locationState = useCarLocations()
  const locations = locationState.locations
  const submittingRef = useRef(false)
  const patch = (p: Partial<CarRequestValues>) => setValues((v) => ({ ...v, ...p }))
  const vehicle = liveCars.find((car) => car.slug === values.vehicleSlug && car.isPublished !== false)
  const capacity = vehicle ? parseVehicleCapacity(vehicle.seats) : null
  const capacityInvalid = !!vehicle && (capacity === null || Number(values.passengers) > capacity)
  const quoteReady = Boolean(vehicle && values.pickupLocationSlug && values.pickupLocationSlug !== CAR_OTHER_LOCATION && values.dropoffLocationSlug && values.dropoffLocationSlug !== CAR_OTHER_LOCATION && values.tripType && /^\d+$/.test(values.passengers.trim()) && Number(values.passengers) >= 1 && Number(values.passengers) <= 50)
  const { state: quoteState, retry: retryQuote } = useCarQuote(quoteReady ? { vehicle: values.vehicleSlug, from: values.pickupLocationSlug, to: values.dropoffLocationSlug, trip: values.tripType === 'Round Trip' ? 'round-trip' : 'one-way', passengers: Number(values.passengers) } : null)
  const step = placed ? 3 : vehicle ? 2 : 1
  const notSet = tx(locale, { en: 'Not set', es: 'Sin definir', it: 'Non definito', ar: 'لم يحدد' })
  const tripLabel = values.tripType === '' ? notSet : values.tripType === 'One Way' ? (tx(locale, { en: 'One Way', es: 'Solo ida', it: 'Solo andata', ar: 'ذهاب فقط' })) : (tx(locale, { en: 'Round Trip', es: 'Ida y vuelta', it: 'Andata e ritorno', ar: 'ذهاب وعودة' }))
  const steps = [tx(locale, { en: 'Choose vehicle', es: 'Elige el vehículo', it: 'Scegli il veicolo', ar: 'اختيار السيارة' }), tx(locale, { en: 'Trip details', es: 'Detalles del viaje', it: 'Dettagli del viaggio', ar: 'تفاصيل الرحلة' }), tx(locale, { en: 'Submitted', es: 'Enviada', it: 'Inviata', ar: 'تم الإرسال' })]
  const hasQuerySignal = Boolean(initial.vehicleSlug || rawVehicleSlug || initial.pickup || initial.dropoff || initial.date || initial.tripType)
  const editParam = (() => {
    const raw = (params.get('edit') ?? '').trim()
    return isCarReference(raw) ? raw : null
  })()

  // Prefill contact details from the signed-in account as editable copies.
  useEffect(() => {
    if (!sessionUser) return
    setValues((v) => {
      const name = `${sessionUser.firstName ?? ''} ${sessionUser.lastName ?? ''}`.trim()
      return {
        ...v,
        fullName: v.fullName || name,
        email: v.email || sessionUser.email || '',
        phone: v.phone || sessionUser.phone || '',
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionUser])

  // Edit mode: `?edit=SP-CR-…` loads the customer's own record for editing.
  // The query is read once; a foreign or missing record fails honestly.
  useEffect(() => {
    if (!editParam || hasQuerySignal) return
    let cancelled = false
    fetch(`/api/account/car-requests/${encodeURIComponent(editParam)}`, { credentials: 'same-origin' })
      .then(async (res) => {
        if (cancelled) return
        const data = (await res.json()) as CarRequest & { error?: string }
        if (!res.ok) throw new Error(data.error || 'Car request not found.')
        if (data.status !== 'new' && data.status !== 'reviewing') {
          throw new Error(tx(locale, { en: 'This request can no longer be edited.', es: 'Esta solicitud ya no se puede editar.', it: 'Questa richiesta non può più essere modificata.', ar: 'هذا الطلب لم يعد قابلًا للتعديل.' }))
        }
        const shaped = sanitizeCarDraft({
          vehicleSlug: data.vehicleSlug,
          tripType: data.tripType,
          pickup: data.pickup,
          dropoff: data.dropoff,
          preferredPickupDate: data.preferredPickupDate,
          preferredReturnDate: data.preferredReturnDate,
          passengers: data.passengers,
          notes: data.notes,
          contact: { fullName: data.contact.name, email: data.contact.email, phone: data.contact.phone },
          currency,
        })
        if (!shaped || cancelled) return
        setValues({
          vehicleSlug: shaped.vehicleSlug,
          tripType: shaped.tripType,
          pickup: shaped.pickup,
          dropoff: shaped.dropoff,
          pickupLocationSlug: shaped.pickupLocationSlug ?? CAR_OTHER_LOCATION,
          dropoffLocationSlug: shaped.dropoffLocationSlug ?? CAR_OTHER_LOCATION,
          pickupTime: shaped.pickupTime ?? '',
          returnTime: shaped.returnTime ?? '',
          pickupDate: shaped.preferredPickupDate,
          returnDate: shaped.preferredReturnDate,
          passengers: String(shaped.passengers),
          fullName: shaped.contact.fullName,
          email: shaped.contact.email,
          phone: shaped.contact.phone,
          notes: shaped.notes,
        })
        setEditingRef(data.reference)
      })
      .catch((error: unknown) => {
        if (!cancelled) setSummary(error instanceof Error ? error.message : 'Car request not found.')
      })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const buildDraft = (): CarRequestDraft => {
    const pax = values.passengers.trim()
    const structured = values.pickupLocationSlug !== CAR_OTHER_LOCATION && values.dropoffLocationSlug !== CAR_OTHER_LOCATION && values.pickupLocationSlug !== '' && values.dropoffLocationSlug !== ''
    const pickupSlug = structured ? values.pickupLocationSlug : ''
    const dropSlug = structured ? values.dropoffLocationSlug : ''
    const pickupName = carLocationDisplayName(values.pickupLocationSlug, values.pickup, locations, locale, '')
    const dropName = carLocationDisplayName(values.dropoffLocationSlug, values.dropoff, locations, locale, '')
    return {
      vehicleSlug: values.vehicleSlug,
      tripType: values.tripType,
      pickup: pickupName,
      dropoff: dropName,
      pickupLocationSlug: pickupSlug,
      dropoffLocationSlug: dropSlug,
      pickupTime: values.pickupTime,
      returnTime: values.tripType === 'Round Trip' ? values.returnTime : '',
      preferredPickupDate: values.pickupDate,
      preferredReturnDate: values.tripType === 'Round Trip' ? values.returnDate : '',
      passengers: pax === '' ? Number.NaN : Number(pax),
      notes: values.notes.trim().slice(0, CAR_NOTE_MAX + 1),
      contact: { fullName: values.fullName.trim(), email: values.email.trim(), phone: values.phone.trim() },
      currency,
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (submittingRef.current) return
    const raw = buildDraft()
    const errs = validateCarRequest(raw)
    if (!vehicle) errs.vehicle = 'invalid'
    setErrors(errs)
    if (hasCarErrors(errs)) {
      setSummary(tx(locale, { en: 'Could not submit the request. Review the highlighted fields below.', es: 'No se pudo enviar la solicitud. Revisa los campos marcados abajo.', it: 'Impossibile inviare la richiesta. Controlla i campi evidenziati qui sotto.', ar: 'تعذر إرسال الطلب. راجع الحقول الموضحة أدناه.' }))
      const ids: Record<keyof CarFieldErrors, string> = { vehicle: 'car-vehicle', tripType: 'req-trip-label', pickup: 'car-pickup', dropoff: 'car-dropoff', pickupDate: 'car-pickup-date', returnDate: 'car-return-date', passengers: values.tripType === 'Round Trip' ? 'car-passengers-rt' : 'car-passengers', pickupTime: 'car-pickup-time', returnTime: 'car-return-time', name: 'car-name', email: 'car-email', phone: 'car-phone', notes: 'car-notes' }
      const order: Array<keyof CarFieldErrors> = ['vehicle', 'tripType', 'pickup', 'dropoff', 'pickupDate', 'returnDate', 'passengers', 'pickupTime', 'returnTime', 'name', 'email', 'phone', 'notes']
      for (const field of order) {
        if (errs[field]) {
          focusCarField(ids[field])
          break
        }
      }
      return
    }
    const preview = { ...raw, notes: raw.notes.slice(0, CAR_NOTE_MAX) }
    submittingRef.current = true
    setSubmitting(true)
    const url = editingRef
      ? `/api/account/car-requests/${encodeURIComponent(editingRef)}`
      : '/api/car-requests'
    const measurement = editingRef ? null : beginFormLead(window, process.env.NODE_ENV, 'car_request')
    fetch(url, {
      method: editingRef ? 'PATCH' : 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(editingRef ? { action: 'update', draft: preview } : preview),
    })
      .then(async (res) => {
        const data = (await res.json()) as CarRequest & { error?: string }
        if (!res.ok) throw new Error(data.error || 'Could not submit the request.')
        if (measurement) confirmFormLead(window, process.env.NODE_ENV, measurement, res.status, data)
        setErrors({})
        setSummary('')
        setEditingRef(null)
        setPlaced(data)
        window.setTimeout(() => focusCarField('car-preview-title'), 50)
      })
      .catch((error: unknown) => {
        setSummary(error instanceof Error ? error.message : (tx(locale, { en: 'Could not submit the request. Please try again.', es: 'No se pudo enviar la solicitud. Inténtalo de nuevo.', it: 'Impossibile inviare la richiesta. Riprova.', ar: 'تعذر إرسال الطلب. حاول مجددًا.' })))
      })
      .finally(() => { submittingRef.current = false; setSubmitting(false) })
  }

  const handleEdit = () => {
    setPlaced(null)
    window.setTimeout(() => focusCarField('car-vehicle'), 50)
  }

  const renderPreview = (record: CarRequest) => {
    const d = {
      vehicleSlug: record.vehicleSlug,
      tripType: record.tripType,
      pickup: record.pickup,
      dropoff: record.dropoff,
      preferredPickupDate: record.preferredPickupDate,
      preferredReturnDate: record.preferredReturnDate,
      passengers: record.passengers,
      notes: record.notes,
      contact: { fullName: record.contact.name, email: record.contact.email, phone: record.contact.phone },
    }
    const previewCar = liveCars.find((car) => car.slug === d.vehicleSlug)
    const dateRows = d.tripType === 'Round Trip' && d.preferredReturnDate !== ''
      ? [{ label: tx(locale, { en: 'Preferred return date', es: 'Fecha de regreso preferida', it: 'Data di ritorno preferita', ar: 'تاريخ العودة المفضل' }), value: d.preferredReturnDate, ltr: true }]
      : []
    const timeRows: { label: string; value: string }[] = [
      ...(record.pickupTime ? [{ label: tx(locale, { en: 'Pick-up time', es: 'Hora de recogida', it: 'Orario di ritiro', ar: 'وقت الاستلام' }), value: record.pickupTime }] : []),
      ...(record.returnTime ? [{ label: tx(locale, { en: 'Return time', es: 'Hora de regreso', it: 'Orario di ritorno', ar: 'وقت العودة' }), value: record.returnTime }] : []),
    ]
    return <div className="form-success large">
      <Check size={42} />
      <h1 id="car-preview-title" tabIndex={-1}>{tx(locale, { en: 'Car request submitted', es: 'Solicitud de coche enviada', it: 'Richiesta auto inviata', ar: 'تم إرسال طلب السيارة' })}</h1>
      <span className="req-ref" dir="ltr">{tx(locale, { en: 'Reference: ', es: 'Referencia: ', it: 'Riferimento: ', ar: 'المرجع: ' })}{record.reference}</span>
      <div className="req-summary-rows" style={{ maxWidth: 520, margin: '18px auto', textAlign: 'start' }}>
        <div><span>{tx(locale, { en: 'Requested vehicle', es: 'Vehículo solicitado', it: 'Veicolo richiesto', ar: 'السيارة المطلوبة' })}</span><strong>{previewCar?.title ?? d.vehicleSlug}</strong></div>
        <div><span>{tx(locale, { en: 'Trip type', es: 'Tipo', it: 'Tipo', ar: 'النوع' })}</span><strong>{d.tripType === 'One Way' ? (tx(locale, { en: 'One Way', es: 'Solo ida', it: 'Solo andata', ar: 'ذهاب فقط' })) : d.tripType === 'Round Trip' ? (tx(locale, { en: 'Round Trip', es: 'Ida y vuelta', it: 'Andata e ritorno', ar: 'ذهاب وعودة' })) : notSet}</strong></div>
        <div><span>{tx(locale, { en: 'From', es: 'Desde', it: 'Da', ar: 'من' })}</span><strong>{d.pickup}</strong></div>
        <div><span>{tx(locale, { en: 'To', es: 'Hasta', it: 'A', ar: 'إلى' })}</span><strong>{d.dropoff}</strong></div>
        <div><span>{tx(locale, { en: 'Preferred pick-up date', es: 'Fecha de recogida preferida', it: 'Data di ritiro preferita', ar: 'تاريخ الاستلام المفضل' })}</span><strong dir="ltr">{d.preferredPickupDate}</strong></div>
        {dateRows.map((row) => <div key={row.label}><span>{row.label}</span><strong dir="ltr">{row.value}</strong></div>)}
        {timeRows.map((row) => <div key={row.label}><span>{row.label}</span><strong dir="ltr">{row.value}</strong></div>)}
        {(record.quote || record.pickupLocationSlug) && <CarQuoteSummary quote={record.quote} locale={locale} tripType={record.tripType} saved/>}
        <div><span>{tx(locale, { en: 'Passengers', es: 'Pasajeros', it: 'Passeggeri', ar: 'الركاب' })}</span><strong>{d.passengers}</strong></div>
        <div><span>{tx(locale, { en: 'Full name', es: 'Nombre completo', it: 'Nome completo', ar: 'الاسم الكامل' })}</span><strong>{d.contact.fullName}</strong></div>
        <div><span>{tx(locale, { en: 'Email', es: 'Correo electrónico', it: 'Email', ar: 'البريد الإلكتروني' })}</span><strong dir="ltr">{d.contact.email}</strong></div>
        <div><span>{tx(locale, { en: 'Phone', es: 'Teléfono', it: 'Telefono', ar: 'رقم الهاتف' })}</span><strong dir="ltr">{d.contact.phone}</strong></div>
        {d.notes !== '' && <div><span>{tx(locale, { en: 'Notes', es: 'Notas', it: 'Note', ar: 'ملاحظات' })}</span><strong style={{ whiteSpace: 'pre-wrap' }}>{d.notes}</strong></div>}
      </div>
      <p><CircleAlert size={15} style={{ verticalAlign: '-2px', marginInlineEnd: 6 }} />{tx(locale, { en: 'We have received your request and our team will review it. Keep the reference above.', es: 'Hemos recibido tu solicitud y nuestro equipo la revisará. Guarda la referencia de arriba.', it: 'Abbiamo ricevuto la tua richiesta e il nostro team la esaminerà. Conserva il riferimento qui sopra.', ar: 'استلمنا طلبك وسيراجعه فريقنا. احتفظ بالمرجع أعلاه.' })}</p>
      <p>{tx(locale, { en: 'No vehicle has been reserved, no availability was checked, and no rate was confirmed.', es: 'No se ha reservado ningún vehículo, no se ha comprobado disponibilidad ni se ha confirmado ninguna tarifa.', it: 'Nessun veicolo è stato prenotato, nessuna disponibilità è stata verificata e nessuna tariffa è stata confermata.', ar: 'لم يتم حجز أي سيارة ولم يتم التحقق من التوافر أو تأكيد أي سعر.' })}</p>
      <div className="car-success-actions">
        {sessionUser
          ? <><button type="button" className="outline-btn" onClick={handleEdit}>{tx(locale, { en: 'Edit request', es: 'Editar solicitud', it: 'Modifica richiesta', ar: 'تعديل الطلب' })}</button>
            <Link className="primary-btn" href={`/account/car-requests/detail?ref=${encodeURIComponent(record.reference)}`}>{tx(locale, { en: 'View request details', es: 'Ver detalles de la solicitud', it: 'Vedi dettagli richiesta', ar: 'عرض تفاصيل الطلب' })}</Link></>
          : <><Link className="primary-btn" href="/register">{tx(locale, { en: 'Create an account to track my requests', es: 'Crea una cuenta para seguir tus solicitudes', it: 'Crea un account per seguire le tue richieste', ar: 'إنشاء حساب لمتابعة طلباتي' })}</Link>
            <Link className="outline-btn" href={`/login?next=${encodeURIComponent('/account/car-requests')}`}>{tx(locale, { en: 'Sign in', es: 'Iniciar sesión', it: 'Accedi', ar: 'تسجيل الدخول' })}</Link></>}
        <Link className="outline-btn" href="/contact">{tx(locale, { en: 'Contact our team', es: 'Contacta con nuestro equipo', it: 'Contatta il nostro team', ar: 'تواصل مع فريقنا' })}</Link>
      </div>
    </div>
  }

  return <>
    <Breadcrumb items={[tx(locale, { en: 'Rent Car', es: 'Alquiler de coches', it: 'Noleggio auto', ar: 'تأجير السيارات' }), tx(locale, { en: 'Request a vehicle', es: 'Solicitar un vehículo', it: 'Richiedi un veicolo', ar: 'طلب سيارة' })]} />
    <main className="container car-request-page">
      <header className="car-request-head">
        <span className="eyebrow">{tx(locale, { en: 'Private transport', es: 'Transporte privado', it: 'Trasporto privato', ar: 'نقل خاص' })}</span>
        <h1>{tx(locale, { en: 'Tell us how you want to move.', es: 'Cuéntanos cómo quieres moverte.', it: 'Dicci come vuoi muoverti.', ar: 'أخبرنا كيف تريد التنقل.' })}</h1>
        <p>{tx(locale, { en: 'Fill in your request details and our team will review your request and contact you.', es: 'Completa los detalles de tu solicitud y nuestro equipo la revisará y te contactará.', it: 'Compila i dettagli della richiesta: il nostro team la esaminerà e ti contatterà.', ar: 'املأ تفاصيل طلبك وسيراجع فريقنا طلبك وسيتواصل معك.' })}</p>
      </header>
      <ol className="stepper req-stepper" aria-label={tx(locale, { en: 'Vehicle request progress', es: 'Progreso de la solicitud', it: 'Avanzamento richiesta', ar: 'مراحل طلب السيارة' })}>
        {steps.map((label, i) => {
          const state = step > i + 1 ? 'done' : step === i + 1 ? 'active' : 'todo'
          const isDone = step > i + 1
          return <li key={label}>
            {i > 0 && <span className={`step-line${step > i ? ' done' : ''}`} aria-hidden="true" />}
            <span className={`step-pill ${state}`} aria-current={step === i + 1 ? 'step' : undefined}>
              <b className="step-num">{isDone ? <Check size={18} /> : i + 1}</b>
              {label}
            </span>
          </li>
        })}
      </ol>
      {placed
        ? renderPreview(placed)
        : <div className="car-request-layout">
          <aside className="car-summary-card" aria-label={tx(locale, { en: 'Request summary', es: 'Resumen de la solicitud', it: 'Riepilogo richiesta', ar: 'ملخص الطلب' })}>
            <div>
              <span className="eyebrow">{tx(locale, { en: 'Your summary', es: 'Tu resumen', it: 'Il tuo riepilogo', ar: 'ملخص طلبك' })}</span>
              {vehicle
                ? <div className="req-vehicle-mini"><img src={vehicle.image} alt={vehicle.title} /><div><strong>{vehicle.title}</strong><span><Users size={13} style={{ verticalAlign: '-2px' }} /> {vehicle.seats}</span></div></div>
                : <p className="req-novehicle">{tx(locale, { en: 'Select a vehicle in the form to see your summary here.', es: 'Selecciona un vehículo en el formulario para ver tu resumen aquí.', it: 'Seleziona un veicolo nel modulo per vedere qui il riepilogo.', ar: 'اختر السيارة من النموذج ليظهر ملخصك هنا.' })}</p>}
              <div className="req-summary-rows">
                <div><span>{tx(locale, { en: 'Trip type', es: 'Tipo', it: 'Tipo', ar: 'النوع' })}</span><strong>{tripLabel}</strong></div>
                <div><span>{tx(locale, { en: 'From', es: 'Desde', it: 'Da', ar: 'من' })}</span><strong>{carLocationDisplayName(values.pickupLocationSlug, values.pickup, locations, locale, notSet)}</strong></div>
                <div><span>{tx(locale, { en: 'To', es: 'Hasta', it: 'A', ar: 'إلى' })}</span><strong>{carLocationDisplayName(values.dropoffLocationSlug, values.dropoff, locations, locale, notSet)}</strong></div>
                <div><span>{tx(locale, { en: 'Preferred pick-up date', es: 'Fecha de recogida preferida', it: 'Data di ritiro preferita', ar: 'تاريخ الاستلام المفضل' })}</span><strong dir="ltr">{values.pickupDate || notSet}</strong></div>
                {values.tripType === 'Round Trip' && <div><span>{tx(locale, { en: 'Preferred return date', es: 'Fecha de regreso preferida', it: 'Data di ritorno preferita', ar: 'تاريخ العودة المفضل' })}</span><strong dir="ltr">{values.returnDate || notSet}</strong></div>}
                <div><span>{tx(locale, { en: 'Passengers', es: 'Pasajeros', it: 'Passeggeri', ar: 'الركاب' })}</span><strong>{values.passengers || notSet}</strong></div>
                <section aria-live="polite" aria-busy={quoteState.kind === 'loading'} className="car-quote-message">
                  {quoteState.kind === 'loading' ? tx(locale, { en: 'Updating transfer price…', es: 'Actualizando el precio del traslado…', it: 'Aggiornamento del prezzo del trasferimento…' })
                    : quoteState.kind === 'error' ? <>{tx(locale, { en: 'We could not retrieve a price. You can retry or send an inquiry without a quote.', es: 'No pudimos obtener el precio. Puedes reintentar o enviar una consulta sin presupuesto.', it: 'Impossibile recuperare il prezzo. Puoi riprovare o inviare una richiesta senza preventivo.' })}<button type="button" className="text-link" onClick={retryQuote}>{tx(locale, { en: 'Retry price', es: 'Reintentar precio', it: 'Riprova prezzo' })}</button></>
                    : quoteState.kind === 'unavailable' || capacityInvalid ? tx(locale, { en: 'This vehicle cannot be priced for these passengers. Send an inquiry and our team will arrange a suitable vehicle.', es: 'No hay tarifa para este vehículo y pasajeros. Envía una consulta para que busquemos un vehículo adecuado.', it: 'Nessuna tariffa per questo veicolo e passeggeri. Invia una richiesta per trovare un veicolo adatto.' })
                    : <CarQuoteSummary quote={quoteState.kind === 'quote' ? quoteState.quote : null} tripType={values.tripType} locale={locale}/>}
                </section>
              </div>
              <p><ShieldCheck size={15} />{tx(locale, { en: 'Private driver and A/C included', es: 'Conductor privado y aire acondicionado incluidos', it: 'Autista privato e aria condizionata inclusi', ar: 'شامل سائق خاص وتكييف' })}</p>
              <a className="req-wa" href={whatsappHref(brand.whatsapp)} target="_blank" rel="noreferrer" onClick={() => trackPublicInteraction({ event: 'sp_contact_click', channel: 'whatsapp', placement: 'car_request' })}>{tx(locale, { en: 'Chat on WhatsApp', es: 'Hablar por WhatsApp', it: 'Chat su WhatsApp', ar: 'تواصل عبر واتساب' })}</a>
            </div>
          </aside>
          <div className="car-form-card">
            {fleet.loading && <p role="status">{tx(locale, { en: 'Loading available vehicles…', es: 'Cargando vehículos disponibles…', it: 'Caricamento dei veicoli disponibili…' })}</p>}
            {fleet.error && <p role="alert">{tx(locale, { en: 'Vehicles could not be loaded.', es: 'No se pudieron cargar los vehículos.', it: 'Impossibile caricare i veicoli.' })}<button type="button" onClick={fleet.retry}>{tx(locale, { en: 'Retry', es: 'Reintentar', it: 'Riprova' })}</button></p>}
            {!fleet.loading && !fleet.error && !liveCars.length && <p role="status">{tx(locale, { en: 'No vehicles are currently available. Please contact our team.', es: 'No hay vehículos disponibles. Contacta con nuestro equipo.', it: 'Nessun veicolo disponibile. Contatta il nostro team.' })}</p>}
            {locationState.loading && <p role="status" className="car-location-notice">{tx(locale, { en: 'Loading pickup and drop-off locations…', es: 'Cargando lugares de recogida y entrega…', it: 'Caricamento dei luoghi di ritiro e riconsegna…' })}</p>}
            {locationState.error && <p role="alert" className="car-location-notice">{tx(locale, { en: 'Locations could not be loaded. Enter your addresses to request a manual quote.', es: 'No se pudieron cargar los lugares. Introduce tus direcciones para solicitar un presupuesto.', it: 'Impossibile caricare i luoghi. Inserisci gli indirizzi per richiedere un preventivo.' })}<button type="button" onClick={locationState.retry}>{tx(locale, { en: 'Retry locations', es: 'Reintentar lugares', it: 'Riprova luoghi' })}</button></p>}
            {editingRef && <p className="car-location-notice">{tx(locale, { en: 'Saving changes recalculates your quote using current prices. Your earlier quote may change.', es: 'Guardar cambios recalcula el presupuesto con los precios actuales. El precio anterior puede cambiar.', it: 'Il salvataggio ricalcola il preventivo con i prezzi attuali. Il prezzo precedente può cambiare.' })}</p>}
            <CarRequestForm values={values} errors={errors} summary={summary} submitting={submitting} editing={editingRef !== null} locations={locations} onChange={patch} onSubmit={handleSubmit} />
          </div>
        </div>}
    </main>
  </>
}
