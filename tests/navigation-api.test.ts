import { beforeEach, describe, it, expect, vi } from 'vitest'
const mocks=vi.hoisted(()=>({user:vi.fn(),permission:vi.fn(),origin:vi.fn(),read:vi.fn(),change:vi.fn(),defaults:vi.fn(),resolve:vi.fn(),published:vi.fn(),options:vi.fn(),staticOptions:vi.fn(),revalidate:vi.fn()}))
vi.mock('@/lib/server/auth',()=>({getCurrentUser:mocks.user,hasPermission:mocks.permission}))
vi.mock('@/lib/server/csrf',()=>({isSameOriginRequest:mocks.origin}))
vi.mock('@/lib/server/navigation',()=>({readNavigation:mocks.read,changeNavigation:mocks.change,navigationDefaults:mocks.defaults,resolveNavigation:mocks.resolve,publishedNavigation:mocks.published,recordNavigationOptions:mocks.options,staticNavigationOptions:mocks.staticOptions}))
vi.mock('next/cache',()=>({revalidatePath:mocks.revalidate}))
vi.mock('@/lib/server/website-heroes',()=>({HeroConflictError:class extends Error{}}))
import { GET as adminGET, PATCH } from '@/app/api/admin/website-cms/navigation/route'
import { POST as preview } from '@/app/api/admin/website-cms/navigation/preview/route'
import { GET as publicGET } from '@/app/api/navigation/route'
import { GET as optionsGET } from '@/app/api/admin/website-cms/navigation/options/route'
import { NavigationValidationError, defaultNavigation, initialNavigation } from '@/lib/navigation'
import { HeroConflictError } from '@/lib/server/website-heroes'
const request=(action='save-draft',content:unknown=defaultNavigation(),revision=0)=>new Request('https://local.test/api/admin/website-cms/navigation',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,content,revision})})
beforeEach(()=>{vi.resetAllMocks();mocks.user.mockResolvedValue({id:'staff'});mocks.permission.mockReturnValue(true);mocks.origin.mockReturnValue(true);mocks.read.mockResolvedValue(initialNavigation());mocks.defaults.mockResolvedValue(defaultNavigation());mocks.change.mockResolvedValue({...initialNavigation(),revision:1});mocks.resolve.mockResolvedValue({primaryLocale:'en',revision:0,items:[]});mocks.published.mockResolvedValue(null);mocks.options.mockResolvedValue([]);mocks.staticOptions.mockReturnValue([{key:'/',label:'Home',href:'/',target:{type:'internal',href:'/'}}])})
describe('navigation endpoints authorization and lifecycle',()=>{
 it('protects draft reads and mutations when signed out',async()=>{mocks.user.mockResolvedValue(null);expect((await adminGET()).status).toBe(401);expect((await PATCH(request())).status).toBe(401);expect((await preview(request())).status).toBe(401);expect((await optionsGET(new Request('https://local.test?kind=page'))).status).toBe(401);expect(mocks.read).not.toHaveBeenCalled();expect(mocks.change).not.toHaveBeenCalled()})
 it('requires view for draft preview and edit for every mutation',async()=>{
  mocks.permission.mockImplementation((_user,key)=>key==='settings.view');expect((await adminGET()).status).toBe(200);expect((await preview(request())).status).toBe(200)
  for(const action of ['save-draft','publish','restore','reset-draft'])expect((await PATCH(request(action))).status).toBe(403)
  mocks.permission.mockReturnValue(false);expect((await adminGET()).status).toBe(403);expect((await preview(request())).status).toBe(403)
 })
 it('rejects cross-origin writes and previews before invoking persistence',async()=>{mocks.origin.mockReturnValue(false);expect((await PATCH(request())).status).toBe(403);expect((await preview(request())).status).toBe(403);expect(mocks.change).not.toHaveBeenCalled();expect(mocks.resolve).not.toHaveBeenCalled()})
 it('keeps unsaved preview read-only and private',async()=>{const result=await preview(request());expect(result.status).toBe(200);expect(result.headers.get('cache-control')).toContain('no-store');expect(mocks.resolve).toHaveBeenCalledWith(defaultNavigation());expect(mocks.change).not.toHaveBeenCalled();expect(mocks.revalidate).not.toHaveBeenCalled()})
 it('saves without invalidating public navigation; publish/restore invalidate the layout',async()=>{
  expect((await PATCH(request())).status).toBe(200);expect(mocks.revalidate).not.toHaveBeenCalled()
  for(const action of ['publish','restore']){expect((await PATCH(request(action))).status).toBe(200);expect(mocks.change).toHaveBeenCalledWith(0,action,defaultNavigation())}
  expect(mocks.revalidate).toHaveBeenCalledTimes(2)
 })
 it('returns revision conflicts and malformed tree validation as actionable errors',async()=>{mocks.change.mockRejectedValueOnce(new HeroConflictError('Reload latest revision'));expect((await PATCH(request())).status).toBe(409);mocks.change.mockRejectedValueOnce(new NavigationValidationError('Invalid tree'));expect((await PATCH(request())).status).toBe(400)})
 it.each([-1,0.5,Number.MAX_SAFE_INTEGER+1])('rejects invalid revision %s',async revision=>{expect((await PATCH(request('save-draft',{},revision))).status).toBe(400);expect(mocks.change).not.toHaveBeenCalled()})
 it('limits request size, malformed JSON and invalid actions',async()=>{
  expect((await PATCH(new Request('https://local.test',{method:'PATCH',body:'x'.repeat(100001)}))).status).toBe(400)
  expect((await PATCH(new Request('https://local.test',{method:'PATCH',body:'{'}))).status).toBe(400)
  expect((await PATCH(request('erase-all'))).status).toBe(400);expect(mocks.change).not.toHaveBeenCalled()
 })
 it('never serializes admin state or drafts from the public endpoint',async()=>{const result=await publicGET();expect(await result.json()).toEqual({navigation:null});expect(mocks.read).not.toHaveBeenCalled();expect(result.headers.get('cache-control')).toContain('no-store')})
 it('returns 503 rather than a false default menu if storage is unavailable',async()=>{mocks.published.mockRejectedValue(new Error('database private detail'));const response=await publicGET();expect(response.status).toBe(503);expect(JSON.stringify(await response.json())).not.toContain('database private detail')})
 it('searches actual public pages and supports only declared published sources',async()=>{
  const result=await optionsGET(new Request('https://local.test?kind=page&q=home'));expect((await result.json()).options).toHaveLength(1)
  expect((await optionsGET(new Request('https://local.test?kind=private'))).status).toBe(400)
  await optionsGET(new Request('https://local.test?kind=tour&q=Cairo'));expect(mocks.options).toHaveBeenCalledWith('tour',undefined,'Cairo')
 })
})
