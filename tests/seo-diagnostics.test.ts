import { describe, expect, it } from 'vitest'
import { diagnoseSeo, recordSeoPreview, type DiagnosticPage } from '@/lib/seo-diagnostics'
import { emptyRecordSeoContent } from '@/lib/record-seo'
describe('evidence-based SEO diagnostics', () => {
  it('distinguishes verified defects, recommendations and unmeasured fallbacks', () => {
    const seo = emptyRecordSeoContent(); seo.text.en.title = 'Repeated'; seo.text.en.description = 'Description'
    const rows: DiagnosticPage[] = [
      { id: 'a', route: '/blogs/a', published: true, seo },
      { id: 'b', route: '/blogs/b', published: true, seo: { ...seo, canonical: '/deleted', index: false } },
      { id: 'c', route: '/blogs/c', published: false, seo },
      { id: 'static', route: '/about', published: true, seo: null },
    ]
    const checks = diagnoseSeo(rows, new Set(['/blogs/a', '/blogs/b', '/about']))
    expect(checks.filter(check => check.code === 'duplicate-title')).toHaveLength(2)
    expect(checks.find(check => check.code === 'broken-canonical')?.severity).toBe('issue')
    expect(checks.find(check => check.code === 'noindex')?.severity).toBe('recommendation')
    expect(checks.filter(check => check.route === '/about' && ['missing-title', 'missing-description'].includes(check.code)).every(check => check.severity === 'unverified')).toBe(true)
    expect(checks.filter(check => check.route === '/blogs/c').map(check => check.code)).toEqual(['not-public'])
    expect(JSON.stringify(checks)).not.toContain('ranking score')
  })
  it('renders private locale/schema/robots preview without arbitrary schema injection', () => {
    const seo = emptyRecordSeoContent(); seo.text.it = { title: 'Egitto', description: 'Un viaggio.' }; seo.index = false
    const result = recordSeoPreview({ name: 'Egypt', route: '/blogs/egypt' }, seo, 'it', 'https://starpyramids.com')
    expect(result.metadata).toMatchObject({ title: { absolute: 'Egitto' }, robots: { index: false, follow: true } })
    expect(result.structuredData).toMatchObject({ '@type': 'WebPage', name: 'Egitto' })
    expect(recordSeoPreview({ name: 'Egypt', route: '/blogs/egypt' }, { ...seo, structuredData: false }, 'it', 'https://starpyramids.com').structuredData).toBeNull()
  })
})
