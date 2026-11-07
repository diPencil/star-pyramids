-- P0 Fix 04 — guest booking access.
-- Additive only: no existing booking row, column, or value is altered or
-- removed. Guest access is granted by NEW rows, never by rewriting history.

-- CreateTable
CREATE TABLE `booking_access_tokens` (
    `id` VARCHAR(191) NOT NULL,
    `publicId` VARCHAR(64) NOT NULL,
    `bookingRef` VARCHAR(16) NOT NULL,
    `tokenHash` VARCHAR(64) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `revokedAt` DATETIME(3) NULL,
    `lastUsedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `booking_access_tokens_publicId_key`(`publicId`),
    UNIQUE INDEX `booking_access_tokens_tokenHash_key`(`tokenHash`),
    INDEX `booking_access_tokens_bookingRef_idx`(`bookingRef`),
    INDEX `booking_access_tokens_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `booking_access_attempts` (
    `id` VARCHAR(191) NOT NULL,
    `ipAddress` VARCHAR(64) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `booking_access_attempts_ipAddress_createdAt_idx`(`ipAddress`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `booking_access_tokens` ADD CONSTRAINT `booking_access_tokens_bookingRef_fkey` FOREIGN KEY (`bookingRef`) REFERENCES `bookings`(`reference`) ON DELETE CASCADE ON UPDATE CASCADE;