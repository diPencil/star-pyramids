'use client'

import { trackPublicInteraction } from "@/lib/tracking/tracking-events";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronDown, ArrowRight, Sun, Ship, Anchor, Package } from "lucide-react";
import { assignableOneDayTours, getToursByCategory } from "@/data/tours";
import { useDbTours } from "@/lib/tours/tours-client";
import { useLocale } from "../locale";
import { SharedSelect } from "./forms/shared-select";
import { DateInput } from "./forms/date-input";
import { extra } from "@/lib/i18n/site-copy";


export function FilterField({label,placeholder,date=false,value,onChange,options}:{label:string;placeholder:string;date?:boolean;value?:string;onChange?:(v:string)=>void;options?:readonly (string|{value:string;label:string})[]}){const fieldStyle={border:0,outline:0,background:'transparent',width:'100%',font:'inherit',color:'inherit',minHeight:'auto'} as const; const {locale:ffLocale}=useLocale(); return <label className="filter-field"><span>{label}</span><div>{options?<SharedSelect value={value??''} onChange={(next)=>onChange?.(next)} locale={ffLocale} label={label} options={[{value:'',label:placeholder},...options.map((o)=>typeof o==='string'?{value:o,label:o}:{value:o.value,label:o.label})]} />:date?<DateInput aria-label={label} value={value??''} onChange={(e)=>onChange?.(e.target.value)} hideNativeIndicator style={fieldStyle}/>:value!==undefined?<input aria-label={label} value={value} onChange={(e)=>onChange?.(e.target.value)} placeholder={placeholder} style={fieldStyle}/>:<>{placeholder}<ChevronDown size={17}/></>}</div></label>}

export function HeroField({title,placeholder,value,onChange,options,date=false}:{title:string;placeholder:string;value:string;onChange:(v:string)=>void;options?:string[];date?:boolean}){const control={width:'100%',border:0,outline:0,background:'transparent',fontSize:15,fontFamily:'inherit',color:value?'#1d1f1f':'#a7a7a7',padding:0,minHeight:28} as const; const {locale:hfLocale}=useLocale(); return <label className="hero-field"><span className="hero-field-title">{title}</span>{options?<span className="hero-field-control"><SharedSelect value={value} onChange={onChange} locale={hfLocale} label={title} options={[{value:'',label:placeholder},...options.map((o)=>({value:o,label:o}))]} modal={false} /></span>:<span className="hero-field-control">{date?<DateInput aria-label={title} value={value} onChange={(e)=>onChange(e.target.value)} placeholder={placeholder} placeholderMode hideNativeIndicator style={control}/>:<input aria-label={title} value={value} onChange={(e)=>onChange(e.target.value)} placeholder={placeholder} style={control}/>}{!date&&<ChevronDown size={20}/>}</span>}</label>}

export function TripSearchEngine() {
  const [tab, setTab] = useState('Make Your Trip');
  const [trip, setTrip] = useState('exact');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [where, setWhere] = useState('');
  const [howLong, setHowLong] = useState('');
  const [tripKind, setTripKind] = useState('');
  const [tripType, setTripType] = useState('One Way');
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [pickupDate, setPickupDate] = useState('');
  const router = useRouter();
  const tabNames = ['Make Your Trip', 'Find your trip', 'Rent Car'];
  const { locale: tl } = useLocale();
  const ex = extra[tl];
  const tabIndex = Math.max(0, tabNames.indexOf(tab));
  const rtl = typeof document !== 'undefined' && document.documentElement.dir === 'rtl';

  // Fetch all live tours once, then filter by category client-side (single DB query)
  // Use getToursByCategory to avoid import issue with catalogTours
  const allLiveTours = useDbTours([
    ...assignableOneDayTours,
    ...getToursByCategory('multi-days-tours'),
    ...getToursByCategory('nile-cruises'),
    ...getToursByCategory('shore-excursions'),
  ], { includeNew: true });

  // Derive unique destinations from published tours
  const destinationOptions = Array.from(
    new Set(allLiveTours.map((t) => t.location).filter(Boolean))
  ).sort();

  // Derive unique durations from published tours
  const durationOptions = Array.from(
    new Set(allLiveTours.map((t) => t.duration).filter(Boolean))
  ).sort((a, b) => {
    const numA = parseInt(a);
    const numB = parseInt(b);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    return a.localeCompare(b);
  });

  // Category counts from single array (no extra queries)
  const liveOneDayTours = allLiveTours.filter(t => t.category === 'one-day-tours');
  const liveMultiDayTours = allLiveTours.filter(t => t.category === 'multi-days-tours');
  const liveNileCruises = allLiveTours.filter(t => t.category === 'nile-cruises');
  const liveShoreExcursions = allLiveTours.filter(t => t.category === 'shore-excursions');

  // Trip kind configuration with real-time tour counts
  const tripKinds = [
    { value: 'one-day-tours', label: ex.k1, count: liveOneDayTours.length, icon: Sun },
    { value: 'multi-days-tours', label: ex.k2, count: liveMultiDayTours.length, icon: Package },
    { value: 'nile-cruises', label: ex.k3, count: liveNileCruises.length, icon: Ship },
    { value: 'shore-excursions', label: ex.k4, count: liveShoreExcursions.length, icon: Anchor },
  ];

  // Handle search with proper query parameters
  const handleSearch = () => {
    trackPublicInteraction({ event: 'sp_search_submit', placement: 'tour_search' })
    if (tripKind) {
      const params = new URLSearchParams();
      if (where) params.set('destination', where);
      if (howLong) params.set('duration', howLong);
      const queryString = params.toString();
      router.push(`/egypt-tours/${tripKind}${queryString ? `?${queryString}` : ''}`);
    } else {
      const searchTerms = [where, howLong].filter(Boolean).join(' ');
      router.push(`/search?q=${encodeURIComponent(searchTerms || 'Egypt')}`);
    }
  };

  // Reset all filters
  const handleReset = () => {
    setWhere('');
    setHowLong('');
    setTripKind('');
  };

  const hasActiveFilters = where || howLong || tripKind;

  return (
    <div className="search-wrap">
      <div className="search-tabs" role="tablist" aria-label="Trip search">
        <span
          className="seg-indicator"
          aria-hidden="true"
          style={{ transform: `translateX(${(rtl ? -1 : 1) * tabIndex * 100}%)` }}
        />
        {tabNames.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            className={tab === t ? 'active' : ''}
            onClick={() => setTab(t)}
          >
            {[ex.tabMake, ex.tabFind, ex.tabRent][tabNames.indexOf(t)]}
          </button>
        ))}
      </div>
      <div className="search-panel">
        <div className="search-panel-body" key={tab} role="tabpanel">
          {/* Make Your Trip Tab */}
          {tab === 'Make Your Trip' && (
            <>
              <div className="trip-question trip-time-selector">
                <strong>{ex.qWhen}</strong>
                {[['exact', ex.qExact], ['approx', ex.qApprox], ['unsure', ex.qUnsure]].map(
                  ([v, l]) => (
                    <button
                      key={v}
                      type="button"
                      className={trip === v ? 'selected-radio' : ''}
                      aria-pressed={trip === v}
                      onClick={() => setTrip(v)}
                    >
                      <i className={trip === v ? 'checked' : ''} />
                      {l}
                    </button>
                  )
                )}
              </div>
              <div className="field-grid cols-2">
                <HeroField
                  title={ex.fFrom}
                  placeholder={ex.fFromPh}
                  date
                  value={from}
                  onChange={setFrom}
                />
                <HeroField
                  title={ex.fTo}
                  placeholder={ex.fToPh}
                  date
                  value={to}
                  onChange={setTo}
                />
                <Link
                  className="primary-btn"
                  href={`/make-your-trip${from || to ? `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}` : ''}`}
                >
                  {ex.makeTripBtn} <ArrowRight size={18} />
                </Link>
              </div>
            </>
          )}

          {/* Find Your Trip Tab - Improved */}
          {tab === 'Find your trip' && (
            <>
              <div className="trip-question trip-kind-selector">
                <strong>{ex.qWhat}</strong>
                <div className="trip-kind-options" role="radiogroup" aria-label={ex.qWhat}>
                  {tripKinds.map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      type="button"
                      className={`trip-kind-btn ${tripKind === value ? 'selected' : ''}`}
                      aria-pressed={tripKind === value}
                      onClick={() => setTripKind(tripKind === value ? '' : value)}
                    >
                      <Icon size={18} aria-hidden="true" />
                      <span className="trip-kind-label">{label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="field-grid cols-2">
                <HeroField
                  title={ex.wWhere}
                  placeholder={ex.wWherePh}
                  value={where}
                  onChange={setWhere}
                  options={destinationOptions}
                />
                <HeroField
                  title={ex.wLong}
                  placeholder={ex.wLongPh}
                  value={howLong}
                  onChange={setHowLong}
                  options={durationOptions}
                />
                <button
                  type="button"
                  className="primary-btn"
                  onClick={handleSearch}
                  disabled={!tripKind && !where && !howLong}
                >
                  {ex.searchBtn} <ArrowRight size={18} />
                </button>
              </div>
              {hasActiveFilters && (
                <button
                  type="button"
                  className="reset-btn"
                  onClick={handleReset}
                >
                  {ex.resetFilters || 'Reset filters'}
                </button>
              )}
              {!tripKind && !where && !howLong && (
                <p className="search-hint" aria-live="polite">
                  {ex.searchHint || 'Select a trip type or enter a destination to begin'}
                </p>
              )}
            </>
          )}

          {/* Rent Car Tab - Preserved as-is */}
          {tab === 'Rent Car' && (
            <>
              <div className="trip-question">
                <strong>{ex.qType}</strong>
                {[['One Way', ex.tOne], ['Round Trip', ex.tRound]].map(([v, l]) => (
                  <button
                    key={v}
                    type="button"
                    className={tripType === v ? 'selected-radio' : ''}
                    aria-pressed={tripType === v}
                    onClick={() => setTripType(v)}
                  >
                    <i className={tripType === v ? 'checked' : ''} />
                    {l}
                  </button>
                ))}
              </div>
              <div className="field-grid cols-3">
                <HeroField
                  title={ex.cHolder}
                  placeholder={ex.cHolderPh}
                  value={pickup}
                  onChange={setPickup}
                />
                <HeroField
                  title={ex.cDrop}
                  placeholder={ex.cDropPh}
                  value={dropoff}
                  onChange={setDropoff}
                />
                <HeroField
                  title={ex.cDate}
                  placeholder={ex.cDatePh}
                  date
                  value={pickupDate}
                  onChange={setPickupDate}
                />
                <button
                  type="button"
                  className="primary-btn"
                  onClick={() =>
                    router.push(
                      `/rent-car/request?pickup=${encodeURIComponent(pickup)}&dropoff=${encodeURIComponent(dropoff)}&type=${encodeURIComponent(tripType)}&date=${encodeURIComponent(pickupDate)}`
                    )
                  }
                >
                  {ex.sendReq} <ArrowRight size={18} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
