-- CreateTable
CREATE TABLE `car_requests` (
    `id` VARCHAR(191) NOT NULL,
    `reference` VARCHAR(16) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `vehicleSlug` VARCHAR(80) NOT NULL,
    `assignedVehicleSlug` VARCHAR(80) NULL,
    `tripType` ENUM('ONE_WAY', 'ROUND_TRIP') NOT NULL DEFAULT 'ONE_WAY',
    `pickup` VARCHAR(160) NOT NULL,
    `dropoff` VARCHAR(160) NOT NULL,
    `pickupDate` DATE NULL,
    `returnDate` DATE NULL,
    `passengers` INTEGER NOT NULL DEFAULT 1,
    `contactName` VARCHAR(80) NOT NULL,
    `contactEmail` VARCHAR(190) NOT NULL,
    `contactPhone` VARCHAR(32) NOT NULL,
    `notes` TEXT NULL,
    `status` ENUM('NEW', 'REVIEWING', 'CONFIRMED', 'CANCELLED') NOT NULL DEFAULT 'NEW',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `car_requests_reference_key`(`reference`),
    INDEX `car_requests_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `car_requests_status_createdAt_idx`(`status`, `createdAt`),
    INDEX `car_requests_contactEmail_idx`(`contactEmail`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `car_request_activities` (
    `id` VARCHAR(191) NOT NULL,
    `requestId` VARCHAR(191) NOT NULL,
    `actorRole` VARCHAR(16) NOT NULL,
    `action` VARCHAR(160) NOT NULL,
    `note` TEXT NULL,
    `isInternal` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `car_request_activities_requestId_createdAt_idx`(`requestId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `car_request_attempts` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(190) NOT NULL,
    `ipAddress` VARCHAR(64) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `car_request_attempts_email_createdAt_idx`(`email`, `createdAt`),
    INDEX `car_request_attempts_ipAddress_createdAt_idx`(`ipAddress`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `car_requests` ADD CONSTRAINT `car_requests_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `car_request_activities` ADD CONSTRAINT `car_request_activities_requestId_fkey` FOREIGN KEY (`requestId`) REFERENCES `car_requests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
