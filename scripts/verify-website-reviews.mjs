// All test writes are rolled back; never changes an existing review or user.
import { PrismaClient } from '@prisma/client'
import assert from 'node:assert/strict'
const db = new PrismaClient()
const scope = '@website'
const marker = new Error('ROLLBACK_WEBSITE_REVIEW_QA')
try {
  const before = await db.review.count()
  let passed = 0
  try {
    await db.$transaction(async tx => {
      const user = await tx.user.findFirst({ where: { reviews: { none: { tourSlug: scope } } }, select: { id: true } })
      assert.ok(user, 'No existing account available for rollback-only verification')
      const review = await tx.review.create({ data: { userId: user.id, tourSlug: scope, rating: 4, text: 'Rollback-only website review verification.', status: 'PENDING' } })
      assert.equal(review.status, 'PENDING'); passed++
      assert.equal(await tx.review.count({ where: { id: review.id, status: 'PUBLISHED' } }), 0); passed++
      assert.equal((await tx.review.findUnique({ where: { userId_tourSlug: { userId: user.id, tourSlug: scope } } }))?.id, review.id); passed++
      await tx.review.update({ where: { id: review.id }, data: { status: 'PUBLISHED', publishedAt: new Date() } })
      assert.equal((await tx.review.findUnique({ where: { id: review.id } }))?.status, 'PUBLISHED'); passed++
      assert.equal(await tx.review.count({ where: { id: review.id, tourSlug: scope, status: 'PUBLISHED' } }), 1); passed++
      await tx.review.update({ where: { id: review.id }, data: { status: 'REJECTED', publishedAt: null } })
      assert.equal(await tx.review.count({ where: { id: review.id, status: 'PUBLISHED' } }), 0); passed++
      throw marker
    })
  } catch (error) { if (error !== marker) throw error }
  assert.equal(await db.review.count(), before); passed++
  console.log(JSON.stringify({ passed, database: 'MySQL', transaction: 'rolled back', existingRecordsPreserved: true }))
} finally { await db.$disconnect() }
