-- Phase 2 (Rent Cars): locations, directional routes, vehicle-specific route pricing.
-- Additive only: new tables + enums; no ALTER/DROP on cars or car_requests.
-- Money is stored as integer minor units (cents) — DECIMAL-free and float-free.

-- CreateTable
CREATE TABLE `car_locations` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(80) NOT NULL,
    `nameEn` VARCHAR(120) NOT NULL,
    `nameEs` VARCHAR(120) NULL,
    `nameIt` VARCHAR(120) NULL,
    `nameAr` VARCHAR(120) NULL,
    `kind` ENUM('AIRPORT', 'HOTEL', 'CITY', 'CUSTOM') NOT NULL DEFAULT 'CITY',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 999,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `car_locations_slug_key`(`slug`),
    INDEX `car_locations_isActive_sortOrder_idx`(`isActive`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `car_routes` (
    `id` VARCHAR(191) NOT NULL,
    `originSlug` VARCHAR(80) NOT NULL,
    `destinationSlug` VARCHAR(80) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 999,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `car_routes_originSlug_destinationSlug_key`(`originSlug`, `destinationSlug`),
    INDEX `car_routes_destinationSlug_idx`(`destinationSlug`),
    INDEX `car_routes_isActive_idx`(`isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `car_route_prices` (
    `id` VARCHAR(191) NOT NULL,
    `routeId` VARCHAR(191) NOT NULL,
    `carSlug` VARCHAR(80) NOT NULL,
    `currency` CHAR(3) NOT NULL DEFAULT 'USD',
    `oneWayCents` INTEGER NOT NULL,
    `roundTripMode` ENUM('AUTOMATIC', 'MANUAL') NOT NULL DEFAULT 'AUTOMATIC',
    `roundTripCents` INTEGER NULL,
    `roundTripMultiplierBp` INTEGER NOT NULL DEFAULT 200,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `car_route_prices_routeId_carSlug_key`(`routeId`, `carSlug`),
    INDEX `car_route_prices_carSlug_idx`(`carSlug`),
    INDEX `car_route_prices_isActive_idx`(`isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `car_routes` ADD CONSTRAINT `car_routes_originSlug_fkey` FOREIGN KEY (`originSlug`) REFERENCES `car_locations`(`slug`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `car_routes` ADD CONSTRAINT `car_routes_destinationSlug_fkey` FOREIGN KEY (`destinationSlug`) REFERENCES `car_locations`(`slug`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `car_route_prices` ADD CONSTRAINT `car_route_prices_routeId_fkey` FOREIGN KEY (`routeId`) REFERENCES `car_routes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `car_route_prices` ADD CONSTRAINT `car_route_prices_carSlug_fkey` FOREIGN KEY (`carSlug`) REFERENCES `cars`(`slug`) ON DELETE CASCADE ON UPDATE CASCADE;
