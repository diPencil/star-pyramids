-- AlterTable
ALTER TABLE `payment_events` ADD COLUMN `providerEventId` VARCHAR(128) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `payment_events_providerEventId_key` ON `payment_events`(`providerEventId`);
