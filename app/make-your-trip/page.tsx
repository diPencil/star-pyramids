'use client'
import { Suspense, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, ArrowRight, CalendarDays, Check, Minus, Plus, Sparkles } from 'lucide-react'
import { SiteShell, Breadcrumb } from '@/components/site'
import { destinations } from '@/data/content'
import { parseMakeTripQuery } from '@/lib/query'

const stepLabels = ['Quick information', 'Personal information', 'Confirmation']
const timeOptions = [['exact', 'Have An Exact Time'], ['approx', 'Have An Approximate Time'], ['unsure', 'Not Sure Yet']] as const
const timeNames: Record<string, string> = { exact: 'Exact time', approx: 'Approximate time', unsure: 'Not sure yet' }
const nationalities = ['Egyptian', 'American', 'British', 'French', 'German', 'Spanish', 'Italian', 'Saudi', 'Emirati', 'Canadian', 'Australian', 'Other']
const dialCodes = [['Egypt', '🇪🇬', '+20'], ['United States', '🇺🇸', '+1'], ['United Kingdom', '🇬🇧', '+44'], ['France', '🇫🇷', '+33'], ['Germany', '🇩🇪', '+49'], ['Spain', '🇪🇸', '+34'], ['Italy', '🇮🇹', '+39'], ['Saudi Arabia', '🇸🇦', '+966'], ['UAE', '🇦🇪', '+971'], ['Australia', '🇦🇺', '+61']]
const natToDial: Record<string, string> = { Egyptian: '+20', American: '+1', British: '+44', French: '+33', German: '+49', Spanish: '+34', Italian: '+39', Saudi: '+966', Emirati: '+971', Canadian: '+1', Australian: '+61' }
const PRICE_CAP = 10000

function DatePill({ label, placeholder, value, onChange, min }: { label: string; placeholder: string; value: string; onChange: (v: string) => void; min?: string }) {
  return <label className="myt-date"><span>{label}</span><span className="myt-date-pill"><input aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} min={min} onFocus={(e) => { e.target.type = 'date' }} onBlur={(e) => { if (!e.target.value) e.target.type = 'text' }} /><CalendarDays size={20} /></span></label>
}

function Counter({ label, sub, value, set, min = 0 }: { label: string; sub: string; value: number; set: (v: number) => void; min?: number }) {
  return <div className="myt-counter"><span>{label} <small>({sub})</small></span><div className="myt-counter-box"><button type="button" aria-label={'Decrease ' + label} onClick={() => set(Math.max(min, value - 1))}><Minus size={16} /></button><b>{value}</b><button type="button" aria-label={'Increase ' + label} onClick={() => set(value + 1)}><Plus size={16} /></button></div></div>
}

function PlannerInner() {
  const params = useSearchParams()
  const router = useRouter()
  const initialQuery = useMemo(() => parseMakeTripQuery(params), [params])
  const [step, setStep] = useState<number>(initialQuery.step)
  const [sent, setSent] = useState(false)
  const [time, setTime] = useState('exact')
  const [from, setFrom] = useState(initialQuery.from)
  const [to, setTo] = useState(initialQuery.to)
  const [destination, setDestination] = useState(initialQuery.destination)
  const destName = destinations.find((d) => d.slug === destination)?.title ?? ''
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [flightOffer, setFlightOffer] = useState(false)
  const [nationality, setNationality] = useState('')
  const [code, setCode] = useState('+20')
  const [phone, setPhone] = useState('')
  const [adults, setAdults] = useState(initialQuery.guests)
  const [children, setChildren] = useState(0)
  const [infants, setInfants] = useState(0)
  const [priceMin, setPriceMin] = useState(1000)
  const [priceMax, setPriceMax] = useState(3000)
  const [note, setNote] = useState('')
  const tourName = initialQuery.tour?.title ?? ''
  const validStep1 = time !== 'exact' || (from !== '' && to !== '')
  const validStep2 = fullName.trim() !== '' && /.+@.+\..+/.test(email) && nationality !== '' && phone.trim() !== ''
  const firstName = fullName.trim().split(/\s+/)[0] || 'Traveler'
  const goStep = (n: number) => { if (!sent) setStep(Math.min(Math.max(1, n), 2)) }
  const clampMin = (v: number) => setPriceMin(Math.max(0, Math.min(v, priceMax - 100)))
  const clampMax = (v: number) => setPriceMax(Math.min(PRICE_CAP, Math.max(v, priceMin + 100)))

  return <SiteShell><Breadcrumb items={['Make Your Trip']} /><main className="planner-page">{sent ? <div className="myt-success"><div className="myt-seal"><span className="myt-seal-ring" aria-hidden="true" /><span className="myt-seal-core"><Check size={44} /></span><Sparkles className="myt-spark" size={22} /></div><h2>Thank You {firstName}</h2><p>Your Request Has Been Received.</p><p>Your Details Have Been Successfully Submitted And Confirmed.</p><p>Our Team Will Reach Out To You Within 1 Hour Via WhatsApp, Phone Call, Or Email To Provide All The Details You Need.</p><p>Get Ready — Your Adventure With Star Pyramids Tours Starts Here!</p><div className="myt-success-actions"><Link className="primary-btn" href="/">Home</Link><button type="button" className="primary-btn" onClick={() => router.back()}>Go Back</button></div></div> : <><div className="planner-card"><h1><button type="button" className="myt-back" onClick={() => router.back()} aria-label="Go back"><ArrowLeft size={20} /></button> Make Your Trip</h1><div className="stepper">{[0, 1, 2].map((i) => {
    const state = step > i + 1 ? 'done' : step === i + 1 ? 'active' : 'todo'
    const done = step > i + 1
    return <span key={stepLabels[i]} style={{ display: 'contents' }}>{i > 0 && <span className={'step-line' + (step > i ? ' done' : '')} aria-hidden="true" />}<button type="button" className={'step-pill ' + state} onClick={() => goStep(i + 1)} aria-current={step === i + 1 ? 'step' : undefined}><b className="step-num">{done ? <Check size={18} /> : i + 1}</b>{stepLabels[i]}</button></span>
  })}</div></div><div className="planner-card planner-form">{step === 1 && <><div className="trip-question"><strong>When will you be traveling?</strong>{timeOptions.map(([v, l]) => <button key={v} type="button" className={time === v ? 'selected-radio' : ''} aria-pressed={time === v} onClick={() => setTime(v)}><i className={time === v ? 'checked' : ''} />{l}</button>)}</div>{tourName !== '' && <p className="myt-tour-note">Selected tour: <strong>{tourName}</strong> · <Link href="/egypt-tours/one-day-tours">Change</Link></p>}<label className="myt-field"><span className="myt-label">Destination</span><select value={destination} onChange={(e) => setDestination(e.target.value)}><option value="">Choose a place in Egypt</option>{destinations.map((d) => <option key={d.slug} value={d.slug}>{d.title}</option>)}</select></label><div className="myt-dates"><DatePill label="From" placeholder="Select the start date of the trip" value={from} onChange={setFrom} /><DatePill label="To" placeholder="Select the end date of the trip" value={to} onChange={setTo} min={from || undefined} /></div><div className="planner-actions"><button type="button" className="navy-btn" disabled={!validStep1} onClick={() => setStep(2)}>Next up <ArrowRight size={19} /></button></div></>}{step === 2 && <>{(destName !== '' || from !== '') && <p className="myt-tour-note">{[destName, from && to ? `${from} → ${to}` : '', `${adults + children + infants} guest${adults + children + infants === 1 ? '' : 's'}`].filter(Boolean).join(' · ')} · <button type="button" className="text-link" style={{ border: 0, background: 'none', cursor: 'pointer', padding: 0, font: 'inherit' }} onClick={() => setStep(1)}>Edit</button></p>}<div className="myt-grid"><label className="myt-field"><span className="myt-label">Full Name <em className="req">*</em></span><input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="your full name here" /></label><label className="myt-field"><span className="myt-label">Email <em className="req">*</em></span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Type your email.." /></label></div><label className="myt-check"><input type="checkbox" checked={flightOffer} onChange={(e) => setFlightOffer(e.target.checked)} /><span className="box" aria-hidden="true">{flightOffer && <Check size={16} />}</span> Add Flight Offer</label><div className="myt-grid"><label className="myt-field"><span className="myt-label">Nationality <em className="req">*</em></span><select value={nationality} onChange={(e) => { setNationality(e.target.value); const d = natToDial[e.target.value]; if (d) setCode(d) }}><option value="">Choose your nationality</option>{nationalities.map((n) => <option key={n} value={n}>{n}</option>)}</select></label><label className="myt-field"><span className="myt-label">Phone <em className="req">*</em></span><span className="myt-phone"><select aria-label="Country code" value={code} onChange={(e) => setCode(e.target.value)}>{dialCodes.map(([name, flag, dial]) => <option key={name + dial} value={dial}>{flag} {dial}</option>)}</select><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Type your phone" inputMode="tel" /></span></label></div><div className="myt-group"><div className="myt-counters"><Counter label="Adults" sub="12+" value={adults} set={setAdults} min={1} /><Counter label="Children" sub="3 - 11" value={children} set={setChildren} /><Counter label="Infants" sub="0 - 2" value={infants} set={setInfants} /></div></div><div className="myt-group"><span className="myt-group-title">Price</span><div className="price-values"><label className="myt-field"><span className="myt-minmax">Min</span><input type="number" min={0} max={PRICE_CAP} value={priceMin} onChange={(e) => clampMin(Number(e.target.value))} /></label><label className="myt-field"><span className="myt-minmax right">Max</span><input type="number" min={0} max={PRICE_CAP} value={priceMax} onChange={(e) => clampMax(Number(e.target.value))} /></label></div><div className="price-slider" role="group" aria-label="Price range"><span className="rail" aria-hidden="true" /><span className="fill" aria-hidden="true" style={{ left: (priceMin / PRICE_CAP * 100) + '%', right: (100 - priceMax / PRICE_CAP * 100) + '%' }} /><input type="range" aria-label="Minimum price" min={0} max={PRICE_CAP} step={100} value={priceMin} onChange={(e) => clampMin(Number(e.target.value))} /><input type="range" aria-label="Maximum price" min={0} max={PRICE_CAP} step={100} value={priceMax} onChange={(e) => clampMax(Number(e.target.value))} /></div></div><div className="myt-group"><label className="myt-field">Note<textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Additional Notes........." /></label></div><div className="planner-actions"><button type="button" className="outline-btn" onClick={() => setStep(1)}>Back</button><button type="button" className="navy-btn" disabled={!validStep2} onClick={() => setSent(true)}>Submit</button></div></>}</div></>}</main></SiteShell>
}

export default function MakeYourTrip() { return <Suspense><PlannerInner /></Suspense> }
