import { afterEach, expect, it, vi } from 'vitest'
import { requestGuestCrmRecovery } from '@/lib/admin/admin-customers-client'
afterEach(()=>vi.unstubAllGlobals())
it('requests the existing email proof flow without transmitting consent or claiming ownership',async()=>{
  const fetch=vi.fn().mockResolvedValue(new Response(JSON.stringify({accepted:true})))
  vi.stubGlobal('fetch',fetch)
  await requestGuestCrmRecovery('SP-BK-TEST01','guest@example.com')
  expect(fetch).toHaveBeenCalledTimes(1)
  const [path,options]=fetch.mock.calls[0]
  expect(path).toBe('/api/bookings/request-access');expect(options.credentials).toBe('same-origin')
  expect(JSON.parse(options.body)).toEqual({reference:'SP-BK-TEST01',email:'guest@example.com'})
})
it.each([429,503])('shows a safe error for %i without echoing a provider link or secret',async status=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({error:'https://private/token-secret'}),{status})))
  await expect(requestGuestCrmRecovery('SP-BK-TEST01','guest@example.com')).rejects.toThrow(status===429?'Too many requests':'temporarily unavailable')
})
it('reports network failure without claiming that an email was sent',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('private bearer value')))
  await expect(requestGuestCrmRecovery('SP-BK-TEST01','guest@example.com')).rejects.toThrow('Network error')
})
