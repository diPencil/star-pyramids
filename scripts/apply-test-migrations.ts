import { spawnSync } from 'node:child_process'
import path from 'node:path'

import {
  configureIsolatedTestDatabase,
  loadApplicationDatabaseUrlForComparison,
} from '../tests/helpers/database-isolation'

loadApplicationDatabaseUrlForComparison()
configureIsolatedTestDatabase()

const prismaExecutable = path.join(
  process.cwd(),
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'prisma.cmd' : 'prisma',
)
const result = spawnSync(prismaExecutable, ['migrate', 'deploy'], {
  cwd: process.cwd(),
  env: process.env,
  stdio: 'inherit',
  shell: false,
})

if (result.error) throw result.error
process.exitCode = result.status ?? 1
