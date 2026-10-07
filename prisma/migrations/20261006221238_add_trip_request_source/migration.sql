-- AlterTable
ALTER TABLE `trip_requests` ADD COLUMN `sourceSlug` VARCHAR(80) NULL,
    ADD COLUMN `sourceTitle` VARCHAR(200) NULL,
    ADD COLUMN `sourceType` VARCHAR(32) NULL;
