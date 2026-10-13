import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const homepage = readFileSync(join(process.cwd(), 'components', 'homepage.tsx'), 'utf8')

describe('homepage help form regression guard', () => {
  it('submits to the real enquiry workflow with same-origin credentials', () => {
    expect(homepage).toMatch(/fetch\('\/api\/enquiries'/)
    expect(homepage).toMatch(/credentials:\s*'same-origin'/)
    expect(homepage).toMatch(/sourcePage:\s*'\/'/)
  })

  it('guards duplicate submissions and reuses an idempotency request ID for retries', () => {
    expect(homepage).toMatch(/if \(submitting\.current\) return/)
    expect(homepage).toMatch(/pendingRequest\.current/)
    expect(homepage).toMatch(/requestId:\s*pendingRequest\.current\.id/)
  })

  it('renders translated loading, success and failure states without browser dialogs', () => {
    expect(homepage).toMatch(/status === 'submitting'/)
    expect(homepage).toMatch(/status==='success'/)
    expect(homepage).toMatch(/role=\{status==='error'\?'alert':'status'\}/)
    expect(homepage).not.toMatch(/window\.alert|alert\(/)
  })
})
