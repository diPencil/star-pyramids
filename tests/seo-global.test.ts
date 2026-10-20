import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { protectEnquiryNavigation } from '@/lib/enquiry-navigation';

const read = vi.hoisted(() => vi.fn());
vi.mock('@/lib/server/db', () => ({ db: { siteSetting: { findUnique: read } } }));
vi.mock('@/lib/server/fx', () => ({ getActiveRate: vi.fn() }));

import { PUBLIC_SETTING_KEYS, SECRET_SETTING_KEYS, validateSettingsPatch } from '@/lib/server/settings';
import { getGlobalSeo } from '@/lib/server/global-seo';

beforeEach(() => { read.mockReset(); read.mockResolvedValue(null); });

describe('global SEO settings trust boundary', () => {
  it('extends the original public owner and retains its title', () => {
    const values = { 'site.seoTitle': 'Star Pyramids', 'site.seoDescriptionEn': 'Explore Egypt.', 'site.seoDescriptionEs': 'Viajes a Egipto.', 'site.seoDescriptionIt': 'Viaggi in Egitto.', 'site.seoImage': 'https://example.com/social.jpg', 'site.googleSiteVerification': 'Public_token-123' };
    expect(validateSettingsPatch({ values })).toEqual({ clean: values, errors: [] });
    for (const key of Object.keys(values)) {
      expect(PUBLIC_SETTING_KEYS).toContain(key);
      expect(SECRET_SETTING_KEYS).not.toContain(key);
    }
  });
  it.each(['<meta content="x">', 'abc def', 'a\n', 'abc=', 'é', 'x'.repeat(257)])('rejects unsafe token %j', token => {
    expect(validateSettingsPatch({ values: { 'site.googleSiteVerification': token } }).errors).not.toHaveLength(0);
  });
  it('allows bounded tokens and explicit optional clears', () => {
    expect(validateSettingsPatch({ values: { 'site.googleSiteVerification': 'x'.repeat(256) } }).errors).toEqual([]);
    const values = { 'site.googleSiteVerification': '', 'site.seoImage': '', 'site.seoDescriptionEn': '' };
    expect(validateSettingsPatch({ values })).toEqual({ clean: values, errors: [] });
  });
  it.each(['javascript:alert(1)', '//evil.test/x', 'data:image/png,abc', 'http://example.com/a.jpg', 'https://user:password@example.com/a.jpg', 'https://localhost/a.jpg'])('rejects unsafe image %s', image => {
    expect(validateSettingsPatch({ values: { 'site.seoImage': image } }).errors).not.toHaveLength(0);
  });
  it.each(['<script>x</script>', 'a\u007f', 'a\n', 'x'.repeat(321)])('rejects unsafe descriptions %j', description => {
    for (const suffix of ['En', 'Es', 'It']) expect(validateSettingsPatch({ values: { [`site.seoDescription${suffix}`]: description } }).errors).not.toHaveLength(0);
  });
  it('rejects competing keys, scripts, arbitrary documents and nonstrings', () => {
    for (const values of [{ 'seo.global': '{}' }, { 'site.seoTemplate': '%s' }, { 'site.gaScript': '<script/>' }, { 'site.googleSiteVerification': 123 }]) {
      expect(validateSettingsPatch({ values }).errors).not.toHaveLength(0);
    }
  });
});

describe('tracking settings trust boundary', () => {
  it('accepts a valid GTM container and toggle as public settings', () => {
    const values = { 'tracking.gtmEnabled': 'true', 'tracking.gtmContainerId': '  GTM-KQ8GR36H  ' };
    expect(validateSettingsPatch({ values })).toEqual({
      clean: { 'tracking.gtmEnabled': 'true', 'tracking.gtmContainerId': 'GTM-KQ8GR36H' },
      errors: [],
    });
    for (const key of Object.keys(values)) {
      expect(PUBLIC_SETTING_KEYS).toContain(key);
      expect(SECRET_SETTING_KEYS).not.toContain(key);
    }
  });
  it.each(['', 'GTM-', 'gtm-kq8gr36h', 'UA-12345', 'G-ABC123', '<script>', 'GTM-KQ8GR36H;alert(1)'])('rejects invalid GTM container %j', containerId => {
    expect(validateSettingsPatch({ values: { 'tracking.gtmContainerId': containerId } }).errors).not.toHaveLength(0);
  });
  it.each(['1', 'yes', 'TRUE', ''])('rejects invalid tracking toggle %j', enabled => {
    expect(validateSettingsPatch({ values: { 'tracking.gtmEnabled': enabled } }).errors).not.toHaveLength(0);
  });
});

describe('global metadata reads real public strings only', () => {
  it.each([['en', 'En'], ['es', 'Es'], ['it', 'It'], ['ar', 'En']])('uses the %s description without taking over title', async (locale, suffix) => {
    const values: Record<string, string> = { [`site.seoDescription${suffix}`]: 'Localized description', 'site.seoImage': 'https://example.com/social.jpg', 'site.googleSiteVerification': 'public-token' };
    read.mockImplementation(async ({ where }: { where: { key: string } }) => ({ value: values[where.key] }));
    const result = await getGlobalSeo(locale);
    expect(result).toEqual({ description: 'Localized description', openGraph: { description: 'Localized description', images: [{ url: values['site.seoImage'] }] }, twitter: { description: 'Localized description', images: [values['site.seoImage']] }, verification: { google: 'public-token' } });
    expect(read.mock.calls.map(([args]) => args.where.key)).toEqual(Object.keys(values));
    expect(result).not.toHaveProperty('title');
  });
  it('omits missing and cleared settings', async () => {
    expect(await getGlobalSeo('en')).toEqual({});
    read.mockResolvedValue({ value: '' });
    expect(await getGlobalSeo('en')).toEqual({});
  });
  it('rejects corrupt stored values independently', async () => {
    read.mockImplementation(async ({ where }: { where: { key: string } }) => ({ value: where.key === 'site.seoDescriptionEn' ? 'Safe description' : '<script>bad</script>' }));
    expect(await getGlobalSeo('en')).toEqual({ description: 'Safe description', openGraph: { description: 'Safe description' }, twitter: { description: 'Safe description' } });
  });
});

describe('global SEO unsaved navigation', () => {
  it('defers dirty history traversal until confirmed and removes its listeners', () => {
    const navigation = Object.assign(new EventTarget(), {
      currentEntry: { key: 'current', index: 1 },
      traverseTo: vi.fn(),
    });
    const browser = Object.assign(new EventTarget(), { navigation, history: { state: null } });
    let dirty = true;
    let pending: (() => void) | undefined;
    const request = vi.fn((action: () => void) => { pending = action; });
    const cleanup = protectEnquiryNavigation(browser as unknown as Window, () => dirty, request);
    const traversal = () => Object.assign(new Event('navigate', { cancelable: true }), {
      navigationType: 'traverse', destination: { key: 'previous', index: 0, sameDocument: true },
    });
    const event = traversal();
    navigation.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(request).toHaveBeenCalledOnce();
    expect(navigation.traverseTo).not.toHaveBeenCalled();
    // Keeping edits means leaving the deferred action uncalled.
    expect(dirty).toBe(true);
    dirty = false;
    pending?.();
    expect(navigation.traverseTo).toHaveBeenCalledExactlyOnceWith('previous');
    const cleanEvent = traversal();
    navigation.dispatchEvent(cleanEvent);
    expect(cleanEvent.defaultPrevented).toBe(false);
    cleanup();
    dirty = true;
    navigation.dispatchEvent(traversal());
    expect(request).toHaveBeenCalledOnce();
  });

  it('wires custom discard dialogs, reload, and a shared synchronous request lock', () => {
    const source = readFileSync(new URL('../components/admin/seo-global-settings.tsx', import.meta.url), 'utf8');
    expect(source).toContain('protectEnquiryNavigation(window, () => dirtyRef.current || busy.current, navigate)');
    expect(source).toMatch(/const load = useCallback\(async \(\) => \{\s*if \(busy.current\) return;\s*busy.current = true;/);
    expect(source).toContain('if (!canEdit || loading || busy.current || pendingRef.current) return;');
    expect(source).toMatch(/function requestReload\(\)[\s\S]*?if \(dirtyRef.current\) \{[\s\S]*?setConfirmReload\(true\)/);
    expect(source).toContain('onClick={requestReload}');
    expect(source).toContain('confirmLabel="Discard and reload"');
    expect(source).toContain('confirmLabel="Discard and leave"');
    expect(source).toContain('setValues(baseline); setPendingNavigation(null); action?.();');
    expect(source).not.toMatch(/\b(?:window\.)?(?:alert|confirm)\s*\(/);
  });
});
