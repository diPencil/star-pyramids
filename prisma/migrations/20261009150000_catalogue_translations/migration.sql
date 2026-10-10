CREATE TABLE `catalogue_translations` (
  `entityType` VARCHAR(24) NOT NULL,
  `slug` VARCHAR(80) NOT NULL,
  `payload` LONGTEXT NOT NULL,
  PRIMARY KEY (`entityType`, `slug`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
