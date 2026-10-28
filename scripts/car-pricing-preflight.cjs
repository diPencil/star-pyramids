// Read-only. Run with node --env-file=.env scripts/car-pricing-preflight.cjs.
const { PrismaClient } = require('@prisma/client');
const { createHash } = require('node:crypto');
const db = new PrismaClient();

async function main() {
  const url = new URL(process.env.DATABASE_URL);
  if (!['localhost', '127.0.0.1', '[::1]', '::1'].includes(url.hostname)) throw new Error('Local database required.');
  const baseline = {};
  const tables = ['cars', 'car_routes', 'car_route_prices', 'car_requests'];
  for (const table of tables) {
    const rows = await db.$queryRawUnsafe(`SELECT * FROM \`${table}\` ORDER BY id`);
    const preserved = rows.map(row => Object.fromEntries(Object.entries(row).filter(([key]) => !['minPassengers', 'maxPassengers', 'quotePricingMetadata'].includes(key)).sort(([a], [b]) => a.localeCompare(b))));
    baseline[table] = { count: rows.length, sha256: createHash('sha256').update(JSON.stringify(preserved)).digest('hex') };
  }
  const prices = await db.$queryRawUnsafe('SELECT p.id, p.carSlug, c.seats FROM car_route_prices p LEFT JOIN cars c ON c.slug=p.carSlug');
  const incompatible = prices.filter(row => {
    const match = /^(\d+)(?:\s*seats?)?$/i.exec((row.seats ?? '').trim());
    return !match || Number(match[1]) < 1 || Number(match[1]) > 100;
  }).map(row => ({ priceId: row.id, carSlug: row.carSlug, seats: row.seats }));
  console.log(JSON.stringify({ baseline, incompatible }, null, 2));
  if (incompatible.length) throw new Error('Incompatible legacy capacities; migration must not proceed.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => db.$disconnect());
