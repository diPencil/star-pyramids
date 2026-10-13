import { beforeAll } from 'vitest'

import { db } from '@/lib/server/db'

beforeAll(async () => {
  try {
    await db.$queryRaw`SELECT 1`
  } catch {
    throw new Error(
      'The isolated integration database is unavailable or not migrated. No application database fallback was used.',
    )
  }
})
