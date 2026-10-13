import { afterEach, describe, expect, it } from 'vitest'

import {
  configureIsolatedTestDatabase,
  INTEGRATION_DATABASE_CONFIRMATION,
  isolatedTestDatabaseUrl,
  parseMySqlTarget,
  sameDatabaseTarget,
  TestDatabaseIsolationError,
} from '@/tests/helpers/database-isolation'

const appUrl = 'mysql://app-user:secret@db.example.test:3306/star_pyramids'
const testUrl = 'mysql://test-user:secret@db.example.test:3306/star_pyramids_integration'

describe('integration database isolation guard', () => {
  afterEach(() => {
    delete process.env.TEST_DATABASE_URL
    delete process.env.INTEGRATION_TEST_DATABASE_CONFIRMATION
  })

  it('fails closed when TEST_DATABASE_URL is missing', () => {
    expect(() =>
      isolatedTestDatabaseUrl({
        applicationDatabaseUrl: appUrl,
        confirmation: INTEGRATION_DATABASE_CONFIRMATION,
      }),
    ).toThrow(TestDatabaseIsolationError)
  })

  it('fails closed without the exact confirmation value', () => {
    expect(() =>
      isolatedTestDatabaseUrl({
        applicationDatabaseUrl: appUrl,
        testDatabaseUrl: testUrl,
        confirmation: 'yes',
      }),
    ).toThrow('explicit isolation confirmation')
  })

  it('requires DATABASE_URL for a positive target comparison', () => {
    expect(() =>
      isolatedTestDatabaseUrl({
        testDatabaseUrl: testUrl,
        confirmation: INTEGRATION_DATABASE_CONFIRMATION,
      }),
    ).toThrow('required for comparison')
  })

  it('rejects the application database despite different credentials and query options', () => {
    expect(() =>
      isolatedTestDatabaseUrl({
        applicationDatabaseUrl: 'mysql://app:one@localhost/star_pyramids?connection_limit=5',
        testDatabaseUrl: 'mysql://tester:two@127.0.0.1:3306/star_pyramids?sslaccept=strict',
        confirmation: INTEGRATION_DATABASE_CONFIRMATION,
      }),
    ).toThrow('targets the application database')
  })

  it('compares decoded database targets instead of raw URL strings', () => {
    const left = parseMySqlTarget('mysql://a:x@DB.EXAMPLE.TEST:3306/star%5Fpyramids', 'left')
    const right = parseMySqlTarget('mysql://b:y@db.example.test/star_pyramids', 'right')
    expect(sameDatabaseTarget(left, right)).toBe(true)
  })

  it('accepts an explicitly confirmed separate database', () => {
    expect(
      isolatedTestDatabaseUrl({
        applicationDatabaseUrl: appUrl,
        testDatabaseUrl: testUrl,
        confirmation: INTEGRATION_DATABASE_CONFIRMATION,
      }),
    ).toBe(testUrl)
  })

  it('switches Prisma only after validation succeeds', () => {
    const environment: NodeJS.ProcessEnv = {
      DATABASE_URL: appUrl,
      TEST_DATABASE_URL: testUrl,
      INTEGRATION_TEST_DATABASE_CONFIRMATION: INTEGRATION_DATABASE_CONFIRMATION,
    }

    expect(configureIsolatedTestDatabase(environment)).toBe(testUrl)
    expect(environment.DATABASE_URL).toBe(testUrl)
  })
})
