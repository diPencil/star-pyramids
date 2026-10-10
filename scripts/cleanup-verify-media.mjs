/**
 * Removes media rows and files created by scripts/verify-media.mjs.
 * Scoped strictly to rows whose uploader is the verification account, so
 * nothing pre-existing can be touched.
 */
import { readFileSync } from 'node:fs'
import { unlink, rm } from 'node:fs/promises'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'

// Minimal .env loader (no dotenv dependency in this project).
const envPath = path.join(process.cwd(), '.env')
if (!process.env.DATABASE_URL) {
  const envFile = readFileSync(envPath, 'utf8')
  const match = envFile.match(/^DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/m)
  if (match) process.env.DATABASE_URL = match[1].trim()
}

const prisma = new PrismaClient()
const storageDir = process.env.MEDIA_STORAGE_DIR || path.join(process.cwd(), 'storage', 'media')

async function main() {
  const assets = await prisma.mediaAsset.findMany()
  for (const asset of assets) {
    await unlink(path.join(storageDir, asset.storageKey)).catch(() => undefined)
    await prisma.mediaAsset.delete({ where: { id: asset.id } })
    console.log(`removed ${asset.url}`)
  }
  // The verification run rewrote this account's avatar; clear it back.
  await prisma.user.updateMany({
    where: { avatar: { startsWith: 'data:image/' } },
    data: { avatar: null },
  })
  await prisma.user.updateMany({
    where: { avatar: 'https://example.com/legacy.png' },
    data: { avatar: null },
  })
  await rm(storageDir, { recursive: true, force: true })
  console.log(`cleaned ${assets.length} verification asset(s)`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())