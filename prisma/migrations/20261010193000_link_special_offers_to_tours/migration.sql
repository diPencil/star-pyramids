-- Additive only: existing campaign records remain untouched and unlinked.
ALTER TABLE `offers`
  ADD COLUMN `tourSlug` VARCHAR(80) NULL,
  ADD COLUMN `discountPercent` DOUBLE NULL,
  ADD COLUMN `startsAt` DATETIME(3) NULL;
CREATE UNIQUE INDEX `offers_tourSlug_key` ON `offers`(`tourSlug`);
ALTER TABLE `offers` ADD CONSTRAINT `offers_tourSlug_fkey`
  FOREIGN KEY (`tourSlug`) REFERENCES `tours`(`slug`)
  ON DELETE RESTRICT ON UPDATE CASCADE;
