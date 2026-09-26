'use client'

import { useEffect, useState } from 'react'
import { Building2, CheckCircle2, CircleDollarSign, Cloud, Globe2, KeyRound, LogIn, Mail, MapPinned, Palette, PlugZap, Plus, QrCode, Share2, ShieldCheck } from 'lucide-react'
import { WhatsAppGlyph } from '@/components/whatsapp-chat'
import { PageHead } from '@/components/admin/admin-shell'
import { AdminText, Card } from '@/components/admin/admin-ui'
import { useAdminLocale } from '@/components/admin/admin-locale'
import { cn } from '@/lib/utils'
import { defaultCurrencySettings, getCurrencyRates, readCurrencySettings, readLocalizationSettings, saveCurrencySettings, saveLocalizationSettings } from '@/components/locale'
import { saveBrandSettings, useBrandSettings, SOCIAL_NETWORKS, readSocialLinks, saveSocialLinks, type SocialLink } from '@/lib/admin-store'
import { FacebookIcon, GoogleIcon } from '@/components/brand-icons'
import { ImageField } from '@/components/admin/image-field'

const TIMEZONES = [
  'Africa/Cairo', 'Africa/Tunis', 'Africa/Algiers', 'Africa/Casablanca',
  'Asia/Dubai', 'Asia/Riyadh', 'Asia/Qatar', 'Asia/Kuwait',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Rome', 'Europe/Madrid', 'Europe/Amsterdam',
  'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'America/Toronto',
  'Asia/Kolkata', 'Asia/Singapore', 'Australia/Sydney', 'Pacific/Auckland', 'UTC',
]

function SiteClock({ timezone }: { timezone: string }) {
  const ar = useAdminLocale() === 'ar'
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])
  let time = '—'
  try {
    time = new Intl.DateTimeFormat(ar ? 'ar-EG' : 'en-US', {
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      timeZone: timezone, timeZoneName: 'short',
    }).format(now)
  } catch {
    time = '—'
  }
  return <b dir="ltr">{time}</b>
}

function LocalizationTab({ onSaved }: { onSaved: () => void }) {
  const stored = readLocalizationSettings()
  const [defaultLanguage, setDefaultLanguage] = useState<'en' | 'ar'>(stored.defaultLanguage)
  const [timezone, setTimezone] = useState(stored.timezone)

  const save = () => {
    saveLocalizationSettings({ defaultLanguage, timezone })
    onSaved()
  }

  return (
    <div className="sp-form">
      <label><AdminText en="Default language" ar="اللغة الافتراضية" /><select value={defaultLanguage} onChange={(e) => setDefaultLanguage(e.target.value as 'en' | 'ar')}><option value="en">English</option><option value="ar">العربية</option></select></label>
      <label><AdminText en="Timezone" ar="المنطقة الزمنية" /><select value={timezone} onChange={(e) => setTimezone(e.target.value)}>{TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}</select></label>
      <div className="sp-status2">
        <div><small><AdminText en="CURRENT SITE TIME" ar="توقيت الموقع الحالي" /></small><SiteClock timezone={timezone} /></div>
        <div><small><AdminText en="SCOPE" ar="النطاق" /></small><b><AdminText en="New visitors + timestamps" ar="الزوار الجدد + الطوابع الزمنية" /></b></div>
      </div>
      <div><button type="button" className="sp-btn dark" onClick={save}><AdminText en="Save" ar="حفظ" /></button></div>
    </div>
  )
}

function SocialTab() {
  const [links, setLinks] = useState<SocialLink[]>(readSocialLinks)
  const [saved, setSaved] = useState(false)

  const update = (id: string, patch: Partial<SocialLink>) =>
    setLinks((prev) => prev.map((link) => (link.id === id ? { ...link, ...patch } : link)))

  const remove = (id: string) => setLinks((prev) => prev.filter((link) => link.id !== id))

  const add = (section: 'header' | 'footer') => {
    const nextLink: SocialLink = {
      id: `soc-${Date.now().toString(36)}`,
      network: 'facebook',
      url: '',
      header: section === 'header',
      footer: section === 'footer',
    }
    setLinks((prev) => [...prev, nextLink])
  }

  const save = () => {
    saveSocialLinks(links.filter((link) => link.url.trim()))
    setLinks(readSocialLinks())
    setSaved(true)
  }

  const group = (section: 'header' | 'footer', titleEn: string, titleAr: string, hintEn: string, hintAr: string) => (
    <>
      <p className="sp-group-title"><AdminText en={titleEn} ar={titleAr} /></p>
      <p style={{ margin: '-6px 0 4px', color: 'var(--sp-muted)', fontSize: 12 }}><AdminText en={hintEn} ar={hintAr} /></p>
      {links.filter((link) => link[section]).map((link) => (
        <div className="sp-form-2" key={link.id}>
          <label><AdminText en="Network" ar="الشبكة" />
            <select value={link.network} onChange={(e) => update(link.id, { network: e.target.value as SocialLink['network'] })}>
              {SOCIAL_NETWORKS.map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}
            </select>
          </label>
          <label><AdminText en="Profile link" ar="رابط الحساب" />
            <span style={{ display: 'flex', gap: 8 }}>
              <input value={link.url} onChange={(e) => update(link.id, { url: e.target.value })} placeholder="https://..." dir="ltr" style={{ flex: 1 }} />
              <button type="button" className="sp-delete-btn" onClick={() => remove(link.id)}><AdminText en="Delete" ar="حذف" /></button>
            </span>
          </label>
        </div>
      ))}
      <div><button type="button" className="sp-btn" onClick={() => add(section)}><Plus size={16} /> <AdminText en="Add link" ar="إضافة رابط" /></button></div>
    </>
  )

  return (
    <div className="sp-form">
      {group('header', 'Header top bar', 'شريط الهيدر العلوي', 'Shown beside the header actions', 'تظهر بجانب أزرار الهيدر')}
      {group('footer', 'Footer', 'الفوتر', 'Shown under the footer logo', 'تظهر تحت شعار الفوتر')}
      {saved && <p role="status" style={{ color: '#15803d' }}><AdminText en="Social links saved. The website updates instantly." ar="حفظت روابط التواصل. يتحدث الموقع فورا." /></p>}
      <div><button type="button" className="sp-btn dark" onClick={save}><AdminText en="Save" ar="حفظ" /></button></div>
    </div>
  )
}

function GeneralTab({ onSaved }: { onSaved: () => void }) {
  const brand = useBrandSettings()
  const [companyName, setCompanyName] = useState(brand.companyName)
  const [logo, setLogo] = useState(brand.logo)
  const [favicon, setFavicon] = useState(brand.favicon)
  const [aboutEn, setAboutEn] = useState(brand.aboutEn)
  const [aboutAr, setAboutAr] = useState(brand.aboutAr)

  useEffect(() => {
    setCompanyName(brand.companyName)
    setLogo(brand.logo)
    setFavicon(brand.favicon)
    setAboutEn(brand.aboutEn)
    setAboutAr(brand.aboutAr)
  }, [brand.companyName, brand.logo, brand.favicon, brand.aboutEn, brand.aboutAr])

  const save = () => {
    saveBrandSettings({ companyName: companyName.trim() || 'Star Pyramids Tours', logo: logo.trim() || '/logo.png', favicon: favicon.trim() || '/favicon.png', aboutEn: aboutEn.trim(), aboutAr: aboutAr.trim() })
    onSaved()
  }

  return (
    <div className="sp-form">
      <label><AdminText en="Company name" ar="اسم الشركة" /><input value={companyName} onChange={(e) => setCompanyName(e.target.value)} /></label>
      <p className="sp-group-title"><AdminText en="Logo" ar="الشعار" /></p>
      <ImageField value={logo} onChange={setLogo} />
      <p className="sp-group-title"><AdminText en="Favicon" ar="أيقونة الموقع" /></p>
      <ImageField value={favicon} onChange={setFavicon} />
      <p className="sp-group-title"><AdminText en="Footer tagline (under the logo)" ar="سطر الفوتر (تحت الشعار)" /></p>
      <label><AdminText en="About (EN)" ar="الوصف (EN)" /><input value={aboutEn} onChange={(e) => setAboutEn(e.target.value)} dir="ltr" /></label>
      <label><AdminText en="About (AR)" ar="الوصف (AR)" /><input value={aboutAr} onChange={(e) => setAboutAr(e.target.value)} /></label>
      <div><button type="button" className="sp-btn dark" onClick={save}><AdminText en="Save" ar="حفظ" /></button></div>
    </div>
  )
}

function ContactTab({ onSaved }: { onSaved: () => void }) {
  const brand = useBrandSettings()
  const [phone, setPhone] = useState(brand.phone)
  const [whatsapp, setWhatsapp] = useState(brand.whatsapp)
  const [email, setEmail] = useState(brand.email)
  const [address, setAddress] = useState(brand.address)
  const [mapUrl, setMapUrl] = useState(brand.mapUrl)
  const [copyrightEn, setCopyrightEn] = useState(brand.copyrightEn)
  const [copyrightAr, setCopyrightAr] = useState(brand.copyrightAr)

  useEffect(() => {
    setPhone(brand.phone)
    setWhatsapp(brand.whatsapp)
    setEmail(brand.email)
    setAddress(brand.address)
    setMapUrl(brand.mapUrl)
    setCopyrightEn(brand.copyrightEn)
    setCopyrightAr(brand.copyrightAr)
  }, [brand.phone, brand.whatsapp, brand.email, brand.address, brand.mapUrl, brand.copyrightEn, brand.copyrightAr])

  const save = () => {
    saveBrandSettings({
      phone: phone.trim() || brand.phone,
      whatsapp: whatsapp.trim() || brand.whatsapp,
      email: email.trim() || brand.email,
      address: address.trim() || brand.address,
      mapUrl: mapUrl.trim(),
      copyrightEn: copyrightEn.trim() || brand.copyrightEn,
      copyrightAr: copyrightAr.trim() || brand.copyrightAr,
    })
    onSaved()
  }

  return <div className="sp-form">
    <div className="sp-form-2">
      <label><AdminText en="Phone number" ar="رقم الهاتف" /><input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" dir="ltr" required /></label>
      <label><AdminText en="WhatsApp number" ar="رقم واتساب" /><input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} inputMode="tel" dir="ltr" required /></label>
    </div>
    <label><AdminText en="Public email" ar="البريد الإلكتروني العام" /><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" required /></label>
    <label><AdminText en="Company address" ar="عنوان الشركة" /><input value={address} onChange={(e) => setAddress(e.target.value)} required /></label>
    <label><AdminText en="Google Maps URL" ar="رابط خرائط جوجل" /><input type="url" value={mapUrl} onChange={(e) => setMapUrl(e.target.value)} dir="ltr" placeholder="https://maps.google.com/..." /></label>
    <p className="sp-group-title"><AdminText en="Footer copyright" ar="حقوق النشر في الفوتر" /></p>
    <label><AdminText en="Copyright (EN)" ar="حقوق النشر (EN)" /><input value={copyrightEn} onChange={(e) => setCopyrightEn(e.target.value)} dir="ltr" required /></label>
    <label><AdminText en="Copyright (AR)" ar="حقوق النشر (AR)" /><input value={copyrightAr} onChange={(e) => setCopyrightAr(e.target.value)} dir="rtl" required /></label>
    <div><button type="button" className="sp-btn dark" onClick={save}><AdminText en="Save contact details" ar="حفظ بيانات التواصل" /></button></div>
  </div>
}

const tabs = [
  { id: 'general', icon: Building2, en: 'General', ar: 'عام', sub: 'Core company details', subAr: 'بيانات الشركة الأساسية' },
  { id: 'contact', icon: Mail, en: 'Contact', ar: 'التواصل', sub: 'Public contact channels', subAr: 'قنوات التواصل العامة' },
  { id: 'localization', icon: Globe2, en: 'Localization', ar: 'اللغة والمنطقة', sub: 'Language and regional defaults', subAr: 'اللغة والإعدادات الإقليمية' },
  { id: 'currency', icon: CircleDollarSign, en: 'Currency', ar: 'العملة', sub: 'Live conversion rates', subAr: 'أسعار التحويل الحية' },
  { id: 'social', icon: Share2, en: 'Social', ar: 'التواصل الاجتماعي', sub: 'Company profile links', subAr: 'روابط حسابات الشركة' },
  { id: 'website', icon: Palette, en: 'Website Defaults', ar: 'افتراضيات الموقع', sub: 'SEO defaults', subAr: 'إعدادات تحسين محركات البحث' },
  { id: 'email', icon: Mail, en: 'Email Configuration', ar: 'إعداد البريد', sub: 'SMTP / IMAP mailboxes', subAr: 'صناديق البريد الصادر والوارد' },
  { id: 'whatsapp', icon: WhatsAppGlyph, en: 'WhatsApp', ar: 'واتساب', sub: 'QR session or official Cloud API', subAr: 'جلسة QR أو واجهة Cloud الرسمية' },
  { id: 'google-maps', icon: MapPinned, en: 'Google Maps', ar: 'خرائط جوجل', sub: 'Maps, places and location services', subAr: 'الخرائط والأماكن وخدمات المواقع' },
  { id: 'google-auth', icon: GoogleIcon, en: 'Google Login', ar: 'تسجيل الدخول بجوجل', sub: 'Customer account authentication', subAr: 'مصادقة حسابات العملاء' },
  { id: 'facebook-auth', icon: FacebookIcon, en: 'Facebook Login', ar: 'تسجيل الدخول بفيسبوك', sub: 'Customer account authentication', subAr: 'مصادقة حسابات العملاء' },
] as const

function SecretPrototypeNote() {
  return <p className="sp-integration-note"><ShieldCheck size={15} /> <AdminText en="Prototype only — do not enter real credentials. Secure secret storage requires backend integration." ar="نسخة تجريبية فقط — لا تدخل بيانات اعتماد حقيقية. يتطلب التخزين الآمن للأسرار تكامل الواجهة الخلفية." /></p>
}

function IntegrationStatus({ label }: { label?: React.ReactNode }) {
  return <span className="sp-integration-status"><i aria-hidden="true" />{label ?? <AdminText en="Backend pending" ar="الباك إند معلق" />}</span>
}

function IntegrationToggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return <button type="button" role="switch" aria-checked={checked} className={cn('sp-integration-toggle', checked && 'active')} onClick={onChange}><span className="sp-toggle-track" aria-hidden="true" /><span className="sp-toggle-label">{checked ? <AdminText en="Enabled" ar="مفعل" /> : <AdminText en="Disabled" ar="معطل" />}</span></button>
}

export default function SettingsPage() {
  const ar = useAdminLocale() === 'ar'
  const brand = useBrandSettings()
  const [tab, setTab] = useState<(typeof tabs)[number]['id']>('whatsapp')
  const [saved, setSaved] = useState(false)
  const [notice, setNotice] = useState('')
  const [whatsappEnabled, setWhatsappEnabled] = useState(true)
  const [mapsEnabled, setMapsEnabled] = useState(true)
  const [googleAuthEnabled, setGoogleAuthEnabled] = useState(true)
  const [facebookAuthEnabled, setFacebookAuthEnabled] = useState(true)
  const [currencyForm, setCurrencyForm] = useState(readCurrencySettings)
  const [currencySaved, setCurrencySaved] = useState(false)
  const [currencyError, setCurrencyError] = useState('')

  const saveCurrency = () => {
    const eur = Number(currencyForm.eur)
    const egp = Number(currencyForm.egp)
    if (!(eur > 0) || !(egp > 0)) {
      setCurrencyError(ar ? 'أدخل أسعارا أكبر من الصفر.' : 'Enter rates greater than zero.')
      return
    }
    setCurrencyError('')
    saveCurrencySettings({ eur, egp, defaultCurrency: currencyForm.defaultCurrency })
    setCurrencyForm(readCurrencySettings())
    setCurrencySaved(true)
  }

  const resetCurrency = () => {
    saveCurrencySettings({ eur: defaultCurrencySettings.eur, egp: defaultCurrencySettings.egp, defaultCurrency: defaultCurrencySettings.defaultCurrency })
    setCurrencyForm(readCurrencySettings())
    setCurrencySaved(true)
  }

  const backendAction = (en: string, arMsg: string) => {
    setNotice(ar ? arMsg : en)
    setSaved(false)
  }

  const activeTab = tabs.find((t) => t.id === tab)

  return (
    <>
      <PageHead eyebrow="Administration" title="Settings" titleAr="الإعدادات" sub="Manage company, contact, localization, social and application defaults." subAr="إدارة الشركة والتواصل واللغة وروابط التواصل وافتراضيات التطبيق." />
      <div className="sp-set-grid">
        <Card title={<AdminText en="Settings" ar="الإعدادات" />}>
          <div className="sp-set-nav">
            {tabs.map((t) => (
              <button key={t.id} type="button" className={cn(tab === t.id && 'active')} onClick={() => setTab(t.id)}>
                <t.icon size={18} />
                <span><strong>{ar ? t.ar : t.en}</strong><small>{ar ? t.subAr : t.sub}</small></span>
              </button>
            ))}
          </div>
        </Card>

        <Card title={activeTab ? (ar ? activeTab.ar : activeTab.en) : ''} sub={activeTab ? (ar ? activeTab.subAr : activeTab.sub) : ''}>
          {tab === 'whatsapp' && (
            <div className="sp-integration-page">
              <div className="sp-integration-summary">
                <span className="sp-integration-icon green"><WhatsAppGlyph size={22} /></span>
                <div className="sp-integration-copy"><strong><AdminText en="WhatsApp messaging" ar="مراسلات واتساب" /></strong><p><AdminText en="Choose one connection method. Messages will appear in the unified Inbox after the backend is connected." ar="اختر طريقة ربط واحدة. ستظهر الرسائل في صندوق المراسلة الموحد بعد ربط الواجهة الخلفية." /></p></div>
                <div className="sp-integration-controls"><IntegrationStatus /><IntegrationToggle checked={whatsappEnabled} onChange={() => setWhatsappEnabled((value) => !value)} /></div>
              </div>

              <div className="sp-method-grid">
                <section className="sp-method-card">
                  <header><span className="sp-integration-icon"><QrCode size={21} /></span><div><h3><AdminText en="QR Session" ar="جلسة QR" /></h3><p><AdminText en="Connect an existing WhatsApp device session." ar="اربط جلسة جهاز واتساب موجودة." /></p></div></header>
                  <div className="sp-qr-preview" aria-label={ar ? 'عنصر نائب لرمز QR' : 'QR code placeholder'}>
                    <QrCode size={76} strokeWidth={1.25} />
                    <strong><AdminText en="QR code will appear here" ar="سيظهر رمز QR هنا" /></strong>
                    <small><AdminText en="Generated by the backend session service" ar="يولد من خدمة الجلسات الخلفية" /></small>
                  </div>
                  <div className="sp-form">
                    <label><AdminText en="Session name" ar="اسم الجلسة" /><input defaultValue="Star Pyramids Support" /></label>
                    <label><AdminText en="Assigned inbox" ar="الصندوق المعين" /><select defaultValue="main"><option value="main">{ar ? 'صندوق واتساب الرئيسي' : 'Main WhatsApp Inbox'}</option><option value="sales">{ar ? 'فريق المبيعات' : 'Sales Team'}</option></select></label>
                  </div>
                  <button type="button" className="sp-btn primary" disabled={!whatsappEnabled} onClick={() => backendAction('QR generation is ready. Connect the backend session endpoint to generate a real scannable code.', 'توليد QR جاهز. اربط نقطة الجلسات الخلفية لتوليد رمز حقيقي قابل للمسح.')}><QrCode size={17} /> <AdminText en="Generate QR code" ar="توليد رمز QR" /></button>
                  <p className="sp-integration-note"><AdminText en="This method requires a backend session provider. It is separate from Meta Cloud API and must be reviewed before production use." ar="تتطلب هذه الطريقة مزود جلسات خلفيا. وهي منفصلة عن واجهة Meta Cloud ويجب مراجعتها قبل الإنتاج." /></p>
                </section>

                <section className="sp-method-card featured">
                  <header><span className="sp-integration-icon blue"><Cloud size={21} /></span><div><h3><AdminText en="Official Cloud API" ar="واجهة Cloud الرسمية" /></h3><p><AdminText en="Recommended Meta WhatsApp Business connection." ar="ربط Meta WhatsApp Business الموصى به." /></p></div><span className="sp-recommended"><AdminText en="Recommended" ar="موصى به" /></span></header>
                  <div className="sp-form">
                    <div className="sp-form-2">
                      <label><AdminText en="Meta App ID" ar="معرف تطبيق Meta" /><input placeholder={ar ? 'أدخل معرف تطبيق Meta' : 'Enter Meta App ID'} /></label>
                      <label><AdminText en="Business Account ID" ar="معرف حساب الأعمال" /><input placeholder={ar ? 'أدخل معرف WABA' : 'Enter WABA ID'} /></label>
                    </div>
                    <label><AdminText en="Phone Number ID" ar="معرف رقم الهاتف" /><input placeholder={ar ? 'أدخل معرف رقم الهاتف' : 'Enter Phone Number ID'} /></label>
                    <label><AdminText en="Access token" ar="رمز الوصول" /><input type="password" placeholder={ar ? 'معطل في النسخة التجريبية' : 'Disabled in prototype'} autoComplete="off" disabled /></label>
                    <label><AdminText en="Webhook callback" ar="رابط Webhook" /><input value="https://starpyramids.com/api/integrations/whatsapp/webhook" readOnly /></label>
                    <label><AdminText en="Verify token" ar="رمز التحقق" /><input type="password" placeholder={ar ? 'معطل في النسخة التجريبية' : 'Disabled in prototype'} autoComplete="off" disabled /></label>
                  </div>
                  <SecretPrototypeNote />
                  <div className="sp-integration-actions">
                    <button type="button" className="sp-btn primary" disabled={!whatsappEnabled} onClick={() => backendAction('Meta Embedded Signup is prepared. The backend OAuth callback is required to complete the connection.', 'تسجيل Meta المدمج مجهز. يلزم رد OAuth الخلفي لإتمام الربط.')}><PlugZap size={17} /> <AdminText en="Connect with Meta" ar="الربط مع Meta" /></button>
                    <button type="button" className="sp-btn" disabled={!whatsappEnabled} onClick={() => backendAction('Connection testing will run through the backend without exposing the access token in the browser.', 'سيعمل اختبار الاتصال عبر الخلفية دون كشف رمز الوصول في المتصفح.')}><AdminText en="Test connection" ar="اختبار الاتصال" /></button>
                  </div>
                  <p className="sp-integration-note"><ShieldCheck size={15} /> <AdminText en="Tokens and webhook secrets must remain server-side and encrypted." ar="يجب أن تبقى الرموز وأسرار webhook في الخادم ومشفرة." /></p>
                </section>
              </div>
              {notice && <p className="sp-integration-feedback" role="status"><CheckCircle2 size={16} />{notice}</p>}
            </div>
          )}

          {tab === 'google-maps' && (
            <div className="sp-integration-page">
              <div className="sp-integration-summary">
                <span className="sp-integration-icon red"><MapPinned size={22} /></span>
                <div className="sp-integration-copy"><strong><AdminText en="Google Maps Platform" ar="منصة خرائط جوجل" /></strong><p><AdminText en="Maps, place search and trip location previews across the website." ar="الخرائط والبحث عن الأماكن ومعاينات مواقع الرحلات عبر الموقع." /></p></div>
                <div className="sp-integration-controls"><IntegrationStatus /><IntegrationToggle checked={mapsEnabled} onChange={() => setMapsEnabled((value) => !value)} /></div>
              </div>
              <section className="sp-integration-panel">
                <div className="sp-form">
                  <div className="sp-form-2">
                    <label><AdminText en="Browser API key" ar="مفتاح API للمتصفح" /><input type="password" placeholder={ar ? 'معطل في النسخة التجريبية' : 'Disabled in prototype'} autoComplete="off" disabled /></label>
                    <label><AdminText en="Map ID" ar="معرف الخريطة" /><input placeholder={ar ? 'معرف خريطة جوجل اختياري' : 'Optional Google Map ID'} /></label>
                  </div>
                  <div className="sp-form-2">
                    <label><AdminText en="Default latitude" ar="خط العرض الافتراضي" /><input defaultValue="29.9870" inputMode="decimal" /></label>
                    <label><AdminText en="Default longitude" ar="خط الطول الافتراضي" /><input defaultValue="31.2118" inputMode="decimal" /></label>
                  </div>
                  <div className="sp-form-2">
                    <label><AdminText en="Default zoom" ar="التقريب الافتراضي" /><input type="number" defaultValue="12" min="1" max="20" /></label>
                    <label><AdminText en="Enabled services" ar="الخدمات المفعلة" /><select defaultValue="maps-places"><option value="maps-places">{ar ? 'الخرائط + الأماكن' : 'Maps + Places'}</option><option value="maps">{ar ? 'الخرائط فقط' : 'Maps only'}</option><option value="maps-places-geocoding">{ar ? 'الخرائط + الأماكن + الترميز' : 'Maps + Places + Geocoding'}</option></select></label>
                  </div>
                </div>
                <SecretPrototypeNote />
                <div className="sp-map-config-preview"><MapPinned size={32} /><strong>{brand.address}</strong><span><AdminText en="Map preview becomes live after a valid restricted API key is connected." ar="تصبح معاينة الخريطة حية بعد ربط مفتاح مقيد صالح." /></span></div>
                <div className="sp-integration-actions">
                  <button type="button" className="sp-btn primary" disabled={!mapsEnabled} onClick={() => backendAction('Google Maps settings are ready. Saving and validating the key requires the backend settings endpoint.', 'إعدادات خرائط جوجل جاهزة. يتطلب الحفظ والتحقق نقطة الإعدادات الخلفية.')}><AdminText en="Save configuration" ar="حفظ الإعدادات" /></button>
                  <button type="button" className="sp-btn" disabled={!mapsEnabled} onClick={() => backendAction('Map validation is prepared and will run after the backend supplies the restricted browser key.', 'التحقق من الخريطة مجهز وسيعمل بعد توفير المفتاح المقيد من الخلفية.')}><AdminText en="Test map" ar="اختبار الخريطة" /></button>
                </div>
                <p className="sp-integration-note"><ShieldCheck size={15} /> <AdminText en="Restrict the browser key to the production domain and only the required Google APIs." ar="قيد مفتاح المتصفح على نطاق الإنتاج وواجهات جوجل المطلوبة فقط." /></p>
              </section>
              {notice && <p className="sp-integration-feedback" role="status"><CheckCircle2 size={16} />{notice}</p>}
            </div>
          )}

          {tab === 'google-auth' && (
            <div className="sp-integration-page">
              <div className="sp-integration-summary">
                <span className="sp-integration-icon red"><GoogleIcon size={22} /></span>
                <div className="sp-integration-copy"><strong><AdminText en="Google customer login" ar="تسجيل دخول العملاء بجوجل" /></strong><p><AdminText en="Allow customers to create or access their account with Google." ar="اسمح للعملاء بإنشاء حساباتهم أو الوصول إليها بجوجل." /></p></div>
                <div className="sp-integration-controls"><IntegrationStatus /><IntegrationToggle checked={googleAuthEnabled} onChange={() => setGoogleAuthEnabled((value) => !value)} /></div>
              </div>
              <section className="sp-integration-panel">
                <div className="sp-form">
                  <label><AdminText en="Google OAuth Client ID" ar="معرف عميل Google OAuth" /><input placeholder={ar ? 'أدخل معرف عميل Google OAuth' : 'Enter Google OAuth Client ID'} /></label>
                  <label><AdminText en="Google OAuth Client Secret" ar="سر عميل Google OAuth" /><input type="password" placeholder={ar ? 'معطل في النسخة التجريبية' : 'Disabled in prototype'} autoComplete="off" disabled /></label>
                  <label><AdminText en="Authorized JavaScript origin" ar="مصدر JavaScript المعتمد" /><input value="https://starpyramids.com" readOnly /></label>
                  <label><AdminText en="Authorized redirect URI" ar="رابط إعادة التوجيه المعتمد" /><input value="https://starpyramids.com/api/auth/callback/google" readOnly /></label>
                  <label><AdminText en="Requested scopes" ar="النطاقات المطلوبة" /><input value="openid email profile" readOnly /></label>
                </div>
                <div className="sp-integration-actions">
                  <button type="button" className="sp-btn primary" disabled={!googleAuthEnabled} onClick={() => backendAction('Google OAuth is prepared. The backend callback and secure session handling are required for a real login.', 'Google OAuth مجهز. يلزم رد الخلفية وإدارة جلسات آمنة لتسجيل حقيقي.')}><LogIn size={17} /> <AdminText en="Connect Google" ar="ربط جوجل" /></button>
                  <button type="button" className="sp-btn" disabled={!googleAuthEnabled} onClick={() => backendAction('A real Google sign-in test will be available after the OAuth callback is implemented.', 'سيتاح اختبار دخول حقيقي بجوجل بعد تنفيذ رد OAuth.')}><AdminText en="Test login" ar="اختبار الدخول" /></button>
                </div>
                <SecretPrototypeNote />
                <p className="sp-integration-note"><KeyRound size={15} /> <AdminText en="The client secret and login tokens must never be exposed in frontend code." ar="يجب ألا يكشف سر العميل ورموز الدخول في كود الواجهة أبدا." /></p>
              </section>
              {notice && <p className="sp-integration-feedback" role="status"><CheckCircle2 size={16} />{notice}</p>}
            </div>
          )}

          {tab === 'facebook-auth' && (
            <div className="sp-integration-page">
              <div className="sp-integration-summary">
                <span className="sp-integration-icon facebook"><FacebookIcon size={22} /></span>
                <div className="sp-integration-copy"><strong><AdminText en="Facebook customer login" ar="تسجيل دخول العملاء بفيسبوك" /></strong><p><AdminText en="Allow customers to create or access their account with Facebook." ar="اسمح للعملاء بإنشاء حساباتهم أو الوصول إليها بفيسبوك." /></p></div>
                <div className="sp-integration-controls"><IntegrationStatus /><IntegrationToggle checked={facebookAuthEnabled} onChange={() => setFacebookAuthEnabled((value) => !value)} /></div>
              </div>
              <section className="sp-integration-panel">
                <div className="sp-form">
                  <div className="sp-form-2">
                    <label><AdminText en="Facebook App ID" ar="معرف تطبيق فيسبوك" /><input placeholder={ar ? 'أدخل معرف تطبيق فيسبوك' : 'Enter Facebook App ID'} /></label>
                    <label><AdminText en="Facebook App Secret" ar="سر تطبيق فيسبوك" /><input type="password" placeholder={ar ? 'معطل في النسخة التجريبية' : 'Disabled in prototype'} autoComplete="off" disabled /></label>
                  </div>
                  <label><AdminText en="Valid OAuth redirect URI" ar="رابط إعادة توجيه OAuth الصالح" /><input value="https://starpyramids.com/api/auth/callback/facebook" readOnly /></label>
                  <label><AdminText en="Data deletion callback" ar="رابط حذف البيانات" /><input value="https://starpyramids.com/api/auth/facebook/data-deletion" readOnly /></label>
                  <label><AdminText en="Requested permissions" ar="الأذونات المطلوبة" /><input value="public_profile,email" readOnly /></label>
                </div>
                <div className="sp-integration-actions">
                  <button type="button" className="sp-btn primary" disabled={!facebookAuthEnabled} onClick={() => backendAction('Facebook Login is prepared. The backend callback and secure session handling are required for a real login.', 'تسجيل فيسبوك مجهز. يلزم رد الخلفية وإدارة جلسات آمنة لتسجيل حقيقي.')}><LogIn size={17} /> <AdminText en="Connect Facebook" ar="ربط فيسبوك" /></button>
                  <button type="button" className="sp-btn" disabled={!facebookAuthEnabled} onClick={() => backendAction('A real Facebook login test will be available after the OAuth callback is implemented.', 'سيتاح اختبار دخول حقيقي بفيسبوك بعد تنفيذ رد OAuth.')}><AdminText en="Test login" ar="اختبار الدخول" /></button>
                </div>
                <SecretPrototypeNote />
                <p className="sp-integration-note"><KeyRound size={15} /> <AdminText en="Keep the App Secret on the server and configure the production domain in Meta." ar="أبق سر التطبيق في الخادم واضبط نطاق الإنتاج في Meta." /></p>
              </section>
              {notice && <p className="sp-integration-feedback" role="status"><CheckCircle2 size={16} />{notice}</p>}
            </div>
          )}

          {tab === 'email' && (
            <div className="sp-form">
              <div className="sp-status2">
                <div><small><AdminText en="OUTGOING EMAIL" ar="البريد الصادر" /></small><b><AdminText en="Configured" ar="مضبوط" /></b></div>
                <div><small><AdminText en="INCOMING EMAIL" ar="البريد الوارد" /></small><b><AdminText en="Configured" ar="مضبوط" /></b></div>
              </div>
              <p className="sp-group-title"><AdminText en="Sender Identity" ar="هوية المرسل" /></p>
              <div className="sp-form-2">
                <label><AdminText en="From Name" ar="اسم المرسل" /><input defaultValue="Star Pyramids Tours" /></label>
                <label><AdminText en="From Email" ar="بريد المرسل" /><input defaultValue="sales@starpyramids.com" /></label>
              </div>
              <p className="sp-group-title"><AdminText en="Outgoing Email - SMTP" ar="البريد الصادر - SMTP" /></p>
              <div className="sp-form-2">
                <label><AdminText en="SMTP Host" ar="مضيف SMTP" /><input defaultValue="smtp.hostinger.com" /></label>
                <label><AdminText en="SMTP Port" ar="منفذ SMTP" /><input defaultValue="465" /></label>
              </div>
              <div className="sp-form-2">
                <label><AdminText en="Encryption" ar="التشفير" /><select defaultValue="SSL"><option>SSL</option><option>TLS</option><option>None</option></select></label>
                <label><AdminText en="SMTP Username" ar="اسم مستخدم SMTP" /><input defaultValue="sales@starpyramids.com" /></label>
              </div>
              <div className="sp-form-2">
                <label><AdminText en="SMTP Password" ar="كلمة مرور SMTP" /><input type="password" placeholder={ar ? 'معطل في النسخة التجريبية' : 'Disabled in prototype'} disabled /></label>
                <label><AdminText en="Timeout" ar="المهلة" /><input defaultValue="30" /></label>
              </div>
              <div className="sp-form-2">
                <label><AdminText en="Test recipient" ar="مستلم الاختبار" /><input placeholder="you@company.com" /></label>
                <label>&nbsp;<button type="button" className="sp-btn" onClick={() => setSaved(true)}><AdminText en="Test Outgoing Email" ar="اختبار البريد الصادر" /></button></label>
              </div>
              <p className="sp-group-title"><AdminText en="Incoming Email - IMAP / POP3" ar="البريد الوارد - IMAP / POP3" /></p>
              <div className="sp-form-2">
                <label><AdminText en="Protocol" ar="البروتوكول" /><select defaultValue="IMAP"><option>IMAP</option><option>POP3</option></select></label>
                <label><AdminText en="Incoming Host" ar="المضيف الوارد" /><input defaultValue="imap.hostinger.com" /></label>
              </div>
              <div className="sp-form-2">
                <label><AdminText en="Incoming Port" ar="المنفذ الوارد" /><input defaultValue="993" /></label>
                <label><AdminText en="Encryption" ar="التشفير" /><select defaultValue="SSL"><option>SSL</option><option>TLS</option></select></label>
              </div>
              <div className="sp-form-2">
                <label><AdminText en="Incoming Username" ar="اسم المستخدم الوارد" /><input defaultValue="sales@starpyramids.com" /></label>
                <label><AdminText en="Incoming Password" ar="كلمة المرور الواردة" /><input type="password" placeholder={ar ? 'معطل في النسخة التجريبية' : 'Disabled in prototype'} disabled /></label>
              </div>
              <SecretPrototypeNote />
              <label><AdminText en="Mailbox / Folder" ar="الصندوق / المجلد" /><input defaultValue="INBOX" /></label>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" className="sp-btn" onClick={() => setSaved(true)}><AdminText en="Test Incoming Mail" ar="اختبار البريد الوارد" /></button>
                <button type="button" className="sp-btn dark" onClick={() => setSaved(true)}><AdminText en="Save" ar="حفظ" /></button>
              </div>
              {saved && <p role="status" style={{ color: '#15803d' }}><AdminText en="Saved successfully." ar="تم الحفظ بنجاح." /></p>}
            </div>
          )}

          {tab === 'general' && (
            <GeneralTab onSaved={() => setSaved(true)} />
          )}

          {tab === 'contact' && (
            <ContactTab onSaved={() => setSaved(true)} />
          )}

          {tab === 'localization' && (
            <LocalizationTab onSaved={() => setSaved(true)} />
          )}

          {tab === 'currency' && (
            <div className="sp-form">
              <div className="sp-status2">
                <div><small><AdminText en="BASE CURRENCY" ar="العملة الأساسية" /></small><b>USD · 1</b></div>
                <div><small><AdminText en="LAST UPDATED" ar="آخر تحديث" /></small><b>{currencyForm.updatedAt ? new Date(currencyForm.updatedAt).toLocaleString() : <AdminText en="Defaults" ar="الافتراضية" />}</b></div>
              </div>
              <p className="sp-group-title"><AdminText en="Conversion rates (per 1 USD)" ar="أسعار التحويل (لكل 1 دولار)" /></p>
              <div className="sp-form-2">
                <label><AdminText en="Euro (EUR)" ar="اليورو (EUR)" /><input type="number" min="0" step="0.01" value={currencyForm.eur} onChange={(e) => { setCurrencyForm((f) => ({ ...f, eur: Number(e.target.value) })); setCurrencySaved(false) }} dir="ltr" /></label>
                <label><AdminText en="Egyptian Pound (EGP)" ar="الجنيه المصري (EGP)" /><input type="number" min="0" step="0.5" value={currencyForm.egp} onChange={(e) => { setCurrencyForm((f) => ({ ...f, egp: Number(e.target.value) })); setCurrencySaved(false) }} dir="ltr" /></label>
              </div>
              <label><AdminText en="Default currency" ar="العملة الافتراضية" /><select value={currencyForm.defaultCurrency} onChange={(e) => setCurrencyForm((f) => ({ ...f, defaultCurrency: e.target.value as 'USD' | 'EUR' | 'EGP' }))}><option value="USD">USD</option><option value="EUR">EUR</option><option value="EGP">EGP</option></select></label>
              <p className="sp-group-title"><AdminText en="Live preview ($120 tour)" ar="معاينة حية (رحلة بـ 120 دولارا)" /></p>
              <div className="sp-status2">
                <div><small>USD</small><b>${(120 * getCurrencyRates().USD).toLocaleString('en-US')}</b></div>
                <div><small>EUR</small><b>€{(120 * getCurrencyRates().EUR).toLocaleString('en-US')}</b></div>
              </div>
              <div className="sp-status2" style={{ marginTop: 12 }}>
                <div><small>EGP</small><b>{Math.round(120 * getCurrencyRates().EGP).toLocaleString('en-US')} £</b></div>
                <div><small><AdminText en="SCOPE" ar="النطاق" /></small><b><AdminText en="Every website price" ar="كل أسعار الموقع" /></b></div>
              </div>
              {currencyError && <p role="alert" style={{ color: '#b91c1c' }}>{currencyError}</p>}
              {currencySaved && <p role="status" style={{ color: '#15803d' }}><AdminText en="Rates saved. Website prices update instantly." ar="حفظت الأسعار. تتحدث أسعار الموقع فورا." /></p>}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" className="sp-btn" onClick={resetCurrency}><AdminText en="Reset defaults" ar="استعادة الافتراضية" /></button>
                <button type="button" className="sp-btn dark" onClick={saveCurrency}><AdminText en="Save rates" ar="حفظ الأسعار" /></button>
              </div>
            </div>
          )}

          {tab === 'social' && (
            <SocialTab />
          )}

          {tab === 'website' && (
            <div className="sp-form">
              <label><AdminText en="SEO title" ar="عنوان SEO" /><input defaultValue="STAR PYRAMIDS | Discover Egypt" /></label>
              <label><AdminText en="Promo bar text" ar="نص الشريط الترويجي" /><textarea rows={2} defaultValue="Book any package tour and enjoy a FREE tour experience." /></label>
              <div><button type="button" className="sp-btn dark" onClick={() => setSaved(true)}><AdminText en="Save" ar="حفظ" /></button></div>
            </div>
          )}

          {saved && tab !== 'email' && <p role="status" style={{ color: '#15803d' }}><AdminText en="Saved successfully." ar="تم الحفظ بنجاح." /></p>}
        </Card>
      </div>
    </>
  )
}
