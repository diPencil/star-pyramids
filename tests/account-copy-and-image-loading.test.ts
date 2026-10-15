import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
it('uses project welcome copy without the obsolete Friday plan', () => {
  const source = readFileSync('app/admin/dashboard/page.tsx', 'utf8')
  expect(source).toContain('Welcome to STAR PYRAMIDS.')
  expect(source).not.toContain('Friday plan')
})
it('removes the technical customer notice without changing payment functionality', () => {
  const source = readFileSync('components/account-portal.tsx', 'utf8')
  expect(source).not.toContain("en: 'Account connected'")
  expect(source).not.toContain('Your identity, profile, sign-in')
})
it('does not eagerly preload every catalogue cover while keeping the homepage hero prioritized', () => {
  const source = readFileSync('components/site.tsx', 'utf8').split('export function CardGallery(')[1].split('export function TourCard(')[0]
  expect(source).toContain('loading="lazy"')
  expect(source).not.toContain('priority=')
  expect(source).toContain('imgs.map(')
  expect(readFileSync('components/homepage-hero.tsx', 'utf8')).toContain('fill priority sizes="100vw"')
})
