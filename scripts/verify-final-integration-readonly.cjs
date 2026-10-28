// Local SELECT-only fingerprints. No row content, credentials or PII printed.
const { PrismaClient } = require('@prisma/client')
const { createHash } = require('node:crypto')
async function main() {
  const target = new URL(process.env.DATABASE_URL || '')
  if (!['localhost', '127.0.0.1', '[::1]'].includes(target.hostname)) throw Error('Local database only')
  const db = new PrismaClient()
  try {
    const names = new Set(['tours', 'offers', 'destinations', 'events', 'cars', 'car_locations', 'car_routes', 'car_route_pricings', 'car_route_pricing', 'car_route_prices', 'car_requests', 'trip_requests', 'event_requests', 'bookings', 'booking_items', 'payments', 'payment_events', 'journey_gallery', 'journey_gallery_tours', 'reviews', 'media_assets', 'site_settings'])
    const tables = await db.$queryRaw`SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME`
    const result = []
    for (const { name } of tables) {
      if (!names.has(name)) continue
      const rows = await db.$queryRawUnsafe('SELECT * FROM `' + name + '`')
      const serialized = rows.map(row => JSON.stringify(row, (_, value) => typeof value === 'bigint' ? value.toString() : Buffer.isBuffer(value) ? value.toString('hex') : value)).sort()
      result.push({ table: name, rows: rows.length, sha256: createHash('sha256').update(JSON.stringify(serialized)).digest('hex') })
    }
    const constraints = await db.$queryRaw`SELECT TABLE_NAME AS tableName, CONSTRAINT_NAME AS name FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() ORDER BY TABLE_NAME, CONSTRAINT_NAME`
    const columns = await db.$queryRaw`SELECT TABLE_NAME AS tableName, CONSTRAINT_NAME AS name, COLUMN_NAME AS columnName, REFERENCED_TABLE_NAME AS parentTable, REFERENCED_COLUMN_NAME AS parentColumn FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL ORDER BY TABLE_NAME, CONSTRAINT_NAME, ORDINAL_POSITION`
    const groups = new Map()
    for (const column of columns) {
      const key = column.tableName + ':' + column.name
      groups.set(key, [...(groups.get(key) || []), column])
    }
    const identifier = value => { if (!/^[a-zA-Z0-9_]+$/.test(value)) throw Error('Unexpected schema identifier'); return '`' + value + '`' }
    let orphanRows = 0
    for (const group of groups.values()) {
      const join = group.map(c => 'c.' + identifier(c.columnName) + ' = p.' + identifier(c.parentColumn)).join(' AND ')
      const notNull = group.map(c => 'c.' + identifier(c.columnName) + ' IS NOT NULL').join(' AND ')
      const rows = await db.$queryRawUnsafe('SELECT COUNT(*) AS total FROM ' + identifier(group[0].tableName) + ' c LEFT JOIN ' + identifier(group[0].parentTable) + ' p ON ' + join + ' WHERE ' + notNull + ' AND p.' + identifier(group[0].parentColumn) + ' IS NULL')
      orphanRows += Number(rows[0].total)
    }
    console.log(JSON.stringify({ tables: result, foreignKeys: constraints.length, orphanRows, fingerprint: createHash('sha256').update(JSON.stringify(result)).digest('hex') }, null, 2))
  } finally { await db.$disconnect() }
}
main().catch(() => { console.error('Local read-only verification failed; no writes attempted.'); process.exitCode = 1 })
