import { beforeEach, expect, it, vi } from 'vitest'
const m=vi.hoisted(()=>({find:vi.fn(),settings:vi.fn()}))
vi.mock('@/lib/server/db',()=>({db:{siteSetting:{findMany:m.find}}}))
vi.mock('@/lib/server/settings',()=>({getStorefrontSettings:m.settings}))
import { readServerBrandSettings } from '@/lib/server/brand-settings'
import { GET } from '@/app/api/settings/route'
import { defaultBrandSettings } from '@/lib/brand-settings'
beforeEach(()=>{vi.resetAllMocks();m.find.mockResolvedValue([]);m.settings.mockResolvedValue({brand:{logo:'/media/logo.png'}})})
it('selects only public brand keys and never returns unrelated settings',async()=>{m.find.mockResolvedValue([{key:'site.logo',value:'/media/new.webp'},{key:'site.favicon',value:'/media/icon.jpg'},{key:'site.name',value:'Saved company'},{key:'mail.smtpPassword',value:'secret'}]);const brand=await readServerBrandSettings();expect(brand.logo).toBe('/media/new.webp');expect(brand.favicon).toBe('/media/icon.jpg');expect(brand.companyName).toBe('Saved company');expect(JSON.stringify(brand)).not.toContain('secret');const query=m.find.mock.calls[0][0];expect(query.select).toEqual({key:true,value:true});expect(query.where.key.in).not.toContain('mail.smtpPassword')})
it('uses defaults only for missing/unconfigured fields or a failed read',async()=>{expect(await readServerBrandSettings()).toEqual(defaultBrandSettings);m.find.mockRejectedValue(new Error('offline'));expect(await readServerBrandSettings()).toEqual(defaultBrandSettings)})
it('does not cache the mutable storefront settings response',async()=>{const response=await GET();expect(response.status).toBe(200);expect(response.headers.get('cache-control')).toContain('no-store');expect((await response.json()).settings.brand.logo).toBe('/media/logo.png')})
