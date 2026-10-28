import { afterEach, describe, expect, it, vi } from 'vitest'
import { ensureStorefrontSettings, refreshStorefrontSettings, getDbCurrency } from '@/lib/storefront-settings'
import { readStoredAdminCurrency, readStoredAdminCurrencyLocale } from '@/components/admin/admin-currency'

afterEach(() => { vi.unstubAllGlobals() })
describe('authoritative currency refresh and admin preferences', () => {
  it('invalidates removed or malformed rates instead of retaining stale conversions', async () => {
    vi.stubGlobal('window', { dispatchEvent: vi.fn() })
    const fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ settings: { currency: { defaultCurrency: 'EUR' }, rates: { eur: '0.8', egp: '50' } } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ settings: { currency: { defaultCurrency: 'USD' }, rates: { eur: '', egp: 'invalid' } } }) })
    vi.stubGlobal('fetch', fetch)
    ensureStorefrontSettings()
    await vi.waitFor(() => expect(getDbCurrency()).toEqual({ defaultCurrency: 'EUR', eur: 0.8, egp: 50 }))
    refreshStorefrontSettings()
    await vi.waitFor(() => expect(getDbCurrency()).toEqual({ defaultCurrency: 'USD' }))
  })
  it.each(['en', 'es', 'it'])('reads admin %s formatting preferences without a public provider', locale => {
    vi.stubGlobal('window', { localStorage: { getItem: (key: string) => key === 'star-locale' ? locale : 'EGP' } })
    expect(readStoredAdminCurrencyLocale()).toBe(locale)
    expect(readStoredAdminCurrency()).toBe('EGP')
  })
  it('rejects unsupported preferences and tolerates blocked browser storage', () => {
    vi.stubGlobal('window', { localStorage: { getItem: () => 'GBP' } })
    expect(readStoredAdminCurrency()).toBe('USD')
    expect(readStoredAdminCurrencyLocale()).toBe('en')
    vi.stubGlobal('window', { localStorage: { getItem: () => { throw new Error('Blocked') } } })
    expect(readStoredAdminCurrency()).toBe('USD')
    expect(readStoredAdminCurrencyLocale()).toBe('en')
  })
})
