-- Stop BEFORE persistent DDL when a legacy price has ambiguous capacity.
-- Matches parseVehicleCapacity: whole number, optionally seat/seats, 1..100.
CREATE TEMPORARY TABLE `_car_pricing_preflight` (`ok` INTEGER NOT NULL CHECK (`ok` = 1));
INSERT INTO `_car_pricing_preflight` (`ok`)
SELECT CASE WHEN COUNT(*) = 0 THEN 1 ELSE 0 END
FROM `car_route_prices` p LEFT JOIN `cars` c ON c.slug = p.carSlug
WHERE c.slug IS NULL OR LOWER(TRIM(c.seats)) NOT REGEXP '^[0-9]+([[:space:]]*seats?)?$'
   OR CAST(TRIM(SUBSTRING_INDEX(LOWER(TRIM(c.seats)), 'seat', 1)) AS UNSIGNED) NOT BETWEEN 1 AND 100;
DROP TEMPORARY TABLE `_car_pricing_preflight`;

CREATE TABLE `car_route_pricing` (
  `id` VARCHAR(191) NOT NULL,
  `routeId` VARCHAR(191) NOT NULL,
  `carSlug` VARCHAR(80) NOT NULL,
  `currency` CHAR(3) NOT NULL DEFAULT 'USD',
  `pricingMode` ENUM('FIXED_TOTAL','PER_PERSON') NOT NULL DEFAULT 'FIXED_TOTAL',
  PRIMARY KEY (`id`),
  UNIQUE INDEX `car_route_pricing_routeId_carSlug_key` (`routeId`,`carSlug`),
  UNIQUE INDEX `car_route_pricing_routeId_carSlug_currency_key` (`routeId`,`carSlug`,`currency`),
  INDEX `car_route_pricing_carSlug_idx` (`carSlug`),
  CONSTRAINT `car_route_pricing_carSlug_fkey` FOREIGN KEY (`carSlug`) REFERENCES `cars`(`slug`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `car_route_pricing_routeId_fkey` FOREIGN KEY (`routeId`) REFERENCES `car_routes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Deterministic parent identity, retaining every original price ID and value.
INSERT INTO `car_route_pricing` (`id`,`routeId`,`carSlug`,`currency`,`pricingMode`)
SELECT `id`,`routeId`,`carSlug`,`currency`,'FIXED_TOTAL' FROM `car_route_prices`;

ALTER TABLE `car_route_prices`
  ADD COLUMN `minPassengers` INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN `maxPassengers` INTEGER NULL;
UPDATE `car_route_prices` p JOIN `cars` c ON c.slug = p.carSlug
SET p.maxPassengers = CAST(TRIM(SUBSTRING_INDEX(LOWER(TRIM(c.seats)), 'seat', 1)) AS UNSIGNED);
ALTER TABLE `car_route_prices`
  MODIFY COLUMN `maxPassengers` INTEGER NOT NULL,
  ADD CONSTRAINT `car_price_passenger_range_check` CHECK (`minPassengers` >= 1 AND `maxPassengers` >= `minPassengers` AND `maxPassengers` <= 100),
  ADD CONSTRAINT `car_route_prices_configuration_fkey` FOREIGN KEY (`routeId`,`carSlug`,`currency`) REFERENCES `car_route_pricing`(`routeId`,`carSlug`,`currency`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD UNIQUE INDEX `car_route_prices_routeId_carSlug_minPassengers_maxPassengers_key` (`routeId`,`carSlug`,`minPassengers`,`maxPassengers`);
-- Replacement composite index already supports the existing routeId FK.
ALTER TABLE `car_route_prices` DROP INDEX `car_route_prices_routeId_carSlug_key`;

-- Historical quote values and metadata remain untouched (new field NULL).
ALTER TABLE `car_requests` ADD COLUMN `quotePricingMetadata` LONGTEXT NULL;

-- Inter-row overlap/capacity invariants are enforced by the backend transaction:
-- lock cars.slug, lock car_route_pricing.id FOR UPDATE, read tiers, validate, write.
