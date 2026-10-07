'use client'

import { useCallback, useEffect, useState } from 'react'
import { Building2, CheckCircle2, CircleDollarSign, Cloud, Globe2, KeyRound, LogIn, Mail, MapPinned, Palette, PlugZap, Plus, QrCode, Share2, ShieldCheck } from 'lucide-react'
import { WhatsAppGlyph } from '@/components/whatsapp-chat'
import { PageHead } from '@/components/admin/admin-shell'
import { AdminText, Card } from '@/components/admin/admin-ui'
import { useAdminLocale } from '@/components/admin/admin-locale'
import { cn } from '@/lib/utils'
import { defaultCurrencySettings, defaultLocalizationSettings } from '@/components/locale'
import { defaultBrandSettings, defaultSocialLinks, SOCIAL_NETWORKS, type SocialLink } from '@/lib/admin-store'
import { FacebookIcon, GoogleIcon } from '@/components/brand-icons'
import { ImageField } from '@/components/admin/image-field'
import { SharedSelect } from '@/components/shared-select'
import { InternationalPhoneInput } from '@/components/international-phone-input'
import { countryFromPhone } from '@/data/countries'
import { toInternational } from '@/lib/phone'
import { ENABLED_LOCALES, LOCALE_LABELS, type EnabledLocale } from '@/lib/locale-config'
import { useCurrentUser } from '@/lib/use-current-user'

const TIMEZONES = [
  'Africa/Cairo', 'Africa/Tunis', 'Africa/Algiers', 'Africa/Casablanca',
  'Asia/Dubai', 'Asia/Riyadh', 'Asia/Qatar', 'Asia/Kuwait',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Rome', 'Europe/Madrid', 'Europe/Amsterdam',
  'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'America/Toronto',
  'Asia/Kolkata', 'Asia/Singapore', 'Australia/Sydney', 'Pacific/Auckland', 'UTC',
]

type SettingsSnapshot = {
  values: Record<string, string>
  secrets: Record<string, { configured: boolean }>
  rates: { eur: string; egp: string }
}

const FALLBACK_SEO_TITLE = 'STAR PYRAMIDS | Discover Egypt'
const FALLBACK_PROMO = 'Book any package tour and enjoy a FREE tour experience.'

function val(snapshot: SettingsSnapshot | null, key: string, fallback = ''): string {
  const stored = snapshot?.values[key]
  return stored !== undefined && stored !== '' ? stored : fallback
}

function secretConfigured(snapshot: SettingsSnapshot | null, key: string): boolean {
  return snapshot?.secrets[key]?.configured === true
}

async function patchSettings(
  values: Record<string, string>,
  rates?: { eur: string; egp: string },
): Promise<SettingsSnapshot> {
  const res = await fetch('/api/admin/settings', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(rates ? { values, rates } : { values }),
  })
  const data = (await res.json()) as SettingsSnapshot & { error?: string }
  if (!res.ok) throw new Error(data.error || 'Save failed.')
  return data
}

/** Inline success/error feedback (the project's established settings pattern). */
function SaveFeedback({ saved, error }: { saved: string; error: string }) {
  if (error) return <p role="alert" style={{ color: '#b91c1c' }}>{error}</p>
  if (saved) return <p role="status" style={{ color: '#15803d' }}><CheckCircle2 size={15} style={{ verticalAlign: '-2px' }} /> {saved}</p>
  return null
}

function ConfigBadge({ configured }: { configured: boolean }) {
  return (
    <span
      className="sp-integration-status"
      style={configured ? undefined : { opacity: 0.75 }}
    >
      <i aria-hidden="true" style={configured ? { background: '#16a34a' } : undefined} />
      {configured
        ? <AdminText en="Configured" ar="مضبوط" />
        : <AdminText en="Not configured" ar="غير مضبوط" />}
    </span>
  )
}

function SecretField({
  labelEn,
  labelAr,
  value,
  onChange,
  configured,
  disabled,
}: {
  labelEn: string
  labelAr: string
  value: string
  onChange: (next: string) => void
  configured: boolean
  disabled?: boolean
}) {
  const ar = useAdminLocale() === 'ar'
  return (
    <label>
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <AdminText en={labelEn} ar={labelAr} />
        <ConfigBadge configured={configured} />
      </span>
      <input
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={configured
          ? (ar ? '•••••••• (مضبوط — اتركه فارغا للإبقاء)' : '•••••••• (configured — leave blank to keep)')
          : (ar ? 'غير مضبوط — أدخل للحفظ' : 'Not configured — enter to save')}
        autoComplete="off"
        dir="ltr"
        disabled={disabled}
      />
    </label>
  )
}

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

type TabShell = {
  snapshot: SettingsSnapshot | null
  canWrite: boolean
  onSaved: (next: SettingsSnapshot) => void
}

function useTabState<T>(snapshot: SettingsSnapshot | null, init: (snap: SettingsSnapshot | null) => T) {
  const [form, setForm] = useState<T>(() => init(snapshot))
  const [saved, setSaved] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    setForm(init(snapshot))
    setSaved('')
    setError('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot])
  return { form, setForm, saved, setSaved, error, setError, saving, setSaving }
}

function ReadOnlyNote() {
  return <p className="sp-integration-note"><ShieldCheck size={15} /> <AdminText en="Your role is read-only for system settings. An Admin can make changes." ar="دورك للقراءة فقط في إعدادات النظام. يمكن للمسؤول إجراء التغييرات." /></p>
}

function LocalizationTab({ snapshot, canWrite, onSaved }: TabShell) {
  const ar = useAdminLocale() === 'ar'
  const t = useTabState(snapshot, (snap) => ({
    defaultLanguage: (val(snap, 'app.defaultLocale', defaultLocalizationSettings.defaultLanguage) as EnabledLocale),
    timezone: val(snap, 'app.timezone', defaultLocalizationSettings.timezone),
  }))

  const save = async () => {
    t.setSaving(true)
    t.setError('')
    t.setSaved('')
    try {
      const next = await patchSettings({
        'app.defaultLocale': t.form.defaultLanguage,
        'app.timezone': t.form.timezone,
      })
      onSaved(next)
      t.setSaved(ar ? 'تم الحفظ بنجاح.' : 'Saved successfully.')
    } catch (e) {
      t.setError(e instanceof Error ? e.message : 'Save failed.')
    } finally {
      t.setSaving(false)
    }
  }

  return (
    <div className="sp-form">
      <label><AdminText en="Default language" ar="اللغة الافتراضية" /><SharedSelect value={t.form.defaultLanguage} onChange={(next) => t.setForm((f) => ({ ...f, defaultLanguage: next as EnabledLocale }))} locale={ar ? 'ar' : 'en'} options={ENABLED_LOCALES.map((value) => ({ value, label: LOCALE_LABELS[value] }))} disabled={!canWrite || t.saving} /></label>
      <label><AdminText en="Timezone" ar="المنطقة الزمنية" /><SharedSelect value={t.form.timezone} onChange={(next) => t.setForm((f) => ({ ...f, timezone: next }))} locale={ar ? 'ar' : 'en'} popupWidth="trigger" options={TIMEZONES.map((tz) => ({ value: tz, label: tz }))} disabled={!canWrite || t.saving} /></label>
      <div className="sp-status2">
        <div><small><AdminText en="CURRENT SITE TIME" ar="توقيت الموقع الحالي" /></small><SiteClock timezone={t.form.timezone} /></div>
        <div><small><AdminText en="SCOPE" ar="النطاق" /></small><b><AdminText en="New visitors + timestamps" ar="الزوار الجدد + الطوابع الزمنية" /></b></div>
      </div>
      {!canWrite && <ReadOnlyNote />}
      <div><button type="button" className="sp-btn dark" onClick={save} disabled={!canWrite || t.saving}>{t.saving ? <AdminText en="Saving…" ar="جارٍ الحفظ…" /> : <AdminText en="Save" ar="حفظ" />}</button></div>
      <SaveFeedback saved={t.saved} error={t.error} />
    </div>
  )
}

function SocialTab({ snapshot, canWrite, onSaved }: TabShell) {
  const ar = useAdminLocale() === 'ar'
  const initialLinks = (): SocialLink[] => {
    const raw = snapshot?.values['social.links']
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as SocialLink[]
        if (Array.isArray(parsed) && parsed.length) return parsed
      } catch { /* fall through to defaults */ }
    }
    return defaultSocialLinks
  }
  const t = useTabState(snapshot, () => ({ links: initialLinks() }))
  const links = t.form.links
  const setLinks = (next: SocialLink[]) => t.setForm({ links: next })

  const update = (id: string, patch: Partial<SocialLink>) =>
    setLinks(links.map((link) => (link.id === id ? { ...link, ...patch } : link)))

  const remove = (id: string) => setLinks(links.filter((link) => link.id !== id))

  const add = (section: 'header' | 'footer') => {
    const nextLink: SocialLink = {
      id: `soc-${Date.now().toString(36)}`,
      network: 'facebook',
      url: '',
      header: section === 'header',
      footer: section === 'footer',
    }
    setLinks([...links, nextLink])
  }

  const save = async () => {
    t.setSaving(true)
    t.setError('')
    t.setSaved('')
    try {
      const clean = links.filter((link) => link.url.trim())
      const next = await patchSettings({ 'social.links': JSON.stringify(clean) })
      onSaved(next)
      t.setSaved(ar ? 'تم الحفظ بنجاح.' : 'Saved successfully.')
    } catch (e) {
      t.setError(e instanceof Error ? e.message : 'Save failed.')
    } finally {
      t.setSaving(false)
    }
  }

  const group = (section: 'header' | 'footer', titleEn: string, titleAr: string, hintEn: string, hintAr: string) => (
    <>
      <p className="sp-group-title"><AdminText en={titleEn} ar={titleAr} /></p>
      <p style={{ margin: '-6px 0 4px', color: 'var(--sp-muted)', fontSize: 12 }}><AdminText en={hintEn} ar={hintAr} /></p>
      {links.filter((link) => link[section]).map((link) => (
        <div className="sp-form-2" key={link.id}>
          <label><AdminText en="Network" ar="الشبكة" />
            <SharedSelect value={link.network} onChange={(next) => update(link.id, { network: next as SocialLink['network'] })} locale={ar ? 'ar' : 'en'} options={SOCIAL_NETWORKS.map((n) => ({ value: n.id, label: n.label }))} disabled={!canWrite || t.saving} />
          </label>
          <label><AdminText en="Profile link" ar="رابط الحساب" />
            <span style={{ display: 'flex', gap: 8 }}>
              <input value={link.url} onChange={(e) => update(link.id, { url: e.target.value })} placeholder="https://..." dir="ltr" style={{ flex: 1 }} disabled={!canWrite || t.saving} />
              <button type="button" className="sp-delete-btn" onClick={() => remove(link.id)} disabled={!canWrite || t.saving}><AdminText en="Delete" ar="حذف" /></button>
            </span>
          </label>
        </div>
      ))}
      <div><button type="button" className="sp-btn" onClick={() => add(section)} disabled={!canWrite || t.saving}><Plus size={16} /> <AdminText en="Add link" ar="إضافة رابط" /></button></div>
    </>
  )

  return (
    <div className="sp-form">
      {group('header', 'Header top bar', 'شريط الهيدر العلوي', 'Shown beside the header actions', 'تظهر بجانب أزرار الهيدر')}
      {group('footer', 'Footer', 'الفوتر', 'Shown under the footer logo', 'تظهر تحت شعار الفوتر')}
      {!canWrite && <ReadOnlyNote />}
      <div><button type="button" className="sp-btn dark" onClick={save} disabled={!canWrite || t.saving}>{t.saving ? <AdminText en="Saving…" ar="جارٍ الحفظ…" /> : <AdminText en="Save" ar="حفظ" />}</button></div>
      <SaveFeedback saved={t.saved} error={t.error} />
    </div>
  )
}

function GeneralTab({ snapshot, canWrite, onSaved }: TabShell) {
  const ar = useAdminLocale() === 'ar'
  const t = useTabState(snapshot, (snap) => ({
    companyName: val(snap, 'site.name', defaultBrandSettings.companyName),
    logo: val(snap, 'site.logo', defaultBrandSettings.logo),
    favicon: val(snap, 'site.favicon', defaultBrandSettings.favicon),
    aboutEn: val(snap, 'site.aboutEn', defaultBrandSettings.aboutEn),
    aboutAr: val(snap, 'site.aboutAr', defaultBrandSettings.aboutAr),
  }))

  const save = async () => {
    t.setSaving(true)
    t.setError('')
    t.setSaved('')
    try {
      const next = await patchSettings({
        'site.name': t.form.companyName.trim() || defaultBrandSettings.companyName,
        'site.logo': t.form.logo.trim() || defaultBrandSettings.logo,
        'site.favicon': t.form.favicon.trim() || defaultBrandSettings.favicon,
        'site.aboutEn': t.form.aboutEn.trim(),
        'site.aboutAr': t.form.aboutAr.trim(),
      })
      onSaved(next)
      t.setSaved(ar ? 'تم الحفظ بنجاح.' : 'Saved successfully.')
    } catch (e) {
      t.setError(e instanceof Error ? e.message : 'Save failed.')
    } finally {
      t.setSaving(false)
    }
  }

  return (
    <div className="sp-form">
      <label><AdminText en="Company name" ar="اسم الشركة" /><input value={t.form.companyName} onChange={(e) => t.setForm((f) => ({ ...f, companyName: e.target.value }))} disabled={!canWrite || t.saving} /></label>
      <p className="sp-group-title"><AdminText en="Logo" ar="الشعار" /></p>
      <ImageField value={t.form.logo} onChange={(logo) => t.setForm((f) => ({ ...f, logo }))} />
      <p className="sp-group-title"><AdminText en="Favicon" ar="أيقونة الموقع" /></p>
      <ImageField value={t.form.favicon} onChange={(favicon) => t.setForm((f) => ({ ...f, favicon }))} />
      <p className="sp-group-title"><AdminText en="Footer tagline (under the logo)" ar="سطر الفوتر (تحت الشعار)" /></p>
      <label><AdminText en="About (EN)" ar="الوصف (EN)" /><input value={t.form.aboutEn} onChange={(e) => t.setForm((f) => ({ ...f, aboutEn: e.target.value }))} dir="ltr" disabled={!canWrite || t.saving} /></label>
      <label><AdminText en="About (AR)" ar="الوصف (AR)" /><input value={t.form.aboutAr} onChange={(e) => t.setForm((f) => ({ ...f, aboutAr: e.target.value }))} disabled={!canWrite || t.saving} /></label>
      {!canWrite && <ReadOnlyNote />}
      <div><button type="button" className="sp-btn dark" onClick={save} disabled={!canWrite || t.saving}>{t.saving ? <AdminText en="Saving…" ar="جارٍ الحفظ…" /> : <AdminText en="Save" ar="حفظ" />}</button></div>
      <SaveFeedback saved={t.saved} error={t.error} />
    </div>
  )
}

function ContactTab({ snapshot, canWrite, onSaved }: TabShell) {
  const ar = useAdminLocale() === 'ar'
  const t = useTabState(snapshot, (snap) => ({
    phone: val(snap, 'contact.phone', defaultBrandSettings.phone),
    whatsapp: val(snap, 'contact.whatsapp', defaultBrandSettings.whatsapp),
    email: val(snap, 'contact.email', defaultBrandSettings.email),
    address: val(snap, 'contact.address', defaultBrandSettings.address),
    mapUrl: val(snap, 'contact.mapUrl', defaultBrandSettings.mapUrl),
    copyrightEn: val(snap, 'contact.copyrightEn', defaultBrandSettings.copyrightEn),
    copyrightAr: val(snap, 'contact.copyrightAr', defaultBrandSettings.copyrightAr),
  }))

  const save = async () => {
    t.setSaving(true)
    t.setError('')
    t.setSaved('')
    try {
      // Normalize through canonical helpers so stored values never duplicate
      // the dial prefix (e.g. no `+20 01288…`). Country context is derived
      // from the number itself; unknown input stays conservative.
      const phoneDigits = toInternational(countryFromPhone(t.form.phone).code, t.form.phone)
      const whatsappDigits = toInternational(countryFromPhone(t.form.whatsapp).code, t.form.whatsapp)
      const values = {
        'contact.phone': phoneDigits || t.form.phone.trim(),
        'contact.whatsapp': whatsappDigits || t.form.whatsapp.trim(),
        'contact.email': t.form.email.trim(),
        'contact.address': t.form.address.trim(),
        'contact.mapUrl': t.form.mapUrl.trim(),
        'contact.copyrightEn': t.form.copyrightEn.trim(),
        'contact.copyrightAr': t.form.copyrightAr.trim(),
      }
      const next = await patchSettings(values)
      onSaved(next)
      t.setSaved(ar ? 'تم الحفظ بنجاح.' : 'Saved successfully.')
    } catch (e) {
      t.setError(e instanceof Error ? e.message : 'Save failed.')
    } finally {
      t.setSaving(false)
    }
  }

  return <div className="sp-form">
    <div className="sp-form-2">
      <label><AdminText en="Phone number" ar="رقم الهاتف" /><InternationalPhoneInput value={t.form.phone} onChange={(phone) => t.setForm((f) => ({ ...f, phone }))} locale={ar ? 'ar' : 'en'} required /></label>
      <label><AdminText en="WhatsApp number" ar="رقم واتساب" /><InternationalPhoneInput value={t.form.whatsapp} onChange={(whatsapp) => t.setForm((f) => ({ ...f, whatsapp }))} locale={ar ? 'ar' : 'en'} required /></label>
    </div>
    <label><AdminText en="Public email" ar="البريد الإلكتروني العام" /><input type="email" value={t.form.email} onChange={(e) => t.setForm((f) => ({ ...f, email: e.target.value }))} dir="ltr" required disabled={!canWrite || t.saving} /></label>
    <label><AdminText en="Company address" ar="عنوان الشركة" /><input value={t.form.address} onChange={(e) => t.setForm((f) => ({ ...f, address: e.target.value }))} required disabled={!canWrite || t.saving} /></label>
    <label><AdminText en="Google Maps URL" ar="رابط خرائط جوجل" /><input type="url" value={t.form.mapUrl} onChange={(e) => t.setForm((f) => ({ ...f, mapUrl: e.target.value }))} dir="ltr" placeholder="https://maps.google.com/..." disabled={!canWrite || t.saving} /></label>
    <p className="sp-group-title"><AdminText en="Footer copyright" ar="حقوق النشر في الفوتر" /></p>
    <label><AdminText en="Copyright (EN)" ar="حقوق النشر (EN)" /><input value={t.form.copyrightEn} onChange={(e) => t.setForm((f) => ({ ...f, copyrightEn: e.target.value }))} dir="ltr" required disabled={!canWrite || t.saving} /></label>
    <label><AdminText en="Copyright (AR)" ar="حقوق النشر (AR)" /><input value={t.form.copyrightAr} onChange={(e) => t.setForm((f) => ({ ...f, copyrightAr: e.target.value }))} dir="rtl" required disabled={!canWrite || t.saving} /></label>
    {!canWrite && <ReadOnlyNote />}
    <div><button type="button" className="sp-btn dark" onClick={save} disabled={!canWrite || t.saving}>{t.saving ? <AdminText en="Saving…" ar="جارٍ الحفظ…" /> : <AdminText en="Save contact details" ar="حفظ بيانات التواصل" />}</button></div>
    <SaveFeedback saved={t.saved} error={t.error} />
  </div>
}

function CurrencyTab({ snapshot, canWrite, onSaved }: TabShell) {
  const ar = useAdminLocale() === 'ar'
  const t = useTabState(snapshot, (snap) => ({
    eur: snap?.rates.eur ?? String(defaultCurrencySettings.eur),
    egp: snap?.rates.egp ?? String(defaultCurrencySettings.egp),
    defaultCurrency: (val(snap, 'app.defaultCurrency', defaultCurrencySettings.defaultCurrency) as 'USD' | 'EUR' | 'EGP'),
  }))

  const eurNum = Number(t.form.eur)
  const egpNum = Number(t.form.egp)
  const previewUsd = 120

  const save = async () => {
    t.setSaving(true)
    t.setError('')
    t.setSaved('')
    if (!(eurNum > 0) || !(egpNum > 0)) {
      t.setError(ar ? 'أدخل أسعارا أكبر من الصفر.' : 'Enter rates greater than zero.')
      t.setSaving(false)
      return
    }
    try {
      const next = await patchSettings(
        { 'app.defaultCurrency': t.form.defaultCurrency },
        { eur: t.form.eur.trim(), egp: t.form.egp.trim() },
      )
      onSaved(next)
      t.setSaved(ar ? 'تم الحفظ بنجاح.' : 'Saved successfully.')
    } catch (e) {
      t.setError(e instanceof Error ? e.message : 'Save failed.')
    } finally {
      t.setSaving(false)
    }
  }

  const reset = async () => {
    t.setSaving(true)
    t.setError('')
    t.setSaved('')
    try {
      const next = await patchSettings(
        { 'app.defaultCurrency': defaultCurrencySettings.defaultCurrency },
        { eur: String(defaultCurrencySettings.eur), egp: String(defaultCurrencySettings.egp) },
      )
      onSaved(next)
      t.setSaved(ar ? 'تم الحفظ بنجاح.' : 'Saved successfully.')
    } catch (e) {
      t.setError(e instanceof Error ? e.message : 'Save failed.')
    } finally {
      t.setSaving(false)
    }
  }

  return (
    <div className="sp-form">
      <div className="sp-status2">
        <div><small><AdminText en="BASE CURRENCY" ar="العملة الأساسية" /></small><b>USD · 1</b></div>
        <div><small><AdminText en="RATE SOURCE" ar="مصدر الأسعار" /></small><b><AdminText en="Manual (DB-backed)" ar="يدوي (مدعوم بقاعدة البيانات)" /></b></div>
      </div>
      <p className="sp-group-title"><AdminText en="Conversion rates (per 1 USD)" ar="أسعار التحويل (لكل 1 دولار)" /></p>
      <div className="sp-form-2">
        <label><AdminText en="Euro (EUR)" ar="اليورو (EUR)" /><input type="number" min="0" step="0.01" value={t.form.eur} onChange={(e) => t.setForm((f) => ({ ...f, eur: e.target.value }))} dir="ltr" disabled={!canWrite || t.saving} /></label>
        <label><AdminText en="Egyptian Pound (EGP)" ar="الجنيه المصري (EGP)" /><input type="number" min="0" step="0.5" value={t.form.egp} onChange={(e) => t.setForm((f) => ({ ...f, egp: e.target.value }))} dir="ltr" disabled={!canWrite || t.saving} /></label>
      </div>
      <label><AdminText en="Default currency" ar="العملة الافتراضية" /><SharedSelect value={t.form.defaultCurrency} onChange={(next) => t.setForm((f) => ({ ...f, defaultCurrency: next as 'USD' | 'EUR' | 'EGP' }))} locale={ar ? 'ar' : 'en'} options={[{ value: 'USD', label: 'USD' }, { value: 'EUR', label: 'EUR' }, { value: 'EGP', label: 'EGP' }]} disabled={!canWrite || t.saving} /></label>
      <p className="sp-group-title"><AdminText en="Live preview ($120 tour)" ar="معاينة حية (رحلة بـ 120 دولارا)" /></p>
      <div className="sp-status2">
        <div><small>USD</small><b>${(previewUsd).toLocaleString('en-US')}</b></div>
        <div><small>EUR</small><b>€{(eurNum > 0 ? previewUsd * eurNum : 0).toLocaleString('en-US')}</b></div>
      </div>
      <div className="sp-status2" style={{ marginTop: 12 }}>
        <div><small>EGP</small><b>{Math.round(egpNum > 0 ? previewUsd * egpNum : 0).toLocaleString('en-US')} £</b></div>
        <div><small><AdminText en="SCOPE" ar="النطاق" /></small><b><AdminText en="Every website price" ar="كل أسعار الموقع" /></b></div>
      </div>
      <p className="sp-integration-note"><AdminText en="Rates are manual. No live FX integration exists in this phase." ar="الأسعار يدوية. لا يوجد تكامل مباشر لأسعار الصرف في هذه المرحلة." /></p>
      {!canWrite && <ReadOnlyNote />}
      <SaveFeedback saved={t.saved} error={t.error} />
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button type="button" className="sp-btn" onClick={reset} disabled={!canWrite || t.saving}><AdminText en="Reset defaults" ar="استعادة الافتراضية" /></button>
        <button type="button" className="sp-btn dark" onClick={save} disabled={!canWrite || t.saving}>{t.saving ? <AdminText en="Saving…" ar="جارٍ الحفظ…" /> : <AdminText en="Save rates" ar="حفظ الأسعار" />}</button>
      </div>
    </div>
  )
}

function WebsiteTab({ snapshot, canWrite, onSaved }: TabShell) {
  const ar = useAdminLocale() === 'ar'
  const t = useTabState(snapshot, (snap) => ({
    seoTitle: val(snap, 'site.seoTitle', FALLBACK_SEO_TITLE),
    promoText: val(snap, 'site.promoText', FALLBACK_PROMO),
  }))

  const save = async () => {
    t.setSaving(true)
    t.setError('')
    t.setSaved('')
    try {
      const next = await patchSettings({
        'site.seoTitle': t.form.seoTitle.trim() || FALLBACK_SEO_TITLE,
        'site.promoText': t.form.promoText.trim() || FALLBACK_PROMO,
      })
      onSaved(next)
      t.setSaved(ar ? 'تم الحفظ بنجاح.' : 'Saved successfully.')
    } catch (e) {
      t.setError(e instanceof Error ? e.message : 'Save failed.')
    } finally {
      t.setSaving(false)
    }
  }

  return (
    <div className="sp-form">
      <label><AdminText en="SEO title" ar="عنوان SEO" /><input value={t.form.seoTitle} onChange={(e) => t.setForm((f) => ({ ...f, seoTitle: e.target.value }))} dir="ltr" disabled={!canWrite || t.saving} /></label>
      <label><AdminText en="Promo bar text" ar="نص الشريط الترويجي" /><textarea rows={2} value={t.form.promoText} onChange={(e) => t.setForm((f) => ({ ...f, promoText: e.target.value }))} dir="ltr" disabled={!canWrite || t.saving} /></label>
      {!canWrite && <ReadOnlyNote />}
      <div><button type="button" className="sp-btn dark" onClick={save} disabled={!canWrite || t.saving}>{t.saving ? <AdminText en="Saving…" ar="جارٍ الحفظ…" /> : <AdminText en="Save" ar="حفظ" />}</button></div>
      <SaveFeedback saved={t.saved} error={t.error} />
    </div>
  )
}

function EmailTab({ snapshot, canWrite, onSaved }: TabShell) {
  const ar = useAdminLocale() === 'ar'
  const t = useTabState(snapshot, (snap) => ({
    fromName: val(snap, 'mail.fromName', 'Star Pyramids Tours'),
    fromEmail: val(snap, 'mail.fromEmail', 'sales@starpyramids.com'),
    smtpHost: val(snap, 'mail.smtpHost', 'smtp.hostinger.com'),
    smtpPort: val(snap, 'mail.smtpPort', '465'),
    smtpEncryption: val(snap, 'mail.smtpEncryption', 'SSL'),
    smtpUsername: val(snap, 'mail.smtpUsername', 'sales@starpyramids.com'),
    smtpPassword: '',
    smtpTimeout: val(snap, 'mail.smtpTimeout', '30'),
    imapProtocol: val(snap, 'mail.imapProtocol', 'IMAP'),
    imapHost: val(snap, 'mail.imapHost', 'imap.hostinger.com'),
    imapPort: val(snap, 'mail.imapPort', '993'),
    imapEncryption: val(snap, 'mail.imapEncryption', 'SSL'),
    imapUsername: val(snap, 'mail.imapUsername', 'sales@starpyramids.com'),
    imapPassword: '',
    mailbox: val(snap, 'mail.mailbox', 'INBOX'),
  }))

  const outgoingReady = t.form.smtpHost.trim() !== '' && t.form.smtpUsername.trim() !== ''
  const incomingReady = t.form.imapHost.trim() !== '' && t.form.imapUsername.trim() !== ''

  const save = async () => {
    t.setSaving(true)
    t.setError('')
    t.setSaved('')
    try {
      const next = await patchSettings({
        'mail.fromName': t.form.fromName.trim(),
        'mail.fromEmail': t.form.fromEmail.trim(),
        'mail.smtpHost': t.form.smtpHost.trim(),
        'mail.smtpPort': t.form.smtpPort.trim(),
        'mail.smtpEncryption': t.form.smtpEncryption,
        'mail.smtpUsername': t.form.smtpUsername.trim(),
        'mail.smtpPassword': t.form.smtpPassword,
        'mail.smtpTimeout': t.form.smtpTimeout.trim(),
        'mail.imapProtocol': t.form.imapProtocol,
        'mail.imapHost': t.form.imapHost.trim(),
        'mail.imapPort': t.form.imapPort.trim(),
        'mail.imapEncryption': t.form.imapEncryption,
        'mail.imapUsername': t.form.imapUsername.trim(),
        'mail.imapPassword': t.form.imapPassword,
        'mail.mailbox': t.form.mailbox.trim() || 'INBOX',
      })
      onSaved(next)
      t.setSaved(ar ? 'تم حفظ الإعدادات. لم يتم التحقق من الاتصال بعد.' : 'Configuration saved. Connection not verified yet.')
    } catch (e) {
      t.setError(e instanceof Error ? e.message : 'Save failed.')
    } finally {
      t.setSaving(false)
    }
  }

  return (
    <div className="sp-form">
      <div className="sp-status2">
        <div><small><AdminText en="OUTGOING EMAIL" ar="البريد الصادر" /></small><b>{outgoingReady ? <AdminText en="Saved" ar="محفوظ" /> : <AdminText en="Not configured" ar="غير مضبوط" />}</b><small style={{ color: 'var(--sp-muted)' }}><AdminText en="Connection: not verified" ar="الاتصال: لم يتم التحقق" /></small></div>
        <div><small><AdminText en="INCOMING EMAIL" ar="البريد الوارد" /></small><b>{incomingReady ? <AdminText en="Saved" ar="محفوظ" /> : <AdminText en="Not configured" ar="غير مضبوط" />}</b><small style={{ color: 'var(--sp-muted)' }}><AdminText en="Connection: not verified" ar="الاتصال: لم يتم التحقق" /></small></div>
      </div>
      <p className="sp-group-title"><AdminText en="Sender Identity" ar="هوية المرسل" /></p>
      <div className="sp-form-2">
        <label><AdminText en="From Name" ar="اسم المرسل" /><input value={t.form.fromName} onChange={(e) => t.setForm((f) => ({ ...f, fromName: e.target.value }))} disabled={!canWrite || t.saving} /></label>
        <label><AdminText en="From Email" ar="بريد المرسل" /><input type="email" value={t.form.fromEmail} onChange={(e) => t.setForm((f) => ({ ...f, fromEmail: e.target.value }))} dir="ltr" disabled={!canWrite || t.saving} /></label>
      </div>
      <p className="sp-group-title"><AdminText en="Outgoing Email - SMTP" ar="البريد الصادر - SMTP" /></p>
      <div className="sp-form-2">
        <label><AdminText en="SMTP Host" ar="مضيف SMTP" /><input value={t.form.smtpHost} onChange={(e) => t.setForm((f) => ({ ...f, smtpHost: e.target.value }))} dir="ltr" disabled={!canWrite || t.saving} /></label>
        <label><AdminText en="SMTP Port" ar="منفذ SMTP" /><input value={t.form.smtpPort} inputMode="numeric" onChange={(e) => t.setForm((f) => ({ ...f, smtpPort: e.target.value }))} dir="ltr" disabled={!canWrite || t.saving} /></label>
      </div>
      <div className="sp-form-2">
        <label><AdminText en="Encryption" ar="التشفير" /><SharedSelect value={t.form.smtpEncryption} onChange={(next) => t.setForm((f) => ({ ...f, smtpEncryption: next }))} locale={ar ? 'ar' : 'en'} options={[{ value: 'SSL', label: 'SSL' }, { value: 'TLS', label: 'TLS' }, { value: 'None', label: 'None' }]} disabled={!canWrite || t.saving} /></label>
        <label><AdminText en="SMTP Username" ar="اسم مستخدم SMTP" /><input value={t.form.smtpUsername} onChange={(e) => t.setForm((f) => ({ ...f, smtpUsername: e.target.value }))} dir="ltr" disabled={!canWrite || t.saving} /></label>
      </div>
      <div className="sp-form-2">
        <SecretField labelEn="SMTP Password" labelAr="كلمة مرور SMTP" value={t.form.smtpPassword} onChange={(smtpPassword) => t.setForm((f) => ({ ...f, smtpPassword }))} configured={secretConfigured(snapshot, 'mail.smtpPassword')} disabled={!canWrite || t.saving} />
        <label><AdminText en="Timeout (seconds)" ar="المهلة (بالثواني)" /><input value={t.form.smtpTimeout} inputMode="numeric" onChange={(e) => t.setForm((f) => ({ ...f, smtpTimeout: e.target.value }))} dir="ltr" disabled={!canWrite || t.saving} /></label>
      </div>
      <p className="sp-group-title"><AdminText en="Incoming Email - IMAP / POP3" ar="البريد الوارد - IMAP / POP3" /></p>
      <div className="sp-form-2">
        <label><AdminText en="Protocol" ar="البروتوكول" /><SharedSelect value={t.form.imapProtocol} onChange={(next) => t.setForm((f) => ({ ...f, imapProtocol: next }))} locale={ar ? 'ar' : 'en'} options={[{ value: 'IMAP', label: 'IMAP' }, { value: 'POP3', label: 'POP3' }]} disabled={!canWrite || t.saving} /></label>
        <label><AdminText en="Incoming Host" ar="المضيف الوارد" /><input value={t.form.imapHost} onChange={(e) => t.setForm((f) => ({ ...f, imapHost: e.target.value }))} dir="ltr" disabled={!canWrite || t.saving} /></label>
      </div>
      <div className="sp-form-2">
        <label><AdminText en="Incoming Port" ar="المنفذ الوارد" /><input value={t.form.imapPort} inputMode="numeric" onChange={(e) => t.setForm((f) => ({ ...f, imapPort: e.target.value }))} dir="ltr" disabled={!canWrite || t.saving} /></label>
        <label><AdminText en="Encryption" ar="التشفير" /><SharedSelect value={t.form.imapEncryption} onChange={(next) => t.setForm((f) => ({ ...f, imapEncryption: next }))} locale={ar ? 'ar' : 'en'} options={[{ value: 'SSL', label: 'SSL' }, { value: 'TLS', label: 'TLS' }]} disabled={!canWrite || t.saving} /></label>
      </div>
      <div className="sp-form-2">
        <label><AdminText en="Incoming Username" ar="اسم المستخدم الوارد" /><input value={t.form.imapUsername} onChange={(e) => t.setForm((f) => ({ ...f, imapUsername: e.target.value }))} dir="ltr" disabled={!canWrite || t.saving} /></label>
        <SecretField labelEn="Incoming Password" labelAr="كلمة المرور الواردة" value={t.form.imapPassword} onChange={(imapPassword) => t.setForm((f) => ({ ...f, imapPassword }))} configured={secretConfigured(snapshot, 'mail.imapPassword')} disabled={!canWrite || t.saving} />
      </div>
      <label><AdminText en="Mailbox / Folder" ar="الصندوق / المجلد" /><input value={t.form.mailbox} onChange={(e) => t.setForm((f) => ({ ...f, mailbox: e.target.value }))} dir="ltr" disabled={!canWrite || t.saving} /></label>
      <p className="sp-integration-note"><ShieldCheck size={15} /> <AdminText en="Passwords stay on the server and are never shown again. Live send/receive testing requires the mail integration phase — saving here stores configuration only." ar="تبقى كلمات المرور في الخادم ولا تظهر مجددا. يتطلب اختبار الإرسال والاستلام الحي مرحلة تكامل البريد — الحفظ هنا يخزن الإعدادات فقط." /></p>
      {!canWrite && <ReadOnlyNote />}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button type="button" className="sp-btn" disabled title={ar ? 'يتطلب مرحلة تكامل البريد' : 'Requires the mail integration phase'}><AdminText en="Test connection" ar="اختبار الاتصال" /></button>
        <button type="button" className="sp-btn dark" onClick={save} disabled={!canWrite || t.saving}>{t.saving ? <AdminText en="Saving…" ar="جارٍ الحفظ…" /> : <AdminText en="Save" ar="حفظ" />}</button>
      </div>
      <SaveFeedback saved={t.saved} error={t.error} />
    </div>
  )
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

function IntegrationStatus({ label }: { label?: React.ReactNode }) {
  return <span className="sp-integration-status"><i aria-hidden="true" />{label ?? <AdminText en="Backend pending" ar="الباك إند معلق" />}</span>
}

function IntegrationToggle({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  return <button type="button" role="switch" aria-checked={checked} className={cn('sp-integration-toggle', checked && 'active')} onClick={onChange} disabled={disabled}><span className="sp-toggle-track" aria-hidden="true" /><span className="sp-toggle-label">{checked ? <AdminText en="Enabled" ar="مفعل" /> : <AdminText en="Disabled" ar="معطل" />}</span></button>
}

function PendingNote({ children }: { children: React.ReactNode }) {
  return <p className="sp-integration-note"><PlugZap size={15} /> {children}</p>
}

function WhatsAppTab({ snapshot, canWrite, onSaved }: TabShell) {
  const ar = useAdminLocale() === 'ar'
  const t = useTabState(snapshot, (snap) => ({
    enabled: val(snap, 'whatsapp.enabled', 'true') === 'true',
    sessionName: val(snap, 'whatsapp.sessionName', 'Star Pyramids Support'),
    inbox: val(snap, 'whatsapp.inbox', 'main'),
    metaAppId: val(snap, 'whatsapp.metaAppId', ''),
    wabaId: val(snap, 'whatsapp.wabaId', ''),
    phoneNumberId: val(snap, 'whatsapp.phoneNumberId', ''),
    accessToken: '',
    verifyToken: '',
  }))

  const save = async () => {
    t.setSaving(true)
    t.setError('')
    t.setSaved('')
    try {
      const next = await patchSettings({
        'whatsapp.enabled': t.form.enabled ? 'true' : 'false',
        'whatsapp.sessionName': t.form.sessionName.trim() || 'Star Pyramids Support',
        'whatsapp.inbox': t.form.inbox,
        'whatsapp.metaAppId': t.form.metaAppId.trim(),
        'whatsapp.wabaId': t.form.wabaId.trim(),
        'whatsapp.phoneNumberId': t.form.phoneNumberId.trim(),
        'whatsapp.accessToken': t.form.accessToken,
        'whatsapp.verifyToken': t.form.verifyToken,
      })
      onSaved(next)
      t.setSaved(ar ? 'تم حفظ الإعدادات. الاتصال لم يتم التحقق منه بعد.' : 'Configuration saved. Connection not verified yet.')
    } catch (e) {
      t.setError(e instanceof Error ? e.message : 'Save failed.')
    } finally {
      t.setSaving(false)
    }
  }

  return (
    <div className="sp-integration-page">
      <div className="sp-integration-summary">
        <span className="sp-integration-icon green"><WhatsAppGlyph size={22} /></span>
        <div className="sp-integration-copy"><strong><AdminText en="WhatsApp messaging" ar="مراسلات واتساب" /></strong><p><AdminText en="Choose one connection method. Messages will appear in the unified Inbox after the backend is connected." ar="اختر طريقة ربط واحدة. ستظهر الرسائل في صندوق المراسلة الموحد بعد ربط الواجهة الخلفية." /></p></div>
        <div className="sp-integration-controls"><IntegrationStatus label={<AdminText en="Not connected" ar="غير متصل" />} /><IntegrationToggle checked={t.form.enabled} onChange={() => t.setForm((f) => ({ ...f, enabled: !f.enabled }))} disabled={!canWrite || t.saving} /></div>
      </div>

      <div className="sp-method-grid">
        <section className="sp-method-card">
          <header><span className="sp-integration-icon"><QrCode size={21} /></span><div><h3><AdminText en="QR Session" ar="جلسة QR" /></h3><p><AdminText en="Connect an existing WhatsApp device session." ar="اربط جلسة جهاز واتساب موجودة." /></p></div></header>
          <div className="sp-qr-preview" aria-label={ar ? 'عنصر نائب لرمز QR' : 'QR code placeholder'}>
            <QrCode size={76} strokeWidth={1.25} />
            <strong><AdminText en="No active session" ar="لا توجد جلسة نشطة" /></strong>
            <small><AdminText en="QR generation requires the backend session provider (pending)" ar="يتطلب توليد QR مزود الجلسات الخلفي (معلق)" /></small>
          </div>
          <div className="sp-form">
            <label><AdminText en="Session name" ar="اسم الجلسة" /><input value={t.form.sessionName} onChange={(e) => t.setForm((f) => ({ ...f, sessionName: e.target.value }))} disabled={!canWrite || t.saving} /></label>
            <label><AdminText en="Assigned inbox" ar="الصندوق المعين" /><SharedSelect value={t.form.inbox} onChange={(next) => t.setForm((f) => ({ ...f, inbox: next }))} locale={ar ? 'ar' : 'en'} options={[{ value: 'main', label: ar ? 'صندوق واتساب الرئيسي' : 'Main WhatsApp Inbox' }, { value: 'sales', label: ar ? 'فريق المبيعات' : 'Sales Team' }]} disabled={!canWrite || t.saving} /></label>
          </div>
          <button type="button" className="sp-btn primary" disabled title={ar ? 'يتطلب مزود الجلسات الخلفي (معلق)' : 'Requires the backend session provider (pending)'}><QrCode size={17} /> <AdminText en="Generate QR code" ar="توليد رمز QR" /></button>
          <p className="sp-integration-note"><AdminText en="This method requires a backend session provider. It is separate from Meta Cloud API and must be reviewed before production use." ar="تتطلب هذه الطريقة مزود جلسات خلفيا. وهي منفصلة عن واجهة Meta Cloud ويجب مراجعتها قبل الإنتاج." /></p>
        </section>

        <section className="sp-method-card featured">
          <header><span className="sp-integration-icon blue"><Cloud size={21} /></span><div><h3><AdminText en="Official Cloud API" ar="واجهة Cloud الرسمية" /></h3><p><AdminText en="Recommended Meta WhatsApp Business connection." ar="ربط Meta WhatsApp Business الموصى به." /></p></div><span className="sp-recommended"><AdminText en="Recommended" ar="موصى به" /></span></header>
          <div className="sp-form">
            <div className="sp-form-2">
              <label><AdminText en="Meta App ID" ar="معرف تطبيق Meta" /><input value={t.form.metaAppId} onChange={(e) => t.setForm((f) => ({ ...f, metaAppId: e.target.value }))} placeholder={ar ? 'أدخل معرف تطبيق Meta' : 'Enter Meta App ID'} dir="ltr" disabled={!canWrite || t.saving} /></label>
              <label><AdminText en="Business Account ID" ar="معرف حساب الأعمال" /><input value={t.form.wabaId} onChange={(e) => t.setForm((f) => ({ ...f, wabaId: e.target.value }))} placeholder={ar ? 'أدخل معرف WABA' : 'Enter WABA ID'} dir="ltr" disabled={!canWrite || t.saving} /></label>
            </div>
            <label><AdminText en="Phone Number ID" ar="معرف رقم الهاتف" /><input value={t.form.phoneNumberId} onChange={(e) => t.setForm((f) => ({ ...f, phoneNumberId: e.target.value }))} placeholder={ar ? 'أدخل معرف رقم الهاتف' : 'Enter Phone Number ID'} dir="ltr" disabled={!canWrite || t.saving} /></label>
            <SecretField labelEn="Access token" labelAr="رمز الوصول" value={t.form.accessToken} onChange={(accessToken) => t.setForm((f) => ({ ...f, accessToken }))} configured={secretConfigured(snapshot, 'whatsapp.accessToken')} disabled={!canWrite || t.saving} />
            <label><AdminText en="Webhook callback" ar="رابط Webhook" /><input value="https://starpyramids.com/api/integrations/whatsapp/webhook" readOnly dir="ltr" /></label>
            <SecretField labelEn="Verify token" labelAr="رمز التحقق" value={t.form.verifyToken} onChange={(verifyToken) => t.setForm((f) => ({ ...f, verifyToken }))} configured={secretConfigured(snapshot, 'whatsapp.verifyToken')} disabled={!canWrite || t.saving} />
          </div>
          <p className="sp-integration-note"><ShieldCheck size={15} /> <AdminText en="Tokens stay on the server and are never shown again. Saving stores configuration only — the provider connection is not verified." ar="تبقى الرموز في الخادم ولا تظهر مجددا. الحفظ يخزن الإعدادات فقط — لم يتم التحقق من اتصال المزود." /></p>
          {!canWrite && <ReadOnlyNote />}
          <div className="sp-integration-actions">
            <button type="button" className="sp-btn dark" onClick={save} disabled={!canWrite || t.saving}>{t.saving ? <AdminText en="Saving…" ar="جارٍ الحفظ…" /> : <AdminText en="Save configuration" ar="حفظ الإعدادات" />}</button>
            <button type="button" className="sp-btn" disabled title={ar ? 'يتطلب رد OAuth الخلفي (معلق)' : 'Requires the backend OAuth callback (pending)'}><PlugZap size={17} /> <AdminText en="Connect with Meta" ar="الربط مع Meta" /></button>
            <button type="button" className="sp-btn" disabled title={ar ? 'يتطلب تكامل المزود (معلق)' : 'Requires the provider integration (pending)'}><AdminText en="Test connection" ar="اختبار الاتصال" /></button>
          </div>
          <SaveFeedback saved={t.saved} error={t.error} />
        </section>
      </div>
    </div>
  )
}

function MapsTab({ snapshot, canWrite, onSaved }: TabShell) {
  const ar = useAdminLocale() === 'ar'
  const t = useTabState(snapshot, (snap) => ({
    enabled: val(snap, 'maps.enabled', 'true') === 'true',
    browserKey: '',
    mapId: val(snap, 'maps.mapId', ''),
    lat: val(snap, 'maps.lat', '29.9870'),
    lng: val(snap, 'maps.lng', '31.2118'),
    zoom: val(snap, 'maps.zoom', '12'),
    services: val(snap, 'maps.services', 'maps-places'),
  }))

  const save = async () => {
    t.setSaving(true)
    t.setError('')
    t.setSaved('')
    try {
      const next = await patchSettings({
        'maps.enabled': t.form.enabled ? 'true' : 'false',
        'maps.browserKey': t.form.browserKey,
        'maps.mapId': t.form.mapId.trim(),
        'maps.lat': t.form.lat.trim(),
        'maps.lng': t.form.lng.trim(),
        'maps.zoom': t.form.zoom.trim(),
        'maps.services': t.form.services,
      })
      onSaved(next)
      t.setSaved(ar ? 'تم حفظ الإعدادات. الخريطة غير متصلة بعد.' : 'Configuration saved. Map not connected yet.')
    } catch (e) {
      t.setError(e instanceof Error ? e.message : 'Save failed.')
    } finally {
      t.setSaving(false)
    }
  }

  return (
    <div className="sp-integration-page">
      <div className="sp-integration-summary">
        <span className="sp-integration-icon red"><MapPinned size={22} /></span>
        <div className="sp-integration-copy"><strong><AdminText en="Google Maps Platform" ar="منصة خرائط جوجل" /></strong><p><AdminText en="Maps, place search and trip location previews across the website." ar="الخرائط والبحث عن الأماكن ومعاينات مواقع الرحلات عبر الموقع." /></p></div>
        <div className="sp-integration-controls"><IntegrationStatus label={<AdminText en="Not connected" ar="غير متصلة" />} /><IntegrationToggle checked={t.form.enabled} onChange={() => t.setForm((f) => ({ ...f, enabled: !f.enabled }))} disabled={!canWrite || t.saving} /></div>
      </div>
      <section className="sp-integration-panel">
        <div className="sp-form">
          <div className="sp-form-2">
            <SecretField labelEn="Browser API key" labelAr="مفتاح API للمتصفح" value={t.form.browserKey} onChange={(browserKey) => t.setForm((f) => ({ ...f, browserKey }))} configured={secretConfigured(snapshot, 'maps.browserKey')} disabled={!canWrite || t.saving} />
            <label><AdminText en="Map ID" ar="معرف الخريطة" /><input value={t.form.mapId} onChange={(e) => t.setForm((f) => ({ ...f, mapId: e.target.value }))} placeholder={ar ? 'معرف خريطة جوجل اختياري' : 'Optional Google Map ID'} dir="ltr" disabled={!canWrite || t.saving} /></label>
          </div>
          <div className="sp-form-2">
            <label><AdminText en="Default latitude" ar="خط العرض الافتراضي" /><input value={t.form.lat} inputMode="decimal" onChange={(e) => t.setForm((f) => ({ ...f, lat: e.target.value }))} dir="ltr" disabled={!canWrite || t.saving} /></label>
            <label><AdminText en="Default longitude" ar="خط الطول الافتراضي" /><input value={t.form.lng} inputMode="decimal" onChange={(e) => t.setForm((f) => ({ ...f, lng: e.target.value }))} dir="ltr" disabled={!canWrite || t.saving} /></label>
          </div>
          <div className="sp-form-2">
            <label><AdminText en="Default zoom" ar="التقريب الافتراضي" /><input type="number" value={t.form.zoom} min="1" max="20" onChange={(e) => t.setForm((f) => ({ ...f, zoom: e.target.value }))} dir="ltr" disabled={!canWrite || t.saving} /></label>
            <label><AdminText en="Enabled services" ar="الخدمات المفعلة" /><SharedSelect value={t.form.services} onChange={(next) => t.setForm((f) => ({ ...f, services: next }))} locale={ar ? 'ar' : 'en'} options={[{ value: 'maps-places', label: ar ? 'الخرائط + الأماكن' : 'Maps + Places' }, { value: 'maps', label: ar ? 'الخرائط فقط' : 'Maps only' }, { value: 'maps-places-geocoding', label: ar ? 'الخرائط + الأماكن + الترميز' : 'Maps + Places + Geocoding' }]} disabled={!canWrite || t.saving} /></label>
          </div>
        </div>
        <p className="sp-integration-note"><ShieldCheck size={15} /> <AdminText en="The API key stays on the server and is never shown again. Restrict the browser key to the production domain and only the required Google APIs." ar="يبقى مفتاح API في الخادم ولا يظهر مجددا. قيد مفتاح المتصفح على نطاق الإنتاج وواجهات جوجل المطلوبة فقط." /></p>
        {!canWrite && <ReadOnlyNote />}
        <div className="sp-integration-actions">
          <button type="button" className="sp-btn primary" onClick={save} disabled={!canWrite || t.saving}>{t.saving ? <AdminText en="Saving…" ar="جارٍ الحفظ…" /> : <AdminText en="Save configuration" ar="حفظ الإعدادات" />}</button>
          <button type="button" className="sp-btn" disabled title={ar ? 'يتطلب مفتاحا مقيدا صالحا (معلق)' : 'Requires a valid restricted key (pending)'}><AdminText en="Test map" ar="اختبار الخريطة" /></button>
        </div>
        <SaveFeedback saved={t.saved} error={t.error} />
      </section>
    </div>
  )
}

function OAuthTab({ provider, snapshot, canWrite, onSaved }: TabShell & { provider: 'google' | 'facebook' }) {
  const ar = useAdminLocale() === 'ar'
  const isGoogle = provider === 'google'
  const idKey = isGoogle ? 'auth.google.clientId' : 'auth.facebook.appId'
  const secretKey = isGoogle ? 'auth.google.clientSecret' : 'auth.facebook.appSecret'
  const enabledKey = isGoogle ? 'auth.google.enabled' : 'auth.facebook.enabled'
  const t = useTabState(snapshot, (snap) => ({
    enabled: val(snap, enabledKey, 'true') === 'true',
    clientId: val(snap, idKey, ''),
    clientSecret: '',
  }))

  const save = async () => {
    t.setSaving(true)
    t.setError('')
    t.setSaved('')
    try {
      const next = await patchSettings({
        [enabledKey]: t.form.enabled ? 'true' : 'false',
        [idKey]: t.form.clientId.trim(),
        [secretKey]: t.form.clientSecret,
      })
      onSaved(next)
      t.setSaved(ar ? 'تم حفظ الإعدادات. تسجيل الدخول غير مفعل بعد.' : 'Configuration saved. Social login not live yet.')
    } catch (e) {
      t.setError(e instanceof Error ? e.message : 'Save failed.')
    } finally {
      t.setSaving(false)
    }
  }

  return (
    <div className="sp-integration-page">
      <div className="sp-integration-summary">
        <span className={cn('sp-integration-icon', isGoogle ? 'red' : 'facebook')}>{isGoogle ? <GoogleIcon size={22} /> : <FacebookIcon size={22} />}</span>
        <div className="sp-integration-copy"><strong>{isGoogle ? <AdminText en="Google customer login" ar="تسجيل دخول العملاء بجوجل" /> : <AdminText en="Facebook customer login" ar="تسجيل دخول العملاء بفيسبوك" />}</strong><p>{isGoogle ? <AdminText en="Allow customers to create or access their account with Google." ar="اسمح للعملاء بإنشاء حساباتهم أو الوصول إليها بجوجل." /> : <AdminText en="Allow customers to create or access their account with Facebook." ar="اسمح للعملاء بإنشاء حساباتهم أو الوصول إليها بفيسبوك." />}</p></div>
        <div className="sp-integration-controls"><IntegrationStatus label={<AdminText en="Not connected" ar="غير متصل" />} /><IntegrationToggle checked={t.form.enabled} onChange={() => t.setForm((f) => ({ ...f, enabled: !f.enabled }))} disabled={!canWrite || t.saving} /></div>
      </div>
      <section className="sp-integration-panel">
        <div className="sp-form">
          {isGoogle ? (
            <>
              <label><AdminText en="Google OAuth Client ID" ar="معرف عميل Google OAuth" /><input value={t.form.clientId} onChange={(e) => t.setForm((f) => ({ ...f, clientId: e.target.value }))} placeholder={ar ? 'أدخل معرف عميل Google OAuth' : 'Enter Google OAuth Client ID'} dir="ltr" disabled={!canWrite || t.saving} /></label>
              <SecretField labelEn="Google OAuth Client Secret" labelAr="سر عميل Google OAuth" value={t.form.clientSecret} onChange={(clientSecret) => t.setForm((f) => ({ ...f, clientSecret }))} configured={secretConfigured(snapshot, secretKey)} disabled={!canWrite || t.saving} />
              <label><AdminText en="Authorized JavaScript origin" ar="مصدر JavaScript المعتمد" /><input value="https://starpyramids.com" readOnly dir="ltr" /></label>
              <label><AdminText en="Authorized redirect URI" ar="رابط إعادة التوجيه المعتمد" /><input value="https://starpyramids.com/api/auth/callback/google" readOnly dir="ltr" /></label>
              <label><AdminText en="Requested scopes" ar="النطاقات المطلوبة" /><input value="openid email profile" readOnly dir="ltr" /></label>
            </>
          ) : (
            <>
              <div className="sp-form-2">
                <label><AdminText en="Facebook App ID" ar="معرف تطبيق فيسبوك" /><input value={t.form.clientId} onChange={(e) => t.setForm((f) => ({ ...f, clientId: e.target.value }))} placeholder={ar ? 'أدخل معرف تطبيق فيسبوك' : 'Enter Facebook App ID'} dir="ltr" disabled={!canWrite || t.saving} /></label>
                <SecretField labelEn="Facebook App Secret" labelAr="سر تطبيق فيسبوك" value={t.form.clientSecret} onChange={(clientSecret) => t.setForm((f) => ({ ...f, clientSecret }))} configured={secretConfigured(snapshot, secretKey)} disabled={!canWrite || t.saving} />
              </div>
              <label><AdminText en="Valid OAuth redirect URI" ar="رابط إعادة توجيه OAuth الصالح" /><input value="https://starpyramids.com/api/auth/callback/facebook" readOnly dir="ltr" /></label>
              <label><AdminText en="Data deletion callback" ar="رابط حذف البيانات" /><input value="https://starpyramids.com/api/auth/facebook/data-deletion" readOnly dir="ltr" /></label>
              <label><AdminText en="Requested permissions" ar="الأذونات المطلوبة" /><input value="public_profile,email" readOnly dir="ltr" /></label>
            </>
          )}
        </div>
        <PendingNote>{isGoogle
          ? <AdminText en="The client secret stays on the server. Real Google sign-in requires the OAuth callback + secure session handling (pending)." ar="يبقى سر العميل في الخادم. يتطلب تسجيل الدخول الحقيقي بجوجل رد OAuth وإدارة جلسات آمنة (معلق)." />
          : <AdminText en="Keep the App Secret on the server and configure the production domain in Meta. Real Facebook login requires the OAuth callback (pending)." ar="أبق سر التطبيق في الخادم واضبط نطاق الإنتاج في Meta. يتطلب تسجيل فيسبوك الحقيقي رد OAuth (معلق)." />}</PendingNote>
        {!canWrite && <ReadOnlyNote />}
        <p className="sp-integration-note"><KeyRound size={15} /> <AdminText en="Secrets are never exposed in frontend code." ar="لا تكشف الأسرار في كود الواجهة أبدا." /></p>
        <div className="sp-integration-actions">
          <button type="button" className="sp-btn primary" onClick={save} disabled={!canWrite || t.saving}>{t.saving ? <AdminText en="Saving…" ar="جارٍ الحفظ…" /> : <AdminText en="Save configuration" ar="حفظ الإعدادات" />}</button>
          <button type="button" className="sp-btn" disabled title={ar ? 'يتطلب رد OAuth الخلفي (معلق)' : 'Requires the backend OAuth callback (pending)'}><LogIn size={17} /> {isGoogle ? <AdminText en="Connect Google" ar="ربط جوجل" /> : <AdminText en="Connect Facebook" ar="ربط فيسبوك" />}</button>
          <button type="button" className="sp-btn" disabled title={ar ? 'يتاح بعد تنفيذ رد OAuth' : 'Available after the OAuth callback is implemented'}><AdminText en="Test login" ar="اختبار الدخول" /></button>
        </div>
        <SaveFeedback saved={t.saved} error={t.error} />
      </section>
    </div>
  )
}

export default function SettingsPage() {
  const ar = useAdminLocale() === 'ar'
  const { user } = useCurrentUser()
  const canWrite = (user?.permissions ?? []).includes('settings.edit')
  const [tab, setTab] = useState<(typeof tabs)[number]['id']>('whatsapp')
  const [snapshot, setSnapshot] = useState<SettingsSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const res = await fetch('/api/admin/settings', { credentials: 'same-origin' })
      const data = (await res.json()) as SettingsSnapshot & { error?: string }
      if (!res.ok) throw new Error(data.error || 'Failed to load settings.')
      setSnapshot(data)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load settings.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const activeTab = tabs.find((t) => t.id === tab)
  const shell: TabShell = { snapshot, canWrite, onSaved: setSnapshot }

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
          {loading && <p role="status"><AdminText en="Loading settings…" ar="جارٍ تحميل الإعدادات…" /></p>}
          {!loading && loadError && (
            <div className="sp-form">
              <p role="alert" style={{ color: '#b91c1c' }}>{loadError}</p>
              <div><button type="button" className="sp-btn" onClick={() => void load()}><AdminText en="Retry" ar="إعادة المحاولة" /></button></div>
            </div>
          )}
          {!loading && !loadError && (
            <>
              {tab === 'whatsapp' && <WhatsAppTab {...shell} />}
              {tab === 'google-maps' && <MapsTab {...shell} />}
              {tab === 'google-auth' && <OAuthTab provider="google" {...shell} />}
              {tab === 'facebook-auth' && <OAuthTab provider="facebook" {...shell} />}
              {tab === 'email' && <EmailTab {...shell} />}
              {tab === 'general' && <GeneralTab {...shell} />}
              {tab === 'contact' && <ContactTab {...shell} />}
              {tab === 'localization' && <LocalizationTab {...shell} />}
              {tab === 'currency' && <CurrencyTab {...shell} />}
              {tab === 'social' && <SocialTab {...shell} />}
              {tab === 'website' && <WebsiteTab {...shell} />}
            </>
          )}
        </Card>
      </div>
    </>
  )
}
