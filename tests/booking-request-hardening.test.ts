import {beforeEach,afterEach,it,expect,vi} from 'vitest'
const m=vi.hoisted(()=>({count:0,check:vi.fn(),record:vi.fn()}))
vi.mock('@/lib/server/rate-limit',()=>({checkBookingRateLimit:m.check,recordBookingAttempt:m.record,checkResetSubmitRateLimit:m.check,recordPasswordResetAttempt:m.record}))
import {bookingClientIp,bookingSameOrigin,reserveBookingAttempt,reserveSetupAttempt} from '@/lib/server/booking-request-security'
import {setupFailureText,readSetupResponse} from '@/lib/account-setup-feedback'
beforeEach(()=>{vi.resetAllMocks();m.count=0;vi.stubEnv('BOOKING_TRUST_PROXY_HEADERS','');m.check.mockImplementation(async()=>{const allowed=m.count<1;await Promise.resolve();return {allowed,retryAfterSeconds:17}});m.record.mockImplementation(async()=>{m.count++})})
afterEach(()=>vi.unstubAllEnvs())
it('demonstrates the old check/record race and closes it within this process',async()=>{
  const old=await Promise.all([1,2].map(async()=>{const result=await m.check();if(result.allowed)await m.record();return result.allowed}))
  expect(old).toEqual([true,true]);expect(m.count).toBe(2)
  m.count=0
  const current=await Promise.all([reserveBookingAttempt('a@b.com','unknown'),reserveBookingAttempt('a@b.com','unknown')])
  expect(current.map(x=>x.allowed)).toEqual([true,false]);expect(m.count).toBe(1)
})
it('reserves setup completions before expensive hashing but keeps inspection read-only',async()=>{
  expect((await reserveSetupAttempt('unknown',false)).allowed).toBe(true);expect(m.count).toBe(0)
  const results=await Promise.all([reserveSetupAttempt('unknown',true),reserveSetupAttempt('unknown',true)])
  expect(results.map(x=>x.allowed)).toEqual([true,false]);expect(m.count).toBe(1)
})
it('does not trust forwarded IP or host without an explicit edge contract',()=>{
  const request=new Request('https://starpyramids.com/api/bookings',{headers:{host:'starpyramids.com',origin:'https://evil.example','x-forwarded-host':'evil.example','x-forwarded-for':'1.2.3.4'}})
  expect(bookingClientIp(request)).toBe('unknown');expect(bookingSameOrigin(request)).toBe(false)
  vi.stubEnv('BOOKING_TRUST_PROXY_HEADERS','1');expect(bookingClientIp(request)).toBe('1.2.3.4')
  expect(bookingClientIp(new Request(request,{headers:{'x-forwarded-for':'not-an-ip'}}))).toBe('unknown')
})
it('requires the request scheme as well as host for same-origin booking mutations',()=>{
  const request=new Request('https://starpyramids.com/api/bookings',{headers:{host:'starpyramids.com',origin:'http://starpyramids.com'}})
  expect(bookingSameOrigin(request)).toBe(false)
})
it.each(['en','es','it'] as const)('distinguishes private setup errors in %s without account existence disclosure',async locale=>{
  const kinds=['invalid','network','service','rate','password','identity'] as const
  const text=kinds.map(kind=>setupFailureText(locale,kind))
  expect(new Set(text).size).toBe(6)
  expect(await readSetupResponse(new Response('unavailable',{status:503}))).toEqual({failure:'service'})
  expect(await readSetupResponse(new Response('{}',{status:429,headers:{'Retry-After':'17'}}))).toEqual({failure:'rate',retryAfter:17})
  expect(await readSetupResponse(new Response('{}',{status:429}))).toEqual({failure:'rate'})
  expect(await readSetupResponse(new Response(JSON.stringify({code:'INVALID_LINK'}),{status:400}))).toEqual({failure:'invalid'})
})
