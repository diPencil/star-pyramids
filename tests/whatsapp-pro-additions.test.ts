import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
it('gates only WhatsApp settings visually and for keyboard interaction without changing saved data', () => {
  const source = readFileSync('app/admin/settings/page.tsx', 'utf8')
  const whatsapp = source.split('function WhatsAppTab(')[1].split('function MapsTab(')[0]
  expect(whatsapp).toContain('sp-pro-additions-content" inert aria-hidden="true"')
  expect(whatsapp).toContain('<strong>Pro Additions</strong>')
  expect(whatsapp).toContain('Contact developer support to request it')
  expect(whatsapp).toContain('Not active on your website.')
  expect(whatsapp).toContain("'whatsapp.accessToken': t.form.accessToken")
  const rest = source.split('function MapsTab(')[1]
  expect(rest).not.toContain('sp-pro-additions-overlay')
  const css = readFileSync('app/admin/settings/pro-additions.css', 'utf8')
  expect(css).toContain('filter:blur(5px)'); expect(css).toContain('pointer-events:none')
})
