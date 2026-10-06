-- CreateTable
CREATE TABLE `bookings` (
    `id` VARCHAR(191) NOT NULL,
    `reference` VARCHAR(16) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `contactName` VARCHAR(80) NOT NULL,
    `contactEmail` VARCHAR(190) NOT NULL,
    `contactPhone` VARCHAR(32) NOT NULL,
    `notes` TEXT NULL,
    `currency` CHAR(3) NOT NULL DEFAULT 'USD',
    `subtotal` DECIMAL(10, 2) NOT NULL,
    `discount` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `total` DECIMAL(10, 2) NOT NULL,
    `status` ENUM('PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `paymentStatus` ENUM('PENDING', 'PAID', 'REFUNDED') NOT NULL DEFAULT 'PENDING',
    `idempotencyKey` VARCHAR(64) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `bookings_reference_key`(`reference`),
    UNIQUE INDEX `bookings_idempotencyKey_key`(`idempotencyKey`),
    INDEX `bookings_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `bookings_status_createdAt_idx`(`status`, `createdAt`),
    INDEX `bookings_contactEmail_idx`(`contactEmail`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `booking_items` (
    `id` VARCHAR(191) NOT NULL,
    `bookingId` VARCHAR(191) NOT NULL,
    `tourSlug` VARCHAR(120) NOT NULL,
    `tourTitle` VARCHAR(200) NOT NULL,
    `tourImage` VARCHAR(255) NULL,
    `travelDate` VARCHAR(10) NOT NULL DEFAULT '',
    `adults` INTEGER NOT NULL DEFAULT 1,
    `children` INTEGER NOT NULL DEFAULT 0,
    `infants` INTEGER NOT NULL DEFAULT 0,
    `addons` JSON NOT NULL,
    `adultUnit` DECIMAL(10, 2) NOT NULL,
    `childUnit` DECIMAL(10, 2) NOT NULL,
    `infantUnit` DECIMAL(10, 2) NOT NULL,
    `addonTotal` DECIMAL(10, 2) NOT NULL,
    `lineTotal` DECIMAL(10, 2) NOT NULL,

    INDEX `booking_items_bookingId_idx`(`bookingId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `booking_activities` (
    `id` VARCHAR(191) NOT NULL,
    `bookingId` VARCHAR(191) NOT NULL,
    `actorRole` VARCHAR(16) NOT NULL,
    `action` VARCHAR(160) NOT NULL,
    `note` TEXT NULL,
    `isInternal` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `booking_activities_bookingId_createdAt_idx`(`bookingId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `booking_attempts` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(190) NOT NULL,
    `ipAddress` VARCHAR(64) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `booking_attempts_email_createdAt_idx`(`email`, `createdAt`),
    INDEX `booking_attempts_ipAddress_createdAt_idx`(`ipAddress`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `booking_items` ADD CONSTRAINT `booking_items_bookingId_fkey` FOREIGN KEY (`bookingId`) REFERENCES `bookings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `booking_activities` ADD CONSTRAINT `booking_activities_bookingId_fkey` FOREIGN KEY (`bookingId`) REFERENCES `bookings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
