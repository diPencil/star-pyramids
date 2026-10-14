import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { SEO_PAGES } from '@/lib/seo-manager'
import { originalPageContent } from '@/lib/page-sections'
const source = vi.hoisted(() => ({ seo: null as unknown, unavailable: false }))
vi.mock('@/lib/server/global-seo', () => ({ getGlobalSeo: async () => ({ openGraph: { images: [{ url: 'https://starpyramids.com/default.jpg' }] }, twitter: { images: ['https://starpyramids.com/default.jpg'] } }) }))
vi.mock('@/lib/server/page-sections', () => ({ readPublishedPage: async () => ({ content: { seo: source.seo }, unavailable: source.unavailable }) }))
vi.mock('@/lib/server/locale', () => ({ getServerLocale: async () => 'it' }))
vi.mock('@/lib/seo', () => ({ getSiteUrl: async () => 'https://starpyramids.com' }))
import { pageContentMetadata } from '@/lib/server/page-content-metadata'
describe('actual static metadata consumers', () => {
  it.each(Object.entries(SEO_PAGES))('%s reads its real CMS SEO after route defaults', (id, page) => {
    const cruise = page.route.startsWith('/egypt-tours/nile-cruises/')
    const file = readFileSync(cruise ? 'app/egypt-tours/nile-cruises/[type]/page.tsx' : 'app' + (page.route === '/' ? '' : page.route) + '/page.tsx', 'utf8')
    if (id === 'homepage') expect(file).toContain("pageContentMetadata('homepage')")
    else {
      const call = cruise ? 'pageContentMetadata(type)' : `pageContentMetadata('${id}')`
      expect(file).toContain(call)
      expect(file.indexOf(`...(await ${call})`)).toBeGreaterThan(file.indexOf('alternates:'))
    }
  })
  it('renders published localized metadata and explicit robots, without database access', async () => {
    const seo = originalPageContent('about').seo
    seo.text.it = { title: 'Egitto', description: 'Viaggi in Egitto.' }
    source.seo = { ...seo, index: false, canonical: '/contact' }
    expect(await pageContentMetadata('about')).toMatchObject({ title: { absolute: 'Egitto' }, description: 'Viaggi in Egitto.', robots: { index: false, follow: true }, alternates: { canonical: 'https://starpyramids.com/contact' } })
    expect(await pageContentMetadata('about')).toMatchObject({ openGraph: { images: [{ url: 'https://starpyramids.com/default.jpg' }] }, twitter: { images: ['https://starpyramids.com/default.jpg'] } })
    source.unavailable = true
    expect(await pageContentMetadata('about')).toEqual({})
  })
})
