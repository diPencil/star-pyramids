'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, type FormEvent, type ReactNode, Suspense } from 'react'
import { ArrowRight, AtSign, Check, Eye, EyeOff, LockKeyhole, Mail, MapPin, Phone, ShieldCheck, User } from 'lucide-react'
import { countries, countryFlag, defaultCountry } from '@/data/countries'
import { CountrySelect } from '@/components/country-select'
import { FacebookIcon, GoogleIcon } from './brand-icons'
import { siteImages } from '@/data/content'
import { LocaleProvider, useLocale } from './locale'
import { LanguageSelector } from './language-selector'
import { Logo } from './site'
import { getCopy } from '@/lib/locale-helpers'

type AuthMode = 'login' | 'register'
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
} as const

const authCopy = { ...baseAuthCopy, es: baseAuthCopy.en, it: baseAuthCopy.en } as const

function AuthField({ label, icon, children, className = '' }: { label: string; icon: ReactNode; children: ReactNode; className?: string }) {
  return <label className={`auth-v2-field ${className}`}><span>{label}</span><div>{icon}{children}</div></label>
}

function PasswordField({ label, name, autoComplete }: { label: string; name: string; autoComplete: string }) {
  const { locale } = useLocale()
  const [show, setShow] = useState(false)
  return <AuthField label={label} icon={<LockKeyhole size={18} />}><input required name={name} minLength={6} maxLength={8} type={show ? 'text' : 'password'} autoComplete={autoComplete} placeholder={locale === 'ar' ? '٦-٨ أحرف' : '6-8 characters'} /><button type="button" onClick={() => setShow((value) => !value)} aria-label={show ? (locale === 'ar' ? 'إخفاء كلمة المرور' : 'Hide password') : (locale === 'ar' ? 'إظهار كلمة المرور' : 'Show password')}>{show ? <EyeOff size={18} /> : <Eye size={18} />}</button></AuthField>
}

function SocialButtons({ onSelect }: { onSelect: (provider: SocialProvider) => void }) {
  const { locale } = useLocale()
  return <div className="auth-v2-socials">
    <button type="button" onClick={() => onSelect('Google')}><GoogleIcon /><span>{locale === 'ar' ? 'المتابعة باستخدام Google' : 'Continue with Google'}</span></button>
    <button type="button" onClick={() => onSelect('Facebook')}><FacebookIcon /><span>{locale === 'ar' ? 'المتابعة باستخدام Facebook' : 'Continue with Facebook'}</span></button>
  </div>
}

function AuthSuccess({ mode, reset }: { mode: AuthMode; reset: () => void }) {
  const { locale } = useLocale()
  const ar = locale === 'ar'
  return <div className="auth-v2-success"><span><Check size={28} /></span><small>{ar ? 'نسخة تجريبية' : 'Preview mode'}</small><h1>{mode === 'register' ? (ar ? 'بيانات الحساب جاهزة للمراجعة.' : 'Your account details are ready.') : (ar ? 'تم التحقق من نموذج الدخول.' : 'The sign-in form is complete.')}</h1><p>{ar ? 'لم يتم إنشاء حساب أو إرسال أي بيانات. الربط الحقيقي هيتم عند توصيل نظام الحسابات والباك إند.' : 'No account was created and no data was transmitted. Real access will begin when the account backend is connected.'}</p><button className="auth-v2-primary" type="button" onClick={reset}>{ar ? 'رجوع للنموذج' : 'Back to the form'}</button></div>
}

function LoginForm() {
  const { locale } = useLocale()
  const router = useRouter()
  const searchParams = useSearchParams()
  const ar = locale === 'ar'
  const text = getCopy(authCopy, locale)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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
        body: JSON.stringify({ email, password }),
      })
      if (res.ok) {
        const next = searchParams.get('next')
        if (next && next.startsWith('/')) {
          router.push(next)
        } else {
          router.push('/admin')
        }
        return
      }
      const data = await res.json().catch(() => ({}))
      setError(data.error || (ar ? 'حدث خطأ. حاول مرة أخرى.' : 'An error occurred. Please try again.'))
    } catch {
      setError(ar ? 'حدث خطأ. حاول مرة أخرى.' : 'An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return <main className="auth-v2">
    <section className="auth-v2-visual">
      <img src={siteImages.pyramids} alt={ar ? 'أهرامات الجيزة في مصر' : 'The Pyramids of Giza in Egypt'} />
      <div className="auth-v2-shade" />
      <div className="auth-v2-visual-content">
        <Logo />
        <div><span>{ar ? 'حساب STAR PYRAMIDS' : 'Your STAR PYRAMIDS account'}</span><h2>{text.imageTitle}</h2><p>{text.imageCopy}</p><ul>{text.benefits.map((benefit) => <li key={benefit}><Check size={16} />{benefit}</li>)}</ul></div>
      </div>
    </section>

    <section className="auth-v2-panel">
      <header className="auth-v2-top"><Link href="/" aria-label={ar ? 'العودة للرئيسية' : 'Back to home'}><ArrowRight size={18} />{ar ? 'الرئيسية' : 'Home'}</Link><LanguageSelector /></header>
      <div className="auth-v2-card">
        <div className="auth-v2-heading"><span>{ar ? 'مرحبًا بعودتك' : 'Welcome back'}</span><h1>{text.loginTitle}</h1><p>{text.loginCopy}</p></div>
        {error && <p className="auth-v2-notice" role="alert"><ShieldCheck size={17} />{error}</p>}
        <form className="auth-v2-form" onSubmit={handleSubmit}>
          <AuthField label={ar ? 'البريد الإلكتروني' : 'Email address'} icon={<Mail size={18} />}>
            <input required name="email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </AuthField>
          <AuthField label={ar ? 'كلمة المرور' : 'Password'} icon={<LockKeyhole size={18} />}>
            <input required name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder={ar ? '٦-٨ أحرف' : '6-8 characters'} value={password} onChange={(e) => setPassword(e.target.value)} />
            <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? (ar ? 'إخفاء كلمة المرور' : 'Hide password') : (ar ? 'إظهار كلمة المرور' : 'Show password')}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
          </AuthField>
          <button className="auth-v2-primary" type="submit" disabled={loading}>{loading ? (ar ? 'جارٍ تسجيل الدخول...' : 'Signing in...') : (ar ? 'تسجيل الدخول' : 'Sign in')} <ArrowRight size={18} /></button>
        </form>
      </div>
    </section>
  </main>
}

function RegisterForm() {
  const { locale } = useLocale()
  const ar = locale === 'ar'
  const text = getCopy(authCopy, locale)
  const [countryCode, setCountryCode] = useState(defaultCountry.code)
  const [notice, setNotice] = useState('')
  const [success, setSuccess] = useState(false)
  const selectedCountry = countries.find((country) => country.code === countryCode) ?? defaultCountry

  const socialPreview = (provider: SocialProvider) => setNotice(ar ? `${provider} جاهز في التصميم، لكن الربط الحقيقي محتاج إعداد OAuth في الباك إند.` : `${provider} is ready in the interface, but real sign-in requires backend OAuth configuration.`)
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setNotice('')
    const form = new FormData(event.currentTarget)
    if (form.get('password') !== form.get('confirmPassword')) {
      setNotice(ar ? 'كلمتا المرور غير متطابقتين.' : 'The passwords do not match.')
      return
    }
    setSuccess(true)
  }

  return <main className={`auth-v2 is-register`}>
    <section className="auth-v2-visual">
      <img src={siteImages.pyramids} alt={ar ? 'أهرامات الجيزة في مصر' : 'The Pyramids of Giza in Egypt'} />
      <div className="auth-v2-shade" />
      <div className="auth-v2-visual-content">
        <Logo />
        <div><span>{ar ? 'حساب STAR PYRAMIDS' : 'Your STAR PYRAMIDS account'}</span><h2>{text.imageTitle}</h2><p>{text.imageCopy}</p><ul>{text.benefits.map((benefit) => <li key={benefit}><Check size={16} />{benefit}</li>)}</ul></div>
      </div>
    </section>

    <section className="auth-v2-panel">
      <header className="auth-v2-top"><Link href="/" aria-label={ar ? 'العودة للرئيسية' : 'Back to home'}><ArrowRight size={18} />{ar ? 'الرئيسية' : 'Home'}</Link><LanguageSelector /></header>
      <div className="auth-v2-card">
        {success ? <AuthSuccess mode="register" reset={() => setSuccess(false)} /> : <>
          <div className="auth-v2-heading"><span>{ar ? 'انضم لينا' : 'Join STAR PYRAMIDS'}</span><h1>{text.registerTitle}</h1><p>{text.registerCopy}</p></div>
          <SocialButtons onSelect={socialPreview} />
          {notice && <p className="auth-v2-notice" role="status"><ShieldCheck size={17} />{notice}</p>}
          <div className="auth-v2-divider"><span>{ar ? 'أو استخدم بياناتك' : 'or use your details'}</span></div>
          <form className="auth-v2-form" onSubmit={submit}>
            <div className="auth-v2-grid">
              <AuthField label={ar ? 'الاسم الأول' : 'First name'} icon={<User size={18} />}><input required name="firstName" autoComplete="given-name" placeholder={ar ? 'الاسم الأول' : 'First name'} /></AuthField>
              <AuthField label={ar ? 'اسم العائلة' : 'Last name'} icon={<User size={18} />}><input required name="lastName" autoComplete="family-name" placeholder={ar ? 'اسم العائلة' : 'Last name'} /></AuthField>
            </div>
            <AuthField label={ar ? 'اسم المستخدم' : 'Username'} icon={<AtSign size={18} />}><input required name="username" autoComplete="username" minLength={3} maxLength={24} pattern="[A-Za-z0-9_]+" title={ar ? 'استخدم حروف إنجليزية وأرقام وشرطة سفلية فقط' : 'Use letters, numbers, and underscores only'} placeholder="traveler_name" /></AuthField>
            <AuthField label={ar ? 'البريد الإلكتروني' : 'Email address'} icon={<Mail size={18} />}><input required name="email" type="email" autoComplete="email" placeholder="you@example.com" /></AuthField>
            <div className="auth-v2-grid auth-v2-country-row">
              <AuthField label={ar ? 'الدولة' : 'Country'} icon={<MapPin size={18} />}><CountrySelect value={countryCode} onChange={setCountryCode} locale={ar ? 'ar' : 'en'} /></AuthField>
              <AuthField label={ar ? 'رقم الموبايل' : 'Mobile number'} icon={<Phone size={18} />} className="auth-v2-phone-field"><span className="auth-v2-dial" aria-label={ar ? 'كود الدولة' : 'Country calling code'}>{countryFlag(selectedCountry.code)} {selectedCountry.dialCode}</span><input required name="phone" type="tel" inputMode="tel" autoComplete="tel-national" pattern="[0-9 ()-]{6,18}" placeholder={ar ? 'رقم الموبايل' : 'Mobile number'} /></AuthField>
            </div>
            <div className="auth-v2-grid"><PasswordField label={ar ? 'كلمة المرور' : 'Password'} name="password" autoComplete="new-password" /><PasswordField label={ar ? 'تأكيد كلمة المرور' : 'Confirm password'} name="confirmPassword" autoComplete="new-password" /></div>
            <label className="auth-v2-check"><input required type="checkbox" /><span><Check size={13} /></span><em>{ar ? 'أوافق على ' : 'I agree to the '}<Link href="/terms">{ar ? 'الشروط والأحكام' : 'Terms and Conditions'}</Link>{ar ? ' و' : ' and '}<Link href="/privacy">{ar ? 'سياسة الخصوصية' : 'Privacy Policy'}</Link>.</em></label>
            <button className="auth-v2-primary" type="submit">{ar ? 'إنشاء الحساب' : 'Create account'} <ArrowRight size={18} /></button>
          </form>
          <p className="auth-v2-switch">{ar ? 'عندك حساب بالفعل؟ ' : 'Already have an account? '}<Link href="/login">{ar ? 'سجّل دخولك' : 'Sign in'}</Link></p>
        </>}
      </div>
    </section>
  </main>
}

export function LoginPage() {
  return <LocaleProvider><Suspense><LoginForm /></Suspense></LocaleProvider>
}

export function RegisterPage() {
  return <LocaleProvider><AuthExperience mode="register" /></LocaleProvider>
}

function AuthExperience({ mode }: { mode: AuthMode }) {
  const { locale } = useLocale()
  const ar = locale === 'ar'
  const copy = getCopy(authCopy, locale)
  const [countryCode, setCountryCode] = useState(defaultCountry.code)
  const [notice, setNotice] = useState('')
  const [success, setSuccess] = useState(false)
  const selectedCountry = countries.find((country) => country.code === countryCode) ?? defaultCountry
  const title = mode === 'login' ? copy.loginTitle : copy.registerTitle
  const intro = mode === 'login' ? copy.loginCopy : copy.registerCopy

  const socialPreview = (provider: SocialProvider) => setNotice(ar ? `${provider} جاهز في التصميم، لكن الربط الحقيقي محتاج إعداد OAuth في الباك إند.` : `${provider} is ready in the interface, but real sign-in requires backend OAuth configuration.`)
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setNotice('')
    if (mode === 'register') {
      const form = new FormData(event.currentTarget)
      if (form.get('password') !== form.get('confirmPassword')) {
        setNotice(ar ? 'كلمتا المرور غير متطابقتين.' : 'The passwords do not match.')
        return
      }
    }
    setSuccess(true)
  }

  return <main className={`auth-v2 ${mode === 'register' ? 'is-register' : ''}`}>
    <section className="auth-v2-visual">
      <img src={siteImages.pyramids} alt={ar ? 'أهرامات الجيزة في مصر' : 'The Pyramids of Giza in Egypt'} />
      <div className="auth-v2-shade" />
      <div className="auth-v2-visual-content">
        <Logo />
        <div><span>{ar ? 'حساب STAR PYRAMIDS' : 'Your STAR PYRAMIDS account'}</span><h2>{copy.imageTitle}</h2><p>{copy.imageCopy}</p><ul>{copy.benefits.map((benefit) => <li key={benefit}><Check size={16} />{benefit}</li>)}</ul></div>
      </div>
    </section>

    <section className="auth-v2-panel">
      <header className="auth-v2-top"><Link href="/" aria-label={ar ? 'العودة للرئيسية' : 'Back to home'}><ArrowRight size={18} />{ar ? 'الرئيسية' : 'Home'}</Link><LanguageSelector /></header>
      <div className="auth-v2-card">
        {success ? <AuthSuccess mode={mode} reset={() => setSuccess(false)} /> : <>
          <div className="auth-v2-heading"><span>{mode === 'login' ? (ar ? 'مرحبًا بعودتك' : 'Welcome back') : (ar ? 'انضم لينا' : 'Join STAR PYRAMIDS')}</span><h1>{title}</h1><p>{intro}</p></div>
          <SocialButtons onSelect={socialPreview} />
          {notice && <p className="auth-v2-notice" role="status"><ShieldCheck size={17} />{notice}</p>}
          <div className="auth-v2-divider"><span>{ar ? 'أو استخدم بياناتك' : 'or use your details'}</span></div>
          <form className="auth-v2-form" onSubmit={submit}>
            {mode === 'register' && <>
              <div className="auth-v2-grid">
                <AuthField label={ar ? 'الاسم الأول' : 'First name'} icon={<User size={18} />}><input required name="firstName" autoComplete="given-name" placeholder={ar ? 'الاسم الأول' : 'First name'} /></AuthField>
                <AuthField label={ar ? 'اسم العائلة' : 'Last name'} icon={<User size={18} />}><input required name="lastName" autoComplete="family-name" placeholder={ar ? 'اسم العائلة' : 'Last name'} /></AuthField>
              </div>
              <AuthField label={ar ? 'اسم المستخدم' : 'Username'} icon={<AtSign size={18} />}><input required name="username" autoComplete="username" minLength={3} maxLength={24} pattern="[A-Za-z0-9_]+" title={ar ? 'استخدم حروف إنجليزية وأرقام وشرطة سفلية فقط' : 'Use letters, numbers, and underscores only'} placeholder="traveler_name" /></AuthField>
              <AuthField label={ar ? 'البريد الإلكتروني' : 'Email address'} icon={<Mail size={18} />}><input required name="email" type="email" autoComplete="email" placeholder="you@example.com" /></AuthField>
              <div className="auth-v2-grid auth-v2-country-row">
                <AuthField label={ar ? 'الدولة' : 'Country'} icon={<MapPin size={18} />}><CountrySelect value={countryCode} onChange={setCountryCode} locale={ar ? 'ar' : 'en'} /></AuthField>
                <AuthField label={ar ? 'رقم الموبايل' : 'Mobile number'} icon={<Phone size={18} />} className="auth-v2-phone-field"><span className="auth-v2-dial" aria-label={ar ? 'كود الدولة' : 'Country calling code'}>{countryFlag(selectedCountry.code)} {selectedCountry.dialCode}</span><input required name="phone" type="tel" inputMode="tel" autoComplete="tel-national" pattern="[0-9 ()-]{6,18}" placeholder={ar ? 'رقم الموبايل' : 'Mobile number'} /></AuthField>
              </div>
              <div className="auth-v2-grid"><PasswordField label={ar ? 'كلمة المرور' : 'Password'} name="password" autoComplete="new-password" /><PasswordField label={ar ? 'تأكيد كلمة المرور' : 'Confirm password'} name="confirmPassword" autoComplete="new-password" /></div>
              <label className="auth-v2-check"><input required type="checkbox" /><span><Check size={13} /></span><em>{ar ? 'أوافق على ' : 'I agree to the '}<Link href="/terms">{ar ? 'الشروط والأحكام' : 'Terms and Conditions'}</Link>{ar ? ' و' : ' and '}<Link href="/privacy">{ar ? 'سياسة الخصوصية' : 'Privacy Policy'}</Link>.</em></label>
            </>}
            {mode === 'login' && <>
              <AuthField label={ar ? 'البريد الإلكتروني أو اسم المستخدم' : 'Email or username'} icon={<AtSign size={18} />}><input required name="identity" autoComplete="username" placeholder={ar ? 'البريد أو اسم المستخدم' : 'Email or username'} /></AuthField>
              <PasswordField label={ar ? 'كلمة المرور' : 'Password'} name="password" autoComplete="current-password" />
              <div className="auth-v2-options"><label><input type="checkbox" />{ar ? 'تذكرني' : 'Remember me'}</label><Link href="/forgot-password">{ar ? 'نسيت كلمة المرور؟' : 'Forgot password?'}</Link></div>
            </>}
            <button className="auth-v2-primary" type="submit">{mode === 'login' ? (ar ? 'تسجيل الدخول' : 'Sign in') : (ar ? 'إنشاء الحساب' : 'Create account')} <ArrowRight size={18} /></button>
          </form>
          <p className="auth-v2-switch">{mode === 'login' ? (ar ? 'لسه معندكش حساب؟ ' : 'New to STAR PYRAMIDS? ') : (ar ? 'عندك حساب بالفعل؟ ' : 'Already have an account? ')}<Link href={mode === 'login' ? '/register' : '/login'}>{mode === 'login' ? (ar ? 'اعمل حساب' : 'Create an account') : (ar ? 'سجّل دخولك' : 'Sign in')}</Link></p>
        </>}
      </div>
    </section>
  </main>
}
