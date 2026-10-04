-- AlterTable
ALTER TABLE `users`
    ADD COLUMN `firstName` VARCHAR(80) NULL,
    ADD COLUMN `lastName` VARCHAR(80) NULL,
    ADD COLUMN `username` VARCHAR(64) NULL,
    ADD COLUMN `countryCode` CHAR(2) NULL,
    ADD COLUMN `phone` VARCHAR(32) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `users_username_key` ON `users`(`username`);

-- CreateTable
CREATE TABLE `registration_attempts` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(190) NOT NULL,
    `ipAddress` VARCHAR(64) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `registration_attempts_email_createdAt_idx`(`email`, `createdAt`),
    INDEX `registration_attempts_ipAddress_createdAt_idx`(`ipAddress`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
