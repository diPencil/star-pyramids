import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseVehicleCapacity } from '@/lib/car-request'

const sql = readFileSync('prisma/migrations/20261027170000_car_passenger_pricing/migration.sql', 'utf8')
const schema = readFileSync('prisma/schema.prisma', 'utf8')

describe('passenger pricing migration safety', () => {
  it('preflights ambiguous capacities before creating persistent tables', () => {
    expect(sql.indexOf('INSERT INTO `_car_pricing_preflight`')).toBeLessThan(sql.indexOf('CREATE TABLE `car_route_pricing`'))
    expect(sql).toContain('CHECK (`ok` = 1)')
    for (const seats of ['2-4 seats', 'up to 8', '', '0', '101 seats']) expect(parseVehicleCapacity(seats)).toBeNull()
    expect(parseVehicleCapacity('6 Seats')).toBe(6)
  })
  it('preserves original IDs and monetary/status fields and defaults to fixed totals', () => {
    expect(sql).toContain("SELECT `id`,`routeId`,`carSlug`,`currency`,'FIXED_TOTAL' FROM `car_route_prices`")
    expect(sql).toContain('SET p.maxPassengers =')
    expect(sql).not.toMatch(/DELETE FROM|TRUNCATE|DROP TABLE|DROP COLUMN|UPDATE\s+`car_requests`/i)
    expect(sql).not.toMatch(/SET\s+(?:p\.)?(?:oneWayCents|roundTripCents|currency|isActive|id)\s*=/i)
  })
  it('enforces one configuration and currency per pair, valid ranges, and nullable snapshot metadata', () => {
    expect(sql).toContain('UNIQUE INDEX `car_route_pricing_routeId_carSlug_key`')
    expect(sql).toContain('FOREIGN KEY (`routeId`,`carSlug`,`currency`)')
    expect(sql).toContain('`maxPassengers` >= `minPassengers`')
    expect(sql).toContain('ADD COLUMN `quotePricingMetadata` LONGTEXT NULL')
    expect(schema).toContain('enum CarPricingMode')
    expect(schema).toContain('@@unique([routeId, carSlug, minPassengers, maxPassengers])')
  })
})
