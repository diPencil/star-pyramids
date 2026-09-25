'use client'
import { Suspense, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, ArrowRight, CalendarDays, Check, Minus, Plus, Sparkles } from 'lucide-react'
import { SiteShell, Breadcrumb } from '@/components/site'
import { useLocale } from '@/components/locale'
import { localizeTourLocation } from '@/lib/tour-format'
import { destinations } from '@/data/content'
import { parseMakeTripQuery } from '@/lib/query'

const stepLabels = ['Quick information', 'Personal information', 'Confirmation']
const timeOptions = [['exact', 'Have An Exact Time'], ['approx', 'Have An Approximate Time'], ['unsure', 'Not Sure Yet']] as const
const timeNames: Record<string, string> = { exact: 'Exact time', approx: 'Approximate time', unsure: 'Not sure yet' }
const nationalities = ['Egyptian', 'American', 'British', 'French', 'German', 'Spanish', 'Italian', 'Saudi', 'Emirati', 'Canadian', 'Australian', 'Other']
const dialCodes = [['Egypt', '🇪🇬', '+20'], ['United States', '🇺🇸', '+1'], ['United Kingdom', '🇬🇧', '+44'], ['France', '🇫🇷', '+33'], ['Germany', '🇩🇪', '+49'], ['Spain', '🇪🇸', '+34'], ['Italy', '🇮🇹', '+39'], ['Saudi Arabia', '🇸🇦', '+966'], ['UAE', '🇦🇪', '+971'], ['Australia', '🇦🇺', '+61']]
const natToDial: Record<string, string> = { Egyptian: '+20', American: '+1', British: '+44', French: '+33', German: '+49', Spanish: '+34', Italian: '+39', Saudi: '+966', Emirati: '+971', Canadian: '+1', Australian: '+61' }
const PRICE_CAP = 10000
const ar: Record<string, string> = {
  'Make Your Trip': 'خطط رحلتك', 'Quick information': 'تفاصيل الرحلة', 'Personal information': 'بيانات التواصل', Confirmation: 'التأكيد',
  'When will you be traveling?': 'متى تحب السفر؟', 'Have An Exact Time': 'موعد محدد', 'Have An Approximate Time': 'موعد تقريبي', 'Not Sure Yet': 'لم أحدد بعد',
  'Ship call date': 'تاريخ توقف السفينة',
  'Selected tour:': 'الرحلة المختارة:', Change: 'تغيير', Destination: 'الوجهة', 'Choose a place in Egypt': 'اختر وجهة في مصر',
  From: 'من', To: 'إلى', 'Select the start date of the trip': 'حدد تاريخ بداية الرحلة', 'Select the end date of the trip': 'حدد تاريخ نهايتها',
  'Next up': 'التالي', Edit: 'تعديل', 'Full Name': 'الاسم الكامل', Email: 'البريد الإلكتروني',
  'your full name here': 'اكتب اسمك الكامل', 'Type your email..': 'اكتب بريدك الإلكتروني', 'Add Flight Offer': 'أضف عرض طيران',
  Nationality: 'الجنسية', 'Choose your nationality': 'اختر جنسيتك', Phone: 'الهاتف', 'Country code': 'مفتاح الدولة', 'Type your phone': 'اكتب رقم الهاتف',
  Adults: 'البالغون', Children: 'الأطفال', Infants: 'الرضع', Price: 'الميزانية', Min: 'الحد الأدنى', Max: 'الحد الأقصى',
  'Price range': 'نطاق السعر', 'Minimum price': 'أقل سعر', 'Maximum price': 'أعلى سعر', Note: 'ملاحظات',
  'Additional Notes.........': 'أي تفاصيل إضافية عن رحلتك', Back: 'رجوع', 'Prepare request': 'جهّز طلبك', 'Go back': 'رجوع',
  'Exact time': 'موعد محدد', 'Approximate time': 'موعد تقريبي', 'Not sure yet': 'لم أحدد بعد',
  Home: 'الرئيسية', 'Go Back': 'رجوع', 'Contact our team': 'تواصل مع فريقنا',
  Egyptian: 'مصرية', American: 'أمريكية', British: 'بريطانية', French: 'فرنسية', German: 'ألمانية', Spanish: 'إسبانية', Italian: 'إيطالية', Saudi: 'سعودية', Emirati: 'إماراتية', Canadian: 'كندية', Australian: 'أسترالية', Other: 'أخرى',
  'Cairo & Giza': 'القاهرة والجيزة',
  'Your request is ready.': 'تم تجهيز طلبك.',
  'This form does not send a booking. Contact our team to confirm your itinerary and availability.': 'هذه الاستمارة لا ترسل حجزاً. تواصل مع فريقنا لتأكيد البرنامج والتوافر.',
  'Our team can help via WhatsApp, phone, or email.': 'فريقنا متاح عبر واتساب أو الهاتف أو البريد.',
  'Get Ready: Your Adventure With Star Pyramids Tours Starts Here!': 'رحلتك في مصر تبدأ من هنا.',
}

function DatePill({ label, placeholder, value, onChange, min }: { label: string; placeholder: string; value: string; onChange: (v: string) => void; min?: string }) {
  return <label className="myt-date"><span>{label}</span><span className="myt-date-pill"><input aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} min={min} onFocus={(e) => { e.target.type = 'date' }} onBlur={(e) => { if (!e.target.value) e.target.type = 'text' }} /><CalendarDays size={20} /></span></label>
}

function Counter({ label, sub, value, set, min = 0 }: { label: string; sub: string; value: number; set: (v: number) => void; min?: number }) {
  const { locale } = useLocale()
  return <div className="myt-counter"><span>{label} <small>({sub})</small></span><div className="myt-counter-box"><button type="button" aria-label={(locale === 'ar' ? 'تقليل ' : 'Decrease ') + label} onClick={() => set(Math.max(min, value - 1))}><Minus size={16} /></button><b>{value}</b><button type="button" aria-label={(locale === 'ar' ? 'زيادة ' : 'Increase ') + label} onClick={() => set(value + 1)}><Plus size={16} /></button></div></div>
}

function PlannerInner() {
  const { locale } = useLocale()
  const t = (key: string) => locale === 'ar' ? ar[key] ?? key : key
  const params = useSearchParams()
  const router = useRouter()
  const initialQuery = useMemo(() => parseMakeTripQuery(params), [params])
  const isShore = initialQuery.tour?.category === 'shore-excursions'
  const [step, setStep] = useState<number>(initialQuery.step)
  const [sent, setSent] = useState(false)
  const [time, setTime] = useState('exact')
  const [from, setFrom] = useState(initialQuery.from)
  const [to, setTo] = useState(isShore ? initialQuery.from : initialQuery.to)
  const [destination, setDestination] = useState(initialQuery.destination)
  const destName = destinations.find((d) => d.slug === destination)?.title ?? ''
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [flightOffer, setFlightOffer] = useState(false)
  const [nationality, setNationality] = useState('')
  const [code, setCode] = useState('+20')
  const [phone, setPhone] = useState('')
  const hasBreakdown = initialQuery.adults + initialQuery.children + initialQuery.infants > 0
  const [adults, setAdults] = useState(hasBreakdown ? initialQuery.adults : initialQuery.guests)
  const [children, setChildren] = useState(hasBreakdown ? initialQuery.children : 0)
  const [infants, setInfants] = useState(hasBreakdown ? initialQuery.infants : 0)
  const [priceMin, setPriceMin] = useState(1000)
  const [priceMax, setPriceMax] = useState(3000)
  const [note, setNote] = useState(initialQuery.addOns.length ? `Requested add-ons: ${initialQuery.addOns.join(', ')}` : '')
  const tourName = locale === 'ar' ? initialQuery.tour?.titleAr ?? initialQuery.tour?.title ?? '' : initialQuery.tour?.title ?? ''
  const validStep1 = time !== 'exact' || (from !== '' && (isShore || to !== ''))
  const validStep2 = fullName.trim() !== '' && /.+@.+\..+/.test(email) && nationality !== '' && phone.trim() !== ''
  const firstName = fullName.trim().split(/\s+/)[0] || 'Traveler'
  const goStep = (n: number) => { if (!sent) setStep(Math.min(Math.max(1, n), 2)) }
  const clampMin = (v: number) => setPriceMin(Math.max(0, Math.min(v, priceMax - 100)))
  const clampMax = (v: number) => setPriceMax(Math.min(PRICE_CAP, Math.max(v, priceMin + 100)))

  return <><Breadcrumb items={[t('Make Your Trip')]} /><main className="planner-page">{sent ? <div className="myt-success"><div className="myt-seal"><span className="myt-seal-ring" aria-hidden="true" /><span className="myt-seal-core"><Check size={44} /></span><Sparkles className="myt-spark" size={22} /></div><h2>{locale === 'ar' ? 'شكراً لك' : 'Thank you'} {firstName}</h2><p>{t('Your request is ready.')}</p><p>{t('This form does not send a booking. Contact our team to confirm your itinerary and availability.')}</p><p>{t('Our team can help via WhatsApp, phone, or email.')}</p><p>{t('Get Ready: Your Adventure With Star Pyramids Tours Starts Here!')}</p><div className="myt-success-actions"><Link className="primary-btn" href="/contact">{t('Contact our team')}</Link><Link className="outline-btn" href="/">{t('Home')}</Link><button type="button" className="primary-btn" onClick={() => router.back()}>{t('Go Back')}</button></div></div> : <><div className="planner-card"><h1><button type="button" className="myt-back" onClick={() => router.back()} aria-label={t('Go back')}><ArrowLeft size={20} /></button> {t('Make Your Trip')}</h1><div className="stepper">{[0, 1, 2].map((i) => {
    const state = step > i + 1 ? 'done' : step === i + 1 ? 'active' : 'todo'
    const done = step > i + 1
    return <span key={stepLabels[i]} style={{ display: 'contents' }}>{i > 0 && <span className={'step-line' + (step > i ? ' done' : '')} aria-hidden="true" />}<button type="button" className={'step-pill ' + state} onClick={() => goStep(i + 1)} aria-current={step === i + 1 ? 'step' : undefined}><b className="step-num">{done ? <Check size={18} /> : i + 1}</b>{t(stepLabels[i])}</button></span>
  })}</div></div><div className="planner-card planner-form">{step === 1 && <><div className="trip-question"><strong>{t('When will you be traveling?')}</strong>{timeOptions.map(([v, l]) => <button key={v} type="button" className={time === v ? 'selected-radio' : ''} aria-pressed={time === v} onClick={() => setTime(v)}><i className={time === v ? 'checked' : ''} />{t(l)}</button>)}</div>{tourName !== '' && <p className="myt-tour-note">{t('Selected tour:')} <strong>{tourName}</strong>, <Link href={`/egypt-tours/${initialQuery.tour?.category ?? 'one-day-tours'}`}>{t('Change')}</Link></p>}<label className="myt-field"><span className="myt-label" >{t('Destination')}</span><select value={destination} onChange={(e) => setDestination(e.target.value)}><option value="" >{t('Choose a place in Egypt')}</option>{destinations.map((d) => <option key={d.slug} value={d.slug}>{locale === 'ar' ? t(localizeTourLocation(d.title)) : d.title}</option>)}</select></label><div className="myt-dates"><DatePill label={t(isShore ? 'Ship call date' : 'From')} placeholder={t(isShore ? 'Ship call date' : 'Select the start date of the trip')} value={from} onChange={isShore ? (value) => { setFrom(value); setTo(value) } : setFrom} />{!isShore && <DatePill label={t('To')} placeholder={t('Select the end date of the trip')} value={to} onChange={setTo} min={from || undefined} />}</div><div className="planner-actions"><button type="button" className="navy-btn" disabled={!validStep1} onClick={() => setStep(2)}>{t('Next up')} <ArrowRight size={19} /></button></div></>}{step === 2 && <>{(destName !== '' || from !== '') && <p className="myt-tour-note">{[destName, from && to ? `${from} → ${to}` : '', locale === 'ar' ? `${adults + children + infants} مسافرين` : `${adults + children + infants} guest${adults + children + infants === 1 ? '' : 's'}`].filter(Boolean).join(', ')}, <button type="button" className="text-link" style={{ border: 0, background: 'none', cursor: 'pointer', padding: 0, font: 'inherit' }} onClick={() => setStep(1)} >{t('Edit')}</button></p>}<div className="myt-grid"><label className="myt-field"><span className="myt-label">{t('Full Name')} <em className="req">*</em></span><input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={t('your full name here')} /></label><label className="myt-field"><span className="myt-label">{t('Email')} <em className="req">*</em></span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('Type your email..')} /></label></div><label className="myt-check"><input type="checkbox" checked={flightOffer} onChange={(e) => setFlightOffer(e.target.checked)} /><span className="box" aria-hidden="true">{flightOffer && <Check size={16} />}</span> {t('Add Flight Offer')}</label><div className="myt-grid"><label className="myt-field"><span className="myt-label">{t('Nationality')} <em className="req">*</em></span><select value={nationality} onChange={(e) => { setNationality(e.target.value); const d = natToDial[e.target.value]; if (d) setCode(d) }}><option value="">{t('Choose your nationality')}</option>{nationalities.map((n) => <option key={n} value={n}>{t(n)}</option>)}</select></label><label className="myt-field"><span className="myt-label">{t('Phone')} <em className="req">*</em></span><span className="myt-phone"><select aria-label={t('Country code')} value={code} onChange={(e) => setCode(e.target.value)}>{dialCodes.map(([name, flag, dial]) => <option key={name + dial} value={dial}>{flag} {dial}</option>)}</select><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t('Type your phone')} inputMode="tel" /></span></label></div><div className="myt-group"><div className="myt-counters"><Counter label={t('Adults')} sub="12+" value={adults} set={setAdults} min={1} /><Counter label={t('Children')} sub="3 - 11" value={children} set={setChildren} /><Counter label={t('Infants')} sub="0 - 2" value={infants} set={setInfants} /></div></div><div className="myt-group"><span className="myt-group-title" >{t('Price')}</span><div className="price-values"><label className="myt-field"><span className="myt-minmax">{t('Min')}</span><input type="number" min={0} max={PRICE_CAP} value={priceMin} onChange={(e) => clampMin(Number(e.target.value))} /></label><label className="myt-field"><span className="myt-minmax right">{t('Max')}</span><input type="number" min={0} max={PRICE_CAP} value={priceMax} onChange={(e) => clampMax(Number(e.target.value))} /></label></div><div className="price-slider" role="group" aria-label={t('Price range')}><span className="rail" aria-hidden="true" /><span className="fill" aria-hidden="true" style={{ left: (priceMin / PRICE_CAP * 100) + '%', right: (100 - priceMax / PRICE_CAP * 100) + '%' }} /><input type="range" aria-label={t('Minimum price')} min={0} max={PRICE_CAP} step={100} value={priceMin} onChange={(e) => clampMin(Number(e.target.value))} /><input type="range" aria-label={t('Maximum price')} min={0} max={PRICE_CAP} step={100} value={priceMax} onChange={(e) => clampMax(Number(e.target.value))} /></div></div><div className="myt-group"><label className="myt-field">{t('Note')}<textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('Additional Notes.........')} /></label></div><div className="planner-actions"><button type="button" className="outline-btn" onClick={() => setStep(1)} >{t('Back')}</button><button type="button" className="navy-btn" disabled={!validStep2} onClick={() => setSent(true)} >{t('Prepare request')}</button></div></>}</div></>}</main></>
}

export default function MakeYourTrip() { return <SiteShell><Suspense><PlannerInner /></Suspense></SiteShell> }
