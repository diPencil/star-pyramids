'use client'
import { useEffect, useId, useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { overallTrackingHealth, type TrackingHealthCheck, type TrackingHealthReport, type TrackingHealthStatus } from '@/lib/tracking/health/tracking-health'
import { observeTrackingBrowser } from '@/lib/tracking/health/tracking-health-browser'
import { toast } from '../admin-toaster'
import styles from './tracking-health.module.css'

const messages: Record<string, readonly [string, string]> = {
  configuration_valid: ['Saved IDs are valid in format. This alone does not verify installation or data delivery.', 'صيغة المعرّفات المحفوظة صحيحة. هذا وحده لا يثبت التثبيت أو وصول البيانات.'],
  gtm_disabled: ['Enable GTM in the saved settings when you are ready to measure.', 'فعّل GTM في الإعدادات المحفوظة عندما تكون مستعدًا للقياس.'],
  gtm_id_invalid: ['Save a valid GTM Container ID.', 'احفظ معرّف حاوية GTM صالحًا.'],
  ga4_id_invalid: ['Save the GA4 Measurement ID for the intended web stream.', 'احفظ معرّف قياس GA4 لمصدر بيانات الويب المطلوب.'],
  configuration_incomplete: ['Complete and save the IDs before this check can run.', 'أكمل المعرّفات واحفظها قبل إجراء هذا الفحص.'],
  google_credentials_missing: ['Configure server-side read-only Google credentials. No Google account verification was performed.', 'اضبط بيانات اعتماد Google على الخادم للقراءة فقط. لم يتم التحقق من حساب Google.'],
  google_credentials_invalid: ['The server credential is invalid. Ask the server administrator to review its secure configuration.', 'بيانات اعتماد الخادم غير صالحة. اطلب من مسؤول الخادم مراجعة إعدادها الآمن.'],
  google_permission_denied: ['Google denied access. Review API enablement and read-only account/property permissions.', 'رفض Google الوصول. راجع تفعيل الواجهات وصلاحيات القراءة للحساب والموقع.'],
  google_auth_failed: ['Google authentication failed. Review the server credential; do not paste it into this page.', 'فشلت مصادقة Google. راجع بيانات اعتماد الخادم دون لصقها في هذه الصفحة.'],
  google_timeout: ['Google did not respond within the time limit. Try again later.', 'لم يستجب Google خلال المهلة المحددة. أعد المحاولة لاحقًا.'],
  google_api_error: ['The Google API check could not be completed. This is not proof of a tracking failure.', 'تعذر إكمال فحص واجهة Google. هذا لا يثبت فشل التتبع.'],
  container_lookup_unresolved: ['The requested container could not be resolved through the authorized API.', 'تعذر تحديد الحاوية المطلوبة عبر الواجهة المصرّح بها.'],
  published_version_missing: ['No published container version was verified. Preview is not publication evidence.', 'لم يتم التحقق من نسخة منشورة للحاوية. وضع المعاينة لا يثبت النشر.'],
  published_empty: ['The published container has no tags. Configure, review and publish the intended Google tag in GTM.', 'الحاوية المنشورة بلا علامات. اضبط علامة Google المطلوبة وراجعها ثم انشرها في GTM.'],
  published_destination_matched: ['The live GTM API version contains an enabled Google tag with the expected static GA4 ID and a firing trigger. Actual firing is a separate check.', 'تحتوي نسخة GTM المنشورة على علامة Google مفعّلة بمعرّف GA4 المتوقع ومشغّل. التنفيذ الفعلي فحص مستقل.'],
  published_tag_inactive: ['The matching Google tag is paused or has no firing trigger in the live version.', 'علامة Google المطابقة متوقفة أو بلا مشغّل في النسخة المنشورة.'],
  published_destination_mismatch: ['The published Google tag points to a different GA4 Measurement ID.', 'علامة Google المنشورة تشير إلى معرّف قياس GA4 مختلف.'],
  published_destination_unresolved: ['The destination is dynamic, custom, linked through GT-, or otherwise unsupported for automatic verification. Review the live version manually.', 'الوجهة ديناميكية أو مخصصة أو مرتبطة عبر GT- أو غير مدعومة للفحص التلقائي. راجع النسخة المنشورة يدويًا.'],
  ga4_property_missing: ['Configure the numeric GA4 Property ID on the server; it is different from the G- Measurement ID.', 'اضبط معرّف موقع GA4 الرقمي على الخادم؛ فهو مختلف عن معرّف القياس G-.'],
  ga4_stream_mismatch: ['The configured Measurement ID was not found in this GA4 property’s web streams.', 'لم يُعثر على معرّف القياس ضمن مصادر الويب في موقع GA4 المحدد.'],
  ga4_stream_unresolved: ['Stream discovery could not be completed within its safety limit.', 'تعذر إكمال تحديد مصدر البيانات ضمن الحد الآمن للفحص.'],
  ga4_data_received: ['GA4 reported events for this web stream and the production hostnames over the last seven complete days. This does not prove every conversion is correct.', 'أبلغ GA4 عن أحداث لهذا المصدر ونطاقات الإنتاج خلال آخر سبعة أيام مكتملة. هذا لا يثبت صحة كل تحويل.'],
  ga4_reporting_delay: ['Realtime stream events exist, but no completed-day events were reported yet. Allow for reporting delay; realtime is not hostname-specific.', 'توجد أحداث آنية للمصدر، لكن لم تظهر أحداث لأيام مكتملة بعد. قد تتأخر التقارير؛ البيانات الآنية ليست خاصة بنطاق بعينه.'],
  ga4_no_recent_data: ['No recent events were reported. Low traffic, consent, filters or reporting delay may explain this; absence alone does not prove failure.', 'لم تظهر أحداث حديثة. قد يكون السبب انخفاض الزيارات أو الموافقة أو الفلاتر أو تأخر التقارير؛ الغياب وحده لا يثبت الفشل.'],
  browser_no_observation: ['Keep an eligible public page open in another tab of this browser, then verify again. This check never opens a page, loads GTM or grants consent.', 'اترك صفحة عامة مؤهلة مفتوحة في تبويب آخر بهذا المتصفح ثم أعد الفحص. هذا الفحص لا يفتح صفحة ولا يحمّل GTM ولا يمنح موافقة.'],
  browser_channel_unavailable: ['This browser blocks or does not support cross-tab observation. Browser installation remains unverified.', 'هذا المتصفح لا يدعم ملاحظة التبويبات أو يمنعها. تثبيت المتصفح يظل غير متحقق.'],
  browser_invalid_observation: ['No fresh, valid browser observation is available.', 'لا توجد ملاحظة حديثة وصالحة من المتصفح.'],
  browser_ineligible: ['The responding page is outside the public measurement boundary.', 'الصفحة المستجيبة خارج حدود القياس العام.'],
  browser_container_mismatch: ['The observed public tab uses a different container. Reload that public page after saving settings.', 'التبويب العام يستخدم حاوية مختلفة. أعد تحميل الصفحة العامة بعد حفظ الإعدادات.'],
  browser_consent_denied: ['Optional consent is denied and GTM has not loaded. Advanced mode should load on an eligible public page without granting consent. Check the deployed version, network and CSP.', 'الموافقة الاختيارية مرفوضة ولم يُحمّل GTM. الوضع المتقدم يحمّله في الصفحة العامة المؤهلة دون منح الموافقة. افحص النسخة المنشورة والشبكة وCSP.'],
  browser_loading: ['The observed public tab is still loading GTM. Retry after it finishes.', 'التبويب العام ما زال يحمّل GTM. أعد الفحص بعد انتهاء التحميل.'],
  browser_not_loaded: ['The observed consented public tab has not loaded GTM. Check its network, extensions and console.', 'لم يحمّل التبويب العام الموافق على التتبع GTM. افحص الشبكة والإضافات ووحدة التحكم فيه.'],
  browser_script_failed: ['A GTM script load failed in an observed public tab. Check connectivity, CSP and blocking extensions.', 'فشل تحميل سكربت GTM في تبويب عام. افحص الاتصال وCSP والإضافات التي تمنع التحميل.'],
  browser_observed: ['GTM completed loading in the observed public tab(s), including when consent is denied in Advanced mode. Loading does not grant consent or prove GA4 reception.', 'اكتمل تحميل GTM في التبويبات العامة الملحوظة، حتى مع رفض الموافقة في الوضع المتقدم. التحميل لا يمنح الموافقة ولا يثبت وصول GA4.'],
}
const statuses: Record<TrackingHealthStatus, readonly [string, string]> = {
  verified: ['Verified', 'تم التحقق'], action_required: ['Action Required', 'يلزم إجراء'], not_verified: ['Not Verified', 'غير متحقق'], error: ['Error', 'خطأ'],
}
const evidenceLabels: Record<string, readonly [string, string]> = {
  cspOrigin: ['Observed CSP resource origin', 'نطاق المورد في مخالفة CSP'], cspDirective: ['CSP directive', 'توجيه CSP'], cspDisposition: ['CSP mode', 'وضع CSP'],
  containerId: ['Checked GTM Container ID', 'معرّف حاوية GTM المفحوصة'], measurementId: ['Checked GA4 Measurement ID', 'معرّف قياس GA4 المفحوص'],
  tagCount: ['Published tags', 'العلامات المنشورة'], matchingGoogleTags: ['Matching Google tags', 'علامات Google المطابقة'],
  eventsLast7CompleteDays: ['Events · last 7 complete days', 'الأحداث · آخر ٧ أيام مكتملة'], keyEventsLast7CompleteDays: ['Key events · last 7 complete days', 'الأحداث الرئيسية · آخر ٧ أيام مكتملة'],
  streamEventsLast30Minutes: ['Stream events · last 30 minutes', 'أحداث المصدر · آخر ٣٠ دقيقة'], analyticsConsent: ['Analytics consent', 'موافقة التحليلات'], marketingConsent: ['Marketing consent', 'موافقة التسويق'],
  observedTabs: ['Observed tabs', 'التبويبات الملحوظة'], loadedTabs: ['Loaded tabs', 'التبويبات التي اكتمل تحميلها'],
}

export function TrackingHealthPanel({ canVerify, blocked, revision }: { canVerify: boolean; blocked: boolean; revision: string }) {
  const [language, setLanguage] = useState<'en' | 'ar'>('en')
  const [report, setReport] = useState<TrackingHealthReport | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const active = useRef<AbortController | null>(null)
  const heading = useId()
  const ar = language === 'ar'
  const t = (en: string, arabic: string) => ar ? arabic : en
  useEffect(() => {
    setReport(null); setError(''); setBusy(false)
    return () => { active.current?.abort(); active.current = null }
  }, [revision, blocked])

  async function verify() {
    if (active.current || !canVerify || blocked) return
    const controller = new AbortController()
    active.current = controller
    setBusy(true); setError(''); setReport(null)
    const timer = window.setTimeout(() => controller.abort(), 35000)
    let failureMessage = ''
    try {
      const response = await fetch('/api/admin/tracking-health', { method: 'POST', credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
      if (!response.ok) {
        failureMessage = response.status === 429 ? t('Please wait one minute before verifying again.', 'انتظر دقيقة قبل إعادة الفحص.') : response.status === 401 || response.status === 403 ? t('Administrator settings permission is required.', 'يلزم تصريح إعدادات المسؤول.') : t('Verification could not be completed. Try again later.', 'تعذر إكمال الفحص. أعد المحاولة لاحقًا.')
        throw Error()
      }
      const data = await response.json() as TrackingHealthReport
      const browser = await observeTrackingBrowser(window, data.config.containerId)
      if (controller.signal.aborted) return
      const result = { ...data, browser, overall: overallTrackingHealth([data.configuration, data.published, browser, data.ga4]) }
      setReport(result)
      const message = t('Tracking checks completed. Review each independent result.', 'اكتملت فحوص التتبع. راجع نتيجة كل فحص مستقل.')
      if (result.overall === 'verified') toast.success(message, { dedupeKey: 'tracking-health' })
      else if (result.overall === 'error') toast.error(message, { dedupeKey: 'tracking-health' })
      else toast.warning(message, { dedupeKey: 'tracking-health' })
    } catch {
      if (controller.signal.aborted && active.current !== controller) return
      const message = controller.signal.aborted ? t('Verification timed out. No success was established.', 'انتهت مهلة الفحص دون إثبات النجاح.') : failureMessage || t('Verification failed. Check your connection and try again.', 'تعذر الفحص. راجع الاتصال وأعد المحاولة.')
      setError(message); toast.error(message, { dedupeKey: 'tracking-health' })
    } finally {
      window.clearTimeout(timer)
      if (active.current === controller) { active.current = null; setBusy(false) }
    }
  }

  const row = (label: string, value?: TrackingHealthCheck) => {
    const check = value ?? { status: 'not_verified' as const, code: 'not_checked' }
    const message = messages[check.code] ?? ['Run verification to collect evidence.', 'شغّل الفحص لجمع الأدلة.']
    return <div className={styles.row}>
      <div className={styles.rowHead}><strong>{label}</strong><span className={styles.status} data-status={check.status}>{statuses[check.status][ar ? 1 : 0]}</span></div>
      <p>{message[ar ? 1 : 0]}</p>
      {check.evidence && <dl className={styles.evidence}>{Object.entries(check.evidence).filter(([key]) => key in evidenceLabels).map(([key, value]) => <div key={key}><dt>{evidenceLabels[key][ar ? 1 : 0]}</dt><dd>{value === null ? t('Unavailable', 'غير متاح') : typeof value === 'boolean' ? value ? t('Granted', 'ممنوحة') : t('Denied', 'مرفوضة') : value}</dd></div>)}</dl>}
      {typeof check.evidence?.realtimeStatus === 'string' && check.evidence.realtimeStatus !== 'available' && <p>{t('Realtime: ', 'الفحص الآني: ')}{(messages[check.evidence.realtimeStatus] ?? messages.google_api_error)[ar ? 1 : 0]}</p>}
    </div>
  }

  return <section className={styles.monitor} aria-labelledby={heading} aria-busy={busy} lang={language} dir={ar ? 'rtl' : 'ltr'}>
    <div className={styles.toolbar}><h3 id={heading}>{t('Google Tracking Health', 'حالة تتبع Google')}</h3><div role="group" aria-label={t('Health monitor language', 'لغة مراقب التتبع')}>
      <button className="sp-btn" type="button" aria-pressed={!ar} onClick={() => setLanguage('en')}>EN</button><button className="sp-btn" type="button" aria-pressed={ar} onClick={() => setLanguage('ar')}>العربية</button>
    </div></div>
    <p>{t('Checks saved settings, the published container, an already-open public browser tab, and GA4 aggregate reception. It sends no test events.', 'يفحص الإعدادات المحفوظة والحاوية المنشورة وتبويبًا عامًا مفتوحًا بالفعل واستقبال GA4 المجمّع. لا يرسل أحداثًا تجريبية.')}</p>
    <div className={styles.overall} role="status"><strong>{t('Overall Tracking Health', 'الحالة العامة للتتبع')}</strong><span className={styles.status} data-status={report?.overall ?? 'not_verified'}>{statuses[report?.overall ?? 'not_verified'][ar ? 1 : 0]}</span></div>
    {row(t('GTM Configuration', 'إعدادات GTM'), report?.configuration)}
    {row(t('Published Container', 'الحاوية المنشورة'), report?.published)}
    {row(t('Browser Load', 'تحميل المتصفح'), report?.browser)}
    {row(t('GA4 Data Reception', 'استقبال بيانات GA4'), report?.ga4)}
    {blocked && <p>{t('Save your settings and finish any pending action before verifying.', 'احفظ الإعدادات وأكمل أي إجراء معلّق قبل الفحص.')}</p>}
    {!canVerify && <p>{t('Verification requires administrator settings permission.', 'الفحص يتطلب تصريح إعدادات المسؤول.')}</p>}
    {error && <p role="alert">{error}</p>}
    <div className={styles.toolbar}><button className="sp-btn" type="button" disabled={!canVerify || blocked || busy} onClick={() => void verify()}><RefreshCw size={16} aria-hidden="true" />{busy ? t('Verifying…', 'جارٍ التحقق…') : t('Verify Connection', 'التحقق من الاتصال')}</button>
      <span className={styles.checked}>{report ? <>{t('Last checked:', 'آخر فحص:')} <time dateTime={report.checkedAt}>{new Date(report.checkedAt).toLocaleString(ar ? 'ar' : 'en')}</time></> : t('Not checked in this session', 'لم يُفحص في هذه الجلسة')}</span>
    </div>
  </section>
}
