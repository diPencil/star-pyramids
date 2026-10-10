'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { REVIEW_LABELS, type ReviewAdmin, type ReviewConfig, type ReviewProvider } from '@/lib/review-integrations'
import { AdminText, Card } from './admin-ui'
import { useAdminLocale } from './admin-locale'
const configOf = (v: ReviewAdmin): ReviewConfig => ({ enabled: v.enabled, resourceId: v.resourceId, profileUrl: v.profileUrl, widgetId: v.widgetId })
async function jsonResponse(response: Response): Promise<{ integrations: ReviewAdmin[]; testState?: ReviewAdmin['state'] }> {
  const data = await response.json().catch(() => null) as { integrations?: ReviewAdmin[]; error?: string; testState?: ReviewAdmin['state'] } | null
  if (!response.ok || !data || !Array.isArray(data.integrations)) throw Error(data?.error || 'Could not complete the review integration request.')
  return { integrations: data.integrations, testState: data.testState }
}
function ProviderSettings({ item, canWrite, onUpdated }: { item: ReviewAdmin; canWrite: boolean; onUpdated: (p: ReviewProvider, rows: ReviewAdmin[]) => void }) {
  const ar = useAdminLocale() === 'ar', [form, setForm] = useState(configOf(item)), [secret, setSecret] = useState(''), [clearSecret, setClearSecret] = useState(false)
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [feedback, setFeedback] = useState(''), guard = useRef(false)
  useEffect(() => { setForm(configOf(item)); setSecret(''); setClearSecret(false) }, [item])
  const dirty = JSON.stringify(form) !== JSON.stringify(configOf(item)) || Boolean(secret) || clearSecret
  const api = item.provider === 'google' || item.provider === 'tripadvisor'
  const change = <K extends keyof ReviewConfig>(key: K, value: ReviewConfig[K]) => { setForm(f => ({ ...f, [key]: value })); setFeedback('') }
  async function act(action: 'save' | 'test') {
    if (guard.current) return
    guard.current = true; setBusy(true); setError(''); setFeedback('')
    try {
      const { integrations, testState } = await jsonResponse(await fetch('/api/admin/review-integrations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ action, provider: item.provider, ...(action === 'save' ? { config: form, secret, clearSecret } : {}) }) }))
      onUpdated(item.provider, integrations)
      const current = integrations.find(v => v.provider === item.provider)
      setFeedback(action === 'save' ? (ar ? 'تم حفظ الإعدادات. اختبر الاتصال قبل العرض.' : 'Configuration saved. Test before publishing.') : testState === 'not_connected' ? (ar ? 'غير متصلة. أدخل بيانات الربط واحفظها أولًا.' : 'Not connected. Enter and save your connection details first.') : testState === 'partner_access_required' ? (ar ? 'بانتظار موافقة الشراكة ووثائق API من GetYourGuide.' : 'Awaiting GetYourGuide partner approval and API documentation.') : current?.message || '')
    } catch (e) { setError(e instanceof Error ? e.message : 'Request failed.') }
    finally { guard.current = false; setBusy(false) }
  }
  const states = { not_connected: ar ? 'غير متصلة' : 'Not connected', connected: ar ? 'نجح آخر اختبار' : 'Last test succeeded', error: ar ? 'فشل آخر اختبار' : 'Last test failed', widget_configured: ar ? 'الودجت مضبوط، لم يتم التحقق' : 'Widget configured, not verified', partner_access_required: ar ? 'بانتظار موافقة الشراكة' : 'Partner access required' }
  return <Card title={REVIEW_LABELS[item.provider]}>
    <div className="sp-form">
      <p className="sp-integration-note" role="status">{states[item.state]}{item.checkedAt && <> · {new Date(item.checkedAt).toLocaleString(ar ? 'ar-EG' : 'en-GB')}</>}</p>
      <label className="sp-review-toggle"><input type="checkbox" checked={form.enabled} onChange={e => change('enabled', e.target.checked)} disabled={!canWrite || busy}/><AdminText en="Show on website" ar="العرض في الموقع"/></label>
      {api && <><label><AdminText en={item.provider === 'google' ? 'Google Place ID' : 'Tripadvisor Location ID'} ar={item.provider === 'google' ? 'معرف المكان في جوجل' : 'معرف الموقع في Tripadvisor'}/><input value={form.resourceId} onChange={e => change('resourceId', e.target.value)} maxLength={200} disabled={!canWrite || busy} dir="ltr"/></label>
        <label><AdminText en="API key" ar="مفتاح API"/><input type="password" autoComplete="new-password" value={secret} onChange={e => { setSecret(e.target.value); setClearSecret(false); setFeedback('') }} placeholder={item.secretConfigured ? (ar ? 'محفوظ بأمان، اترك فارغًا للاحتفاظ به' : 'Stored securely. Leave blank to keep.') : (ar ? 'غير مضبوط' : 'Not configured')} disabled={!canWrite || busy} maxLength={2000} dir="ltr"/></label>
        {item.secretConfigured && <label className="sp-review-toggle"><input type="checkbox" checked={clearSecret} onChange={e => { setClearSecret(e.target.checked); setSecret('') }} disabled={!canWrite || busy}/><AdminText en="Remove stored API key on save" ar="إزالة المفتاح المحفوظ عند الحفظ"/></label>}</>}
      {item.provider === 'trustindex' && <label><AdminText en="Trustindex widget ID" ar="معرف ودجت Trustindex"/><input value={form.widgetId} onChange={e => change('widgetId', e.target.value)} placeholder="ID after loader.js? (no HTML)" disabled={!canWrite || busy} maxLength={100} dir="ltr"/></label>}
      <label><AdminText en="Public profile URL" ar="رابط الصفحة العامة"/><input type="url" value={form.profileUrl} onChange={e => change('profileUrl', e.target.value)} maxLength={1500} disabled={!canWrite || busy} dir="ltr"/></label>
      <p className="sp-integration-note">{item.provider === 'google' ? (ar ? 'Places API يعرض عينة من التقييمات. فعّل Places API (New) والفوترة وقيد المفتاح للسيرفر.' : 'Places API returns a review sample. Enable Places API (New), billing and server key restrictions.') : item.provider === 'tripadvisor' ? (ar ? 'يتطلب اشتراك Content API. يتم تحميل أحدث التقييمات مباشرة بدون تخزين نصوصها.' : 'Requires Content API access. Recent reviews are loaded live without storing their text.') : item.provider === 'trustindex' ? (ar ? 'استخدم معرف الودجت الرسمي فقط. يعرض الودجت داخل إطار معزول. ضبط المعرف لا يثبت نجاح الاتصال.' : 'Use the official widget ID only. The widget runs in an isolated frame. Saving an ID does not verify a connection.') : (ar ? 'يمكن حفظ رابط الشركة. الربط بتقييمات GetYourGuide ينتظر موافقة الشراكة ووثائق API الخاصة بحسابك؛ لن يتم عرض تقييمات افتراضية.' : 'Save your company profile link. A review API connection awaits partner approval and account-specific API documentation. No placeholder reviews are shown.')}</p>
      {item.message && <p className="sp-integration-note">{item.message}</p>}
      {dirty && <p className="sp-integration-note"><AdminText en="You have unsaved changes." ar="لديك تغييرات غير محفوظة."/></p>}
      {error && <p role="alert" className="sp-review-error">{error}</p>}{feedback && <p role="status">{feedback}</p>}
      <div className="sp-review-actions"><button type="button" className="sp-btn primary" onClick={() => void act('save')} disabled={!canWrite || busy || !dirty}><AdminText en={busy ? 'Working…' : 'Save configuration'} ar={busy ? 'جارٍ التنفيذ…' : 'حفظ الإعدادات'}/></button><button type="button" className="sp-btn" onClick={() => void act('test')} disabled={!canWrite || busy || dirty}><AdminText en={api ? 'Test connection / Refresh' : 'Check configuration'} ar={api ? 'اختبار الاتصال / تحديث' : 'فحص الإعدادات'}/></button></div>
    </div>
  </Card>
}
export function ReviewIntegrationsSettings({ canWrite }: { canWrite: boolean }) {
  const [rows, setRows] = useState<ReviewAdmin[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState('')
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { setRows((await jsonResponse(await fetch('/api/admin/review-integrations', { credentials: 'same-origin', cache: 'no-store' }))).integrations) }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load integrations.') } finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])
  return <div className="sp-review-settings">{loading && <p role="status"><AdminText en="Loading review integrations…" ar="جارٍ تحميل ربط التقييمات…"/></p>}{error && <div><p role="alert">{error}</p><button type="button" className="sp-btn" onClick={() => void load()}><AdminText en="Retry" ar="إعادة المحاولة"/></button></div>}{!canWrite && <p><AdminText en="Your role can view these settings. Editing requires settings permission." ar="يمكن لدورك الاطلاع. التعديل يتطلب صلاحية الإعدادات."/></p>}{rows.map(item => <ProviderSettings key={item.provider} item={item} canWrite={canWrite} onUpdated={(p, items) => setRows(old => old.map(v => v.provider === p ? items.find(n => n.provider === p) || v : v))}/>)}</div>
}
