'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, CalendarDays, CheckCircle2, ExternalLink, ImagePlus, MapPin, Plus, Save, Trash2, Upload } from 'lucide-react'
import { PageHead } from './admin-shell'
import { AdminText, Card } from './admin-ui'
import { useAdminLocale } from './admin-locale'
import { getTravelerUnitPrices, multiDayCategories, normalizeTourPricePeriods, tours } from '@/data/tours'
import { destinations } from '@/data/content'
import type { CruiseTypeSlug, Tour, TourCategory, TourLocation, TourVideoPlatform } from '@/data/types'
import { readImageFile } from '@/lib/admin-store'
import { ImageField } from './image-field'
import { SharedSelect } from '@/components/shared-select'
import { DateInput } from '@/components/date-input'

const steps = [
  { en: 'Basic', ar: 'الأساسية' },
  { en: 'Booking Pricing', ar: 'تسعير الحجز' },
  { en: 'Add-ons', ar: 'الإضافات' },
  { en: 'Overview', ar: 'نظرة عامة' },
  { en: 'Highlights', ar: 'أبرز المعالم' },
  { en: 'Itinerary', ar: 'البرنامج' },
  { en: 'Inclusions', ar: 'المشمول' },
  { en: 'Date Pricing', ar: 'أسعار المواعيد' },
  { en: 'Media', ar: 'الوسائط' },
  { en: 'Map', ar: 'الخريطة' },
  { en: 'Review & Publish', ar: 'المراجعة والنشر' },
] as const

type BasicForm = {
  title: string
  titleAr: string
  category: TourCategory
  destinationSlug: string
  cruiseType: CruiseTypeSlug | ''
  departurePort: string
  location: string
  duration: string
  price: string
  deal: string
  dealEndsAt: string
  groupSize: string
  travelStyle: string
  summary: string
  overview: string
  itineraryNote: string
  included: string
  excluded: string
}

type AddOnRow = { id: string; title: string; price: string }
type HighlightRow = { id: string; title: string; items: string }
type ItineraryRow = { id: string; day: string; title: string; description: string; meals: string; image: string }
type PassengerRateRow = { id: string; travelers: string; price: string }
type TravelerPriceRows = { adult: PassengerRateRow[]; child: PassengerRateRow[]; infant: PassengerRateRow[] }
type PriceTierRow = { id: string; label: string; price: string; suffix: string }
type PriceMatrixRow = { id: string; category: string; startDate: string; endDate: string; price: string; note: string; prefix: string; tiers: PriceTierRow[] }
type LocationRow = { id: string; name: string; nameAr: string; latitude: string; longitude: string }
type GalleryRow = { id: string; src: string; alt: string; creditLabel: string; creditUrl: string; source: 'link' | 'upload' }
type VideoRow = { id: string; url: string; platform: TourVideoPlatform; title: string; titleAr: string; publishedAt: string; thumbnail: string }

const id = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const splitLines = (value: string) => value.split('\n').map((line) => line.trim()).filter(Boolean)
const isValidPassengerRate = (row: PassengerRateRow) => Number.isInteger(Number(row.travelers)) && Number(row.travelers) > 0 && Number.isFinite(Number(row.price)) && Number(row.price) >= 0
const isSafeExternalUrl = (value: string) => {
  try { return new URL(value).protocol === 'https:' } catch { return false }
}

function locationRows(locations: readonly TourLocation[] | undefined, fallback: string): LocationRow[] {
  const values = locations?.length ? locations : [fallback]
  return values.map((location) => typeof location === 'string'
    ? { id: id('location'), name: location, nameAr: '', latitude: '', longitude: '' }
    : { id: id('location'), name: location.name, nameAr: location.nameAr ?? '', latitude: String(location.latitude), longitude: String(location.longitude) })
}

function editorData(tour: Tour) {
  const detail = tour.detail
  const dayDetail = tour.dayDetail
  const itinerarySource = detail?.itinerary ?? dayDetail?.stops?.map((stop, index) => ({ day: `Stop ${index + 1}`, ...stop })) ?? []
  const travelerSource = detail?.travelerPrices ?? dayDetail?.travelerPrices ?? [
    { travelers: 1, adultPrice: tour.price, childPrice: tour.price, infantPrice: 0 },
    { travelers: 2, adultPrice: tour.price, childPrice: tour.price, infantPrice: 0 },
    { travelers: 3, adultPrice: tour.price, childPrice: tour.price, infantPrice: 0 },
  ]
  const addonsSource = detail?.addOns ?? dayDetail?.addOns ?? []
  const highlightsSource = detail?.highlights ?? (dayDetail?.highlights?.length ? [{ title: 'Highlights', items: dayDetail.highlights }] : [])
  const gallerySource = tour.gallery?.length ? tour.gallery : dayDetail?.gallery?.map((item) => item.src) ?? [tour.image]
  const overview = detail?.overview ?? dayDetail?.overview ?? [tour.summary]
  const priceSource = normalizeTourPricePeriods(detail?.priceRows ?? dayDetail?.priceRows, 'Available travel dates')
  return {
    form: {
      title: tour.title,
      titleAr: tour.titleAr ?? '',
      category: tour.category,
      destinationSlug: tour.destinationSlug ?? '',
      cruiseType: tour.cruiseType ?? '',
      departurePort: tour.departurePort ?? '',
      location: tour.location,
      duration: tour.duration,
      price: String(tour.price),
      deal: String(tour.deal?.percent ?? ''),
      dealEndsAt: tour.deal?.endsAt?.slice(0, 10) ?? '',
      groupSize: tour.groupSize ?? '',
      travelStyle: tour.travelStyle ?? '',
      summary: tour.summary,
      overview: overview.join('\n'),
      itineraryNote: detail?.itineraryNote ?? dayDetail?.itineraryNote ?? '',
      included: (detail?.included ?? dayDetail?.included ?? []).join('\n'),
      excluded: (detail?.excluded ?? dayDetail?.excluded ?? []).join('\n'),
    } satisfies BasicForm,
    addOns: addonsSource.map((item) => ({ id: id('addon'), title: item.title, price: item.price === undefined ? '' : String(item.price) })),
    categorySlugs: [...(tour.categorySlugs ?? [])],
    highlightImage: detail?.highlightImage ?? dayDetail?.highlightImage ?? gallerySource[0] ?? tour.image,
    highlights: highlightsSource.map((group) => ({ id: id('highlight'), title: group.title, items: group.items.join('\n') })),
    itinerary: itinerarySource.map((item, index) => ({ id: id('day'), day: item.day, title: item.title, description: item.description, meals: item.meals ?? '', image: item.image ?? detail?.itineraryImages?.[index] ?? '' })),
    travelerPrices: {
      adult: travelerSource.map((item) => ({ id: id('adult-price'), travelers: String(item.travelers), price: String(item.adultPrice ?? item.price ?? tour.price) })),
      child: travelerSource.map((item) => ({ id: id('child-price'), travelers: String(item.travelers), price: String(item.childPrice ?? item.adultPrice ?? item.price ?? tour.price) })),
      infant: travelerSource.map((item) => ({ id: id('infant-price'), travelers: String(item.travelers), price: String(item.infantPrice ?? 0) })),
    } satisfies TravelerPriceRows,
    priceRows: priceSource.map((row) => ({ id: id('price-row'), category: row.category, startDate: row.startDate ?? '', endDate: row.endDate ?? '', price: String(row.price), note: row.note, prefix: row.prefix ?? '', tiers: (row.tiers ?? []).map((tier) => ({ id: id('price-tier'), label: tier.label, price: String(tier.price), suffix: tier.suffix ?? '' })) })),
    locations: locationRows(detail?.locations ?? dayDetail?.locations, tour.location),
    gallery: gallerySource.map((src, index) => ({ id: id('gallery'), src, alt: tour.galleryCaptions?.[index]?.en ?? `${tour.title} ${index + 1}`, creditLabel: tour.photoCredits?.[index]?.label ?? '', creditUrl: tour.photoCredits?.[index]?.url ?? '', source: 'link' as const })),
    videos: (tour.journeyVideos ?? []).map((video) => ({ id: video.id || id('video'), url: video.url, platform: video.platform ?? 'youtube', title: video.title, titleAr: video.titleAr ?? '', publishedAt: video.publishedAt.slice(0, 10), thumbnail: video.thumbnail ?? '' })),
  }
}

export function TripBuilder() {
  const ar = useAdminLocale() === 'ar'
  const initialTour = tours[0]
  const initial = editorData(initialTour)
  const [sourceTour, setSourceTour] = useState(initialTour)
  // Canonical slug being edited (null = creating a new tour). Set from
  // ?slug= on load and after a successful POST so later saves update it.
  const [editingSlug, setEditingSlug] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedSlug, setSavedSlug] = useState<string | null>(null)
  const [activeStep, setActiveStep] = useState(0)
  // Step 11 (index steps.length - 1) is the maximum valid builder step.
  // All navigation paths clamp here; nothing may advance beyond it.
  const isLastStep = activeStep >= steps.length - 1
  const step = activeStep === 4 ? -1 : activeStep > 4 ? activeStep - 1 : activeStep
  const [done, setDone] = useState<number[]>([])
  const [form, setForm] = useState<BasicForm>(initial.form)
  const [catSlugs, setCatSlugs] = useState<string[]>(initial.categorySlugs)
  const [addOns, setAddOns] = useState<AddOnRow[]>(initial.addOns)
  const [highlightImage, setHighlightImage] = useState(initial.highlightImage)
  const [highlights, setHighlights] = useState<HighlightRow[]>(initial.highlights)
  const [itinerary, setItinerary] = useState<ItineraryRow[]>(initial.itinerary)
  const [travelerPrices, setTravelerPrices] = useState<TravelerPriceRows>(initial.travelerPrices)
  const [priceRows, setPriceRows] = useState<PriceMatrixRow[]>(initial.priceRows)
  const [locations, setLocations] = useState<LocationRow[]>(initial.locations)
  const [gallery, setGallery] = useState<GalleryRow[]>(initial.gallery)
  const [videos, setVideos] = useState<VideoRow[]>(initial.videos)
  const [mediaLink, setMediaLink] = useState('')
  const [mediaAlt, setMediaAlt] = useState('')
  const [mediaCreditLabel, setMediaCreditLabel] = useState('')
  const [mediaCreditUrl, setMediaCreditUrl] = useState('')
  const [previewAdults, setPreviewAdults] = useState(2)
  const [previewChildren, setPreviewChildren] = useState(0)
  const [previewInfants, setPreviewInfants] = useState(0)
  // Route slug for a new tour (the slug field is read-only when editing).
  const [newSlug, setNewSlug] = useState('')
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')
  // Serialized snapshot of the last persisted editor state. Compared
  // against the live editor state to decide whether Save & Publish shows.
  // Step navigation and preview controls never touch these fields.
  const [baseline, setBaseline] = useState<string | null>(() =>
    JSON.stringify({
      form: initial.form, catSlugs: initial.categorySlugs, addOns: initial.addOns,
      highlightImage: initial.highlightImage, highlights: initial.highlights,
      itinerary: initial.itinerary, travelerPrices: initial.travelerPrices,
      priceRows: initial.priceRows, locations: initial.locations,
      gallery: initial.gallery, videos: initial.videos,
    }),
  )

  const load = (tour: Tour) => {
    const data = editorData(tour)
    setSourceTour(tour)
    setForm(data.form)
    setCatSlugs(data.categorySlugs)
    setAddOns(data.addOns)
    setHighlightImage(data.highlightImage)
    setHighlights(data.highlights)
    setItinerary(data.itinerary)
    setTravelerPrices(data.travelerPrices)
    setPriceRows(data.priceRows)
    setLocations(data.locations)
    setGallery(data.gallery)
    setVideos(data.videos)
    // Loaded DB state is clean by definition.
    setBaseline(JSON.stringify({
      form: data.form, catSlugs: data.categorySlugs, addOns: data.addOns,
      highlightImage: data.highlightImage, highlights: data.highlights,
      itinerary: data.itinerary, travelerPrices: data.travelerPrices,
      priceRows: data.priceRows, locations: data.locations,
      gallery: data.gallery, videos: data.videos,
    }))
  }

  useEffect(() => {
    const slug = new URLSearchParams(window.location.search).get('slug')
    if (!slug) return
    // DB-authoritative load (no static/localStorage fallback).
    let cancelled = false
    const loadFromDb = async () => {
      try {
        const res = await fetch(`/api/tours/${encodeURIComponent(slug)}`, { credentials: 'same-origin' })
        const data = await res.json()
        if (!res.ok || !data.tour) {
          setError(data.error || 'Tour not found in the database.')
          return
        }
        if (!cancelled) {
          load(data.tour as Tour)
          // Resolve to the canonical slug (supports opening via an alias).
          setEditingSlug((data.tour as Tour).slug)
          setSavedSlug(null)
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load tour.')
      }
    }
    void loadFromDb()
    return () => { cancelled = true }
  }, [])

  const set = (key: keyof BasicForm) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((current) => ({ ...current, [key]: event.target.value }))

  /** String-value adapter so shared dropdowns reuse the same form update. */
  const setField = (key: keyof BasicForm) => (next: string) =>
    setForm((current) => ({ ...current, [key]: next }))

  const toggleCatSlug = (slug: string) =>
    setCatSlugs((current) => current.includes(slug) ? current.filter((entry) => entry !== slug) : [...current, slug])

  const next = () => {
    setDone((current) => current.includes(activeStep) ? current : [...current, activeStep])
    setActiveStep((current) => Math.min(current + 1, steps.length - 1))
  }

  const addMediaLink = () => {
    const src = mediaLink.trim()
    if (!/^https?:\/\//i.test(src) && !src.startsWith('/') && !src.startsWith('data:image/')) {
      setError(ar ? 'أدخل رابط صورة صحيحا.' : 'Enter a valid image URL.')
      return
    }
    setGallery((current) => [...current, { id: id('gallery'), src, alt: mediaAlt.trim() || form.title, creditLabel: mediaCreditLabel.trim(), creditUrl: mediaCreditUrl.trim(), source: 'link' as const }].slice(0, 12))
    setMediaLink('')
    setMediaAlt('')
    setMediaCreditLabel('')
    setMediaCreditUrl('')
    setError('')
  }

  const uploadGallery = async (files: FileList | null) => {
    if (!files) return
    const loaded = await Promise.all(Array.from(files).slice(0, 12).map(async (file) => ({ file, src: await readImageFile(file) })))
    const valid = loaded.filter((item): item is { file: File; src: string } => Boolean(item.src)).map(({ file, src }) => ({ id: id('gallery'), src, alt: file.name, creditLabel: '', creditUrl: '', source: 'upload' as const }))
    setGallery((current) => [...current, ...valid].slice(0, 12))
    if (valid.length !== loaded.length) setError(ar ? 'بعض الصور لم تُقبل. الحد 1.5MB للصورة.' : 'Some images were rejected. The limit is 1.5MB per image.')
  }

  const cleanTravelerPrices = useMemo(() => {
    const clean = (rows: PassengerRateRow[]) => rows
      .map((row) => ({ travelers: Number(row.travelers), price: Number(row.price) }))
      .filter((row) => Number.isInteger(row.travelers) && row.travelers > 0 && Number.isFinite(row.price) && row.price >= 0)
    const adult = clean(travelerPrices.adult)
    const child = clean(travelerPrices.child)
    const infant = clean(travelerPrices.infant)
    const counts = Array.from(new Set([...adult, ...child, ...infant].map((row) => row.travelers))).sort((a, b) => a - b)
    return counts.map((travelers) => ({
      travelers,
      adultPrice: adult.find((row) => row.travelers === travelers)?.price,
      childPrice: child.find((row) => row.travelers === travelers)?.price,
      infantPrice: infant.find((row) => row.travelers === travelers)?.price,
    }))
  }, [travelerPrices])
  const previewTour = useMemo<Tour>(() => ({
    ...sourceTour,
    price: Number(form.price) || sourceTour.price,
    detail: sourceTour.detail ? { ...sourceTour.detail, travelerPrices: cleanTravelerPrices } : sourceTour.detail,
    dayDetail: sourceTour.dayDetail ? { ...sourceTour.dayDetail, travelerPrices: cleanTravelerPrices } : sourceTour.dayDetail,
  }), [cleanTravelerPrices, form.price, sourceTour])
  const previewHeadcount = Math.max(1, previewAdults + previewChildren + previewInfants)
  const previewPrices = getTravelerUnitPrices(previewTour, previewHeadcount)
  const previewTotal = previewAdults * previewPrices.adult + previewChildren * previewPrices.child + previewInfants * previewPrices.infant
  const cover = gallery[0]?.src || sourceTour.image

  // Unsaved-changes detection: every persisted editor field serialized.
  // New (never-saved) tours always show Save & Publish until the first
  // successful save; step navigation never alters these fields.
  const currentSnapshot = useMemo(
    () =>
      JSON.stringify({
        form, catSlugs, addOns, highlightImage, highlights, itinerary,
        travelerPrices, priceRows, locations, gallery, videos,
      }),
    [form, catSlugs, addOns, highlightImage, highlights, itinerary, travelerPrices, priceRows, locations, gallery, videos],
  )
  const showSave = editingSlug === null || baseline === null || baseline !== currentSnapshot

  const publish = async () => {
    setFeedback('')
    setError('')
    const basePrice = Number(form.price)
    if (!form.title.trim() || !form.duration.trim() || !Number.isFinite(basePrice) || basePrice < 0) {
      setError(ar ? 'راجع العنوان والمدة والسعر الأساسي قبل النشر.' : 'Check the title, duration, and base price before publishing.')
      return
    }
    if (form.category === 'one-day-tours' && !form.destinationSlug) {
      setError(ar ? 'اختر الوجهة قبل نشر رحلة اليوم الواحد.' : 'Select the destination before publishing the one-day tour.')
      return
    }
    if (form.category === 'multi-days-tours' && !catSlugs.length) {
      setError(ar ? 'اختر فئة واحدة على الأقل قبل نشر رحلة متعددة الأيام.' : 'Select at least one category before publishing the multi-day tour.')
      return
    }
    if (form.category === 'nile-cruises' && !form.cruiseType) {
      setError(ar ? 'اختر نوع الرحلة النيلية قبل النشر.' : 'Select the Nile cruise type before publishing.')
      return
    }
    if (form.category === 'shore-excursions' && !form.departurePort.trim()) {
      setError(ar ? 'أدخل ميناء الانطلاق قبل نشر الرحلة الساحلية.' : 'Enter the departure port before publishing the shore excursion.')
      return
    }
    const invalidTravelerPricing = (Object.keys(travelerPrices) as Array<keyof TravelerPriceRows>).some((type) => {
      const rows = travelerPrices[type]
      return !rows.length || rows.some((row) => !isValidPassengerRate(row)) || new Set(rows.map((row) => Number(row.travelers))).size !== rows.length
    })
    if (invalidTravelerPricing) {
      setError(ar ? 'راجع عدد المسافرين وأسعار البالغ والطفل والرضيع. يجب أن تكون القيم صحيحة وغير مكررة.' : 'Check traveler counts and every adult, child, and infant rate. Counts must be valid and unique.')
      return
    }
    const invalidDetailedPrice = priceRows.some((row) => row.price !== '' && (!Number.isFinite(Number(row.price)) || Number(row.price) < 0)
      || !row.category.trim()
      || Boolean(row.startDate) !== Boolean(row.endDate)
      || Boolean(row.startDate && row.endDate && row.endDate < row.startDate)
      || !row.tiers.length
      || row.tiers.some((tier) => !tier.label.trim() || tier.price === '' || !Number.isFinite(Number(tier.price)) || Number(tier.price) < 0))
    if (invalidDetailedPrice) {
      setError(ar ? 'راجع فترات السفر وأسعارها. يلزم عنوان للفترة، وتاريخا البداية والنهاية معا عند استخدامهما، وشريحة سعر واحدة على الأقل.' : 'Check date pricing. Each period needs a title, both dates when dates are used, and at least one valid price tier.')
      return
    }
    const invalidVideo = videos.find((row) => {
      const hasData = row.url.trim() || row.title.trim() || row.titleAr.trim() || row.publishedAt || row.thumbnail.trim()
      return hasData && (!row.url.trim() || !row.title.trim() || !isSafeExternalUrl(row.url.trim()) || Boolean(row.thumbnail.trim()) && !isSafeExternalUrl(row.thumbnail.trim()))
    })
    if (invalidVideo) {
      setError(ar ? 'كل فيديو يحتاج عنوانا ورابط HTTPS صحيحا.' : 'Every video needs a title and a valid HTTPS URL.')
      return
    }
    const invalidCredit = gallery.find((item) => Boolean(item.creditLabel.trim()) !== Boolean(item.creditUrl.trim()) || item.creditUrl.trim() && !isSafeExternalUrl(item.creditUrl.trim()))
    if (invalidCredit) {
      setError(ar ? 'بيانات مصدر الصورة تحتاج اسما ورابط HTTPS صحيحا معا.' : 'Photo credits need both a label and a valid HTTPS URL.')
      return
    }
    const savedLocations: TourLocation[] = locations.filter((row) => row.name.trim()).map((row) => {
      const latitude = Number(row.latitude)
      const longitude = Number(row.longitude)
      return Number.isFinite(latitude) && Number.isFinite(longitude) && row.latitude !== '' && row.longitude !== ''
        ? { id: row.id, name: row.name.trim(), nameAr: row.nameAr.trim() || undefined, latitude, longitude }
        : row.name.trim()
    })
    const savedItinerary = itinerary.filter((row) => row.title.trim() || row.description.trim()).map((row, index) => ({
      day: row.day.trim() || (form.category === 'one-day-tours' ? `Stop ${index + 1}` : `Day ${index + 1}`),
      title: row.title.trim(),
      description: row.description.trim(),
      meals: row.meals.trim() || undefined,
      image: row.image.trim() || undefined,
    }))
    const savedAddOns = addOns.filter((row) => row.title.trim()).map((row) => ({ title: row.title.trim(), price: row.price === '' ? undefined : Number(row.price) }))
    const savedHighlights = highlights.filter((row) => row.title.trim() || splitLines(row.items).length).map((row) => ({ title: row.title.trim() || 'Highlights', items: splitLines(row.items) }))
    const savedPriceRows = priceRows.filter((row) => row.category.trim()).map((row) => ({
      category: row.category.trim(),
      price: Number(row.price) || 0,
      note: row.note.trim(),
      startDate: row.startDate || undefined,
      endDate: row.endDate || undefined,
      prefix: row.prefix.trim() || undefined,
      tiers: row.tiers.filter((tier) => tier.label.trim() && tier.price !== '').map((tier) => ({ label: tier.label.trim(), price: Number(tier.price), suffix: tier.suffix.trim() || undefined })),
    }))
    const savedVideos = videos.filter((row) => row.url.trim() && row.title.trim()).map((row) => ({
      id: row.id,
      url: row.url.trim(),
      platform: row.platform,
      title: row.title.trim(),
      titleAr: row.titleAr.trim() || undefined,
      publishedAt: row.publishedAt || '',
      thumbnail: row.thumbnail.trim() || undefined,
    }))
    const overview = splitLines(form.overview)
    const galleryImages = gallery.map((item) => item.src)
    const common: Tour = {
      ...sourceTour,
      title: form.title.trim(),
      titleAr: form.titleAr.trim() || undefined,
      category: form.category,
      cruiseType: form.category === 'nile-cruises' ? form.cruiseType || undefined : undefined,
      departurePort: form.category === 'shore-excursions' ? form.departurePort.trim() || undefined : undefined,
      destinationSlug: form.category === 'one-day-tours' ? form.destinationSlug || null : null,
      categorySlugs: form.category === 'multi-days-tours' ? [...catSlugs] : [],
      location: form.location.trim(),
      duration: form.duration.trim(),
      price: basePrice,
      image: galleryImages[0] ?? sourceTour.image,
      gallery: galleryImages.length ? galleryImages : sourceTour.gallery,
      galleryCaptions: gallery.length ? gallery.map((item) => ({ en: item.alt, ar: item.alt })) : sourceTour.galleryCaptions,
      photoCredits: gallery.filter((item) => item.creditLabel.trim() && item.creditUrl.trim()).map((item) => ({ label: item.creditLabel.trim(), url: item.creditUrl.trim() })),
      journeyVideos: savedVideos,
      summary: form.summary.trim(),
      groupSize: form.groupSize.trim() || undefined,
      travelStyle: form.travelStyle.trim() || undefined,
      deal: Number(form.deal) > 0 && form.dealEndsAt ? { percent: Number(form.deal), endsAt: form.dealEndsAt } : undefined,
    }
    const saved: Tour = form.category === 'one-day-tours' ? {
      ...common,
      dayDetail: {
        ...(sourceTour.dayDetail ?? { overview: [] }),
        overview,
        highlightImage: highlightImage.trim() || undefined,
        itineraryNote: form.itineraryNote.trim() || undefined,
        highlights: savedHighlights.flatMap((group) => group.items),
        stops: savedItinerary.map(({ title, description, meals, image }) => ({ title, description, meals, image })),
        gallery: gallery.map((item) => ({ src: item.src, alt: item.alt })),
        included: splitLines(form.included),
        excluded: splitLines(form.excluded),
        addOns: savedAddOns,
        locations: savedLocations.length ? savedLocations : [form.location.trim()],
        priceRows: savedPriceRows,
        travelerPrices: cleanTravelerPrices,
      },
    } : {
      ...common,
      detail: {
        ...(sourceTour.detail ?? { highlights: [], itinerary: [], locations: [] }),
        overview,
        highlightImage: highlightImage.trim() || undefined,
        itineraryNote: form.itineraryNote.trim() || undefined,
        highlights: savedHighlights,
        itinerary: savedItinerary,
        included: splitLines(form.included),
        excluded: splitLines(form.excluded),
        addOns: savedAddOns,
        locations: savedLocations.length ? savedLocations : [form.location.trim()],
        priceRows: savedPriceRows,
        travelerPrices: cleanTravelerPrices,
      },
    }
    // Save & Publish: the ONLY persistence path, straight to the database.
    // - Editing (?slug= loaded): PUT updates exactly that DB row.
    // - Creating (no ?slug=): POST inserts exactly one row; a taken slug is
    //   reported as an error and never silently overwritten (no duplicates).
    if (saving) return
    setSaving(true)
    try {
      let method: 'POST' | 'PUT' = 'PUT'
      let url = ''
      let finalSlug = ''
      if (editingSlug) {
        method = 'PUT'
        finalSlug = editingSlug
        url = `/api/tours/${encodeURIComponent(editingSlug)}`
      } else {
        const slug = newSlug.trim().toLowerCase()
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 80) {
          setError(ar ? 'أدخل رابطا جديدا صحيحا: حروف إنجليزية صغيرة وأرقام وشرطات.' : 'Enter a valid new route slug: lowercase letters, numbers, and hyphens.')
          setSaving(false)
          return
        }
        method = 'POST'
        finalSlug = slug
        url = '/api/tours'
      }
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(method === 'POST' ? { ...saved, slug: finalSlug } : saved),
        credentials: 'same-origin',
      })
      const data = await res.json().catch(() => ({} as { error?: string; tour?: Tour }))
      if (res.status === 409) throw new Error(ar ? 'توجد رحلة بهذا الرابط مسبقا. افتحها للتعديل عليها بدلا من إنشاء نسخة مكررة.' : 'A tour with this slug already exists. Open it to edit instead of creating a duplicate.')
      if (!res.ok) throw new Error(data.error || 'Failed to save tour')
      const persisted = (data.tour as Tour | undefined) ?? saved
      setSourceTour(persisted)
      setEditingSlug(persisted.slug)
      setSavedSlug(persisted.slug)
      try {
        const nextUrl = new URL(window.location.href)
        nextUrl.searchParams.set('slug', persisted.slug)
        window.history.replaceState(null, '', nextUrl.toString())
      } catch { /* non-fatal */ }
      setDone(steps.map((_, index) => index))
      setFeedback(ar ? 'تم حفظ الرحلة في قاعدة البيانات.' : 'Tour saved to the database.')
      // Successful save marks the editor clean, hiding Save & Publish until
      // the next edit. Failures leave the baseline untouched (button stays).
      setBaseline(currentSnapshot)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save tour to database.')
      setFeedback('')
      setSavedSlug(null)
    } finally {
      setSaving(false)
    }
  }

  const repeatHeader = (title: React.ReactNode, index: number, remove: () => void) => <header><span>{index + 1}</span><strong>{title}</strong><button type="button" onClick={remove} aria-label={ar ? 'حذف العنصر' : 'Remove item'} title={ar ? 'حذف' : 'Remove'}><Trash2 size={16} /></button></header>

  const pricingGroups = [
    { type: 'adult' as const, en: 'Adults', ar: 'البالغون', defaultPrice: form.price },
    { type: 'child' as const, en: 'Children', ar: 'الأطفال', defaultPrice: form.price },
    { type: 'infant' as const, en: 'Infants', ar: 'الرضع', defaultPrice: '0' },
  ]
  const addPassengerRate = (type: keyof TravelerPriceRows, defaultPrice: string) => setTravelerPrices((current) => {
    const rows = current[type]
    const nextCount = Math.max(0, ...rows.map((item) => Number(item.travelers) || 0)) + 1
    return { ...current, [type]: [...rows, { id: id(`${type}-price`), travelers: String(nextCount), price: defaultPrice }] }
  })
  const updatePassengerRate = (type: keyof TravelerPriceRows, rowId: string, key: 'travelers' | 'price', value: string) => setTravelerPrices((current) => ({
    ...current,
    [type]: current[type].map((row) => row.id === rowId ? { ...row, [key]: value } : row),
  }))
  const removePassengerRate = (type: keyof TravelerPriceRows, rowId: string) => setTravelerPrices((current) => ({
    ...current,
    [type]: current[type].filter((row) => row.id !== rowId),
  }))

  return <>
    <PageHead eyebrow="Trip Builder" title="Trip Builder" titleAr="منشئ الرحلات" sub="Edit the complete tour experience from one structured workflow" subAr="عدّل تجربة الرحلة كاملة من مسار عمل منظم" actions={isLastStep ? (
      // Final step: navigation only — never advances the builder, never saves.
      editingSlug ? <a className="sp-btn dark" href={`/egypt-tours/${encodeURIComponent(editingSlug)}`} target="_blank" rel="noopener noreferrer"><ExternalLink size={16} /> <AdminText en="View Tour" ar="عرض الرحلة" /></a> : null
    ) : (
      <button type="button" className="sp-btn dark" onClick={next} disabled={saving}><ArrowRight size={16} /> <AdminText en="Continue" ar="متابعة" /></button>
    )} />
    <div className="sp-steps" aria-label={ar ? 'خطوات بناء الرحلة' : 'Trip builder steps'}>{steps.map((item, index) => <button key={item.en} type="button" className={index === activeStep ? 'active' : done.includes(index) ? 'done' : ''} onClick={() => setActiveStep(index)}>{index + 1}. {ar ? item.ar : item.en}</button>)}</div>

    <div className="sp-builder">
      <Card title={ar ? steps[activeStep].ar : steps[activeStep].en} sub={<AdminText en="Every field feeds the public tour detail experience" ar="كل حقل يغذي تجربة صفحة الرحلة العامة" />}>
        <div className="sp-form">
          {step === 4 && <label><AdminText en="Itinerary note" ar="ملاحظة البرنامج" /><textarea value={form.itineraryNote} onChange={set('itineraryNote')} rows={3} placeholder={ar ? 'ملاحظة تظهر أعلى أيام أو محطات البرنامج' : 'Shown above the itinerary days or stops'} /></label>}
          {step === 7 && gallery.length>0&&<div className="sp-media-alt-list"><strong><AdminText en="Gallery image descriptions" ar="أوصاف صور المعرض" /></strong>{gallery.map((image, index) => <label key={image.id}><AdminText en={`Image ${index + 1} description`} ar={`وصف الصورة ${index + 1}`} /><input value={image.alt} onChange={(event) => setGallery((current) => current.map((item) => item.id === image.id ? { ...item, alt: event.target.value } : item))} /></label>)}</div>}
          {step === 9 && <div className="sp-builder-note"><CheckCircle2 size={17}/><AdminText en="Related Tours are selected automatically from the tour category and destination. Customer reviews are submitted and moderated separately, so neither should be authored as tour content here." ar="يتم اختيار الرحلات ذات الصلة تلقائيا حسب تصنيف الرحلة والوجهة. أما تقييمات العملاء فتُرسل وتُراجع بشكل منفصل، لذلك لا يتم تأليف أي منهما كمحتوى للرحلة هنا." /></div>}
          {step === 9 && <div className="sp-builder-coverage"><span><b>{videos.length}</b><AdminText en="journey videos" ar="فيديوهات رحلة" /></span><span><b>{priceRows.length}</b><AdminText en="detailed price rows" ar="صفوف أسعار تفصيلية" /></span><span><b>{gallery.filter((item) => item.creditLabel && item.creditUrl).length}</b><AdminText en="photo credits" ar="مصادر صور" /></span><span><b>{form.itineraryNote ? 1 : 0}</b><AdminText en="itinerary note" ar="ملاحظة برنامج" /></span></div>}
          {step === 6 && <><div className="sp-builder-subhead"><div><strong><AdminText en="Tour date price calendar" ar="تقويم أسعار مواعيد الرحلة" /></strong><small><AdminText en="Create one card for each travel period, then add Solo, 2 PAX, group, cabin, or other prices inside it." ar="أنشئ كارتا لكل فترة سفر، ثم أضف داخله أسعار الفردي أو شخصين أو المجموعة أو الكابينة." /></small></div><button type="button" className="sp-btn" onClick={() => setPriceRows((current) => [...current, { id: id('price-row'), category: '', startDate: '', endDate: '', price: '', note: '', prefix: '', tiers: [{ id: id('price-tier'), label: 'Solo', price: form.price, suffix: 'per person' }] }])}><Plus size={16}/><AdminText en="Add travel period" ar="إضافة فترة سفر" /></button></div><div className="sp-repeat-list">{priceRows.map((row, index) => <article className="sp-repeat-card sp-date-price-card" key={row.id}>{repeatHeader(<AdminText en="Travel period" ar="فترة سفر" />, index, () => setPriceRows((current) => current.filter((item) => item.id !== row.id)))}<label><AdminText en="Period title" ar="عنوان الفترة" /><input value={row.category} placeholder={ar ? 'مثال: 1 - 10 يناير 2027' : 'Example: 1 - 10 January 2027'} onChange={(event) => setPriceRows((current) => current.map((item) => item.id === row.id ? { ...item, category: event.target.value } : item))} /></label><div className="sp-form-2"><label><AdminText en="Start date" ar="تاريخ البداية" /><DateInput value={row.startDate} onChange={(event) => setPriceRows((current) => current.map((item) => item.id === row.id ? { ...item, startDate: event.target.value } : item))} /></label><label><AdminText en="End date" ar="تاريخ النهاية" /><DateInput value={row.endDate} min={row.startDate || undefined} onChange={(event) => setPriceRows((current) => current.map((item) => item.id === row.id ? { ...item, endDate: event.target.value } : item))} /></label></div><label><AdminText en="Period note (optional)" ar="ملاحظة الفترة (اختياري)" /><input value={row.note} placeholder={ar ? 'مثال: موسم الذروة' : 'Example: Peak season'} onChange={(event) => setPriceRows((current) => current.map((item) => item.id === row.id ? { ...item, note: event.target.value } : item))} /></label><div className="sp-tier-editor"><div className="sp-tier-editor-head"><strong><AdminText en="Prices in this period" ar="أسعار هذه الفترة" /></strong><button type="button" className="sp-btn" onClick={() => setPriceRows((current) => current.map((item) => item.id === row.id ? { ...item, tiers: [...item.tiers, { id: id('price-tier'), label: '', price: '', suffix: 'per person' }] } : item))}><Plus size={15}/><AdminText en="Add period price" ar="إضافة سعر للفترة" /></button></div>{row.tiers.map((tier) => <div className="sp-tier-row" key={tier.id}><input value={tier.label} aria-label={ar ? 'اسم شريحة السعر' : 'Price tier label'} placeholder={ar ? 'فردي أو 2 PAX أو 3-10 PAX' : 'Solo, 2 PAX, or 3-10 PAX'} onChange={(event) => setPriceRows((current) => current.map((item) => item.id === row.id ? { ...item, tiers: item.tiers.map((entry) => entry.id === tier.id ? { ...entry, label: event.target.value } : entry) } : item))} /><input type="number" min="0" step="0.01" value={tier.price} aria-label={ar ? 'السعر' : 'Price'} placeholder="0" onChange={(event) => setPriceRows((current) => current.map((item) => item.id === row.id ? { ...item, tiers: item.tiers.map((entry) => entry.id === tier.id ? { ...entry, price: event.target.value } : entry) } : item))} /><input value={tier.suffix} aria-label={ar ? 'وحدة السعر' : 'Price unit'} placeholder={ar ? 'للفرد' : 'per person'} onChange={(event) => setPriceRows((current) => current.map((item) => item.id === row.id ? { ...item, tiers: item.tiers.map((entry) => entry.id === tier.id ? { ...entry, suffix: event.target.value } : entry) } : item))} /><button type="button" className="sp-icon-btn danger" onClick={() => setPriceRows((current) => current.map((item) => item.id === row.id ? { ...item, tiers: item.tiers.filter((entry) => entry.id !== tier.id) } : item))} aria-label={ar ? 'حذف سعر الفترة' : 'Remove period price'}><Trash2 size={15}/></button></div>)}</div></article>)}</div></>}
          {step === 7 && <>
            <div className="sp-builder-subhead"><div><strong><AdminText en="Journey video reels" ar="فيديوهات الرحلة" /></strong><small><AdminText en="Newest dated videos appear first on the public page." ar="تظهر الفيديوهات الأحدث تاريخا أولا في صفحة الرحلة." /></small></div><button type="button" className="sp-btn" onClick={() => setVideos((current) => [...current, { id: id('video'), url: '', platform: 'youtube', title: '', titleAr: '', publishedAt: '', thumbnail: '' }])}><Plus size={16}/><AdminText en="Add video" ar="إضافة فيديو" /></button></div>
            <div className="sp-repeat-list">{videos.map((row, index) => <article className="sp-repeat-card" key={row.id}>
              {repeatHeader(<AdminText en="Journey video" ar="فيديو الرحلة" />, index, () => setVideos((current) => current.filter((item) => item.id !== row.id)))}
              <div className="sp-form-2"><label><AdminText en="Video URL" ar="رابط الفيديو" /><input value={row.url} dir="ltr" placeholder="https://..." onChange={(event) => setVideos((current) => current.map((item) => item.id === row.id ? { ...item, url: event.target.value } : item))} /></label><label><AdminText en="Platform" ar="المنصة" /><SharedSelect value={row.platform} onChange={(next) => setVideos((current) => current.map((item) => item.id === row.id ? { ...item, platform: next as TourVideoPlatform } : item))} locale={ar ? 'ar' : 'en'} options={[{ value: 'youtube', label: 'YouTube' }, { value: 'instagram', label: 'Instagram' }, { value: 'tiktok', label: 'TikTok' }, { value: 'facebook', label: 'Facebook' }, { value: 'vimeo', label: 'Vimeo' }, { value: 'direct', label: 'Direct video' }]} /></label></div>
              <div className="sp-form-2"><label><AdminText en="Title (EN)" ar="العنوان (EN)" /><input value={row.title} onChange={(event) => setVideos((current) => current.map((item) => item.id === row.id ? { ...item, title: event.target.value } : item))} /></label><label><AdminText en="Title (AR)" ar="العنوان (AR)" /><input value={row.titleAr} onChange={(event) => setVideos((current) => current.map((item) => item.id === row.id ? { ...item, titleAr: event.target.value } : item))} /></label></div>
              <label><AdminText en="Published date" ar="تاريخ النشر" /><DateInput value={row.publishedAt} onChange={(event) => setVideos((current) => current.map((item) => item.id === row.id ? { ...item, publishedAt: event.target.value } : item))} /></label>
              <ImageField value={row.thumbnail} onChange={(thumbnail) => setVideos((current) => current.map((item) => item.id === row.id ? { ...item, thumbnail } : item))} preview="compact" linkLabel={{ en: 'Thumbnail URL (optional)', ar: 'رابط صورة الفيديو (اختياري)' }} uploadLabel={{ en: 'Upload thumbnail', ar: 'رفع صورة الفيديو' }} previewAlt={row.title || 'Video thumbnail'} />
            </article>)}</div>
            <div className="sp-builder-divider" />
            <div className="sp-builder-subhead"><div><strong><AdminText en="Tour gallery" ar="معرض صور الرحلة" /></strong><small><AdminText en="The first image is the cover. Credits are optional." ar="الصورة الأولى هي الغلاف. بيانات المصدر اختيارية." /></small></div></div>
            <div className="sp-form-2"><label><AdminText en="Pending photo credit" ar="مصدر الصورة الجديدة" /><input value={mediaCreditLabel} onChange={(event) => setMediaCreditLabel(event.target.value)} placeholder={ar ? 'اسم المصور أو المصدر' : 'Photographer or source name'} /></label><label><AdminText en="Pending credit URL" ar="رابط مصدر الصورة الجديدة" /><input value={mediaCreditUrl} onChange={(event) => setMediaCreditUrl(event.target.value)} dir="ltr" placeholder="https://..." /></label></div>
            {gallery.length>0&&<div className="sp-media-credit-list">{gallery.map((image, index) => <div key={image.id}><strong>{index + 1}. {image.alt}</strong><div className="sp-form-2"><label><AdminText en="Credit label" ar="اسم المصدر" /><input value={image.creditLabel} onChange={(event) => setGallery((current) => current.map((item) => item.id === image.id ? { ...item, creditLabel: event.target.value } : item))} /></label><label><AdminText en="Credit URL" ar="رابط المصدر" /><input value={image.creditUrl} dir="ltr" placeholder="https://..." onChange={(event) => setGallery((current) => current.map((item) => item.id === image.id ? { ...item, creditUrl: event.target.value } : item))} /></label></div></div>)}</div>}
          </>}
          {step === 0 && <><label><AdminText en={editingSlug ? 'Route slug (read only)' : 'New route slug'} ar={editingSlug ? 'رابط الرحلة (للقراءة فقط)' : 'رابط الرحلة الجديدة'} />{editingSlug ? <input value={sourceTour.slug} readOnly dir="ltr" /> : <input value={newSlug} onChange={(event) => setNewSlug(event.target.value)} dir="ltr" placeholder="my-new-tour" />}</label><div className="sp-form-2"><label><AdminText en="Title (EN)" ar="العنوان (EN)" /><input value={form.title} onChange={set('title')} /></label><label><AdminText en="Title (AR)" ar="العنوان (AR)" /><input value={form.titleAr} onChange={set('titleAr')} /></label></div><div className="sp-form-2"><label><AdminText en="Category" ar="التصنيف" /><SharedSelect value={form.category} onChange={setField('category')} locale={ar ? 'ar' : 'en'} options={[{ value: 'one-day-tours', label: 'one-day-tours' }, { value: 'multi-days-tours', label: 'multi-days-tours' }, { value: 'nile-cruises', label: 'nile-cruises' }, { value: 'shore-excursions', label: 'shore-excursions' }]} /></label><label><AdminText en="Primary location" ar="الموقع الأساسي" /><input value={form.location} onChange={set('location')} /></label></div>{form.category === 'one-day-tours' && <label><AdminText en="Destination" ar="الوجهة" /><SharedSelect value={form.destinationSlug} onChange={setField('destinationSlug')} locale={ar ? 'ar' : 'en'} popupWidth="trigger" options={[{ value: '', label: ar ? 'اختر الوجهة' : 'Select destination' }, ...destinations.filter((d) => d.showInOneDayTours).map((d) => ({ value: d.slug, label: d.title }))]} /></label>}{form.category === 'multi-days-tours' && <div><strong style={{ display: 'block', marginBottom: 8 }}><AdminText en="Multi Day Categories" ar="فئات الرحلات متعددة الأيام" /></strong><div className="sp-check-grid">{multiDayCategories.map((c) => <label key={c.slug} className="sp-check-row"><input type="checkbox" checked={catSlugs.includes(c.slug)} onChange={() => toggleCatSlug(c.slug)} /><span>{c.name}<small dir="ltr">{c.slug}</small></span></label>)}</div></div>}{form.category === 'nile-cruises'&&<label><AdminText en="Cruise type" ar="نوع الرحلة النيلية" /><SharedSelect value={form.cruiseType} onChange={setField('cruiseType')} locale={ar ? 'ar' : 'en'} popupWidth="trigger" options={[{ value: '', label: ar ? 'اختر نوع الرحلة' : 'Select cruise type' }, { value: 'standard-nile-cruises', label: 'standard-nile-cruises' }, { value: 'deluxe-nile-cruise', label: 'deluxe-nile-cruise' }, { value: 'superior-nile-cruise', label: 'superior-nile-cruise' }, { value: 'luxury-nile-cruise', label: 'luxury-nile-cruise' }]} /></label>}{form.category === 'shore-excursions'&&<label><AdminText en="Departure port" ar="ميناء الانطلاق" /><input value={form.departurePort} onChange={set('departurePort')} placeholder={ar ? 'ميناء الإسكندرية' : 'Alexandria'} /></label>}<div className="sp-form-2"><label><AdminText en="Duration" ar="المدة" /><input value={form.duration} onChange={set('duration')} /></label><label><AdminText en="Group size" ar="حجم المجموعة" /><input value={form.groupSize} onChange={set('groupSize')} /></label></div><label><AdminText en="Travel style" ar="نمط الرحلة" /><input value={form.travelStyle} onChange={set('travelStyle')} /></label><label><AdminText en="Short summary" ar="الملخص القصير" /><textarea value={form.summary} onChange={set('summary')} rows={3} /></label></>}

          {step === 1 && <><div className="sp-form-2"><label><AdminText en="Base price (USD)" ar="السعر الأساسي (USD)" /><input type="number" min="0" value={form.price} onChange={set('price')} /></label><label><AdminText en="Deal discount %" ar="نسبة الخصم %" /><input type="number" min="0" max="99" value={form.deal} onChange={set('deal')} /></label></div><label><AdminText en="Deal ends at" ar="ينتهي الخصم في" /><DateInput value={form.dealEndsAt} onChange={set('dealEndsAt')} /></label><p className="sp-builder-note"><AdminText en="The base price is the fallback when no traveler-count tier matches." ar="السعر الأساسي هو السعر الاحتياطي عندما لا توجد شريحة مطابقة لعدد المسافرين." /></p></>}

          {step === 2 && <><div className="sp-repeat-list">{addOns.map((row, index) => <article className="sp-repeat-card" key={row.id}>{repeatHeader(<AdminText en="Optional add-on" ar="إضافة اختيارية" />, index, () => setAddOns((current) => current.filter((item) => item.id !== row.id)))}<div className="sp-form-2"><label><AdminText en="Title" ar="العنوان" /><input value={row.title} onChange={(event) => setAddOns((current) => current.map((item) => item.id === row.id ? { ...item, title: event.target.value } : item))} /></label><label><AdminText en="Price (blank = on request)" ar="السعر (فارغ = حسب الطلب)" /><input type="number" min="0" value={row.price} onChange={(event) => setAddOns((current) => current.map((item) => item.id === row.id ? { ...item, price: event.target.value } : item))} /></label></div></article>)}</div><button type="button" className="sp-btn" onClick={() => setAddOns((current) => [...current, { id: id('addon'), title: '', price: '' }])}><Plus size={16} /><AdminText en="Add add-on" ar="إضافة اختيار" /></button></>}

          {step === 3 && <label><AdminText en="Overview paragraphs" ar="فقرات النظرة العامة" /><textarea value={form.overview} onChange={set('overview')} placeholder={ar ? 'فقرة في كل سطر' : 'One paragraph per line'} rows={8} /></label>}

          {activeStep === 4 && <><p className="sp-builder-note"><AdminText en="Choose the main Highlights image, then create one or more groups with one highlight per line." ar="اختر الصورة الرئيسية لقسم أبرز المعالم، ثم أنشئ مجموعة أو أكثر واكتب بندا واحدا في كل سطر." /></p><article className="sp-repeat-card sp-highlight-image-editor"><header><span><ImagePlus size={16}/></span><strong><AdminText en="Highlights image" ar="صورة أبرز المعالم" /></strong></header><ImageField value={highlightImage} onChange={setHighlightImage} preview="wide" linkLabel={{ en: 'Highlights image URL', ar: 'رابط صورة أبرز المعالم' }} uploadLabel={{ en: 'Upload Highlights image', ar: 'رفع صورة أبرز المعالم' }} previewAlt={ar ? 'معاينة صورة أبرز المعالم' : 'Highlights image preview'} /></article><div className="sp-repeat-list">{highlights.map((row, index) => <article className="sp-repeat-card" key={row.id}>{repeatHeader(<AdminText en="Highlight group" ar="مجموعة أبرز المعالم" />, index, () => setHighlights((current) => current.filter((item) => item.id !== row.id)))}<label><AdminText en="Group title" ar="عنوان المجموعة" /><input value={row.title} placeholder={ar ? 'أبرز معالم القاهرة' : 'Cairo highlights'} onChange={(event) => setHighlights((current) => current.map((item) => item.id === row.id ? { ...item, title: event.target.value } : item))} /></label><label><AdminText en="Highlights (one per line)" ar="المعالم البارزة (بند في كل سطر)" /><textarea value={row.items} rows={5} placeholder={ar ? 'أهرامات الجيزة\nأبو الهول' : 'Giza Pyramids\nGreat Sphinx'} onChange={(event) => setHighlights((current) => current.map((item) => item.id === row.id ? { ...item, items: event.target.value } : item))} /></label></article>)}</div><button type="button" className="sp-btn" onClick={() => setHighlights((current) => [...current, { id: id('highlight'), title: '', items: '' }])}><Plus size={16}/><AdminText en="Add highlight group" ar="إضافة مجموعة" /></button></>}

          {step === 4 && <><div className="sp-repeat-list">{itinerary.map((row, index) => <article className="sp-repeat-card" key={row.id}>{repeatHeader(<AdminText en={form.category === 'one-day-tours' ? 'Itinerary stop' : 'Itinerary day'} ar={form.category === 'one-day-tours' ? 'محطة البرنامج' : 'يوم البرنامج'} />, index, () => setItinerary((current) => current.filter((item) => item.id !== row.id)))}<div className="sp-form-2"><label><AdminText en="Day / label" ar="اليوم / العنوان التعريفي" /><input value={row.day} placeholder={form.category === 'one-day-tours' ? 'Stop 1' : 'Day 1'} onChange={(event) => setItinerary((current) => current.map((item) => item.id === row.id ? { ...item, day: event.target.value } : item))} /></label><label><AdminText en="Day title" ar="عنوان اليوم" /><input value={row.title} onChange={(event) => setItinerary((current) => current.map((item) => item.id === row.id ? { ...item, title: event.target.value } : item))} /></label></div><label><AdminText en="Description" ar="الوصف" /><textarea value={row.description} rows={4} onChange={(event) => setItinerary((current) => current.map((item) => item.id === row.id ? { ...item, description: event.target.value } : item))} /></label><label><AdminText en="Meals" ar="وجبات اليوم" /><input value={row.meals} placeholder={ar ? 'إفطار، غداء، عشاء' : 'Breakfast, lunch, dinner'} onChange={(event) => setItinerary((current) => current.map((item) => item.id === row.id ? { ...item, meals: event.target.value } : item))} /></label><ImageField value={row.image} onChange={(image) => setItinerary((current) => current.map((item) => item.id === row.id ? { ...item, image } : item))} preview="compact" linkLabel={{ en: 'Itinerary image URL', ar: 'رابط صورة البرنامج' }} uploadLabel={{ en: 'Upload itinerary image', ar: 'رفع صورة البرنامج' }} previewAlt={row.title || row.day} /></article>)}</div><button type="button" className="sp-btn" onClick={() => setItinerary((current) => [...current, { id: id('day'), day: form.category === 'one-day-tours' ? `Stop ${current.length + 1}` : `Day ${current.length + 1}`, title: '', description: '', meals: '', image: '' }])}><Plus size={16}/><AdminText en="Add itinerary item" ar="إضافة عنصر للبرنامج" /></button></>}

          {step === 5 && <><label><AdminText en="What's included? (one per line)" ar="ما المشمول؟ (بند في كل سطر)" /><textarea value={form.included} onChange={set('included')} rows={6} /></label><label><AdminText en="What's excluded? (one per line)" ar="ما غير المشمول؟ (بند في كل سطر)" /><textarea value={form.excluded} onChange={set('excluded')} rows={6} /></label></>}

          {step === 1 && <><div className="sp-builder-divider" /><div className="sp-builder-subhead"><div><strong><AdminText en="Booking rates by passenger type" ar="أسعار الحجز حسب نوع المسافر" /></strong><small><AdminText en="These rates drive the live booking total. They do not appear in the public date-price calendar." ar="هذه الأسعار تحسب إجمالي الحجز مباشرة، ولا تظهر داخل تقويم أسعار المواعيد العام." /></small></div></div><div className="sp-passenger-pricing-grid">{pricingGroups.map((group) => <section className={`sp-passenger-pricing ${group.type}`} key={group.type}><header><div><strong>{ar ? group.ar : group.en}</strong><small><AdminText en="Per-person rate by total group size" ar="سعر الفرد حسب إجمالي حجم المجموعة" /></small></div><button type="button" className="sp-btn" onClick={() => addPassengerRate(group.type, group.defaultPrice)}><Plus size={15}/><AdminText en="Add rate" ar="إضافة سعر" /></button></header><div className="sp-passenger-rate-head"><span><AdminText en="Total travelers" ar="إجمالي المسافرين" /></span><span><AdminText en="Price (USD)" ar="السعر (USD)" /></span><span /></div>{travelerPrices[group.type].map((row) => <div className="sp-passenger-rate-row" key={row.id}><input type="number" min="1" step="1" aria-label={ar ? `عدد المسافرين لفئة ${group.ar}` : `${group.en} traveler count`} value={row.travelers} onChange={(event) => updatePassengerRate(group.type, row.id, 'travelers', event.target.value)} /><input type="number" min="0" step="0.01" aria-label={ar ? `سعر فئة ${group.ar}` : `${group.en} price`} value={row.price} onChange={(event) => updatePassengerRate(group.type, row.id, 'price', event.target.value)} /><button type="button" className="sp-icon-btn danger" onClick={() => removePassengerRate(group.type, row.id)} aria-label={ar ? 'حذف السعر' : 'Remove rate'} title={ar ? 'حذف السعر' : 'Remove rate'}><Trash2 size={18}/></button></div>)}</section>)}</div></>}

          {step === 7 && <>
            <ImageField value={mediaLink} onChange={setMediaLink} preview="compact" linkLabel={{ en: 'Gallery image URL', ar: 'رابط صورة المعرض' }} uploadLabel={{ en: 'Upload one image', ar: 'رفع صورة واحدة' }} previewAlt={mediaAlt || form.title} />
            <label><AdminText en="Image description" ar="وصف الصورة" /><input value={mediaAlt} onChange={(event) => setMediaAlt(event.target.value)} /></label>
            <button type="button" className="sp-btn" onClick={addMediaLink}><ImagePlus size={16}/><AdminText en="Add image to gallery" ar="إضافة الصورة إلى المعرض" /></button>
            <label className="sp-file-label"><AdminText en="Or upload several gallery images" ar="أو ارفع عدة صور للمعرض" /><span className="sp-file-trigger"><Upload size={16}/><AdminText en="Choose images" ar="اختيار الصور" /></span><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple onChange={(event) => uploadGallery(event.target.files)} /></label>
            <div className="sp-gallery">{gallery.map((image, index) => <figure className="sp-g-item" key={image.id}><img src={image.src} alt={image.alt}/>{index===0&&<em className="sp-g-cover"><AdminText en="Cover" ar="الغلاف" /></em>}<figcaption><span>{image.alt}</span><span className="sp-g-ops"><button type="button" disabled={index===0} onClick={() => setGallery((current) => { const next=[...current]; [next[index-1],next[index]]=[next[index],next[index-1]]; return next })} aria-label={ar?'تحريك للخلف':'Move backward'}><ArrowLeft size={14}/></button><button type="button" disabled={index===gallery.length-1} onClick={() => setGallery((current) => { const next=[...current]; [next[index+1],next[index]]=[next[index],next[index+1]]; return next })} aria-label={ar?'تحريك للأمام':'Move forward'}><ArrowRight size={14}/></button><button type="button" onClick={() => setGallery((current) => current.filter((item) => item.id !== image.id))} aria-label={ar?'حذف الصورة':'Remove image'}><Trash2 size={14}/></button></span></figcaption></figure>)}</div>
          </>}

          {step === 8 && <><p className="sp-builder-note"><MapPin size={16}/><AdminText en="Add every stop. Coordinates produce the interactive map; a name alone uses the standard map search." ar="أضف كل محطة. الإحداثيات تُظهر الخريطة التفاعلية، والاسم وحده يستخدم بحث الخريطة الطبيعي." /></p><div className="sp-repeat-list">{locations.map((row, index) => <article className="sp-repeat-card" key={row.id}>{repeatHeader(<AdminText en="Map location" ar="موقع على الخريطة" />, index, () => setLocations((current) => current.filter((item) => item.id !== row.id)))}<div className="sp-form-2"><label><AdminText en="Location name (EN)" ar="اسم الموقع (EN)" /><input value={row.name} onChange={(event) => setLocations((current) => current.map((item) => item.id===row.id?{...item,name:event.target.value}:item))} /></label><label><AdminText en="Location name (AR)" ar="اسم الموقع (AR)" /><input value={row.nameAr} onChange={(event) => setLocations((current) => current.map((item) => item.id===row.id?{...item,nameAr:event.target.value}:item))} /></label></div><div className="sp-form-2"><label><AdminText en="Latitude" ar="خط العرض" /><input inputMode="decimal" dir="ltr" value={row.latitude} placeholder="25.6872" onChange={(event) => setLocations((current) => current.map((item) => item.id===row.id?{...item,latitude:event.target.value}:item))} /></label><label><AdminText en="Longitude" ar="خط الطول" /><input inputMode="decimal" dir="ltr" value={row.longitude} placeholder="32.6396" onChange={(event) => setLocations((current) => current.map((item) => item.id===row.id?{...item,longitude:event.target.value}:item))} /></label></div></article>)}</div><button type="button" className="sp-btn" onClick={() => setLocations((current) => [...current, { id:id('location'), name:'', nameAr:'', latitude:'', longitude:'' }])}><Plus size={16}/><AdminText en="Add location" ar="إضافة موقع" /></button></>}

          {step === 9 && <div className="sp-review-grid"><div><small><AdminText en="Tour" ar="الرحلة" /></small><strong>{form.title}</strong><span>{form.category} · {form.duration}</span></div><div><small><AdminText en="Content" ar="المحتوى" /></small><strong>{itinerary.length} <AdminText en="itinerary items" ar="عناصر برنامج" /></strong><span>{highlights.length} <AdminText en="highlight groups" ar="مجموعات أبرز المعالم" /> · {addOns.length} <AdminText en="add-ons" ar="إضافات" /> · {locations.length} <AdminText en="locations" ar="مواقع" /></span></div><div><small><AdminText en="Pricing" ar="التسعير" /></small><strong>{cleanTravelerPrices.length} <AdminText en="combined traveler tiers" ar="شرائح مسافرين مجمعة" /></strong><span><AdminText en={`${travelerPrices.adult.length} adult · ${travelerPrices.child.length} child · ${travelerPrices.infant.length} infant rates`} ar={`${travelerPrices.adult.length} بالغ · ${travelerPrices.child.length} طفل · ${travelerPrices.infant.length} رضيع`} /></span></div><div><small><AdminText en="Media" ar="الوسائط" /></small><strong>{gallery.length} <AdminText en="images" ar="صور" /></strong><span><AdminText en="First image is the cover" ar="الصورة الأولى هي الغلاف" /></span></div><p className="sp-builder-note full"><AdminText en="Save & Publish writes this tour to the database. The public tour page reads the same saved record." ar="الحفظ والنشر يكتبان هذه الرحلة في قاعدة البيانات. صفحة الرحلة العامة تقرأ نفس السجل المحفوظ." /></p></div>}

          {error&&<p className="sp-builder-feedback error" role="alert">{error}</p>}
          {feedback&&<p className="sp-builder-feedback success" role="status"><CheckCircle2 size={17}/>{feedback}</p>}
          {feedback&&savedSlug&&<p className="sp-builder-feedback success" role="status"><a href={`/egypt-tours/${savedSlug}`}><AdminText en="View tour" ar="عرض الرحلة" /></a>{' · '}<a href="/admin/trips"><AdminText en="Back to Trips" ar="رجوع إلى الرحلات" /></a></p>}
          <div className="sp-builder-actions">{activeStep>0&&<button type="button" className="sp-btn" onClick={() => setActiveStep((current) => current-1)} disabled={saving}><AdminText en="Back" ar="رجوع" /></button>}{!isLastStep?<button type="button" className="sp-btn primary" onClick={next} disabled={saving}><AdminText en="Continue" ar="متابعة" /></button>:showSave?<button type="button" className="sp-btn primary" onClick={publish} disabled={saving}><Save size={16}/><AdminText en="Save & Publish" ar="حفظ ونشر" /></button>:null}</div>
        </div>
      </Card>

      <aside className="sp-preview"><Card title={activeStep === 7 ? <AdminText en="Date calendar preview" ar="معاينة تقويم المواعيد" /> : <AdminText en="Live booking preview" ar="معاينة الحجز الحية" />} sub={activeStep === 7 ? <AdminText en="Matches the public Tour Prices section" ar="تطابق سيكشن أسعار الرحلة العام" /> : <AdminText en="Uses passenger-type booking rates" ar="تستخدم أسعار الحجز حسب نوع المسافر" />}>{activeStep === 7 ? <div className="sp-date-price-preview">{priceRows.length ? priceRows.map((row) => <article key={row.id}><header><CalendarDays size={15}/><div><b>{row.category || (ar ? 'فترة سفر جديدة' : 'New travel period')}</b>{(row.startDate || row.endDate) && <small>{[row.startDate, row.endDate].filter(Boolean).join(' / ')}</small>}</div></header>{row.tiers.length ? row.tiers.map((tier) => <p key={tier.id}><span>{tier.label || (ar ? 'شريحة سعر' : 'Price tier')}</span><strong>${(Number(tier.price) || 0).toLocaleString('en-US')}</strong></p>) : <em><AdminText en="Add at least one period price" ar="أضف سعرا واحدا على الأقل للفترة" /></em>}</article>) : <div className="sp-empty-preview"><CalendarDays size={22}/><AdminText en="Add a travel period to preview Tour Prices." ar="أضف فترة سفر لمعاينة أسعار الرحلة." /></div>}</div> : <div className="sp-preview-box"><img src={cover} alt=""/><div><small>{form.location} · {form.duration}</small><h4>{form.title}</h4><div className="sp-preview-guests"><label><AdminText en="Adults" ar="البالغون" /><input type="number" min="1" max="50" value={previewAdults} onChange={(event) => setPreviewAdults(Math.max(1, Number(event.target.value) || 1))} /></label><label><AdminText en="Children" ar="الأطفال" /><input type="number" min="0" max="50" value={previewChildren} onChange={(event) => setPreviewChildren(Math.max(0, Number(event.target.value) || 0))} /></label><label><AdminText en="Infants" ar="الرضع" /><input type="number" min="0" max="50" value={previewInfants} onChange={(event) => setPreviewInfants(Math.max(0, Number(event.target.value) || 0))} /></label></div><div className="sp-preview-rates"><span><AdminText en="Adult" ar="بالغ" /><b>${previewPrices.adult.toLocaleString('en-US')}</b></span><span><AdminText en="Child" ar="طفل" /><b>${previewPrices.child.toLocaleString('en-US')}</b></span><span><AdminText en="Infant" ar="رضيع" /><b>${previewPrices.infant.toLocaleString('en-US')}</b></span></div><p><AdminText en={`Tier for ${previewHeadcount} traveler${previewHeadcount === 1 ? '' : 's'}`} ar={`شريحة ${previewHeadcount} مسافر`} /><b>${previewTotal.toLocaleString('en-US')}</b></p></div></div>}</Card></aside>
    </div>
  </>
}
