import { afterEach, beforeEach, expect, it, vi } from 'vitest'
let store:typeof import('@/lib/storefront-settings')
const fetcher=vi.fn()
const settle=()=>new Promise(resolve=>setTimeout(resolve,0))
beforeEach(async()=>{vi.resetModules();fetcher.mockReset();vi.stubGlobal('window',new EventTarget());vi.stubGlobal('fetch',fetcher);store=await import('@/lib/storefront-settings')})
afterEach(()=>vi.unstubAllGlobals())
const response=(logo:string,favicon=logo)=>Response.json({settings:{brand:{logo,favicon}}})
it('requests fresh settings and ignores old responses after an admin refresh',async()=>{
 let old!:(response:Response)=>void
 fetcher.mockImplementationOnce(()=>new Promise<Response>(resolve=>{old=resolve})).mockResolvedValueOnce(response('/media/new-logo.webp','/media/new-icon.jpg'))
 store.ensureStorefrontSettings();store.refreshStorefrontSettings();await settle();expect(store.getDbBrand()!.logo).toBe('/media/new-logo.webp')
 old(response('/logo.png','/favicon.png'));await settle();expect(store.getDbBrand()!.logo).toBe('/media/new-logo.webp');expect(store.getDbBrand()!.favicon).toBe('/media/new-icon.jpg');expect(fetcher.mock.calls.every(([,options])=>options.cache==='no-store')).toBe(true)
})
it('does not let an older completion release the newer single-flight guard',async()=>{
 let old!:(response:Response)=>void,newer!:(response:Response)=>void
 fetcher.mockImplementationOnce(()=>new Promise<Response>(resolve=>{old=resolve})).mockImplementationOnce(()=>new Promise<Response>(resolve=>{newer=resolve}))
 store.ensureStorefrontSettings();store.refreshStorefrontSettings();old(response('/logo.png'));await settle();store.ensureStorefrontSettings();expect(fetcher).toHaveBeenCalledTimes(2);newer(response('/media/current.webp'));await settle();expect(store.getDbBrand()!.logo).toBe('/media/current.webp')
})
it('allows an explicit successful clear to reset branding instead of keeping a stale image',async()=>{fetcher.mockResolvedValueOnce(response('/media/custom.webp')).mockResolvedValueOnce(response('',''));store.ensureStorefrontSettings();await settle();expect(store.getDbBrand()!.logo).toBe('/media/custom.webp');store.refreshStorefrontSettings();await settle();expect(store.getDbBrand()).toEqual({})})
it('keeps the last successful browser snapshot if a new request fails',async()=>{fetcher.mockResolvedValueOnce(response('/media/custom.webp')).mockResolvedValueOnce(new Response('',{status:503}));store.ensureStorefrontSettings();await settle();store.refreshStorefrontSettings();await settle();expect(store.getDbBrand()!.logo).toBe('/media/custom.webp')})

it('invalidates requests older than a newly arrived server branding seed exactly once',async()=>{
 let old!:(response:Response)=>void
 fetcher.mockImplementationOnce(()=>new Promise<Response>(resolve=>{old=resolve})).mockResolvedValueOnce(response('/media/server-b.webp','/media/server-b-icon.webp'))
 store.ensureStorefrontSettings()
 const seed={logo:'/media/server-b.webp',favicon:'/media/server-b-icon.webp'}
 store.ensureStorefrontBrandSeed(seed);store.ensureStorefrontBrandSeed({...seed});await settle()
 expect(fetcher).toHaveBeenCalledTimes(2);expect(store.getDbBrand()!.logo).toBe(seed.logo)
 old(response('/media/old-a.webp'));await settle();expect(store.getDbBrand()!.logo).toBe(seed.logo)
})
