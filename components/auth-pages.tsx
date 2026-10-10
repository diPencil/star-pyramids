'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, type FormEvent, type ReactNode, Suspense } from 'react'
import { ArrowRight, AtSign, Check, Eye, EyeOff, LockKeyhole, Mail, MapPin, Phone, ShieldCheck, User } from 'lucide-react'
import { countries, defaultCountry } from '@/data/countries'
import { CountrySelect } from '@/components/country-select'
import { InternationalPhoneInput } from '@/components/international-phone-input'
import { FacebookIcon, GoogleIcon } from './brand-icons'
import { siteImages } from '@/data/content'
import { LocaleProvider, tx, useLocale } from './locale'
import { LanguageSelector } from './language-selector'
import { Logo } from './site'
import { getCopy } from '@/lib/locale-helpers'

type SocialProvider = 'Google' | 'Facebook'

const baseAuthCopy = {
  en: {
    loginTitle: 'Welcome back to your Egypt plans.',
    loginCopy: 'Sign in to keep your saved journeys, enquiries, and travel details together.',
    registerTitle: 'Create your travel account.',
    registerCopy: 'Save inspiring journeys and keep every conversation with our Egypt team in one place.',
    imageTitle: 'Your next Egypt story, kept in one place.',
    imageCopy: 'Return to saved trips, continue planning, and keep the details of your journey close.',
    benefits: ['Save tours for later', 'Keep trip enquiries together', 'Continue planning across devices'],
  },
  ar: {
    loginTitle: 'أهلاً برجوعك لخطط رحلتك في مصر.',
    loginCopy: 'سجّل دخولك عشان تلاقي الرحلات المحفوظة وطلباتك وتفاصيل سفرك في مكان واحد.',
    registerTitle: 'اعمل حساب رحلتك.',
    registerCopy: 'احفظ الرحلات اللي عجبتك وخلي كل تواصلك مع فريقنا في مصر مرتب في مكان واحد.',
    imageTitle: 'كل تفاصيل رحلتك لمصر في مكان واحد.',
    imageCopy: 'ارجع لرحلاتك المحفوظة، كمّل التخطيط، وخلي تفاصيل رحلتك قريبة منك.',
    benefits: ['احفظ الرحلات لوقت لاحق', 'اجمع طلبات الرحلة في مكان واحد', 'كمّل التخطيط من أي جهاز'],
  },
  es: {
    loginTitle: 'Bienvenido de nuevo a tus planes de Egipto.',
    loginCopy: 'Inicia sesión para tener tus viajes guardados, tus consultas y tus datos de viaje en un solo lugar.',
    registerTitle: 'Crea tu cuenta de viaje.',
    registerCopy: 'Guarda viajes inspiradores y mantén toda tu conversación con nuestro equipo en Egipto en un solo lugar.',
    imageTitle: 'Tu próxima historia en Egipto, en un solo lugar.',
    imageCopy: 'Vuelve a tus viajes guardados, sigue planificando y ten los detalles de tu viaje a mano.',
    benefits: ['Guarda tours para después', 'Mantén tus consultas juntas', 'Sigue planificando en todos tus dispositivos'],
  },
  it: {
    loginTitle: 'Bentornato ai tuoi piani per l’Egitto.',
    loginCopy: 'Accedi per ritrovare viaggi salvati, richieste e dati di viaggio in un unico posto.',
    registerTitle: 'Crea il tuo account di viaggio.',
    registerCopy: 'Salva viaggi interessanti e tieni ogni conversazione con il nostro team in Egitto in un unico posto.',
    imageTitle: 'La tua prossima storia in Egitto, in un unico posto.',
    imageCopy: 'Torna ai viaggi salvati, continua a pianificare e tieni i dettagli del viaggio con te.',
    benefits: ['Salva i tour per dopo', 'Tieni insieme le richieste di viaggio', 'Continua a pianificare su ogni dispositivo'],
  },
} as const

const authCopy = { ...baseAuthCopy } as const

function AuthField({ label, icon, children, className = '' }: { label: string; icon: ReactNode; children: ReactNode; className?: string }) {
  return <label className={`auth-v2-field ${className}`}><span>{label}</span><div>{icon}{children}</div></label>
}

function PasswordField({ label, name, autoComplete }: { label: string; name: string; autoComplete: string }) {
  const { locale } = useLocale()
  const [show, setShow] = useState(false)
  return <AuthField label={label} icon={<LockKeyhole size={18} />}><input required name={name} minLength={6} maxLength={8} type={show ? 'text' : 'password'} autoComplete={autoComplete} placeholder={tx(locale, { en: '6-8 characters', es: '6-8 caracteres', it: '6-8 caratteri', ar: '٦-٨ أحرف' })} /><button type="button" onClick={() => setShow((value) => !value)} aria-label={show ? tx(locale, { en: 'Hide password', es: 'Ocultar contraseña', it: 'Nascondi password', ar: 'إخفاء كلمة المرور' }) : tx(locale, { en: 'Show password', es: 'Mostrar contraseña', it: 'Mostra password', ar: 'إظهار كلمة المرور' })}>{show ? <EyeOff size={18} /> : <Eye size={18} />}</button></AuthField>
}

function SocialButtons({ onSelect }: { onSelect: (provider: SocialProvider) => void }) {
  const { locale } = useLocale()
  return <div className="auth-v2-socials">
    <button type="button" onClick={() => onSelect('Google')}><GoogleIcon /><span>{tx(locale, { en: 'Continue with Google', es: 'Continuar con Google', it: 'Continua con Google', ar: 'المتابعة باستخدام Google' })}</span></button>
    <button type="button" onClick={() => onSelect('Facebook')}><FacebookIcon /><span>{tx(locale, { en: 'Continue with Facebook', es: 'Continuar con Facebook', it: 'Continua con Facebook', ar: 'المتابعة باستخدام Facebook' })}</span></button>
  </div>
}

function LoginForm() {
  const { locale } = useLocale()
  const router = useRouter()
  const searchParams = useSearchParams()
  const text = getCopy(authCopy, locale)
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const genericError = tx(locale, { en: 'An error occurred. Please try again.', es: 'Se produjo un error. Inténtalo de nuevo.', it: 'Si è verificato un errore. Riprova.', ar: 'حدث خطأ. حاول مرة أخرى.' })

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (loading) return
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ identifier, password, next: searchParams.get('next') }),
      })
      if (res.ok) {
        const data = await res.json()
        router.replace(typeof data.redirectTo === 'string' ? data.redirectTo : '/')
        router.refresh()
        return
      }
      const data = await res.json().catch(() => ({}))
      setError(data.error || genericError)
    } catch {
      setError(genericError)
    } finally {
      setLoading(false)
    }
  }

  return <main className="auth-v2">
    <section className="auth-v2-visual">
      <img src={siteImages.pyramids} alt={tx(locale, { en: 'The Pyramids of Giza in Egypt', es: 'Las pirámides de Guiza en Egipto', it: 'Le piramidi di Giza in Egitto', ar: 'أهرامات الجيزة في مصر' })} />
      <div className="auth-v2-shade" />
      <div className="auth-v2-visual-content">
        <Logo />
        <div><span>{tx(locale, { en: 'Your STAR PYRAMIDS account', es: 'Tu cuenta de STAR PYRAMIDS', it: 'Il tuo account STAR PYRAMIDS', ar: 'حساب STAR PYRAMIDS' })}</span><h2>{text.imageTitle}</h2><p>{text.imageCopy}</p><ul>{text.benefits.map((benefit) => <li key={benefit}><Check size={16} />{benefit}</li>)}</ul></div>
      </div>
    </section>

    <section className="auth-v2-panel">
      <header className="auth-v2-top"><Link href="/" aria-label={tx(locale, { en: 'Back to home', es: 'Volver al inicio', it: 'Torna alla home', ar: 'العودة للرئيسية' })}><ArrowRight size={18} />{tx(locale, { en: 'Home', es: 'Inicio', it: 'Home', ar: 'الرئيسية' })}</Link><LanguageSelector /></header>
      <div className="auth-v2-card">
        <div className="auth-v2-heading"><span>{tx(locale, { en: 'Welcome back', es: 'Bienvenido de nuevo', it: 'Bentornato', ar: 'مرحبًا بعودتك' })}</span><h1>{text.loginTitle}</h1><p>{text.loginCopy}</p></div>
        {error && <p className="auth-v2-notice" role="alert"><ShieldCheck size={17} />{error}</p>}
        <form className="auth-v2-form" onSubmit={handleSubmit}>
          <AuthField label={tx(locale, { en: 'Email or username', es: 'Correo electrónico o nombre de usuario', it: 'Email o nome utente', ar: 'البريد الإلكتروني أو اسم المستخدم' })} icon={<Mail size={18} />}>
            <input required name="username" type="text" autoComplete="username" placeholder={tx(locale, { en: 'you@example.com or username', es: 'you@example.com o nombre de usuario', it: 'you@example.com o nome utente', ar: 'you@example.com أو اسم المستخدم' })} value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
          </AuthField>
          <AuthField label={tx(locale, { en: 'Password', es: 'Contraseña', it: 'Password', ar: 'كلمة المرور' })} icon={<LockKeyhole size={18} />}>
            <input required name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder={tx(locale, { en: '6-8 characters', es: '6-8 caracteres', it: '6-8 caratteri', ar: '٦-٨ أحرف' })} value={password} onChange={(e) => setPassword(e.target.value)} />
            <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? tx(locale, { en: 'Hide password', es: 'Ocultar contraseña', it: 'Nascondi password', ar: 'إخفاء كلمة المرور' }) : tx(locale, { en: 'Show password', es: 'Mostrar contraseña', it: 'Mostra password', ar: 'إظهار كلمة المرور' })}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
          </AuthField>
          <p className="auth-v2-switch">
            <Link href="/forgot-password">{tx(locale, { en: 'Forgot password?', es: '¿Olvidó su contraseña?', it: 'Hai dimenticato la password?', ar: 'نسيت كلمة المرور؟' })}</Link>
          </p>
          <button className="auth-v2-primary" type="submit" disabled={loading}>{loading ? tx(locale, { en: 'Signing in...', es: 'Iniciando sesión...', it: 'Accesso in corso...', ar: 'جارٍ تسجيل الدخول...' }) : tx(locale, { en: 'Sign in', es: 'Iniciar sesión', it: 'Accedi', ar: 'تسجيل الدخول' })} <ArrowRight size={18} /></button>
        </form>
        <p className="auth-v2-switch">{tx(locale, { en: 'New to Star Pyramids? ', es: '¿Nuevo en Star Pyramids? ', it: 'Nuovo su Star Pyramids? ', ar: 'جديد على STAR PYRAMIDS؟ ' })}<Link href="/register">{tx(locale, { en: 'Create an account', es: 'Crea una cuenta', it: 'Crea un account', ar: 'أنشئ حسابك' })}</Link></p>
      </div>
    </section>
  </main>
}

function RegisterForm() {
  const { locale } = useLocale()
  const router = useRouter()
  const searchParams = useSearchParams()
  const text = getCopy(authCopy, locale)
  const [countryCode, setCountryCode] = useState(defaultCountry.code)
  const [phoneCountry, setPhoneCountry] = useState(defaultCountry.code)
  const [phone, setPhone] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)
  const createFailed = tx(locale, { en: 'Could not create the account. Please try again.', es: 'No se pudo crear la cuenta. Inténtalo de nuevo.', it: 'Impossibile creare l’account. Riprova.', ar: 'تعذر إنشاء الحساب. حاول مرة أخرى.' })

  const socialPreview = (provider: SocialProvider) => setNotice(`${provider}${tx(locale, { en: ' is ready in the interface, but real sign-in requires backend OAuth configuration.', es: ' está listo en la interfaz, pero el inicio de sesión real requiere configuración OAuth en el backend.', it: ' è pronto nell’interfaccia, ma l’accesso reale richiede la configurazione OAuth nel backend.', ar: ' جاهز في التصميم، لكن الربط الحقيقي محتاج إعداد OAuth في الباك إند.' })}`)
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (loading) return
    setNotice('')
    const form = new FormData(event.currentTarget)
    if (form.get('password') !== form.get('confirmPassword')) {
      setNotice(tx(locale, { en: 'The passwords do not match.', es: 'Las contraseñas no coinciden.', it: 'Le password non corrispondono.', ar: 'كلمتا المرور غير متطابقتين.' }))
      return
    }
    setLoading(true)
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          firstName: form.get('firstName'),
          lastName: form.get('lastName'),
          username: form.get('username'),
          email: form.get('email'),
          phone: phone,
          password: form.get('password'),
          confirmPassword: form.get('confirmPassword'),
          countryCode,
          acceptedTerms: form.get('acceptedTerms') === 'on',
          next: searchParams.get('next'),
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        setNotice(data.error || createFailed)
        return
      }
      router.replace(typeof data.redirectTo === 'string' ? data.redirectTo : '/account')
      router.refresh()
    } catch {
      setNotice(createFailed)
    } finally {
      setLoading(false)
    }
  }

  return <main className={`auth-v2 is-register`}>
    <section className="auth-v2-visual">
      <img src={siteImages.pyramids} alt={tx(locale, { en: 'The Pyramids of Giza in Egypt', es: 'Las pirámides de Guiza en Egipto', it: 'Le piramidi di Giza in Egitto', ar: 'أهرامات الجيزة في مصر' })} />
      <div className="auth-v2-shade" />
      <div className="auth-v2-visual-content">
        <Logo />
        <div><span>{tx(locale, { en: 'Your STAR PYRAMIDS account', es: 'Tu cuenta de STAR PYRAMIDS', it: 'Il tuo account STAR PYRAMIDS', ar: 'حساب STAR PYRAMIDS' })}</span><h2>{text.imageTitle}</h2><p>{text.imageCopy}</p><ul>{text.benefits.map((benefit) => <li key={benefit}><Check size={16} />{benefit}</li>)}</ul></div>
      </div>
    </section>

    <section className="auth-v2-panel">
      <header className="auth-v2-top"><Link href="/" aria-label={tx(locale, { en: 'Back to home', es: 'Volver al inicio', it: 'Torna alla home', ar: 'العودة للرئيسية' })}><ArrowRight size={18} />{tx(locale, { en: 'Home', es: 'Inicio', it: 'Home', ar: 'الرئيسية' })}</Link><LanguageSelector /></header>
      <div className="auth-v2-card">
        <>
          <div className="auth-v2-heading"><span>{tx(locale, { en: 'Join STAR PYRAMIDS', es: 'Únete a STAR PYRAMIDS', it: 'Unisciti a STAR PYRAMIDS', ar: 'انضم لينا' })}</span><h1>{text.registerTitle}</h1><p>{text.registerCopy}</p></div>
          <SocialButtons onSelect={socialPreview} />
          {notice && <p className="auth-v2-notice" role="alert"><ShieldCheck size={17} />{notice}</p>}
          <div className="auth-v2-divider"><span>{tx(locale, { en: 'or use your details', es: 'o usa tus datos', it: 'oppure usa i tuoi dati', ar: 'أو استخدم بياناتك' })}</span></div>
          <form className="auth-v2-form" onSubmit={submit}>
            <div className="auth-v2-grid">
              <AuthField label={tx(locale, { en: 'First name', es: 'Nombre', it: 'Nome', ar: 'الاسم الأول' })} icon={<User size={18} />}><input required name="firstName" autoComplete="given-name" placeholder={tx(locale, { en: 'First name', es: 'Nombre', it: 'Nome', ar: 'الاسم الأول' })} /></AuthField>
              <AuthField label={tx(locale, { en: 'Last name', es: 'Apellidos', it: 'Cognome', ar: 'اسم العائلة' })} icon={<User size={18} />}><input required name="lastName" autoComplete="family-name" placeholder={tx(locale, { en: 'Last name', es: 'Apellidos', it: 'Cognome', ar: 'اسم العائلة' })} /></AuthField>
            </div>
            <AuthField label={tx(locale, { en: 'Username', es: 'Nombre de usuario', it: 'Nome utente', ar: 'اسم المستخدم' })} icon={<AtSign size={18} />}><input required name="username" autoComplete="username" minLength={3} maxLength={32} pattern="[A-Za-z0-9_.-]+" title={tx(locale, { en: 'Use letters, numbers, underscores, dots, or hyphens', es: 'Usa letras, números, guiones bajos, puntos o guiones', it: 'Usa lettere, numeri, underscore, punti o trattini', ar: 'استخدم الحروف والأرقام والشرطة السفلية والنقاط والشرطات' })} placeholder="traveler.name" /></AuthField>
            <AuthField label={tx(locale, { en: 'Email address', es: 'Correo electrónico', it: 'Indirizzo email', ar: 'البريد الإلكتروني' })} icon={<Mail size={18} />}><input required name="email" type="email" autoComplete="email" placeholder="you@example.com" /></AuthField>
            <div className="auth-v2-grid auth-v2-country-row">
              <AuthField label={tx(locale, { en: 'Country', es: 'País', it: 'Paese', ar: 'الدولة' })} icon={<MapPin size={18} />}><CountrySelect value={countryCode} onChange={(code) => { setCountryCode(code); setPhoneCountry(code) }} locale={locale} /></AuthField>
              <AuthField label={tx(locale, { en: 'Mobile number', es: 'Número de móvil', it: 'Numero di cellulare', ar: 'رقم الموبايل' })} icon={<Phone size={18} />} className="auth-v2-phone-field"><InternationalPhoneInput required value={phone} onChange={setPhone} locale={locale} countryCode={phoneCountry} onCountryChange={setPhoneCountry} placeholder={tx(locale, { en: 'Mobile number', es: 'Número de móvil', it: 'Numero di cellulare', ar: 'رقم الموبايل' })} /></AuthField>
            </div>
            <div className="auth-v2-grid"><PasswordField label={tx(locale, { en: 'Password', es: 'Contraseña', it: 'Password', ar: 'كلمة المرور' })} name="password" autoComplete="new-password" /><PasswordField label={tx(locale, { en: 'Confirm password', es: 'Confirmar contraseña', it: 'Conferma password', ar: 'تأكيد كلمة المرور' })} name="confirmPassword" autoComplete="new-password" /></div>
            <label className="auth-v2-check"><input required name="acceptedTerms" type="checkbox" /><span><Check size={13} /></span><em>{tx(locale, { en: 'I agree to the ', es: 'Acepto los ', it: 'Accetto i ', ar: 'أوافق على ' })}<Link href="/terms">{tx(locale, { en: 'Terms and Conditions', es: 'Términos y condiciones', it: 'Termini e condizioni', ar: 'الشروط والأحكام' })}</Link>{tx(locale, { en: ' and ', es: ' y ', it: ' e ', ar: ' و' })}<Link href="/privacy">{tx(locale, { en: 'Privacy Policy', es: 'Política de privacidad', it: 'Informativa sulla privacy', ar: 'سياسة الخصوصية' })}</Link>.</em></label>
            <button className="auth-v2-primary" type="submit" disabled={loading}>{loading ? tx(locale, { en: 'Creating account...', es: 'Creando cuenta...', it: 'Creazione account in corso...', ar: 'جارٍ إنشاء الحساب...' }) : tx(locale, { en: 'Create account', es: 'Crear cuenta', it: 'Crea account', ar: 'إنشاء الحساب' })} <ArrowRight size={18} /></button>
          </form>
          <p className="auth-v2-switch">{tx(locale, { en: 'Already have an account? ', es: '¿Ya tienes una cuenta? ', it: 'Hai già un account? ', ar: 'عندك حساب بالفعل؟ ' })}<Link href="/login">{tx(locale, { en: 'Sign in', es: 'Iniciar sesión', it: 'Accedi', ar: 'سجّل دخولك' })}</Link></p>
        </>
      </div>
    </section>
  </main>
}

export function LoginPage() {
  return <LocaleProvider><Suspense><LoginForm /></Suspense></LocaleProvider>
}

export function RegisterPage() {
  return <LocaleProvider><Suspense><RegisterForm /></Suspense></LocaleProvider>
}
