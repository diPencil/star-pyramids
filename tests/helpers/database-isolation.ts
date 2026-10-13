import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { parseEnv } from 'node:util'

const MYSQL_PROTOCOLS = new Set(['mysql:'])
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])

export const INTEGRATION_DATABASE_CONFIRMATION = 'STAR_PYRAMIDS_ISOLATED_TEST_DB'

type DatabaseEnvironment = {
  applicationDatabaseUrl?: string
  testDatabaseUrl?: string
  confirmation?: string
}

type DatabaseTarget = {
  host: string
  port: string
  database: string
}

export class TestDatabaseIsolationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TestDatabaseIsolationError'
  }
}

function normalizedHost(hostname: string): string {
  const host = hostname.toLowerCase()
  return LOCAL_HOSTS.has(host) ? 'local-machine' : host
}

export function parseMySqlTarget(value: string, label: string): DatabaseTarget {
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    throw new TestDatabaseIsolationError(`${label} must be a valid MySQL connection URL.`)
  }

  if (!MYSQL_PROTOCOLS.has(parsed.protocol)) {
    throw new TestDatabaseIsolationError(`${label} must use the mysql protocol.`)
  }

  const database = decodeURIComponent(parsed.pathname.replace(/^\/+/, '')).trim()
  if (!parsed.hostname || !database) {
    throw new TestDatabaseIsolationError(`${label} must include a host and database name.`)
  }

  return {
    host: normalizedHost(parsed.hostname),
    port: parsed.port || '3306',
    database,
  }
}

export function sameDatabaseTarget(left: DatabaseTarget, right: DatabaseTarget): boolean {
  return (
    left.host === right.host &&
    left.port === right.port &&
    left.database.toLowerCase() === right.database.toLowerCase()
  )
}

export function isolatedTestDatabaseUrl(environment: DatabaseEnvironment): string {
  if (environment.confirmation !== INTEGRATION_DATABASE_CONFIRMATION) {
    throw new TestDatabaseIsolationError(
      'Integration database writes are disabled. Set the explicit isolation confirmation value.',
    )
  }

  if (!environment.applicationDatabaseUrl) {
    throw new TestDatabaseIsolationError(
      'DATABASE_URL is required for comparison and will never be used as the integration database.',
    )
  }
  if (!environment.testDatabaseUrl) {
    throw new TestDatabaseIsolationError(
      'TEST_DATABASE_URL is required. Integration tests never fall back to DATABASE_URL.',
    )
  }

  const application = parseMySqlTarget(environment.applicationDatabaseUrl, 'DATABASE_URL')
  const test = parseMySqlTarget(environment.testDatabaseUrl, 'TEST_DATABASE_URL')
  if (sameDatabaseTarget(application, test)) {
    throw new TestDatabaseIsolationError(
      'TEST_DATABASE_URL targets the application database. Use a separate host, port, or database.',
    )
  }

  return environment.testDatabaseUrl
}

export function configureIsolatedTestDatabase(environment = process.env): string {
  const testDatabaseUrl = isolatedTestDatabaseUrl({
    applicationDatabaseUrl: environment.DATABASE_URL,
    testDatabaseUrl: environment.TEST_DATABASE_URL,
    confirmation: environment.INTEGRATION_TEST_DATABASE_CONFIRMATION,
  })

  // Prisma reads DATABASE_URL. Replacing it happens only after the guard passes.
  environment.DATABASE_URL = testDatabaseUrl
  return testDatabaseUrl
}
export function loadApplicationDatabaseUrlForComparison(
  environment = process.env,
  cwd = process.cwd(),
): void {
  if (environment.DATABASE_URL) return

  const envPath = path.join(cwd, '.env')
  if (!existsSync(envPath)) return

  const parsed = parseEnv(readFileSync(envPath, 'utf8'))
  if (parsed.DATABASE_URL) environment.DATABASE_URL = parsed.DATABASE_URL
}
