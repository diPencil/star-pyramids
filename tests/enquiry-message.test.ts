import { describe, expect, it } from 'vitest'
import { buildQuestionMessage, buildQuestionSubject } from '@/lib/enquiry-message'

describe('contextual trip and offer enquiries', () => {
  it('includes the campaign title in WhatsApp and email content', () => {
    const title = 'Nile & Red Sea combination'
    expect(buildQuestionMessage('Nour', title, 'Please share the available dates.', 'offer')).toContain(`Offer: ${title}`)
    expect(buildQuestionSubject(title, 'offer')).toBe(`Offer enquiry: ${title}`)
  })

  it('preserves the existing tour wording for tour questions', () => {
    expect(buildQuestionMessage('Nour', 'Cairo Day Tour', 'Is pickup included?', 'tour')).toContain('Tour: Cairo Day Tour')
  })
})
