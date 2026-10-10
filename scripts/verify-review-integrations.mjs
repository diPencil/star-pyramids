// Run with: node --conditions=react-server --import tsx scripts/verify-review-integrations.mjs
// Tests only a previously absent settings key and always rolls back the transaction.
import assert from 'node:assert/strict'
process.loadEnvFile('.env')
const { db } = await import('../lib/server/db.ts')
const { saveReviewIntegration, getReviewIntegrations } = await import('../lib/server/review-integrations.ts')
const key = 'reviews.integration.google'
const rollback = new Error('ROLLBACK_REVIEW_SETTINGS_VERIFICATION')
const methods = ['findUnique', 'create', 'updateMany']
const model = db.siteSetting
const originals = Object.fromEntries(methods.map(name => [name, model[name]]))
let passed = 0
try {
  assert.equal(await db.siteSetting.findUnique({ where: { key } }), null, 'Existing Google integration found. Verification refuses to touch it.')
  const count = await db.siteSetting.count()
  try {
    await db.$transaction(async tx => {
      for (const name of methods) model[name] = (...args) => tx.siteSetting[name](...args)
      try {
        const config = { enabled: false, resourceId: 'ChIJverification', profileUrl: '', widgetId: '' }
        await saveReviewIntegration('google', config, 'verification-secret-one', false)
        const row = await tx.siteSetting.findUniqueOrThrow({ where: { key } })
        assert.ok(!row.value.includes('verification-secret-one')); passed++
        let snapshot = (await getReviewIntegrations()).find(v => v.provider === 'google')
        assert.equal(snapshot.secretConfigured, true); assert.equal(snapshot.resourceId, config.resourceId); passed++
        const first = JSON.parse(row.value).credential
        await saveReviewIntegration('google', config, '', false)
        assert.equal(JSON.parse((await tx.siteSetting.findUniqueOrThrow({ where: { key } })).value).credential, first); passed++
        await saveReviewIntegration('google', config, 'verification-secret-two', false)
        assert.notEqual(JSON.parse((await tx.siteSetting.findUniqueOrThrow({ where: { key } })).value).credential, first); passed++
        await saveReviewIntegration('google', config, '', true)
        snapshot = (await getReviewIntegrations()).find(v => v.provider === 'google')
        assert.equal(snapshot.secretConfigured, false); passed++
        assert.ok(!JSON.stringify(snapshot).includes('verification-secret')); passed++
      } finally { for (const name of methods) model[name] = originals[name] }
      throw rollback
    }, { timeout: 20000 })
  } catch (e) { if (e !== rollback) throw e }
  assert.equal(await db.siteSetting.findUnique({ where: { key } }), null)
  assert.equal(await db.siteSetting.count(), count); passed++
  console.log(JSON.stringify({ passed, database: 'MySQL', transaction: 'rolled back', existingSettingsPreserved: true, leftoverTestRows: 0 }))
} finally { for (const name of methods) model[name] = originals[name]; await db.$disconnect() }
