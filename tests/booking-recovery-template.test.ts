import { expect, it, vi } from 'vitest'
vi.mock('@/lib/server/db',()=>({db:{}}))
import { renderEmailTemplate } from '@/lib/server/email/email'
it('escapes recovery content and never describes a new or paid booking',()=>{
  const template=renderEmailTemplate('booking_access_requested',{name:'<img src=x onerror=alert(1)>',reference:'SP-BK-ABC123',detailUrl:'/booking/'+'a'.repeat(43)})
  expect(template.html).toContain('&lt;img');expect(template.html).not.toContain('<img src=x')
  expect(template.html).toContain('/booking/'+'a'.repeat(43))
  expect(template.subject).toContain('SP-BK-ABC123');expect(template.text).toContain('Keep this private link confidential')
  expect(template.text).not.toMatch(/payment received|booking confirmed|booking created/i)
})
