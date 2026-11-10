'use client'

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, Check, CircleAlert, Eye, EyeOff, Mail } from "lucide-react";
import { siteImages } from "@/data/content";
import { useLocale, tx } from "../locale";
import { Logo, SiteShell } from "@/components/site";
import { LanguageSelector } from "../shared/language-selector";
import { customerErrorText } from "@/lib/account/customer-error-copy";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const { locale } = useLocale();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not send reset email. Please try again.');
        return;
      }
      setSent(true);
    } catch {
      setError('Could not send reset link. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="auth-v2">
      <section className="auth-v2-visual">
        <img
          src={siteImages.pyramids}
          alt={tx(locale, { en: 'The Pyramids of Giza in Egypt', es: 'Las pirámides de Guiza en Egipto', it: 'Le piramidi di Giza in Egitto', ar: 'أهرامات الجيزة في مصر' })}
        />
        <div className="auth-v2-shade" />
        <div className="auth-v2-visual-content">
          <Logo />
          <div>
            <span>{tx(locale, { en: 'Your STAR PYRAMIDS account', es: 'Tu cuenta de STAR PYRAMIDS', it: 'Il tuo account STAR PYRAMIDS', ar: 'حساب STAR PYRAMIDS' })}</span>
            <h2>{tx(locale, { en: 'Your next Egypt story, kept in one place.', es: 'Tu próxima historia en Egipto, en un solo lugar.', it: 'La tua prossima storia in Egitto, in un unico posto.', ar: 'كل تفاصيل رحلتك لمصر في مكان واحد.' })}</h2>
            <p>{tx(locale, { en: 'Return to saved trips, continue planning, and keep the details of your journey close.', es: 'Vuelve a tus viajes guardados, sigue planificando y ten los detalles de tu viaje a mano.', it: 'Torna ai viaggi salvati, continua a pianificare e tieni i dettagli del viaggio con te.', ar: 'ارجع لرحلاتك المحفوظة، كمّل التخطيط، وخلي تفاصيل رحلتك قريبة منك.' })}</p>
            <ul>
              <li><Check size={16} />{tx(locale, { en: 'Save tours for later', es: 'Guarda tours para después', it: 'Salva i tour per dopo', ar: 'احفظ الرحلات لوقت لاحق' })}</li>
              <li><Check size={16} />{tx(locale, { en: 'Keep trip enquiries together', es: 'Mantén tus consultas juntas', it: 'Tieni insieme le richieste di viaggio', ar: 'اجمع طلبات الرحلة في مكان واحد' })}</li>
              <li><Check size={16} />{tx(locale, { en: 'Continue planning across devices', es: 'Sigue planificando en todos tus dispositivos', it: 'Continua a pianificare su ogni dispositivo', ar: 'كمّل التخطيط من أي جهاز' })}</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="auth-v2-panel">
        <header className="auth-v2-top">
          <Link
            href="/"
            aria-label={tx(locale, { en: 'Back to home', es: 'Volver al inicio', it: 'Torna alla home', ar: 'العودة للرئيسية' })}
          >
            <ArrowRight size={18} />{tx(locale, { en: 'Home', es: 'Inicio', it: 'Home', ar: 'الرئيسية' })}</Link>
          <LanguageSelector />
        </header>
        <div className="auth-v2-card">
          <div className="auth-v2-heading">
            <span>{tx(locale, { en: 'Account recovery', es: 'Recuperación de la cuenta', it: 'Recupero account', ar: 'استعادة الحساب' })}</span>
            <h1>{tx(locale, { en: 'Reset your password', es: 'Restablece tu contraseña', it: 'Reimposta la tua password', ar: 'استعادة كلمة المرور' })}</h1>
            <p>{tx(locale, { en: 'Enter the email address linked to your account and we\'ll send you a secure reset link.', es: 'Introduce el correo electrónico vinculado a tu cuenta y te enviaremos un enlace seguro para restablecer la contraseña.', it: 'Inserisci l\'indirizzo email collegato al tuo account e ti invieremo un link sicuro per reimpostare la password.', ar: 'أدخل عنوان البريد الإلكتروني المرتبط بحسابك وسنرسل لك رابط إعادة تعيين آمن.' })}</p>
          </div>
          {error && <p className="auth-v2-notice" role="alert"><CircleAlert size={15} />{customerErrorText(locale, error, tx(locale, { en: 'Could not send reset link. Please try again.', es: 'No se pudo enviar el enlace de restablecimiento. Inténtalo de nuevo.', it: 'Impossibile inviare il link di reimpostazione. Riprova.', ar: 'تعذر إرسال رابط إعادة التعيين. حاول مجددًا.' }))}</p>}
          <form className="auth-v2-form" onSubmit={handleSubmit}>
            <label className="auth-v2-field">
              <span>{tx(locale, { en: 'Email address', es: 'Correo electrónico', it: 'Indirizzo email', ar: 'البريد الإلكتروني' })}</span>
              <div>
                <Mail size={18} />
                <input
                  required
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={submitting}
                />
              </div>
            </label>
            <button className="auth-v2-primary" type="submit" disabled={submitting}>
              {submitting
                ? tx(locale, { en: 'Sending...', es: 'Enviando...', it: 'Invio...', ar: 'جارٍ الإرسال...' })
                : tx(locale, { en: 'Send reset link', es: 'Enviar enlace de restablecimiento', it: 'Invia link di recupero', ar: 'إرسال رابط الاستعادة' })}
              <ArrowRight size={17} />
            </button>
          </form>
          <p className="auth-v2-switch">
            {tx(locale, { en: 'Remember your password?', es: '¿Recuerdas tu contraseña?', it: 'Ti ricordi la password?', ar: 'تذكرت كلمة المرور?' })}
            <Link href="/login">{tx(locale, { en: 'Back to sign in', es: 'Volver a iniciar sesión', it: 'Torna all\'accesso', ar: 'العودة إلى تسجيل الدخول' })}</Link>
          </p>
        </div>
      </section>
    </main>
  );
}


export function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordContent />
    </Suspense>
  );
}

function ResetPasswordContent() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const { locale } = useLocale();
  const params = useSearchParams();
  const token = params.get('token') || '';

  const passwordError = password.length > 0
    ? (password.length < 6 ? 'Password must be at least 6 characters.' : password.length > 8 ? 'Password must be at most 8 characters.' : null)
    : null;
  const matches = password.length > 0 && password === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (passwordError || !matches) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ token, password, confirmPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not reset password. Please try again.');
        return;
      }
      setSubmitted(true);
    } catch {
      setError('Could not reset password. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!token) {
    return (
      <SiteShell>
        <main className="auth-page-centered">
          <div className="auth-card">
            <div className="auth-mobile-logo">
              <Link href="/">
                <span className="brand-copy"><strong>STAR PYRAMIDS</strong><small>SINCE 1970</small></span>
              </Link>
            </div>
            <div className="form-success">
              <CircleAlert size={34} style={{ color: 'var(--error)' }} />
              <h2>{tx(locale, { en: 'Invalid link', es: 'Enlace no válido', it: 'Link non valido', ar: 'رابط غير صالح' })}</h2>
              <p>{tx(locale, { en: 'This password reset link is missing or invalid. Please request a new one.', es: 'Este enlace de restablecimiento de contraseña falta o no es válido. Por favor solicita uno nuevo.', it: 'Questo link per il ripristino della password manca o non è valido. Richiedine uno nuovo.', ar: 'رابط إعادة تعيين كلمة المرور هذا مفقود أو غير صالح. يرجى طلب واحد جديد.' })}</p>
              <p className="auth-switch"><Link href="/forgot-password">{tx(locale, { en: 'Request new link', es: 'Solicitar nuevo enlace', it: 'Richiedi nuovo link', ar: 'طلب رابط جديد' })}</Link></p>
            </div>
          </div>
        </main>
      </SiteShell>
    );
  }

  if (submitted) {
    return (
      <SiteShell>
        <main className="auth-page-centered">
          <div className="auth-card">
            <div className="auth-mobile-logo">
              <Link href="/">
                <span className="brand-copy"><strong>STAR PYRAMIDS</strong><small>SINCE 1970</small></span>
              </Link>
            </div>
            <div className="form-success">
              <Check size={34} />
              <h2>{tx(locale, { en: 'Password updated', es: 'Contraseña actualizada', it: 'Password aggiornata', ar: 'تم تحديث كلمة المرور' })}</h2>
              <p>{tx(locale, { en: 'Your password has been reset successfully.', es: 'Tu contraseña se ha restablecido correctamente.', it: 'La tua password è stata reimpostata con successo.', ar: 'تمت إعادة تعيين كلمة المرور بنجاح.' })}</p>
              <p className="auth-switch"><Link href="/login">{tx(locale, { en: 'Sign in with new password', es: 'Iniciar sesión con nueva contraseña', it: 'Accedi con la nuova password', ar: 'تسجيل الدخول بكلمة المرور الجديدة' })}</Link></p>
            </div>
          </div>
        </main>
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <main className="auth-page-centered">
        <div className="auth-card">
          <div className="auth-mobile-logo">
            <Link href="/">
              <span className="brand-copy"><strong>STAR PYRAMIDS</strong><small>SINCE 1970</small></span>
            </Link>
          </div>
          <span className="eyebrow">{tx(locale, { en: 'Account recovery', es: 'Recuperación de la cuenta', it: 'Recupero account', ar: 'استعادة الحساب' })}</span>
          <h1>{tx(locale, { en: 'Create new password', es: 'Crear nueva contraseña', it: 'Crea nuova password', ar: 'إنشاء كلمة مرور جديدة' })}</h1>
          <p>{tx(locale, { en: 'Enter your new password below. It must be 6-64 characters.', es: 'Introduce tu nueva contraseña a continuación. Debe tener 6-64 caracteres.', it: 'Inserisci la tua nuova password qui sotto. Deve essere di 6-64 caratteri.', ar: 'أدخل كلمة المرور الجديدة أدناه. يجب أن تكون 6-64 حرفًا.' })}</p>
          <form className="contact-form" onSubmit={handleSubmit}>
            {error && <p className="co-error" role="alert"><CircleAlert size={15} />{customerErrorText(locale, error, tx(locale, { en: 'Could not reset password. Please try again.', es: 'No se pudo restablecer la contraseña. Inténtalo de nuevo.', it: 'Impossibile reimpostare la password. Riprova.', ar: 'تعذر إعادة تعيين كلمة المرور. حاول مجددًا.' }))}</p>}
            <label>
              {tx(locale, { en: 'New password', es: 'Contraseña nueva', it: 'Nuova password', ar: 'كلمة المرور الجديدة' })}
              <span>
                <input
                  required
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Enter new password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={submitting}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword
                    ? tx(locale, { en: 'Hide password', es: 'Ocultar contraseña', it: 'Nascondi password', ar: 'إخفاء كلمة المرور' })
                    : tx(locale, { en: 'Show password', es: 'Mostrar contraseña', it: 'Mostra password', ar: 'إظهار كلمة المرور' })}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </span>
              {passwordError && <span className="field-error" role="alert">{passwordError}</span>}
            </label>
            <label>
              {tx(locale, { en: 'Confirm new password', es: 'Confirmar contraseña nueva', it: 'Conferma nuova password', ar: 'تأكيد كلمة المرور الجديدة' })}
              <span>
                <input
                  required
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={submitting}
                />
              </span>
              {confirmPassword && !matches && <span className="field-error" role="alert">{tx(locale, { en: 'Passwords do not match.', es: 'Las contraseñas no coinciden.', it: 'Le password non coincidono.', ar: 'كلمتا المرور غير متطابقتين.' })}</span>}
            </label>
            <div className="customer-password-rules" aria-live="polite">
              <span className={password.length >= 6 && password.length <= 64 ? 'valid' : ''}><Check size={14} />{tx(locale, { en: '6-64 characters', es: '6-64 caracteres', it: '6-64 caratteri', ar: '6-64 حرفًا' })}</span>
              <span className={matches ? 'valid' : ''}><Check size={14} />{tx(locale, { en: 'Passwords match', es: 'Las contraseñas coinciden', it: 'Le password coincidono', ar: 'كلمتا المرور متطابقتان' })}</span>
            </div>
            <button className="primary-btn" type="submit" disabled={submitting || Boolean(passwordError) || !matches}>
              {submitting
                ? tx(locale, { en: 'Updating…', es: 'Actualizando…', it: 'Aggiornando…', ar: 'جارٍ التحديث…' })
                : tx(locale, { en: 'Update password', es: 'Actualizar contraseña', it: 'Aggiorna password', ar: 'تحديث كلمة المرور' })}
              <ArrowRight size={17} />
            </button>
          </form>
          <p className="auth-switch">
            {tx(locale, { en: 'Remember your password?', es: '¿Recuerdas tu contraseña?', it: 'Ti ricordi la password?', ar: 'تذكرت كلمة المرور؟' })}
            <Link href="/login">{tx(locale, { en: 'Back to sign in', es: 'Volver a iniciar sesión', it: 'Torna all\'accesso', ar: 'العودة إلى تسجيل الدخول' })}</Link>
          </p>
        </div>
      </main>
    </SiteShell>
  );
}
