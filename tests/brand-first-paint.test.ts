import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { BrandProvider } from '@/components/brand-context'
import { BrandMark } from '@/components/brand-mark'
import { defaultBrandSettings, useBrandSettings } from '@/lib/admin-store'
function Identity(){const brand=useBrandSettings();return createElement('img',{src:brand.logo,alt:brand.companyName})}
describe('server-seeded branding first paint',()=>{
 it('renders uploaded logo and dashboard icon in initial HTML without default asset flashes',()=>{
  const initial={...defaultBrandSettings,logo:'/media/2026/10/new-logo.webp',favicon:'/media/2026/10/new-icon.png'}
  const html=renderToStaticMarkup(createElement(BrandProvider,{initial,children:[createElement(Identity,{key:'logo'}),createElement(BrandMark,{key:'icon',alt:'Identity'})]}))
  expect(html).toContain(initial.logo);expect(html).toContain(initial.favicon);expect(html).not.toContain('src="/logo.png"');expect(html).not.toContain('src="/favicon.png"')
 })
 it('keeps defaults available for an unconfigured installation',()=>{const html=renderToStaticMarkup(createElement(BrandProvider,{initial:defaultBrandSettings,children:createElement(Identity)}));expect(html).toContain('src="/logo.png"')})
})
