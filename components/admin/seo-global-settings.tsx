'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { RotateCw, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { protectEnquiryNavigation } from '@/lib/enquiry-navigation';
import { Card } from './admin-ui';
import { AdminConfirmDialog } from './admin-confirm-dialog';

const fields = [
  ['site.seoTitle', 'Default SEO title', 160],
  ['site.seoDescriptionEn', 'Default description (EN)', 320],
  ['site.seoDescriptionEs', 'Default description (ES)', 320],
  ['site.seoDescriptionIt', 'Default description (IT)', 320],
  ['site.seoImage', 'Default social image URL', 2000],
  ['site.googleSiteVerification', 'Google Search Console verification token', 256],
] as const;

function readValues(snapshot: unknown): Record<string, string> {
  if (!snapshot || typeof snapshot !== 'object' || !('values' in snapshot)
    || !snapshot.values || typeof snapshot.values !== 'object') throw new Error('Invalid settings response.');
  const publicValues = snapshot.values as Record<string, unknown>;
  return Object.fromEntries(fields.map(([key]) => {
    if (typeof publicValues[key] !== 'string') throw new Error('Invalid settings response.');
    return [key, publicValues[key]];
  }));
}

export function SeoGlobalSettings({ canEdit = false }: { canEdit?: boolean }) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>({});
  const [baseline, setBaseline] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [confirmReload, setConfirmReload] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);
  const busy = useRef(false);
  const dirtyRef = useRef(false);
  const pendingRef = useRef(false);
  const dirty = fields.some(([key]) => values[key] !== baseline[key]);
  dirtyRef.current = dirty;
  const load = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setLoading(true); setError(''); setSaved(false);
    try {
      const response = await fetch('/api/admin/settings', { cache: 'no-store' });
      if (!response.ok) throw new Error('Unable to load settings.');
      const next = readValues(await response.json());
      setValues(next); setBaseline(next); dirtyRef.current = false;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load settings.');
    } finally { busy.current = false; setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const navigate = (action: () => void) => {
      if (busy.current || pendingRef.current) return;
      pendingRef.current = true;
      setPendingNavigation(() => action);
    };
    const cleanup = protectEnquiryNavigation(window, () => dirtyRef.current || busy.current, navigate);
    const click = (event: MouseEvent) => {
      if ((!dirtyRef.current && !busy.current) || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (!(anchor instanceof HTMLAnchorElement) || (anchor.target && anchor.target !== '_self') || anchor.hasAttribute('download')) return;
      const url = new URL(anchor.href);
      if (url.href === window.location.href) return;
      event.preventDefault(); event.stopPropagation();
      navigate(() => url.origin === window.location.origin ? router.push(url.pathname + url.search + url.hash) : window.location.assign(url.href));
    };
    document.addEventListener('click', click, true);
    return () => { cleanup(); document.removeEventListener('click', click, true); };
  }, [router]);

  function requestReload() {
    if (busy.current || pendingRef.current) return;
    if (dirtyRef.current) {
      pendingRef.current = true;
      setConfirmReload(true);
    } else void load();
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit || loading || busy.current || pendingRef.current) return;
    const patch = Object.fromEntries(fields.filter(([key]) => values[key] !== baseline[key]).map(([key]) => [key, values[key]]));
    if (!Object.keys(patch).length) return;
    busy.current = true; setSaving(true); setError(''); setSaved(false);
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ values: patch }),
      });
      if (!response.ok) throw new Error(response.status === 403 ? 'You do not have permission to edit settings.' : 'Unable to save settings. Check the entered values and retry.');
      const next = readValues(await response.json());
      setValues(next); setBaseline(next); setSaved(true); dirtyRef.current = false;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save settings.');
    } finally { busy.current = false; setSaving(false); }
  }

  return <Card title="Global SEO settings">
    {loading && <p role="status">Loading settings...</p>}
    {error && <p role="alert">{error}</p>}
    {saved && <p role="status">Settings saved.</p>}
    {!canEdit && <p>Read-only. Editing requires settings permission.</p>}
    <form onSubmit={save} className="cms-field-panel">
      <fieldset disabled={!canEdit || loading || saving || confirmReload || pendingNavigation !== null || !Object.keys(baseline).length}>
        <legend>Website defaults</legend>
        {fields.map(([key, label, maxLength]) => <label key={key}>
          <span>{label}</span>
          {key.startsWith('site.seoDescription')
            ? <textarea maxLength={maxLength} value={values[key] ?? ''} onChange={event => { setValues(old => ({ ...old, [key]: event.target.value })); setSaved(false); }} />
            : <input maxLength={maxLength} required={key === 'site.seoTitle'} dir={key === 'site.googleSiteVerification' || key === 'site.seoImage' ? 'ltr' : undefined} pattern={key === 'site.googleSiteVerification' ? '[A-Za-z0-9_-]*' : undefined} value={values[key] ?? ''} onChange={event => { setValues(old => ({ ...old, [key]: event.target.value })); setSaved(false); }} />}
        </label>)}
      </fieldset>
      <p>A configured verification token does not mean Google is authenticated or connected.</p>
      <button className="sp-btn" type="submit" disabled={!canEdit || loading || saving || confirmReload || pendingNavigation !== null || !Object.keys(baseline).length || !dirty}><Save size={16} aria-hidden="true" />{saving ? 'Saving...' : 'Save settings'}</button>
      <button className="sp-btn" type="button" disabled={loading || saving || confirmReload || pendingNavigation !== null} onClick={requestReload}><RotateCw size={16} aria-hidden="true" />{error && !Object.keys(baseline).length ? 'Retry' : 'Reload'}</button>
    </form>
    <AdminConfirmDialog open={confirmReload} title="Discard unsaved SEO edits and reload?" description="Local edits will be discarded and the latest settings loaded." confirmLabel="Discard and reload" cancelLabel="Keep editing" canConfirm={!loading && !saving} onClose={() => { pendingRef.current = false; setConfirmReload(false); }} onConfirm={() => {
      if (busy.current || !pendingRef.current) return;
      pendingRef.current = false; setConfirmReload(false); void load();
    }} />
    <AdminConfirmDialog open={pendingNavigation !== null} title="Discard unsaved SEO edits?" description="Your local edits will be discarded when you leave." confirmLabel="Discard and leave" cancelLabel="Keep editing" canConfirm={!loading && !saving} onClose={() => { pendingRef.current = false; setPendingNavigation(null); }} onConfirm={() => {
      if (busy.current || !pendingRef.current) return;
      const action = pendingNavigation;
      dirtyRef.current = false; pendingRef.current = false;
      setValues(baseline); setPendingNavigation(null); action?.();
    }} />
  </Card>;
}
