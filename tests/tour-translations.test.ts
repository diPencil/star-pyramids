import { describe, expect, it } from 'vitest'
import { readTourText, writeTourText, type Translatable } from '@/lib/tour-translations'

describe('manual tour translation editing', () => {
  const original: Translatable & { title: string; price: number; titleAr: string } = {
    title: 'Cairo', price: 125, titleAr: 'القاهرة',
  }

  it('keeps English, legacy Arabic and shared values while editing multiple languages', () => {
    const spanish = writeTourText(original, 'title', 'El Cairo', 'es')
    const italian = writeTourText(spanish, 'title', 'Il Cairo', 'it')
    const reloaded = JSON.parse(JSON.stringify(italian)) as typeof original
    expect(readTourText(reloaded, 'title', 'es')).toBe('El Cairo')
    expect(readTourText(reloaded, 'title', 'it')).toBe('Il Cairo')
    expect(readTourText(reloaded, 'title', 'en')).toBe('Cairo')
    expect(reloaded.price).toBe(125)
    expect(reloaded.titleAr).toBe('القاهرة')
    expect(original.translations).toBeUndefined()
  })

  it('restores a clean snapshot when a new translation is reverted', () => {
    const changed = writeTourText(original, 'title', 'El Cairo', 'es')
    expect(JSON.stringify(changed)).not.toBe(JSON.stringify(original))
    expect(JSON.stringify(writeTourText(changed, 'title', '', 'es'))).toBe(JSON.stringify(original))
  })

  it('does not fabricate missing translations or lose translations on English edits', () => {
    expect(readTourText(original, 'title', 'it')).toBe('')
    const changed = writeTourText(writeTourText(original, 'title', 'El Cairo', 'es'), 'title', 'Cairo tour', 'en')
    expect(changed.title).toBe('Cairo tour')
    expect(readTourText(changed, 'title', 'es')).toBe('El Cairo')
  })

  it('keeps translations attached when repeatable rows move or are removed', () => {
    const first = writeTourText({ ...original, id: 'first' }, 'title', 'Primero', 'es')
    const second = writeTourText({ ...original, id: 'second' }, 'title', 'Secondo', 'it')
    const reordered = [second, first]
    expect(readTourText(reordered[0], 'title', 'it')).toBe('Secondo')
    const remaining = reordered.filter((row) => row.id !== 'first')
    expect(readTourText(remaining[0], 'title', 'it')).toBe('Secondo')
  })
})
