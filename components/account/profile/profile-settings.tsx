'use client'

import { CURRENCY_OPTIONS } from "@/lib/payments/currency";
// 'use client' is required here: the access token is read from the router
// rather than passed as a prop, so the credential never enters the
// server-rendered payload that ships in the HTML.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { Bell, Check, CheckCircle2, CircleAlert, Globe2, Download, Eye, EyeOff, ImagePlus, KeyRound, Laptop, LockKeyhole, ShieldCheck, Trash2 } from "lucide-react";
import { tx, useLocale } from "@/components/locale";
import { countries, defaultCountry } from "@/data/countries";
import { saveCustomerProfile, type CustomerProfile } from "@/lib/account/customer-account";
import { CountrySelect } from "@/components/shared/forms/country-select";
import { InternationalPhoneInput } from "@/components/shared/forms/international-phone-input";
import { SharedSelect } from "@/components/shared/forms/shared-select";
import { ENABLED_LOCALES, LOCALE_LABELS, type EnabledLocale } from "@/lib/i18n/locale-config";
import { customerErrorText } from "@/lib/account/customer-error-copy";
import { useAccountProfile } from "../shared/account-hooks"
import { CustomerAvatar } from "../shared/account-ui"



function PersonalProfileSection() {
  const router = useRouter()
  const { locale } = useLocale()

  const current = useAccountProfile()
  const [form, setForm] = useState<CustomerProfile>(current)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [avatarError, setAvatarError] = useState('')
  useEffect(() => setForm(current), [current])
  const update = <K extends keyof CustomerProfile>(key: K, value: CustomerProfile[K]) => {
    setForm((previous) => ({ ...previous, [key]: value }))
    setSaved(false)
  }
  const changeAvatar = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    // Allow re-picking the same file after a failed attempt.
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/') || file.size > 2 * 1024 * 1024) {
      setAvatarError(tx(locale, { en: 'Choose an image smaller than 2 MB.', es: 'Elige una imagen de menos de 2 MB.', it: 'Scegli un’immagine inferiore a 2 MB.', ar: 'اختر صورة بحجم أقل من 2 ميجابايت.' }))
      return
    }
    // Stored server-side as a real media file; the server returns the
    // permanent public URL, so the photo survives refresh and re-login.
    try {
      const body = new FormData()
      body.append('file', file, file.name)
      const response = await fetch('/api/avatar', {
        method: 'POST',
        body,
        credentials: 'same-origin',
      })
      const data = await response.json().catch(() => ({ error: '' }))
      const url = typeof data?.user?.avatar === 'string' ? data.user.avatar : ''
      if (!response.ok || !url) {
        setAvatarError(typeof data?.error === 'string' && data.error
          ? data.error
          : tx(locale, { en: 'Could not save that photo.', es: 'No se pudo guardar la foto.', it: 'Impossibile salvare la foto.', ar: 'تعذر حفظ الصورة.' }))
        return
      }
      update('avatar', url)
      setAvatarError('')
    } catch {
      setAvatarError(tx(locale, { en: 'Could not save that photo.', es: 'No se pudo guardar la foto.', it: 'Impossibile salvare la foto.', ar: 'تعذر حفظ الصورة.' }))
    }
  }
  const reset = () => {
    setForm(current)
    setAvatarError('')
    setSaveError('')
    setSaved(false)
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (saving) return
    setSaving(true)
    setSaveError('')
    try {
      const response = await fetch('/api/account/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          username: form.username,
          countryCode: form.country,
          phone: form.phone,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        setSaveError(data.error || (tx(locale, { en: 'Could not save your profile.', es: 'No se pudo guardar tu perfil.', it: 'Impossibile salvare il profilo.', ar: 'تعذر حفظ الملف الشخصي.' })))
        return
      }

      // The avatar is already persisted by /api/avatar at selection time,
      // so profile save only needs to mirror the resulting URL locally.
      saveCustomerProfile(form)
      setSaved(true)
      router.refresh()
    } catch {
      setSaveError(tx(locale, { en: 'Could not save your profile.', es: 'No se pudo guardar tu perfil.', it: 'Impossibile salvare il profilo.', ar: 'تعذر حفظ الملف الشخصي.' }))
    } finally {
      setSaving(false)
    }
  }
  const displayName = `${form.firstName} ${form.lastName}`.trim()
  const initials = [form.firstName, form.lastName].filter(Boolean).map((part) => part[0]).join('').toUpperCase() || 'SP'
  const [phoneCountry, setPhoneCountry] = useState(defaultCountry.code)

  return <form className="customer-profile-form customer-profile-only" onSubmit={submit}>
    <section className="customer-account-block">
      <header><div><span>{tx(locale, { en: 'Personal details', es: 'Datos personales', it: 'Dati personali', ar: 'البيانات الشخصية' })}</span><h2>{tx(locale, { en: 'Account information', es: 'Información de la cuenta', it: 'Informazioni account', ar: 'معلومات الحساب' })}</h2></div>{saved && <span className="customer-saved-notice"><Check size={14} />{tx(locale, { en: 'Saved', es: 'Guardado', it: 'Salvato', ar: 'تم الحفظ' })}</span>}</header>
      <div className="customer-avatar-editor">
        <CustomerAvatar avatar={form.avatar} initials={initials} className="customer-profile-avatar" name={displayName} />
        <div><strong>{tx(locale, { en: 'Profile photo', es: 'Foto de perfil', it: 'Foto profilo', ar: 'صورة الحساب' })}</strong><small>{tx(locale, { en: 'JPG or PNG up to 2 MB', es: 'JPG o PNG de hasta 2 MB', it: 'JPG o PNG fino a 2 MB', ar: 'JPG أو PNG حتى 2 ميجابايت' })}</small>{avatarError && <em>{avatarError}</em>}</div>
        <label aria-label={tx(locale, { en: 'Change profile photo', es: 'Cambiar la foto de perfil', it: 'Cambia la foto profilo', ar: 'تغيير صورة الحساب' })}><ImagePlus size={16} />{tx(locale, { en: 'Change photo', es: 'Cambiar foto', it: 'Cambia foto', ar: 'تغيير الصورة' })}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={changeAvatar} aria-label={tx(locale, { en: 'Change profile photo', es: 'Cambiar la foto de perfil', it: 'Cambia la foto profilo', ar: 'تغيير صورة الحساب' })} /></label>
        {form.avatar && <button type="button" onClick={async () => { update('avatar', ''); setAvatarError(''); await fetch('/api/avatar', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ isAdmin: false }) }).catch(() => {}) }} aria-label={tx(locale, { en: 'Remove photo', es: 'Quitar la foto', it: 'Rimuovi foto', ar: 'حذف الصورة' })} title={tx(locale, { en: 'Remove photo', es: 'Quitar la foto', it: 'Rimuovi foto', ar: 'حذف الصورة' })}><Trash2 size={16} /></button>}
      </div>
      <div className="customer-form-grid">
        <label>{tx(locale, { en: 'First name', es: 'Nombre', it: 'Nome', ar: 'الاسم الأول' })}<input required autoComplete="given-name" value={form.firstName} onChange={(event) => update('firstName', event.target.value)} /></label>
        <label>{tx(locale, { en: 'Last name', es: 'Apellidos', it: 'Cognome', ar: 'اسم العائلة' })}<input required autoComplete="family-name" value={form.lastName} onChange={(event) => update('lastName', event.target.value)} /></label>
        <label>{tx(locale, { en: 'Username', es: 'Nombre de usuario', it: 'Nome utente', ar: 'اسم المستخدم' })}<input required dir="ltr" value={form.username} onChange={(event) => update('username', event.target.value.replace(/[^A-Za-z0-9_.-]/g, ''))} /></label>
        <label>{tx(locale, { en: 'Email address', es: 'Correo electrónico', it: 'Indirizzo email', ar: 'البريد الإلكتروني' })}<input required readOnly type="email" dir="ltr" value={form.email} /></label>
        <label>{tx(locale, { en: 'Country', es: 'País', it: 'Paese', ar: 'الدولة' })}<CountrySelect value={form.country} onChange={(code) => { const next = countries.find((country) => country.code === code) ?? defaultCountry; setForm((previous) => ({ ...previous, country: next.code, dialCode: next.dialCode })); setPhoneCountry(code); setSaved(false) }} locale={locale} /></label>
        <label>{tx(locale, { en: 'Phone number', es: 'Número de teléfono', it: 'Numero di telefono', ar: 'رقم الهاتف' })}<InternationalPhoneInput value={form.phone} onChange={(value) => { update('phone', value); setSaved(false) }} locale={locale} countryCode={phoneCountry} onCountryChange={setPhoneCountry} placeholder={tx(locale, { en: 'Phone number', es: 'Número de teléfono', it: 'Numero di telefono', ar: 'رقم الهاتف' })} /></label>
      </div>
    </section>
    {saveError && <p className="form-error" role="alert">{saveError}</p>}
    <div className="customer-profile-actions"><button type="submit" disabled={saving}>{saving ? (tx(locale, { en: 'Saving...', es: 'Guardando…', it: 'Salvataggio…', ar: 'جارٍ الحفظ...' })) : (tx(locale, { en: 'Save profile', es: 'Guardar perfil', it: 'Salva profilo', ar: 'حفظ الملف الشخصي' }))}</button><button type="button" onClick={reset} disabled={saving}>{tx(locale, { en: 'Discard changes', es: 'Descartar cambios', it: 'Annulla modifiche', ar: 'إلغاء التعديلات' })}</button></div>
  </form>
}

function SettingsSection() {
  const { locale, setLocale, currency, setCurrency } = useLocale()

  const current = useAccountProfile()
  const [form, setForm] = useState<CustomerProfile>(current)
  const [selectedCurrency, setSelectedCurrency] = useState(currency)
  const [saved, setSaved] = useState(false)
  useEffect(() => setForm(current), [current])
  useEffect(() => setSelectedCurrency(currency), [currency])
  const update = <K extends keyof CustomerProfile>(key: K, value: CustomerProfile[K]) => {
    setForm((previous) => ({ ...previous, [key]: value }))
    setSaved(false)
  }
  const reset = () => {
    setForm(current)
    setSelectedCurrency(currency)
    setSaved(false)
  }
  const submit = (event: FormEvent) => {
    event.preventDefault()
    saveCustomerProfile(form)
    setCurrency(selectedCurrency)
    setLocale(form.preferredLanguage)
    setSaved(true)
  }

  return <form className="customer-settings-form" onSubmit={submit}>
    <div className="customer-settings-column">
      <section className="customer-account-block">
        <header><div><span>{tx(locale, { en: 'Preferences', es: 'Preferencias', it: 'Preferenze', ar: 'التفضيلات' })}</span><h2>{tx(locale, { en: 'Language & currency', es: 'Idioma y moneda', it: 'Lingua e valuta', ar: 'اللغة والعملة' })}</h2></div><Globe2 size={19} /></header>
        <div className="customer-settings-selects">
          <label>{tx(locale, { en: 'Preferred language', es: 'Idioma preferido', it: 'Lingua preferita', ar: 'اللغة المفضلة' })}<SharedSelect value={form.preferredLanguage} onChange={(next) => update('preferredLanguage', next as EnabledLocale)} locale={locale} options={ENABLED_LOCALES.map((value) => ({ value, label: LOCALE_LABELS[value] }))} /></label>
          <label>{tx(locale, { en: 'Display currency', es: 'Moneda de visualización', it: 'Valuta di visualizzazione', ar: 'عملة العرض' })}<SharedSelect value={selectedCurrency} onChange={(next) => { setSelectedCurrency(next as typeof currency); setSaved(false) }} locale={locale} options={CURRENCY_OPTIONS} /></label>
        </div>
      </section>
      <section className="customer-account-block">
        <header><div><span>{tx(locale, { en: 'Notifications', es: 'Notificaciones', it: 'Notifiche', ar: 'التنبيهات' })}</span><h2>{tx(locale, { en: 'How we keep you updated', es: 'Cómo te mantenemos al día', it: 'Come ti teniamo aggiornato', ar: 'كيف نبقيك على اطلاع' })}</h2></div><Bell size={19} /></header>
        <label className="customer-switch-row"><span><strong>{tx(locale, { en: 'Booking updates', es: 'Actualizaciones de reservas', it: 'Aggiornamenti prenotazioni', ar: 'تحديثات الحجوزات' })}</strong><small>{tx(locale, { en: 'Confirmations, schedule changes, and pickup details.', es: 'Confirmaciones, cambios de horario y datos de recogida.', it: 'Conferme, cambi di programma e dettagli del prelievo.', ar: 'التأكيدات وتغييرات المواعيد وتفاصيل الاستلام.' })}</small></span><input type="checkbox" checked={form.bookingUpdates} onChange={(event) => update('bookingUpdates', event.target.checked)} /></label>
        <label className="customer-switch-row"><span><strong>{tx(locale, { en: 'Trip reminders', es: 'Recordatorios de viaje', it: 'Promemoria viaggio', ar: 'تذكيرات الرحلة' })}</strong><small>{tx(locale, { en: 'Timely reminders for departures and required documents.', es: 'Recordatorios puntuales de salidas y documentos necesarios.', it: 'Promemoria puntuali per partenze e documenti richiesti.', ar: 'تذكيرات قبل الرحلة بالمواعيد والمستندات المهمة.' })}</small></span><input type="checkbox" checked={form.tripReminders} onChange={(event) => update('tripReminders', event.target.checked)} /></label>
        <label className="customer-switch-row"><span><strong>{tx(locale, { en: 'Payment & receipt updates', es: 'Actualizaciones de pagos y recibos', it: 'Aggiornamenti pagamenti e ricevute', ar: 'تحديثات الدفع والإيصالات' })}</strong><small>{tx(locale, { en: 'Payment status, confirmations, and new receipts.', es: 'Estado de pagos, confirmaciones y nuevos recibos.', it: 'Stato pagamenti, conferme e nuove ricevute.', ar: 'حالة الدفع والتأكيدات والإيصالات الجديدة.' })}</small></span><input type="checkbox" checked={form.paymentUpdates} onChange={(event) => update('paymentUpdates', event.target.checked)} /></label>
        <label className="customer-switch-row"><span><strong>{tx(locale, { en: 'Messages & support replies', es: 'Mensajes y respuestas de asistencia', it: 'Messaggi e risposte dell’assistenza', ar: 'ردود الرسائل والدعم' })}</strong><small>{tx(locale, { en: 'Notify me when the travel team sends a new reply.', es: 'Avísame cuando el equipo de viajes envíe una respuesta.', it: 'Avvisami quando il team viaggi invia una nuova risposta.', ar: 'تنبيه عند وصول رد جديد من فريق الرحلات.' })}</small></span><input type="checkbox" checked={form.messageReplies} onChange={(event) => update('messageReplies', event.target.checked)} /></label>
        <label className="customer-switch-row"><span><strong>{tx(locale, { en: 'Cart reminders', es: 'Recordatorios de la cesta', it: 'Promemoria carrello', ar: 'تذكيرات السلة' })}</strong><small>{tx(locale, { en: 'Remind me about trips waiting in my cart.', es: 'Recuérdame los viajes que esperan en mi cesta.', it: 'Ricordami i viaggi in attesa nel carrello.', ar: 'ذكّرني بالرحلات التي لم أكمل حجزها.' })}</small></span><input type="checkbox" checked={form.cartReminders} onChange={(event) => update('cartReminders', event.target.checked)} /></label>
        <label className="customer-switch-row"><span><strong>{tx(locale, { en: 'Saved trip updates', es: 'Actualizaciones de viajes guardados', it: 'Aggiornamenti viaggi salvati', ar: 'تحديثات الرحلات المحفوظة' })}</strong><small>{tx(locale, { en: 'Changes or offers related to trips I saved.', es: 'Cambios u ofertas relacionados con mis viajes guardados.', it: 'Modifiche o offerte relative ai viaggi salvati.', ar: 'تغييرات أو عروض تخص الرحلات التي حفظتها.' })}</small></span><input type="checkbox" checked={form.savedTripUpdates} onChange={(event) => update('savedTripUpdates', event.target.checked)} /></label>
        <label className="customer-switch-row"><span><strong>{tx(locale, { en: 'SMS updates', es: 'Actualizaciones por SMS', it: 'Aggiornamenti SMS', ar: 'رسائل SMS' })}</strong><small>{tx(locale, { en: 'Urgent travel updates sent to your saved phone number.', es: 'Avisos urgentes de viaje enviados a tu número guardado.', it: 'Aggiornamenti urgenti inviati al tuo numero salvato.', ar: 'تنبيهات عاجلة على رقم الهاتف المسجل.' })}</small></span><input type="checkbox" checked={form.smsUpdates} onChange={(event) => update('smsUpdates', event.target.checked)} /></label>
        <label className="customer-switch-row"><span><strong>{tx(locale, { en: 'Travel inspiration and offers', es: 'Inspiración de viaje y ofertas', it: 'Ispirazioni di viaggio e offerte', ar: 'أفكار وعروض السفر' })}</strong><small>{tx(locale, { en: 'Optional emails you can turn off at any time.', es: 'Correos opcionales que puedes desactivar cuando quieras.', it: 'Email facoltative che puoi disattivare in qualsiasi momento.', ar: 'رسائل اختيارية يمكنك إيقافها في أي وقت.' })}</small></span><input type="checkbox" checked={form.marketingEmails} onChange={(event) => update('marketingEmails', event.target.checked)} /></label>
        <label className="customer-switch-row customer-required-notification"><span><strong>{tx(locale, { en: 'Security alerts', es: 'Alertas de seguridad', it: 'Avvisi di sicurezza', ar: 'تنبيهات الأمان' })}</strong><small>{tx(locale, { en: 'New sign-ins, password changes, and important account activity.', es: 'Nuevos inicios de sesión, cambios de contraseña y actividad importante.', it: 'Nuovi accessi, cambi password e attività importanti.', ar: 'تسجيل دخول جديد وتغييرات كلمة المرور والنشاط المهم.' })}</small><em>{tx(locale, { en: 'Required for account security', es: 'Obligatorio para la seguridad', it: 'Obbligatorio per la sicurezza', ar: 'مطلوبة لحماية الحساب' })}</em></span><input type="checkbox" checked={form.securityAlerts} disabled readOnly /></label>
      </section>
    </div>
    <div className="customer-settings-column">
      <section className="customer-account-block">
        <header><div><span>{tx(locale, { en: 'Access & security', es: 'Acceso y seguridad', it: 'Accesso e sicurezza', ar: 'الدخول والأمان' })}</span><h2>{tx(locale, { en: 'Protect your account', es: 'Protege tu cuenta', it: 'Proteggi il tuo account', ar: 'حماية الحساب' })}</h2></div><LockKeyhole size={19} /></header>
        <div className="customer-settings-list">
          <div><span className="customer-setting-icon"><KeyRound size={17} /></span><div><strong>{tx(locale, { en: 'Password', es: 'Contraseña', it: 'Password', ar: 'كلمة المرور' })}</strong><small>{tx(locale, { en: 'Change your password inside your account.', es: 'Cambia tu contraseña desde tu cuenta.', it: 'Cambia la password dal tuo account.', ar: 'غيّر كلمة المرور من داخل حسابك.' })}</small></div><Link href="/account/change-password">{tx(locale, { en: 'Change', es: 'Cambiar', it: 'Cambia', ar: 'تغيير' })}</Link></div>
          <div><span className="customer-provider google">G</span><div><strong>Google</strong><small>{tx(locale, { en: 'Available after backend OAuth is connected.', es: 'Disponible cuando se conecte OAuth en el backend.', it: 'Disponibile dopo il collegamento OAuth di backend.', ar: 'سيعمل بعد ربط OAuth بالباك.' })}</small></div><span className="customer-backend-state">{tx(locale, { en: 'Backend required', es: 'Requiere backend', it: 'Backend richiesto', ar: 'يحتاج باك' })}</span></div>
          <div><span className="customer-provider facebook">f</span><div><strong>Facebook</strong><small>{tx(locale, { en: 'Available after backend OAuth is connected.', es: 'Disponible cuando se conecte OAuth en el backend.', it: 'Disponibile dopo il collegamento OAuth di backend.', ar: 'سيعمل بعد ربط OAuth بالباك.' })}</small></div><span className="customer-backend-state">{tx(locale, { en: 'Backend required', es: 'Requiere backend', it: 'Backend richiesto', ar: 'يحتاج باك' })}</span></div>
          <div><span className="customer-setting-icon"><Laptop size={17} /></span><div><strong>{tx(locale, { en: 'Sessions & devices', es: 'Sesiones y dispositivos', it: 'Sessioni e dispositivi', ar: 'الجلسات والأجهزة' })}</strong><small>{tx(locale, { en: 'Review signed-in devices and end a session.', es: 'Revisa los dispositivos conectados y cierra sesiones.', it: 'Rivedi i dispositivi collegati e termina una sessione.', ar: 'راجع الأجهزة المسجل منها الدخول وأنهِ أي جلسة.' })}</small></div><button type="button" disabled>{tx(locale, { en: 'Backend required', es: 'Requiere backend', it: 'Backend richiesto', ar: 'يحتاج باك' })}</button></div>
        </div>
      </section>
      <section className="customer-account-block">
        <header><div><span>{tx(locale, { en: 'Privacy & data', es: 'Privacidad y datos', it: 'Privacy e dati', ar: 'الخصوصية والبيانات' })}</span><h2>{tx(locale, { en: 'Your account data', es: 'Tus datos', it: 'I tuoi dati', ar: 'بيانات حسابك' })}</h2></div><ShieldCheck size={19} /></header>
        <div className="customer-settings-list">
          <div><span className="customer-setting-icon"><Download size={17} /></span><div><strong>{tx(locale, { en: 'Download account data', es: 'Descargar datos de la cuenta', it: 'Scarica i dati account', ar: 'تنزيل بيانات الحساب' })}</strong><small>{tx(locale, { en: 'Request a copy of your profile, bookings, and messages.', es: 'Solicita una copia de tu perfil, reservas y mensajes.', it: 'Richiedi una copia di profilo, prenotazioni e messaggi.', ar: 'اطلب نسخة من بياناتك وحجوزاتك ورسائلك.' })}</small></div><button type="button" disabled>{tx(locale, { en: 'Backend required', es: 'Requiere backend', it: 'Backend richiesto', ar: 'يحتاج باك' })}</button></div>
          <div className="danger"><span className="customer-setting-icon"><Trash2 size={17} /></span><div><strong>{tx(locale, { en: 'Delete account', es: 'Eliminar cuenta', it: 'Elimina account', ar: 'حذف الحساب' })}</strong><small>{tx(locale, { en: 'Identity confirmation is required before deletion.', es: 'Se requiere confirmar tu identidad antes de eliminar.', it: 'È richiesta la conferma dell’identità prima dell’eliminazione.', ar: 'يتطلب تأكيد الهوية قبل إرسال طلب الحذف.' })}</small></div><button type="button" disabled>{tx(locale, { en: 'Backend required', es: 'Requiere backend', it: 'Backend richiesto', ar: 'يحتاج باك' })}</button></div>
        </div>
      </section>
    </div>
    <div className="customer-profile-actions">{saved && <span className="customer-saved-notice"><Check size={14} />{tx(locale, { en: 'Saved', es: 'Guardado', it: 'Salvato', ar: 'تم الحفظ' })}</span>}<button type="submit">{tx(locale, { en: 'Save settings', es: 'Guardar ajustes', it: 'Salva impostazioni', ar: 'حفظ الإعدادات' })}</button><button type="button" onClick={reset}>{tx(locale, { en: 'Discard changes', es: 'Descartar cambios', it: 'Annulla modifiche', ar: 'إلغاء التعديلات' })}</button></div>
  </form>
}

function ChangePasswordSection() {
  const { locale } = useLocale()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const passwordError = newPassword.length > 0
    ? (newPassword.length < 6 ? 'Password must be at least 6 characters.' : newPassword.length > 8 ? 'Password must be at most 8 characters.' : null)
    : null;
  const matches = newPassword.length > 0 && newPassword === confirmPassword
  const canSubmit = currentPassword.length > 0 && matches && !passwordError

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!canSubmit) return
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Could not change password. Please try again.')
        return
      }
      setSubmitted(true)
    } catch {
      setError('Could not change password. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return <div className="customer-password-layout">
    <form className="customer-account-block customer-password-card" onSubmit={handleSubmit}>
      <header><div><span>{tx(locale, { en: 'Access & security', es: 'Acceso y seguridad', it: 'Accesso e sicurezza', ar: 'الدخول والأمان' })}</span><h2>{tx(locale, { en: 'Change your password', es: 'Cambia tu contraseña', it: 'Cambia la tua password', ar: 'غيّر كلمة المرور' })}</h2></div><LockKeyhole size={19} /></header>
      <div className="customer-password-fields">
        <label>{tx(locale, { en: 'Current password', es: 'Contraseña actual', it: 'Password attuale', ar: 'كلمة المرور الحالية' })}<span><input required type={showCurrent ? 'text' : 'password'} autoComplete="current-password" value={currentPassword} onChange={(event) => { setCurrentPassword(event.target.value); setSubmitted(false); setError('') }} disabled={submitting} /><button type="button" onClick={() => setShowCurrent((visible) => !visible)} aria-label={showCurrent ? (tx(locale, { en: 'Hide password', es: 'Ocultar la contraseña', it: 'Nascondi password', ar: 'إخفاء كلمة المرور' })) : (tx(locale, { en: 'Show password', es: 'Mostrar la contraseña', it: 'Mostra password', ar: 'إظهار كلمة المرور' }))}>{showCurrent ? <EyeOff size={17} /> : <Eye size={17} />}</button></span></label>
        <label>{tx(locale, { en: 'New password', es: 'Contraseña nueva', it: 'Nuova password', ar: 'كلمة المرور الجديدة' })}<span><input required type={showNew ? 'text' : 'password'} autoComplete="new-password" value={newPassword} onChange={(event) => { setNewPassword(event.target.value); setSubmitted(false); setError('') }} disabled={submitting} /><button type="button" onClick={() => setShowNew((visible) => !visible)} aria-label={showNew ? (tx(locale, { en: 'Hide password', es: 'Ocultar la contraseña', it: 'Nascondi password', ar: 'إخفاء كلمة المرور' })) : (tx(locale, { en: 'Show password', es: 'Mostrar la contraseña', it: 'Mostra password', ar: 'إظهار كلمة المرور' }))}>{showNew ? <EyeOff size={17} /> : <Eye size={17} />}</button></span>{passwordError && <span className="field-error" role="alert">{passwordError}</span>}</label>
        <label>{tx(locale, { en: 'Confirm new password', es: 'Confirma la contraseña nueva', it: 'Conferma la nuova password', ar: 'تأكيد كلمة المرور الجديدة' })}<span><input required type={showNew ? 'text' : 'password'} autoComplete="new-password" value={confirmPassword} onChange={(event) => { setConfirmPassword(event.target.value); setSubmitted(false); setError('') }} disabled={submitting} /></span>{confirmPassword && !matches && <span className="field-error" role="alert">{tx(locale, { en: 'Passwords do not match.', es: 'Las contraseñas no coinciden.', it: 'Le password non coincidono.', ar: 'كلمتا المرور غير متطابقتين.' })}</span>}</label>
      </div>
      <div className="customer-password-rules" aria-live="polite">
        <span className={newPassword.length >= 6 && newPassword.length <= 64 ? 'valid' : ''}><Check size={14} />{tx(locale, { en: '6-64 characters', es: '6-64 caracteres', it: '6-64 caratteri', ar: '6-64 حرفًا' })}</span>
        <span className={matches ? 'valid' : ''}><Check size={14} />{tx(locale, { en: 'Passwords match', es: 'Las contraseñas coinciden', it: 'Le password coincidono', ar: 'كلمتا المرور متطابقتان' })}</span>
      </div>
      {error && <p className="co-error" role="alert"><CircleAlert size={15} />{customerErrorText(locale, error, tx(locale, { en: 'Could not change password. Please try again.', es: 'No se pudo cambiar la contraseña. Inténtalo de nuevo.', it: 'Impossibile cambiare la password. Riprova.', ar: 'تعذر تغيير كلمة المرور. حاول مجددًا.' }))}</p>}
      {submitted && <div className="customer-password-ready"><CheckCircle2 size={17} /><div><strong>{tx(locale, { en: 'Password changed successfully', es: 'Contraseña cambiada correctamente', it: 'Password modificata con successo', ar: 'تم تغيير كلمة المرور بنجاح' })}</strong><small>{tx(locale, { en: 'Your password has been updated. Other sessions have been signed out for security.', es: 'Tu contraseña se ha actualizado. Otras sesiones se han cerrado por seguridad.', it: 'La tua password è stata aggiornata. Altre sessioni sono state disconnesse per sicurezza.', ar: 'تم تحديث كلمة المرور. تم تسجيل الخروج من الجلسات الأخرى لأسباب أمنية.' })}</small></div></div>}
      <div className="customer-password-actions"><Link href="/account/settings">{tx(locale, { en: 'Back to settings', es: 'Volver a los ajustes', it: 'Torna alle impostazioni', ar: 'العودة للإعدادات' })}</Link><button type="submit" disabled={submitting || !canSubmit}>{submitting ? tx(locale, { en: 'Updating…', es: 'Actualizando…', it: 'Aggiornando…', ar: 'جارٍ التحديث…' }) : tx(locale, { en: 'Update password', es: 'Actualizar la contraseña', it: 'Aggiorna password', ar: 'تحديث كلمة المرور' })}</button></div>
    </form>
    <aside className="customer-account-block customer-password-help"><span><ShieldCheck size={20} /></span><h2>{tx(locale, { en: 'Keep your account secure', es: 'Mantén segura tu cuenta', it: 'Mantieni sicuro il tuo account', ar: 'حافظ على أمان حسابك' })}</h2><p>{tx(locale, { en: 'Use a password you do not use elsewhere and never share it with anyone.', es: 'Usa una contraseña que no utilices en ningún otro sitio y no la compartas con nadie.', it: 'Usa una password che non usi altrove e non condividerla mai.', ar: 'استخدم كلمة مرور لا تستخدمها في أي حساب آخر، ولا تشاركها مع أي شخص.' })}</p><small>{tx(locale, { en: 'STAR PYRAMIDS staff will never ask for your password.', es: 'El equipo de STAR PYRAMIDS nunca te pedirá tu contraseña.', it: 'Lo staff di STAR PYRAMIDS non ti chiederà mai la password.', ar: 'لن يطلب فريق STAR PYRAMIDS كلمة مرورك.' })}</small></aside>
  </div>
}

export { PersonalProfileSection, SettingsSection, ChangePasswordSection }
