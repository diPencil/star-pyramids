'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useRef, useState, type MouseEvent as CardMouseEvent } from 'react'
import { CalendarDays, ChevronDown, Globe2, Heart, Menu, Search, Share2, ShoppingCart, X, ArrowRight, ArrowUp, Check, MapPin, Clock3, Users, CarFront, Mail, Phone, Star, Sun, Ship, Anchor, Package, Ticket, BadgePercent, Accessibility, BadgeCheck, Gift, Bell, Sparkles } from 'lucide-react'
import { blogs, cars, destinations, events, faqs, offers, siteImages, policies, findBlog, findCar, findDestination, findEvent, findOffer } from '@/data/content'
import { dayTourRegions, getCruiseTypeBySlug, getToursByCategory, getToursBySlugs, seasonalTours, tourCategories, tourImages } from '@/data/tours'
import { matchPriceBand, parseTourListingQuery, tourListingSorts, tourPriceBands, type TourListingQuery } from '@/lib/query'
import { localizeTourDuration, localizeTourLocation } from '@/lib/tour-format'
import { COMPANY_ADDRESS, phoneHref, whatsappHref } from '@/data/company'
import { useBrandSettings } from '@/lib/admin-store'
import { useCart } from '@/lib/cart'
import { useCustomerFavorites } from '@/lib/customer-account'
import type { Tour, TourCategory, TourVariant } from '@/data/types'
import { LocaleProvider, useLocale, formatPrice, type Locale, type Currency } from './locale'
import { LiveChatWidget } from './live-chat'
import { WhatsAppGlyph, WhatsAppWidget } from './whatsapp-chat'
import { FooterSocials, HeaderSocials } from './social-icons'
import { LanguageModal, LanguageToggle } from './language-selector'

export const images = tourImages

const copy = { en: { search:'Find places and things to do', signIn:'Sign in', home:'Home', tours:'Egypt Tours', rent:'Rent Car', about:'About Us', contact:'Contact Us', blogs:'Blogs', events:'Events', offer:'Special Offer', make:'Make Your Trip', language:'AR - EGP', switch:'العربية', promo:'Book any package tour and enjoy a FREE tour experience included along with it.' }, ar: { search:'ابحث عن الأماكن والأنشطة', signIn:'تسجيل الدخول', home:'الرئيسية', tours:'جولات مصر', rent:'تأجير السيارات', about:'من نحن', contact:'اتصل بنا', blogs:'المدونة', events:'الفعاليات', offer:'عروض خاصة', make:'خطط رحلتك', language:'EN - USD', switch:'English', promo:'احجز أي برنامج سياحي واستمتع بتجربة مجانية مشمولة معه.' } } as const

export const extra = {
  en: { promo2: 'Limited-time savings on top-rated Egypt tours. Grab your deal before it ends!', viewPackages: 'View Packages', viewOffers: 'View Offers', cat1: 'One Day Tours', cat2: 'Multi Days Tours', cat3: 'Nile Cruises', cat4: 'Shore Excursion', liveChat: 'Live Chat', modalTitle: 'Language and Currency', curTitle: 'Currency', regTitle: 'Region and Language', footerTag: 'We would be happy to help you discover Egypt.', footerLinks: 'STAR PYRAMIDS Links', contactInfo: 'Contact Info', address: COMPANY_ADDRESS, rights: 'All rights reserved to STAR PYRAMIDS company, Egypt ©2026', poweredBy: 'Powered by', tabMake: 'Make Your Trip', tabFind: 'Find your trip', tabRent: 'Rent Car', privacy: 'Privacy and Cookies', terms: 'Terms and Conditions', qWhen: 'When will you be traveling?', qExact: 'Have An Exact Time', qApprox: 'Have An Approximate Time', qUnsure: 'Not Sure Yet', fFrom: 'From', fTo: 'To', fFromPh: 'Select the start date of the trip', fToPh: 'Select the end date of the trip', makeTripBtn: 'Make Trip', qWhat: 'What are you looking for?', k1: 'One Day', k2: 'Multi Days', k3: 'Nile Cruise', k4: 'Shore', wWhere: 'Where?', wWherePh: 'Choose your favorite place in Egypt', wLong: 'How Long?', wLongPh: 'How many days do you stay in Egypt', searchBtn: 'Search', qType: 'Type of Trip?', tOne: 'One Way', tRound: 'Round Trip', cHolder: 'Car Holder', cHolderPh: 'Choose Pick-Up Location', cDrop: 'Drop Off Location', cDropPh: 'Choose Drop-Off Location', cDate: 'Pick Up Date and time', cDatePh: 'Choose the time and date for Pick Up', sendReq: 'Send Request', helpTitle: 'Need help to finding your trip?', helpSub: 'Share a few details and our team will contact you.', helpName: 'Full Name', helpNat: 'Nationality', helpPhone: 'Phone', helpBtn: 'Contact Now', helpDoneT: 'We got your details!', helpDoneP1: 'Thank you', helpDoneP2: '. Our travel team will contact you shortly.', contactTitle: 'Contact Us', contactSub: 'Call Us, Write Us, Or Knock on Our Door', addrT: 'Our Address', emailT: 'Email Address', formT: 'Connect with Us Today', sendMsg: 'Send a Message', msgPh: 'How can we help?', faqTeaser: 'Frequently Asked Questions', seeMore: 'See more', needHelp: 'Need Our Help?', footExplore: 'Explore', footCompany: 'Company', certBadge: 'Travelife Certified', guideLink: 'Egypt Travel Guide', faqsLink: 'FAQs', accessLink: 'Accessible Travel', accessNote: '5% discount on all our tour packages for guests requiring accessibility assistance.', readMoreBtn: 'Read More', callUs: 'Call us' },
  ar: { promo2: 'وفّر لفترة محدودة على أفضل جولات مصر. احجز قبل انتهاء العرض!', viewPackages: 'شاهد الباقات', viewOffers: 'شاهد العروض', cat1: 'رحلات اليوم الواحد', cat2: 'رحلات متعددة الأيام', cat3: 'رحلات النيل', cat4: 'رحلات الشواطئ', liveChat: 'محادثة مباشرة', modalTitle: 'اللغة والعملة', curTitle: 'العملة', regTitle: 'المنطقة واللغة', footerTag: 'سعداء بمساعدتك في اكتشاف مصر.', footerLinks: 'روابط ستار بيراميدز', contactInfo: 'معلومات التواصل', address: COMPANY_ADDRESS, rights: 'جميع الحقوق محفوظة لشركة ستار بيراميدز، مصر ©2026', poweredBy: 'مدعوم من', tabMake: 'خطط رحلتك', tabFind: 'اعثر على رحلتك', tabRent: 'استأجر سيارة', privacy: 'الخصوصية وملفات الارتباط', terms: 'الشروط والأحكام', qWhen: 'متى ستسافر؟', qExact: 'لدي وقت محدد', qApprox: 'لدي وقت تقريبي', qUnsure: 'لست متأكداً بعد', fFrom: 'من', fTo: 'إلى', fFromPh: 'اختر تاريخ بداية الرحلة', fToPh: 'اختر تاريخ نهاية الرحلة', makeTripBtn: 'خطط الرحلة', qWhat: 'عن ماذا تبحث؟', k1: 'يوم واحد', k2: 'أيام متعددة', k3: 'رحلة نيلية', k4: 'شاطئية', wWhere: 'أين؟', wWherePh: 'اختر مكانك المفضل في مصر', wLong: 'كم المدة؟', wLongPh: 'كم يوماً ستبقى في مصر', searchBtn: 'بحث', qType: 'نوع الرحلة؟', tOne: 'ذهاب فقط', tRound: 'ذهاب وعودة', cHolder: 'مكان الاستلام', cHolderPh: 'اختر مكان الاستلام', cDrop: 'مكان التسليم', cDropPh: 'اختر مكان التسليم', cDate: 'تاريخ ووقت الاستلام', cDatePh: 'اختر وقت وتاريخ الاستلام', sendReq: 'إرسال الطلب', helpTitle: 'محتاج مساعدة في رحلتك؟', helpSub: 'سيب بياناتك وفريقنا هيتواصل معاك.', helpName: 'الاسم بالكامل', helpNat: 'الجنسية', helpPhone: 'الهاتف', helpBtn: 'تواصل الآن', helpDoneT: 'وصلتنا بياناتك!', helpDoneP1: 'شكراً', helpDoneP2: '. فريق السفر هيتواصل معاك قريباً.', contactTitle: 'اتصل بنا', contactSub: 'كلمنا، راسلنا، أو زورنا', addrT: 'عنوانا', emailT: 'البريد الإلكتروني', formT: 'تواصل معنا اليوم', sendMsg: 'إرسال رسالة', msgPh: 'إزاي نقدر نساعدك؟', faqTeaser: 'الأسئلة الشائعة', seeMore: 'شاهد المزيد', needHelp: 'محتاج مساعدة؟', footExplore: 'استكشف', footCompany: 'الشركة', certBadge: 'معتمد ترافل لايف', guideLink: 'دليل السفر', faqsLink: 'الأسئلة الشائعة', accessLink: 'سفر ميسّر', accessNote: 'خصم 5% على كل باقات الرحلات لضيوفنا من ذوي الاحتياجات الخاصة.', readMoreBtn: 'اقرأ المزيد', callUs: 'اتصل بنا' },
} as const



export function Logo(){const brand=useBrandSettings(); return <Link href="/" className="brand-logo" aria-label="STAR PYRAMIDS Tours Egypt"><img className="brand-img" src={brand.logo || '/logo.png'} alt="STAR PYRAMIDS Tours Egypt"/></Link>}

function NotificationDropdown({ locale, onClose }: { locale: Locale; onClose: () => void }) {
  const isAr = locale === 'ar';
  const [items, setItems] = useState([
    {
      id: '1',
      type: 'offer',
      title: isAr ? 'عرض حصري: خصم 20% على كروز النيل الأقصر وأسوان' : 'Special Offer: 20% OFF Luxury Nile Cruises Luxor & Aswan',
      desc: isAr ? 'احجز رحلتك البحرية الآن واستمتع بإقامة 5 نجوم شاملة كلياً' : 'Book your 5-star cruise now and enjoy all-inclusive stay & private guide',
      time: isAr ? 'منذ 15 دقيقة' : '15m ago',
      unread: true,
      href: '/special-offers'
    },
    {
      id: '2',
      type: 'tour',
      title: isAr ? 'رحلة جديدة: مغامرة سفاري الصحراء البيضاء والواحات 3 أيام' : 'New Tour: White Desert & Bahariya Oasis 3-Day Safari',
      desc: isAr ? 'اكتشف رمال مصر الساحرة والتخييم تحت النجوم مع مرشد خبير' : 'Discover magical landscapes and luxury stargazing camping in Egypt',
      time: isAr ? 'منذ ساعتين' : '2h ago',
      unread: true,
      href: '/egypt-tours/multi-days-tours'
    },
    {
      id: '3',
      type: 'promo',
      title: isAr ? 'كود خصم حصري: STAR2026' : 'Exclusive Promo Code: STAR2026',
      desc: isAr ? 'وفّر 5% إضافية عند حجز أي باقة سياحية هذا الأسبوع' : 'Save extra 5% on all tour packages when booking this week',
      time: isAr ? 'منذ يوم' : '1d ago',
      unread: false,
      href: '/special-offers'
    },
    {
      id: '4',
      type: 'car',
      title: isAr ? 'تحديث أسطول سيارات الليموزين وتوصيل المطار' : 'Updated Car Rental & VIP Airport Transfers',
      desc: isAr ? 'أحدث موديلات السيارات مع سائق خاص بأفضل الأسعار' : 'New premium fleet available with private chauffeur at best rates',
      time: isAr ? 'منذ يومين' : '2d ago',
      unread: false,
      href: '/rent-car'
    }
  ]);

  const unreadCount = items.filter(i => i.unread).length;
  const markAllRead = () => {
    setItems(items.map(i => ({ ...i, unread: false })));
  };

  return (
    <div className="notif-dropdown" role="dialog" aria-label="Notifications" onClick={e => e.stopPropagation()}>
      <div className="notif-head">
        <div className="notif-head-title">
          <h4>{isAr ? 'الإشعارات والعروض' : 'Notifications & Offers'}</h4>
          {unreadCount > 0 && <span className="notif-count-badge">{unreadCount} {isAr ? 'جديد' : 'new'}</span>}
        </div>
        {unreadCount > 0 && (
          <button type="button" className="notif-mark-read" onClick={markAllRead}>
            {isAr ? 'تعيين الكل كمقروء' : 'Mark all read'}
          </button>
        )}
      </div>
      <div className="notif-list">
        {items.map(item => (
          <Link
            key={item.id}
            href={item.href}
            onClick={() => {
              setItems(items.map(i => i.id === item.id ? { ...i, unread: false } : i));
              onClose();
            }}
            className={`notif-item ${item.unread ? 'unread' : ''}`}
          >
            <div className={`notif-icon-bubble ${item.type}`}>
              {item.type === 'offer' ? <BadgePercent size={18} /> : item.type === 'tour' ? <Sparkles size={18} /> : item.type === 'promo' ? <Gift size={18} /> : <CarFront size={18} />}
            </div>
            <div className="notif-content">
              <strong>{item.title}</strong>
              <p>{item.desc}</p>
              <span className="notif-time">{item.time}</span>
            </div>
            {item.unread && <span className="notif-unread-dot" />}
          </Link>
        ))}
      </div>
      <div className="notif-footer">
        <Link href="/special-offers" onClick={onClose}>
          {isAr ? 'عرض جميع العروض الخاصة ←' : 'View all special offers →'}
        </Link>
      </div>
    </div>
  );
}

export function Header() {
  const [menu, setMenu] = useState(false)
  const [toursOpen, setToursOpen] = useState(false)
  const [stickyToursOpen, setStickyToursOpen] = useState(false)
  const [companyOpen, setCompanyOpen] = useState(false)
  const [languageOpen, setLanguageOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [promoIdx, setPromoIdx] = useState(0)
  const [scrolled, setScrolled] = useState(false)
  const promoHold = useRef(false)
  const primaryHeaderRef = useRef<HTMLElement>(null)
  const router = useRouter()
  const pathname = usePathname()
  const { locale, setLocale, currency, setCurrency } = useLocale()
  const { lines: cartLines } = useCart()
  const t = copy[locale]
  const ex = extra[locale]
  const cartLabel = locale === 'ar'
    ? `سلة الرحلات، ${cartLines} ${cartLines === 1 ? 'رحلة' : 'رحلات'}`
    : `Trip cart, ${cartLines} ${cartLines === 1 ? 'trip' : 'trips'}`

  useEffect(() => {
    setMenu(false)
    setToursOpen(false)
    setStickyToursOpen(false)
    setCompanyOpen(false)
    setNotifOpen(false)
  }, [pathname])

  useEffect(() => {
    const onDocumentClick = (event: globalThis.MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('.nav-dropdown')) {
        setToursOpen(false)
        setStickyToursOpen(false)
        setCompanyOpen(false)
      }
      if (!target.closest('.notif-wrapper')) setNotifOpen(false)
    }
    document.addEventListener('click', onDocumentClick)
    return () => document.removeEventListener('click', onDocumentClick)
  }, [])

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (!promoHold.current) setPromoIdx((index) => (index + 1) % 2)
    }, 5000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    let frame = 0
    const syncScrollState = () => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => setScrolled(window.scrollY > 130))
    }
    syncScrollState()
    window.addEventListener('scroll', syncScrollState, { passive: true })
    window.addEventListener('pageshow', syncScrollState)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('scroll', syncScrollState)
      window.removeEventListener('pageshow', syncScrollState)
    }
  }, [])

  const tourLinks = [
    [locale === 'ar' ? 'كل الرحلات' : 'All Trips', '/trips'],
    [ex.cat1, '/egypt-tours/one-day-tours'],
    [ex.cat2, '/egypt-tours/multi-days-tours'],
    [ex.cat3, '/egypt-tours/nile-cruises'],
    [ex.cat4, '/egypt-tours/shore-excursions'],
  ] as const
  const mobileLinks = [[t.home, '/'], [t.tours, '/trips'], [t.rent, '/rent-car'], [t.events, '/events'], [t.about, '/about'], [t.contact, '/contact'], [t.blogs, '/blogs']] as const
  const promos = [
    { text: t.promo, href: '/special-offers', label: ex.viewPackages, icons: <><Ticket size={26}/><BadgePercent size={26}/></> },
    { text: ex.promo2, href: '/special-offers', label: ex.viewOffers, icons: <><Star size={26}/><BadgePercent size={26}/></> },
  ]

  return <>
    <header ref={primaryHeaderRef} suppressHydrationWarning className="site-header">
      <div className="header-top container">
        <button type="button" className="mobile-menu" onClick={() => setMenu((value) => !value)} aria-label={locale === 'ar' ? 'فتح القائمة' : 'Open menu'} aria-expanded={menu}>{menu ? <X/> : <Menu/>}</button>
        <Logo/>
        <form className="site-search" role="search" onSubmit={(event) => { event.preventDefault(); router.push('/search?q=' + encodeURIComponent(query)) }}>
          <Search size={19}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.search} aria-label={t.search}/>
        </form>
        <div className="header-actions">
          <LanguageToggle label={(locale === 'ar' ? 'AR' : 'EN') + ' - ' + currency} onOpen={() => setLanguageOpen(true)}/>
          <div className="notif-wrapper">
            <button type="button" className={`icon-btn notif-btn ${notifOpen ? 'active' : ''}`} onClick={() => setNotifOpen((value) => !value)} aria-label={locale === 'ar' ? 'الإشعارات' : 'Notifications'} aria-expanded={notifOpen}><Bell size={18}/><span className="notif-badge-pulse"/></button>
            {notifOpen && <NotificationDropdown locale={locale} onClose={() => setNotifOpen(false)}/>}
          </div>
          <Link className={`icon-btn header-cart${cartLines > 0 ? ' has-items' : ''}`} href="/cart" aria-label={cartLabel}>
            <ShoppingCart size={18}/>
            {cartLines > 0 && <span className="cart-count-badge" aria-hidden="true">{cartLines > 9 ? '9+' : cartLines}</span>}
          </Link>
          <div className="header-socials"><HeaderSocials /></div>
        </div>
      </div>

      <div className="header-nav">
        <div className="container header-nav-inner">
          <nav aria-label={locale === 'ar' ? 'القائمة الرئيسية' : 'Primary navigation'}>
            <Link href="/">{t.home}</Link>
            <div className="nav-dropdown"><button type="button" onClick={() => setToursOpen((value) => !value)} aria-expanded={toursOpen}>{t.tours} <ChevronDown size={14}/></button>{toursOpen && <div className="tour-menu">{tourLinks.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}</div>}</div>
            <Link href="/rent-car">{t.rent}</Link><Link href="/about">{t.about}</Link><Link href="/contact">{t.contact}</Link><Link href="/blogs">{t.blogs}</Link><Link href="/events">{t.events}</Link><Link className="special-link" href="/special-offers">{t.offer}</Link>
          </nav>
          <div className="nav-right-actions"><Link className="make-trip-link" href="/make-your-trip">{t.make}</Link><Link className="outline-btn" href="/login">{t.signIn}</Link></div>
        </div>
      </div>

      {languageOpen && <LanguageModal locale={locale} currency={currency} onClose={() => setLanguageOpen(false)} onSelect={setLocale} onCurrency={setCurrency}/>}
      {menu && <nav className="mobile-nav" aria-label={locale === 'ar' ? 'قائمة الموبايل' : 'Mobile navigation'}>{mobileLinks.map(([label, href]) => <Link key={href} href={href} onClick={() => setMenu(false)}>{label}</Link>)}</nav>}
    </header>

    <div className={`sticky-nav-bar${scrolled ? ' is-visible' : ''}`} aria-hidden={!scrolled}>
      <div className="container sticky-nav-inner">
        <Logo/>
        <nav aria-label={locale === 'ar' ? 'القائمة العائمة' : 'Sticky navigation'}>
          <Link href="/">{t.home}</Link>
          <div className="nav-dropdown"><button type="button" onClick={() => { setStickyToursOpen((value) => !value); setCompanyOpen(false) }} aria-expanded={stickyToursOpen}>{t.tours} <ChevronDown size={14}/></button>{stickyToursOpen && <div className="tour-menu">{tourLinks.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}</div>}</div>
          <Link href="/rent-car">{t.rent}</Link>
          <Link href="/events">{t.events}</Link>
          <div className="nav-dropdown sticky-company"><button type="button" onClick={() => { setCompanyOpen((value) => !value); setStickyToursOpen(false) }} aria-expanded={companyOpen}>{locale === 'ar' ? 'عن الشركة' : 'About Company'} <ChevronDown size={14}/></button>{companyOpen && <div className="tour-menu"><Link href="/about">{t.about}</Link><Link href="/contact">{t.contact}</Link><Link href="/blogs">{t.blogs}</Link></div>}</div>
          <Link className="special-link" href="/special-offers">{t.offer}</Link>
        </nav>
        <div className="sticky-nav-actions">
          <Link className={`icon-btn header-cart sticky-cart${cartLines > 0 ? ' has-items' : ''}`} href="/cart" aria-label={cartLabel}>
            <ShoppingCart size={17}/>
            {cartLines > 0 && <span className="cart-count-badge" aria-hidden="true">{cartLines > 9 ? '9+' : cartLines}</span>}
          </Link>
          <Link className="make-trip-link" href="/make-your-trip">{t.make}</Link><Link className="outline-btn" href="/login">{t.signIn}</Link>
        </div>
      </div>
    </div>

    <div className="promo" aria-live="polite" onMouseEnter={() => { promoHold.current = true }} onMouseLeave={() => { promoHold.current = false }}>
      <span className="promo-icons" key={'pi' + promoIdx}>{promos[promoIdx].icons}</span><strong key={'pt' + promoIdx} className="promo-swap">{promos[promoIdx].text}</strong><Link key={'pl' + promoIdx} href={promos[promoIdx].href} className="promo-swap">{promos[promoIdx].label}</Link><span className="promo-dots">{promos.map((_, index) => <button key={index} type="button" className={index === promoIdx ? 'active' : ''} aria-label={'Show announcement ' + (index + 1)} aria-current={index === promoIdx} onClick={() => setPromoIdx(index)}/>)}</span>
    </div>
  </>
}

function LegacyHeader(){const [menu,setMenu]=useState(false); const [open,setOpen]=useState(false); const [stickyOpen,setStickyOpen]=useState(false); const [languageOpen,setLanguageOpen]=useState(false); const [notifOpen,setNotifOpen]=useState(false); const {locale,setLocale,currency,setCurrency}=useLocale(); const [query,setQuery]=useState(''); const router=useRouter(); const pathname=usePathname(); const [promoIdx,setPromoIdx]=useState(0); const promoHold=useRef(false); const [scrolled,setScrolled]=useState(false); useEffect(()=>{setOpen(false); setStickyOpen(false); setMenu(false); setNotifOpen(false);},[pathname]); useEffect(()=>{const onDocClick=(e:MouseEvent)=>{const target=e.target as HTMLElement; if(!target.closest('.nav-dropdown')){setOpen(false); setStickyOpen(false);} if(!target.closest('.notif-wrapper')){setNotifOpen(false);}}; document.addEventListener('click',onDocClick); return ()=>document.removeEventListener('click',onDocClick);},[]); useEffect(()=>{const id=setInterval(()=>{if(!promoHold.current) setPromoIdx((i)=>(i+1)%2);},5000); return ()=>clearInterval(id);},[]); useEffect(()=>{const onScroll=()=>setScrolled(window.scrollY>130); onScroll(); window.addEventListener('scroll',onScroll,{passive:true}); return ()=>window.removeEventListener('scroll',onScroll);},[]); const t=copy[locale]; const ex=extra[locale]; const promos=[{text:t.promo,href:'/special-offers',label:ex.viewPackages,icons:<><Ticket size={26}/><BadgePercent size={26}/></>},{text:ex.promo2,href:'/special-offers',label:ex.viewOffers,icons:<><Star size={26}/><BadgePercent size={26}/></>}]; return <><header suppressHydrationWarning className="site-header"><div className="header-top container"><button className="mobile-menu" onClick={()=>setMenu(!menu)} aria-label="Open menu">{menu?<X/>:<Menu/>}</button><Logo/><form className="site-search" role="search" onSubmit={(e)=>{e.preventDefault();router.push('/search?q='+encodeURIComponent(query))}}><Search size={19}/><input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder={t.search} aria-label="Search places and things to do"/></form><div className="header-actions"><LanguageToggle label={(locale==='ar'?'AR':'EN')+' - '+currency} onOpen={()=>setLanguageOpen(true)}/><div className="notif-wrapper"><button type="button" className={`icon-btn notif-btn ${notifOpen?'active':''}`} onClick={()=>setNotifOpen(!notifOpen)} aria-label="Notifications" aria-expanded={notifOpen}><Bell size={18}/><span className="notif-badge-pulse"/></button>{notifOpen&&<NotificationDropdown locale={locale} onClose={()=>setNotifOpen(false)}/>}</div><Link className="icon-btn" href="/account/bookings" aria-label="My bookings"><ShoppingCart size={18}/></Link><div className="header-socials"><HeaderSocials /></div></div></div><div className="header-nav"><div className="container header-nav-inner"><nav><Link href="/">{t.home}</Link><div className="nav-dropdown"><button onClick={()=>setOpen(!open)}>{t.tours} <ChevronDown size={14}/></button>{open&&<div className="tour-menu"><Link href="/trips">{locale==='ar'?'كل الرحلات':'All Trips'}</Link><Link href="/egypt-tours/one-day-tours">{ex.cat1}</Link><Link href="/egypt-tours/multi-days-tours">{ex.cat2}</Link><Link href="/egypt-tours/nile-cruises">{ex.cat3}</Link><Link href="/egypt-tours/shore-excursions">{ex.cat4}</Link></div>}</div><Link href="/rent-car">{t.rent}</Link><Link href="/about">{t.about}</Link><Link href="/contact">{t.contact}</Link><Link href="/blogs">{t.blogs}</Link><Link href="/events">{t.events}</Link><Link className="special-link" href="/special-offers">{t.offer}</Link></nav><div className="nav-right-actions"><Link className="make-trip-link" href="/make-your-trip">{t.make}</Link><Link className="outline-btn" href="/login">{t.signIn}</Link></div></div></div>{languageOpen&&<LanguageModal locale={locale} currency={currency} onClose={()=>setLanguageOpen(false)} onSelect={setLocale} onCurrency={setCurrency}/>} {menu&&<div className="mobile-nav">{[[t.home,'/'],[t.tours,'/trips'],[t.rent,'/rent-car'],[t.about,'/about'],[t.contact,'/contact'],[t.blogs,'/blogs'],[t.events,'/events']].map(([label,href])=><Link key={label} href={href} onClick={()=>setMenu(false)}>{label}</Link>)}</div>}</header><div className={'sticky-nav-bar'+(scrolled?' is-visible':'')} aria-hidden={!scrolled}><div className="container sticky-nav-inner"><Logo/><nav><Link href="/">{t.home}</Link><div className="nav-dropdown"><button onClick={()=>setStickyOpen(!stickyOpen)}>{t.tours} <ChevronDown size={14}/></button>{stickyOpen&&<div className="tour-menu"><Link href="/trips">{locale==='ar'?'كل الرحلات':'All Trips'}</Link><Link href="/egypt-tours/one-day-tours">{ex.cat1}</Link><Link href="/egypt-tours/multi-days-tours">{ex.cat2}</Link><Link href="/egypt-tours/nile-cruises">{ex.cat3}</Link><Link href="/egypt-tours/shore-excursions">{ex.cat4}</Link></div>}</div><Link href="/rent-car">{t.rent}</Link><Link href="/about">{t.about}</Link><Link href="/contact">{t.contact}</Link><Link href="/blogs">{t.blogs}</Link><Link href="/events">{t.events}</Link><Link className="special-link" href="/special-offers">{t.offer}</Link></nav><div className="sticky-nav-actions"><Link className="make-trip-link" href="/make-your-trip">{t.make}</Link><Link className="outline-btn" href="/login">{t.signIn}</Link></div></div></div><div className="promo" aria-live="polite" onMouseEnter={()=>{promoHold.current=true;}} onMouseLeave={()=>{promoHold.current=false;}}><span className="promo-icons" key={'pi'+promoIdx}>{promos[promoIdx].icons}</span><strong key={'pt'+promoIdx} className="promo-swap">{promos[promoIdx].text}</strong><Link key={'pl'+promoIdx} href={promos[promoIdx].href} className="promo-swap">{promos[promoIdx].label}</Link><span className="promo-dots">{promos.map((_,i)=><button key={i} type="button" className={i===promoIdx?'active':''} aria-label={'Show announcement '+(i+1)} aria-current={i===promoIdx} onClick={()=>setPromoIdx(i)}/>)}</span></div></>}

export function Footer(){const {locale}=useLocale(); const ex=extra[locale]; const brand=useBrandSettings(); const footerTag=locale === 'ar' ? (brand.aboutAr || ex.footerTag) : (brand.aboutEn || ex.footerTag); const t=copy[locale]; return <footer><div className="container footer-grid"><div className="foot-brand"><Logo/><p>{footerTag}</p><span className="cert-badge"><Gift size={14}/><span>{ex.certBadge}</span></span><div className="socials foot-socials"><FooterSocials /></div><div className="socials" style={{display:'none'}}><a href="https://www.facebook.com/" target="_blank" rel="noreferrer" aria-label="Facebook" style={{display:'inline-block',marginRight:14}}>f</a><a href="https://www.instagram.com/" target="_blank" rel="noreferrer" aria-label="Instagram" style={{display:'inline-block',marginRight:14}}>◎</a><a href="https://www.youtube.com/" target="_blank" rel="noreferrer" aria-label="YouTube" style={{display:'inline-block',marginRight:14}}>◉</a><a href="https://www.tiktok.com/" target="_blank" rel="noreferrer" aria-label="TikTok" style={{display:'inline-block'}}>♪</a></div></div><div><h3>{ex.footExplore}</h3><Link href="/">{t.home}</Link><Link href="/trips">{locale==='ar'?'كل الرحلات':'All Trips'}</Link><Link href="/egypt-tours/one-day-tours">{ex.cat1}</Link><Link href="/egypt-tours/multi-days-tours">{ex.cat2}</Link><Link href="/egypt-tours/nile-cruises">{ex.cat3}</Link><Link href="/egypt-tours/shore-excursions">{ex.cat4}</Link><Link href="/special-offers">{t.offer}</Link></div><div><h3>{ex.footCompany}</h3><Link href="/rent-car">{t.rent}</Link><Link href="/about">{t.about}</Link><Link href="/contact">{t.contact}</Link><Link href="/egypt-travel-guide">{ex.guideLink}</Link><Link href="/faq">{ex.faqsLink}</Link><Link href="/events">{t.events}</Link><Link href="/accessible-travel">{ex.accessLink}</Link></div><div><h3>{ex.contactInfo}</h3><div className="foot-contact"><a href={phoneHref(brand.phone)} aria-label={locale==='ar'?'اتصل بستار بيراميدز':'Call STAR PYRAMIDS'}><Phone size={15}/><span>{brand.phone}</span></a><a href={whatsappHref(brand.whatsapp)} target="_blank" rel="noreferrer" aria-label={locale==='ar'?'راسل ستار بيراميدز على واتساب':'Chat with STAR PYRAMIDS on WhatsApp'}><svg className="wa-ic" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg><span>{brand.whatsapp}</span></a><a href={`mailto:${brand.email}`}><Mail size={15}/><span>{brand.email}</span></a><span className="foot-addr"><MapPin size={15}/><span>{brand.address}</span></span></div></div></div><div className="container copyright">{ex.rights} <span className="powered-by">| {ex.poweredBy} <a href="https://panel.dipencil.com" target="_blank" rel="noreferrer" aria-label="Dipencil"><img src="https://panel.dipencil.com/pencil-logo.png" alt="Dipencil" loading="lazy"/></a></span> <span><Link href="/privacy">{ex.privacy}</Link>　<Link href="/terms">{ex.terms}</Link></span></div></footer>}

function DynamicFooter() {
  const { locale } = useLocale()
  const ex = extra[locale]
  const t = copy[locale]
  const brand = useBrandSettings()
  const footerTag = locale === 'ar' ? (brand.aboutAr || ex.footerTag) : (brand.aboutEn || ex.footerTag)
  const copyright = locale === 'ar' ? (brand.copyrightAr || ex.rights) : (brand.copyrightEn || ex.rights)

  return <footer>
    <div className="container footer-grid">
      <div className="foot-brand">
        <Logo />
        <p>{footerTag}</p>
        <span className="cert-badge"><Gift size={14} /><span>{ex.certBadge}</span></span>
        <div className="socials foot-socials"><FooterSocials /></div>
      </div>
      <div>
        <h3>{ex.footExplore}</h3>
        <Link href="/">{t.home}</Link>
        <Link href="/trips">{locale === 'ar' ? 'كل الرحلات' : 'All Trips'}</Link>
        <Link href="/egypt-tours/one-day-tours">{ex.cat1}</Link>
        <Link href="/egypt-tours/multi-days-tours">{ex.cat2}</Link>
        <Link href="/egypt-tours/nile-cruises">{ex.cat3}</Link>
        <Link href="/egypt-tours/shore-excursions">{ex.cat4}</Link>
        <Link href="/special-offers">{t.offer}</Link>
      </div>
      <div>
        <h3>{ex.footCompany}</h3>
        <Link href="/rent-car">{t.rent}</Link>
        <Link href="/about">{t.about}</Link>
        <Link href="/contact">{t.contact}</Link>
        <Link href="/egypt-travel-guide">{ex.guideLink}</Link>
        <Link href="/faq">{ex.faqsLink}</Link>
        <Link href="/events">{t.events}</Link>
        <Link href="/accessible-travel">{ex.accessLink}</Link>
      </div>
      <div>
        <h3>{ex.contactInfo}</h3>
        <div className="foot-contact">
          <a href={phoneHref(brand.phone)} aria-label={locale === 'ar' ? 'اتصل بستار بيراميدز' : 'Call STAR PYRAMIDS'}><Phone size={15} /><span>{brand.phone}</span></a>
          <a href={whatsappHref(brand.whatsapp)} target="_blank" rel="noreferrer" aria-label={locale === 'ar' ? 'راسل ستار بيراميدز على واتساب' : 'Chat with STAR PYRAMIDS on WhatsApp'}><WhatsAppGlyph size={16} /><span>{brand.whatsapp}</span></a>
          <a href={`mailto:${brand.email}`}><Mail size={15} /><span>{brand.email}</span></a>
          <span className="foot-addr"><MapPin size={15} /><span>{brand.address}</span></span>
        </div>
      </div>
    </div>
    <div className="container copyright">
      {copyright} <span className="powered-by">| {ex.poweredBy} <a href="https://panel.dipencil.com" target="_blank" rel="noreferrer" aria-label="Dipencil"><img src="https://panel.dipencil.com/pencil-logo.png" alt="Dipencil" /></a></span>
      <span><Link href="/privacy">{ex.privacy}</Link>　<Link href="/terms">{ex.terms}</Link></span>
    </div>
  </footer>
}

export function SupportWidgets(){const [active,setActive]=useState<'live'|'wa'|null>(null); return <div className="support-widgets"><LiveChatWidget open={active==='live'} onOpen={()=>setActive('live')} onClose={()=>setActive((a)=>a==='live'?null:a)}/><WhatsAppWidget open={active==='wa'} onOpen={()=>setActive('wa')} onClose={()=>setActive((a)=>a==='wa'?null:a)}/></div>}

function AccessStrip(){const {locale}=useLocale(); const ex=extra[locale]; const [show,setShow]=useState(true); if(!show) return null; return <div className="access-strip"><Accessibility size={20}/><p>{ex.accessNote}</p><Link href="/accessible-travel">{ex.readMoreBtn}</Link><button type="button" onClick={()=>setShow(false)} aria-label="Dismiss">×</button></div>}

function ScrollTop(){const [show,setShow]=useState(false); useEffect(()=>{const onScroll=()=>setShow(window.scrollY>500); onScroll(); window.addEventListener('scroll',onScroll,{passive:true}); return ()=>window.removeEventListener('scroll',onScroll);},[]); const goTop=()=>{const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches; window.scrollTo({top:0,behavior:reduced?'auto':'smooth'});}; return <button type="button" className={'scroll-top'+(show?' show':'')} onClick={goTop} aria-label="Scroll to top"><ArrowUp size={20}/></button>}

export function SiteShell({children}:{children:React.ReactNode}){return <LocaleProvider><Header/>{children}<AccessStrip/><SupportWidgets/><ScrollTop/><DynamicFooter/></LocaleProvider>}

export function FilterField({label,placeholder,date=false,value,onChange,options}:{label:string;placeholder:string;date?:boolean;value?:string;onChange?:(v:string)=>void;options?:readonly (string|{value:string;label:string})[]}){const fieldStyle={border:0,outline:0,background:'transparent',width:'100%',font:'inherit',color:'inherit',minHeight:'auto'} as const; return <label className="filter-field"><span>{label}</span><div>{options?<><select aria-label={label} value={value??''} onChange={(e)=>onChange?.(e.target.value)} style={fieldStyle}><option value="">{placeholder}</option>{options.map((o)=>{const optionValue=typeof o==='string'?o:o.value; const optionLabel=typeof o==='string'?o:o.label; return <option key={optionValue||optionLabel} value={optionValue}>{optionLabel}</option>})}</select><ChevronDown size={17}/></>:date?<><input aria-label={label} type="date" value={value??''} onChange={(e)=>onChange?.(e.target.value)} style={fieldStyle}/><CalendarDays size={17}/></>:value!==undefined?<input aria-label={label} value={value} onChange={(e)=>onChange?.(e.target.value)} placeholder={placeholder} style={fieldStyle}/>:<>{placeholder}<ChevronDown size={17}/></>}</div></label>}

export function HeroField({title,placeholder,value,onChange,options,date=false}:{title:string;placeholder:string;value:string;onChange:(v:string)=>void;options?:string[];date?:boolean}){const control={width:'100%',border:0,outline:0,background:'transparent',fontSize:15,fontFamily:'inherit',color:value?'#1d1f1f':'#a7a7a7',padding:0,minHeight:28} as const; return <label className="hero-field"><span className="hero-field-title">{title}</span>{options?<span className="hero-field-control"><select aria-label={title} value={value} onChange={(e)=>onChange(e.target.value)} style={control}><option value="">{placeholder}</option>{options.map(o=><option key={o} value={o}>{o}</option>)}</select><ChevronDown size={20}/></span>:<span className="hero-field-control"><input aria-label={title} value={value} onChange={(e)=>onChange(e.target.value)} placeholder={placeholder} onFocus={(e)=>{if(date)e.target.type='date'}} onBlur={(e)=>{if(date&&!e.target.value)e.target.type='text'}} style={control}/>{date?<CalendarDays size={20}/>:<ChevronDown size={20}/>}</span>}</label>}

export function TripSearchEngine(){const [tab,setTab]=useState('Make Your Trip'); const [trip,setTrip]=useState('exact'); const [from,setFrom]=useState(''); const [to,setTo]=useState(''); const [where,setWhere]=useState(''); const [howLong,setHowLong]=useState(''); const [tripKind,setTripKind]=useState(''); const [tripType,setTripType]=useState('One Way'); const [pickup,setPickup]=useState(''); const [dropoff,setDropoff]=useState(''); const [pickupDate,setPickupDate]=useState(''); const router=useRouter(); const tabNames=['Make Your Trip','Find your trip','Rent Car']; const {locale:tl}=useLocale(); const ex=extra[tl]; const tabIndex=Math.max(0,tabNames.indexOf(tab)); const rtl=typeof document!=='undefined'&&document.documentElement.dir==='rtl'; return <div className="search-wrap"><div className="search-tabs" role="tablist" aria-label="Trip search"><span className="seg-indicator" aria-hidden="true" style={{transform:`translateX(${(rtl?-1:1)*tabIndex*100}%)`}}/>{tabNames.map(t=><button key={t} type="button" role="tab" aria-selected={tab===t} className={tab===t?'active':''} onClick={()=>setTab(t)}>{[ex.tabMake,ex.tabFind,ex.tabRent][tabNames.indexOf(t)]}</button>)}</div><div className="search-panel"><div className="search-panel-body" key={tab} role="tabpanel">{tab==='Make Your Trip'&&<><div className="trip-question"><strong>{ex.qWhen}</strong>{[['exact',ex.qExact],['approx',ex.qApprox],['unsure',ex.qUnsure]].map(([v,l])=><button key={v} type="button" className={trip===v?'selected-radio':''} aria-pressed={trip===v} onClick={()=>setTrip(v)}><i className={trip===v?'checked':''}/>{l}</button>)}</div><div className="field-grid cols-2"><HeroField title={ex.fFrom} placeholder={ex.fFromPh} date value={from} onChange={setFrom}/><HeroField title={ex.fTo} placeholder={ex.fToPh} date value={to} onChange={setTo}/><Link className="primary-btn" href={`/make-your-trip${from||to?`?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`:''}`}>{ex.makeTripBtn} <ArrowRight size={18}/></Link></div></>}{tab==='Find your trip'&&<><div className="trip-question"><strong>{ex.qWhat}</strong>{[['one-day-tours',ex.k1],['multi-days-tours',ex.k2],['nile-cruises',ex.k3],['shore-excursions',ex.k4]].map(([v,l])=><button key={v} type="button" className={tripKind===v?'selected-radio':''} aria-pressed={tripKind===v} onClick={()=>setTripKind(tripKind===v?'':v)}><i className={tripKind===v?'checked':''}/>{l}</button>)}</div><div className="field-grid cols-2"><HeroField title={ex.wWhere} placeholder={ex.wWherePh} value={where} onChange={setWhere} options={destinations.map(d=>d.title)}/><HeroField title={ex.wLong} placeholder={ex.wLongPh} value={howLong} onChange={setHowLong} options={['1 day','2-3 days','4-7 days','8+ days']}/><button type="button" className="primary-btn" onClick={()=>{if(tripKind)router.push('/egypt-tours/'+tripKind);else router.push('/search?q='+encodeURIComponent([where,howLong].filter(Boolean).join(' ')||'Egypt'))}}>{ex.searchBtn} <ArrowRight size={18}/></button></div></>}{tab==='Rent Car'&&<><div className="trip-question"><strong>{ex.qType}</strong>{[['One Way',ex.tOne],['Round Trip',ex.tRound]].map(([v,l])=><button key={v} type="button" className={tripType===v?'selected-radio':''} aria-pressed={tripType===v} onClick={()=>setTripType(v)}><i className={tripType===v?'checked':''}/>{l}</button>)}</div><div className="field-grid cols-3"><HeroField title={ex.cHolder} placeholder={ex.cHolderPh} value={pickup} onChange={setPickup}/><HeroField title={ex.cDrop} placeholder={ex.cDropPh} value={dropoff} onChange={setDropoff}/><HeroField title={ex.cDate} placeholder={ex.cDatePh} date value={pickupDate} onChange={setPickupDate}/><button type="button" className="primary-btn" onClick={()=>router.push(`/rent-car/request?pickup=${encodeURIComponent(pickup)}&dropoff=${encodeURIComponent(dropoff)}&type=${encodeURIComponent(tripType)}&date=${encodeURIComponent(pickupDate)}`)}>{ex.sendReq} <ArrowRight size={18}/></button></div></>}</div></div></div>}

export function CardGallery({ images: imgs, title, href, children }: { images: readonly string[]; title: string; href: string; children?: React.ReactNode }){const [idx,setIdx]=useState(0); const scrub=(e:CardMouseEvent<HTMLDivElement>)=>{const r=e.currentTarget.getBoundingClientRect(); setIdx(Math.min(imgs.length-1,Math.max(0,Math.floor((e.clientX-r.left)/r.width*imgs.length))));}; return <div className="card-gallery" onMouseMove={scrub} onMouseLeave={()=>setIdx(0)}><Link href={href} aria-label={title} className="tour-gallery-link">{imgs.map((src,i)=><img key={src+i} src={src} alt={i===0?title:''} aria-hidden={i!==0} className={i===idx?'on':''}/>)}</Link>{children}<div className="tour-dots" role="tablist" aria-label="Photos">{imgs.map((_,i)=><button key={i} type="button" role="tab" aria-selected={i===idx} aria-label={'Show photo '+(i+1)} className={i===idx?'active':''} onClick={()=>setIdx(i)}/>)}</div></div>}

export function TourCard({ tour, variant = 'multi' }: { tour: Tour; variant?: TourVariant }) {
  const [copied, setCopied] = useState(false)
  const favorites = useCustomerFavorites()
  const { currency, locale: plc } = useLocale()
  const href = `/egypt-tours/${tour.slug}`
  const title = plc === 'ar' && tour.titleAr ? tour.titleAr : tour.title
  const saved = favorites.has(tour.slug)
  const cruiseTypeInfo = variant === 'cruise' && tour.cruiseType ? getCruiseTypeBySlug(tour.cruiseType) : undefined
  let offset = 0
  for (const ch of tour.slug) offset = (offset + ch.charCodeAt(0)) % images.length
  const gallery = tour.gallery ?? [tour.image, ...images.slice(offset), ...images.slice(0, offset)].filter((src, index, all) => all.indexOf(src) === index).slice(0, 5)

  const share = async () => {
    const url = window.location.origin + href
    if (navigator.share) {
      try { await navigator.share({ title, url }) } catch { /* sharing was cancelled */ }
      return
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch { /* clipboard can be unavailable */ }
  }

  return <article className={`tour-card ${variant}`}>
    <div className="tour-image">
      <CardGallery images={gallery} title={title} href={href}>
        <button type="button" className="tour-fav" aria-label={saved ? (plc === 'ar' ? 'إزالة من المحفوظات' : 'Remove from saved') : (plc === 'ar' ? 'حفظ الرحلة' : 'Save tour')} aria-pressed={saved} onClick={() => favorites.toggle(tour.slug)}><Heart size={17} fill={saved ? '#f7951d' : 'none'} color={saved ? '#f7951d' : '#1f2937'} strokeWidth={2} /></button>
        <button type="button" className="tour-share" aria-label={copied ? (plc === 'ar' ? 'تم نسخ الرابط' : 'Link copied') : (plc === 'ar' ? 'مشاركة الرحلة' : 'Share tour')} onClick={share}>{copied ? <Check size={17} color="#1d4ed8" /> : <Share2 size={17} color="#1f2937" />}</button>
      </CardGallery>
    </div>
    <div className="tour-body">
      {cruiseTypeInfo ? <div className="meta cruise-meta"><span className="cities-pill">◉ {plc === 'ar' ? localizeTourLocation(tour.location) : tour.location}</span><em>{plc === 'ar' ? cruiseTypeInfo.titleAr : cruiseTypeInfo.titleEn}</em></div> : <div className="meta">◉ {plc === 'ar' ? localizeTourLocation(tour.location) : tour.location} <em>{tour.travelStyle ?? 'Classic'}</em></div>}
      <h3><Link href={href}>{title}</Link></h3>
      <div className="tour-bottom"><div><small>{plc === 'ar' ? 'يبدأ من' : 'Start From'}</small><strong>{formatPrice(tour.price, currency, plc)}</strong></div><span>{variant === 'day' ? <Clock3 size={12} /> : variant === 'cruise' ? <Ship size={12} /> : variant === 'shore' ? <Anchor size={12} /> : null}{plc === 'ar' ? localizeTourDuration(tour.duration) : tour.duration}</span></div>
    </div>
  </article>
}

type PageShowcaseHeroProps = {
  image: string
  eyebrow: string
  title: string
  intro: string
  primaryLabel: string
  primaryHref: string
  secondaryLabel: string
  secondaryHref: string
  railLabel: string
  railTitle: string
  railHref: string
  railMeta: readonly { Icon: typeof Clock3; label: string }[]
  statsLabel: string
  stats: readonly { value: string | number; label: string }[]
}

export function PageShowcaseHero({ image, eyebrow, title, intro, primaryLabel, primaryHref, secondaryLabel, secondaryHref, railLabel, railTitle, railHref, railMeta, statsLabel, stats }: PageShowcaseHeroProps) {
  return <section className="events-page-hero tour-category-page-hero">
    <img src={image} alt="" />
    <div className="events-page-hero-shade" />
    <div className="container events-page-hero-content">
      <div className="events-page-hero-copy">
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{intro}</p>
        <div className="events-page-hero-actions">
          <a href={primaryHref} className="primary-btn">{primaryLabel} <ArrowRight size={17}/></a>
          <Link href={secondaryHref} className="events-hero-link">{secondaryLabel} <ArrowRight size={16}/></Link>
        </div>
      </div>
      <div className="events-hero-rail">
        <Link href={railHref} className="events-next-event">
          <span>{railLabel}</span>
          <strong>{railTitle}</strong>
          <small>{railMeta.map(({ Icon, label }, index) => <span className="showcase-hero-meta" key={`${label}-${index}`}>{index > 0 && <i aria-hidden="true"/>}<Icon size={14}/>{label}</span>)}</small>
        </Link>
        <div className="events-hero-stats" aria-label={statsLabel}>
          {stats.map((stat) => <span key={stat.label}><b>{stat.value}</b>{stat.label}</span>)}
        </div>
      </div>
    </div>
  </section>
}

type TourCategoryHeroProps = Omit<PageShowcaseHeroProps, 'secondaryLabel' | 'secondaryHref' | 'railLabel' | 'railTitle' | 'railHref' | 'railMeta'> & {
  featuredLabel: string
  featuredTitle: string
  featuredHref: string
  featuredLocation: string
  featuredDuration: string
}

export function TourCategoryHero({ featuredLabel, featuredTitle, featuredHref, featuredLocation, featuredDuration, ...hero }: TourCategoryHeroProps) {
  return <PageShowcaseHero {...hero} secondaryLabel={featuredLabel} secondaryHref={featuredHref} railLabel={featuredLabel} railTitle={featuredTitle} railHref={featuredHref} railMeta={[{ Icon: Clock3, label: featuredDuration }, { Icon: MapPin, label: featuredLocation }]}/>
}

export function OneDayToursRegions(){return <SiteShell><OneDayToursRegionsContent/></SiteShell>}

function OneDayToursRegionsContent(){const {locale:dl}=useLocale(); const set=tourCategories['one-day-tours']; const meta=catMeta.day; const ar=dl==='ar'; const catTitle=ar?categoryCopy['one-day-tours'].titleAr:set.title; const catIntro=ar?categoryCopy['one-day-tours'].introAr:set.intro; const catEyebrow=ar?meta.eyebrowAr:meta.eyebrow; const regions=dayTourRegions.map((r)=>({...r,title:dl==='ar'?r.nameAr:r.name,items:getToursBySlugs(r.tourSlugs)})); const total=regions.reduce((n,r)=>n+r.items.length,0); const featured=regions.flatMap((region)=>region.items)[0]; return <><TourCategoryHero image={featured.image} eyebrow={catEyebrow} title={catTitle} intro={catIntro} primaryLabel={ar?'استكشف رحلات اليوم الواحد':'Explore day tours'} primaryHref="#one-day-regions" featuredLabel={ar?'رحلة يوم مميزة':'Featured day tour'} featuredTitle={ar&&featured.titleAr?featured.titleAr:featured.title} featuredHref={`/egypt-tours/${featured.slug}`} featuredLocation={ar?localizeTourLocation(featured.location):featured.location} featuredDuration={ar?localizeTourDuration(featured.duration):featured.duration} statsLabel={ar?'ملخص رحلات اليوم الواحد':'One-day tours summary'} stats={[{value:total,label:ar?'رحلات متاحة':'Tours available'},{value:regions.length,label:ar?'وجهات مصرية':'Egypt destinations'}]}/><Breadcrumb items={[dl==='ar'?'جولات مصر':'Egypt Tours',catTitle]}/><main id="one-day-regions" className="listing-page container"><nav className="category-pills region-nav" aria-label={dl==='ar'?'المحافظات':'Governorates'}>{regions.map(r=><a key={r.slug} href={'#'+r.slug}>{r.title}</a>)}</nav><p className="region-count">{dl==='ar'?<>تصفح <strong>{total}</strong> رحلة يوم واحد في <strong>{regions.length}</strong> محافظات</>:<>Browse <strong>{total}</strong> one-day tours across <strong>{regions.length}</strong> governorates</>}</p>{regions.map(r=><section key={r.slug} id={r.slug} className="region-block" aria-label={r.title}><div className="region-head"><div><span className="eyebrow">{catTitle}</span><h2>{r.title}</h2><p>{r.copy}</p></div><div className="region-badge-wrap"><span className="region-badge">{r.items.length} {dl==='ar'?'رحلات':'tours'}</span><Link href={`/egypt-tours/one-day-tours/${r.slug}`} className="region-see-more">{dl==='ar'?'شاهد الكل':'See more'} <ArrowRight size={14}/></Link></div></div><div className="compact-tour-grid region-tours">{r.items.map(t=><TourCard key={t.slug} tour={t} variant='day'/>)}</div></section>)}<HelpCTA/></main></>}

type RegionTourProps = {
  region: { name: string; nameAr: string; slug: string; copy: string; copyAr?: string; tourSlugs: readonly string[] }
  tours: Tour[]
  page: number
  category?: TourCategory
}

export function RegionTourPage(props: RegionTourProps) {
  return <SiteShell><RegionTourContent {...props}/></SiteShell>
}

function RegionTourContent({ region, tours, page, category = 'one-day-tours' }: RegionTourProps) {
  const { locale } = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const set = tourCategories[category]
  const variant = set.variant
  const meta = catMeta[variant]
  const HeroIcon = meta.HeroIcon
  const isCruise = category === 'nile-cruises'
  const regionTitle = locale === 'ar' ? region.nameAr : region.name
  const [durFilter, setDurFilter] = useState('')
  const filteredTours = durFilter ? tours.filter((tour) => tour.duration === durFilter) : tours
  const durationOptions = isCruise ? Array.from(new Set(tours.map((tour) => tour.duration))) : []
  const perPage = 9
  const totalPages = Math.max(1, Math.ceil(filteredTours.length / perPage))
  const queryPage = Number(searchParams.get('page'))
  const requestedPage = Number.isInteger(queryPage) && queryPage > 0 && queryPage <= 999 ? queryPage : page
  const safePage = Math.max(1, Math.min(requestedPage, totalPages))
  const start = (safePage - 1) * perPage
  const paged = filteredTours.slice(start, start + perPage)
  const makeHref = (number: number) => `/egypt-tours/${category}/${region.slug}${number > 1 ? `?page=${number}` : ''}`
  const setDuration = (value: string) => {
    setDurFilter(value)
    if (requestedPage > 1) router.replace(pathname, { scroll: false })
  }

  return <>
    <Breadcrumb items={[locale==='ar'?'جولات مصر':'Egypt Tours',locale==='ar'?categoryCopy[category].titleAr:set.title,regionTitle]}/>
    <main className="listing-page container">
      <div className={`cat-hero ${variant}`}>
        <span className="cat-hero-ic" aria-hidden="true"><HeroIcon size={34}/></span>
        <div>
          <span className="eyebrow">{locale === 'ar' ? (isCruise ? 'أبحر في النيل' : meta.eyebrowAr) : meta.eyebrow}</span>
          <h1>{regionTitle}</h1>
          <p>{locale === 'ar' && region.copyAr ? region.copyAr : region.copy}</p>
          <div className="cat-feats">{(isCruise ? [{ Icon: Ship, text: locale === 'ar' ? 'مسارات نيلية' : 'Nile itineraries' }, { Icon: Users, text: locale === 'ar' ? 'خيارات متعددة' : 'Cruise options' }] : locale === 'ar' ? meta.featsAr : meta.feats).map((feature) => <span key={feature.text}><feature.Icon size={14}/>{feature.text}</span>)}</div>
        </div>
      </div>
      <div className="results-bar"><span>{locale === 'ar' ? <>عرض <strong>{paged.length}</strong> من <strong>{filteredTours.length}</strong> رحلة</> : <>Showing <strong>{paged.length}</strong> of <strong>{filteredTours.length}</strong> tours</>}</span></div>
      {durationOptions.length > 1 && <nav className="category-pills" aria-label={locale === 'ar' ? 'تصفية حسب المدة' : 'Filter by duration'}>
        {['', ...durationOptions].map((duration) => <button key={duration || 'all'} type="button" className={durFilter === duration ? 'active' : ''} aria-pressed={durFilter === duration} onClick={() => setDuration(duration)}>{duration ? (locale === 'ar' ? localizeTourDuration(duration) : duration) : (locale === 'ar' ? 'الكل' : 'All')}</button>)}
      </nav>}
      {paged.length ? <div className="compact-tour-grid region-tours">{paged.map((tour) => <TourCard key={tour.slug} tour={tour} variant={variant}/>)}</div> : <p className="region-count">{locale === 'ar' ? 'لا توجد رحلات حالياً' : 'No tours available at the moment.'}</p>}
      {totalPages > 1 && <nav className="pagination" aria-label={locale === 'ar' ? 'صفحات الرحلات' : 'Pagination'}>
        <Link href={makeHref(safePage - 1)} className={safePage <= 1 ? 'disabled' : ''} aria-disabled={safePage <= 1} onClick={(event) => { if (safePage <= 1) event.preventDefault() }}><ArrowRight size={14} style={{ transform: 'rotate(180deg)' }}/> {locale === 'ar' ? 'السابق' : 'Previous'}</Link>
        {Array.from({ length: totalPages }, (_, index) => index + 1).map((number) => <Link key={number} href={makeHref(number)} className={number === safePage ? 'active' : ''} aria-current={number === safePage ? 'page' : undefined}>{number}</Link>)}
        <Link href={makeHref(safePage + 1)} className={safePage >= totalPages ? 'disabled' : ''} aria-disabled={safePage >= totalPages} onClick={(event) => { if (safePage >= totalPages) event.preventDefault() }}>{locale === 'ar' ? 'التالي' : 'Next'} <ArrowRight size={14}/></Link>
      </nav>}
    </main>
  </>
}

export const catMeta: Record<TourVariant, { eyebrow: string; eyebrowAr: string; HeroIcon: typeof Sun; feats: { Icon: typeof Sun; text: string }[]; featsAr: { Icon: typeof Sun; text: string }[] }> = {
  multi: { eyebrow: 'Take your time', eyebrowAr: 'خذ وقتك', HeroIcon: Package, feats: [{ Icon: MapPin, text: 'Multi-city routes' }, { Icon: Users, text: 'Private groups' }], featsAr: [{ Icon: MapPin, text: 'مسارات متعددة المدن' }, { Icon: Users, text: 'مجموعات خاصة' }] },
  day: { eyebrow: 'One day, zero rush', eyebrowAr: 'يوم واحد بدون استعجال', HeroIcon: Sun, feats: [{ Icon: Clock3, text: 'Hours, not days' }, { Icon: MapPin, text: 'Single city' }], featsAr: [{ Icon: Clock3, text: 'ساعات لا أيام' }, { Icon: MapPin, text: 'مدينة واحدة' }] },
  cruise: { eyebrow: 'Sail in style', eyebrowAr: 'أبحر بأناقة', HeroIcon: Ship, feats: [{ Icon: Star, text: '5-star decks' }, { Icon: Users, text: 'Full board' }], featsAr: [{ Icon: Star, text: 'أجنحة 5 نجوم' }, { Icon: Users, text: 'إقامة شاملة' }] },
  shore: { eyebrow: 'From port to wonders', eyebrowAr: 'من الميناء إلى العجائب', HeroIcon: Anchor, feats: [{ Icon: Anchor, text: 'Port pickup' }, { Icon: Clock3, text: 'Back on time' }], featsAr: [{ Icon: Anchor, text: 'استلام من الميناء' }, { Icon: Clock3, text: 'عودة في الموعد' }] },
}

export const categoryCopy: Record<TourCategory, { titleAr: string; introAr: string }> = {
  'one-day-tours': { titleAr: 'رحلات اليوم الواحد', introAr: 'اكتشف أعظم كنوز مصر في يوم واحد لا يُنسى.' },
  'multi-days-tours': { titleAr: 'رحلات متعددة الأيام', introAr: 'خذ وقتك واستمتع بمصر أبعد من المعالم.' },
  'nile-cruises': { titleAr: 'كروز النيل', introAr: 'أبحر بين المعابد القديمة براحة وخدمة ومناظر لا تُنسى.' },
  'shore-excursions': { titleAr: 'رحلات الشواطئ', introAr: 'استغل كل ميناء مع رحلات شاطئية مخططة بخبرة.' },
}

export function Breadcrumb({items}:{items:string[]}){const {locale}=useLocale(); const names:Record<string,string>={'Egypt Tours':'جولات مصر','Nile Cruises':'رحلات النيل','Trips':'كل الرحلات'}; return <div className="breadcrumb"><div className="container"><Link href="/">{locale==='ar'?'الرئيسية':'Home'}</Link>{items.map(i=><span key={i}>› {locale==='ar'?(names[i]??i):i}</span>)}</div></div>}

export function Heading({title,copy}:{title:string;copy?:string}){return <div className="section-heading"><h1>{title}</h1>{copy&&<p>{copy}</p>}</div>}

export type TourFilters={destination:string;duration:string;price:string}

export function CategoryFilter({destination,duration,price,destinationOptions,durationOptions,appliedCount,onDestination,onDuration,onPrice,onSearch,onReset}:{destination:string;duration:string;price:string;destinationOptions:readonly string[];durationOptions:readonly string[];appliedCount:number;onDestination:(v:string)=>void;onDuration:(v:string)=>void;onPrice:(v:string)=>void;onSearch:()=>void;onReset:()=>void}){const {currency,locale:fl}=useLocale(); const ar=fl==='ar'; const lo=formatPrice(200,currency,fl); const hi=formatPrice(400,currency,fl); const bandLabel=(id:string)=>id==='under-200'?(ar?`أقل من ${lo}`:`Under ${lo}`):id==='200-400'?`${lo} - ${hi}`:(ar?`أكثر من ${hi}`:`Over ${hi}`); return <div className="category-filter"><div className="filter-grid"><FilterField label={ar?'الوجهة':'Destination'} placeholder={ar?'كل الوجهات':'All destinations'} value={destination} onChange={onDestination} options={destinationOptions}/><FilterField label={ar?'المدة':'Duration'} placeholder={ar?'أي مدة':'Any duration'} value={duration} onChange={onDuration} options={durationOptions}/><FilterField label={ar?'السعر':'Price'} placeholder={ar?'أي سعر':'Any price'} value={price} onChange={onPrice} options={tourPriceBands.filter((band)=>band.id!=='').map((band)=>({value:band.id,label:bandLabel(band.id)}))}/><button type="button" className="primary-btn" onClick={onSearch}>{ar?'بحث':'Search'}</button></div><div className="filter-footer"><span>{appliedCount>0?(ar?`${appliedCount} فلاتر مفعلة`:`${appliedCount} filter${appliedCount===1?'':'s'} applied`):(ar?'عرض كل الرحلات':'Showing all tours')}</span><button type="button" onClick={onReset}>{ar?'مسح الفلاتر':'Reset Filters'}</button></div></div>}

export function TourListing({slug}:{slug:TourCategory}){return <SiteShell><Suspense><TourListingInner slug={slug}/></Suspense></SiteShell>}

function TourListingInner({slug}:{slug:TourCategory}){const set=tourCategories[slug]; const variant=set.variant; const meta=catMeta[variant]; const {locale:tl}=useLocale(); const ar=tl==='ar'; const catTitle=ar?categoryCopy[slug].titleAr:set.title; const catIntro=ar?categoryCopy[slug].introAr:set.intro; const catEyebrow=ar?meta.eyebrowAr:meta.eyebrow; const sortLabel=(o:string)=>o==='Price: low to high'?(ar?'السعر: من الأقل':o):o==='Price: high to low'?(ar?'السعر: من الأعلى':o):(ar?'الموصى بها':o); const allTours=getToursByCategory(slug); const featured=allTours[0]; const destinationOptions=Array.from(new Set(allTours.map((tour)=>tour.location))); const durationOptions=Array.from(new Set(allTours.map((tour)=>tour.duration))); const searchParams=useSearchParams(); const router=useRouter(); const pathname=usePathname(); const query=parseTourListingQuery(searchParams,destinationOptions,durationOptions); const [destination,setDestination]=useState(query.destination); const [duration,setDuration]=useState(query.duration); const [price,setPrice]=useState(query.price); const [sortOpen,setSortOpen]=useState(false); useEffect(()=>{setDestination(query.destination);setDuration(query.duration);setPrice(query.price)},[query.destination,query.duration,query.price]); const perPage=6; const go=(next:TourListingQuery)=>{const params=new URLSearchParams(); if(next.destination)params.set('destination',next.destination); if(next.duration)params.set('duration',next.duration); if(next.price)params.set('price',next.price); if(next.sort!=='Recommended')params.set('sort',next.sort); if(next.page>1)params.set('page',String(next.page)); const qs=params.toString(); router.replace(pathname+(qs?`?${qs}`:''),{scroll:false})}; const applyFilters=()=>go({destination,duration,price,sort:query.sort,page:1}); const resetFilters=()=>{setDestination('');setDuration('');setPrice('');go({destination:'',duration:'',price:'',sort:query.sort,page:1})}; const appliedCount=[query.destination,query.duration,query.price].filter(Boolean).length; const filtered=allTours.filter((t)=>(!query.destination||t.location===query.destination)&&(!query.duration||t.duration===query.duration)&&matchPriceBand(t.price,query.price)); const sorted=[...filtered].sort((a,b)=>query.sort==='Price: low to high'?(a.price-b.price||(a.slug<b.slug?-1:1)):query.sort==='Price: high to low'?(b.price-a.price||(a.slug<b.slug?-1:1)):0); const totalPages=Math.max(1,Math.ceil(sorted.length/perPage)); const safePage=Math.min(Math.max(1,query.page),totalPages); const paged=sorted.slice((safePage-1)*perPage,safePage*perPage); const isShore=slug==='shore-excursions'; return <><TourCategoryHero image={featured.image} eyebrow={catEyebrow} title={catTitle} intro={catIntro} primaryLabel={ar?(isShore?'استكشف رحلات الموانئ':'استكشف الباقات'):(isShore?'Explore shore excursions':'Explore journeys')} primaryHref="#tour-listing" featuredLabel={ar?(isShore?'رحلة ميناء مميزة':'باقة مميزة'):(isShore?'Featured shore excursion':'Featured journey')} featuredTitle={ar&&featured.titleAr?featured.titleAr:featured.title} featuredHref={`/egypt-tours/${featured.slug}`} featuredLocation={ar?localizeTourLocation(featured.location):featured.location} featuredDuration={ar?localizeTourDuration(featured.duration):featured.duration} statsLabel={ar?'ملخص الرحلات':'Tours summary'} stats={[{value:allTours.length,label:ar?(isShore?'رحلات موانئ':'باقات متاحة'):(isShore?'Shore excursions':'Journeys available')},{value:destinationOptions.length,label:ar?(isShore?'موانئ ووجهات':'وجهات مصرية'):(isShore?'Ports & destinations':'Egypt destinations')}]}/><Breadcrumb items={[ar?'جولات مصر':'Egypt Tours',catTitle]}/><main id="tour-listing" className="listing-page container"><CategoryFilter destination={destination} duration={duration} price={price} destinationOptions={destinationOptions} durationOptions={durationOptions} appliedCount={appliedCount} onDestination={setDestination} onDuration={setDuration} onPrice={setPrice} onSearch={applyFilters} onReset={resetFilters}/><div className="results-bar"><strong role="status">{ar?`${sorted.length} رحلات متاحة`:`${sorted.length} tour${sorted.length===1?'':'s'} found`}</strong><div style={{position:'relative'}}><button type="button" onClick={()=>setSortOpen(!sortOpen)} aria-expanded={sortOpen}>{ar?'ترتيب: ':'Sort by: '}{sortLabel(query.sort)} <ChevronDown size={16}/></button>{sortOpen&&<div className="tour-menu" style={{left:'auto',right:0,top:52,width:250}}>{tourListingSorts.map(o=><button key={o} type="button" onClick={()=>{setSortOpen(false);go({...query,sort:o,page:1})}} style={{textAlign:ar?'right':'left',fontWeight:query.sort===o?800:400}}>{sortLabel(o)}{query.sort===o?' ✓':''}</button>)}</div>}</div></div>{paged.length?<div className="listing-grid">{paged.map(t=><TourCard key={t.slug} tour={t} variant={variant}/>)}</div>:<div className="account-empty"><h3>{ar?'لا توجد رحلات تطابق الفلاتر.':'No tours match your filters.'}</h3><p>{ar?'جرّب وجهة مختلفة أو امسح الفلاتر لعرض كل الرحلات.':'Try a different destination or reset the filters to see everything.'}</p><button type="button" className="primary-btn" onClick={resetFilters}>{ar?'مسح الفلاتر':'Reset Filters'}</button></div>}<nav className="pagination" aria-label={ar?'صفحات الرحلات':'Tour listing pages'}><button type="button" onClick={()=>go({...query,page:Math.max(1,safePage-1)})} aria-label={ar?'الصفحة السابقة':'Previous page'} disabled={safePage<=1} style={safePage<=1?{opacity:.5}:undefined}>{ar?'› السابق':'‹ Back'}</button>{Array.from({length:totalPages},(_,i)=>safePage===i+1?<b key={i+1} aria-current="page">{i+1}</b>:<button key={i+1} type="button" aria-label={ar?`انتقل إلى صفحة ${i+1}`:`Go to page ${i+1}`} onClick={()=>go({...query,page:i+1})}>{i+1}</button>)}<button type="button" onClick={()=>go({...query,page:Math.min(totalPages,safePage+1)})} aria-label={ar?'الصفحة التالية':'Next page'} disabled={safePage>=totalPages} style={safePage>=totalPages?{opacity:.5}:undefined}>{ar?'التالي ‹':'Next ›'}</button></nav></main><HelpCTA/></>}

export function HelpCTA(){const {locale:hc}=useLocale(); const ex=extra[hc]; const [sent,setSent]=useState(false); const [name,setName]=useState(''); const [nationality,setNationality]=useState(''); const [phone,setPhone]=useState(''); if(sent) return <section className="help container"><h2>{ex.helpDoneT}</h2><p>{ex.helpDoneP1}{name?` ${name}`:''}{ex.helpDoneP2}</p></section>; return <section className="help container"><h2>{ex.helpTitle}</h2><p>{ex.helpSub}</p><div><form style={{display:'contents'}} onSubmit={(e)=>{e.preventDefault();setSent(true)}}><input placeholder={ex.helpName} required value={name} onChange={(e)=>setName(e.target.value)} aria-label={ex.helpName}/><input placeholder={ex.helpNat} value={nationality} onChange={(e)=>setNationality(e.target.value)} aria-label={ex.helpNat}/><input placeholder={ex.helpPhone} required value={phone} onChange={(e)=>setPhone(e.target.value)} aria-label={ex.helpPhone}/><button className="primary-btn" type="submit">{ex.helpBtn}</button></form></div></section>}

export function HomePage(){return <SiteShell><main><section className="hero"><img src="/egypt-hero.png" alt="Egyptian temple and desert"/><div className="hero-overlay"/><div className="hero-copy"><span>Get started your</span><h1>Exciting Journey With Us</h1></div><TripSearchEngine/></section><section className="stats container">{[['+100K','Happy customers'],['+50','Years of experience'],['+60','Total destinations'],['5.0','Rating in Tripadvisor']].map(([a,b])=><div key={b}><b>{a}</b><span>{b}</span></div>)}</section><section className="section container"><Heading title="Explore Egypt's Top Tours" copy="From the Pyramids to the Nile - find your perfect adventure."/><div className="tour-grid">{seasonalTours.map(t=><TourCard key={t.slug} tour={t}/>)}</div></section><section className="section pale"><div className="container"><Heading title="Popular Destination" copy="Every corner of Egypt has a story waiting for you."/><div className="destination-grid">{['Pyramids & Giza','White Desert','Nile Valley','Red Sea','Luxor Temples','Cairo Markets'].map((x,i)=><article className="destination" key={x}><img src={images[(i+1)%images.length]} alt={x}/><div><small>Explore now</small><h3>{x}</h3></div></article>)}</div></div></section><section className="section how"><div className="container"><Heading title="How it works?" copy="Only three steps away from Egypt."/><div className="steps">{['Finding Trip','Booking','Enjoy'].map((x,i)=><div key={x}><b>{i+1}</b><h3>{x}</h3><p>Start your journey</p></div>)}</div></div></section><section className="section container"><Heading title="Highlights of Egypt" copy="Discover the most important landmarks in Egypt."/><div className="highlight-row">{['Aswan Tours','Hurghada Tours','Sharm El Sheikh Tours','Dahab Tours'].map((x,i)=><div key={x}><img src={images[i%images.length]} alt={x}/><strong>{x}</strong></div>)}</div></section><HelpCTA/></main></SiteShell>}
