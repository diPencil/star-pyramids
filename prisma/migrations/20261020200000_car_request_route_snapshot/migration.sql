-- Phase 6 (Rent Cars transfers): optional structured route/location/time
-- references and the server-side quote snapshot on CarRequest. Purely
-- additive ALTER TABLE ADD COLUMN statements; no data is modified, renamed,
-- or dropped. Existing rows keep NULL for every new column.
-- The phantom route FK relies on car_routes (Phase 2 migration).

ALTER TABLE `car_requests` ADD COLUMN `pickupLocationSlug` VARCHAR(80) NULL,
    ADD COLUMN `dropoffLocationSlug` VARCHAR(80) NULL,
    ADD COLUMN `routeId` VARCHAR(191) NULL,
    ADD COLUMN `pickupTime` VARCHAR(5) NULL,
    ADD COLUMN `returnTime` VARCHAR(5) NULL,
    ADD COLUMN `quoteCurrency` CHAR(3) NULL,
    ADD COLUMN `quotedCents` INTEGER NULL,
    ADD COLUMN `quoteBasis` VARCHAR(16) NULL,
    ADD COLUMN `quoteRoundTripCents` INTEGER NULL,
    ADD COLUMN `quotedAt` DATETIME(3) NULL;

-- CreateTable on legacy table is not needed; only index + FK additions.
ALTER TABLE `car_requests` ADD INDEX `car_requests_routeId_idx`(`routeId`);

-- AddForeignKey
ALTER TABLE `car_requests` ADD CONSTRAINT `car_requests_routeId_fkey` FOREIGN KEY (`routeId`) REFERENCES `car_routes`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
