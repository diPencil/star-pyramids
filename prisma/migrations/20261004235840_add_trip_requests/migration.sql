-- CreateTable
CREATE TABLE `trip_requests` (
    `id` VARCHAR(191) NOT NULL,
    `reference` VARCHAR(16) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `contactName` VARCHAR(80) NOT NULL,
    `contactEmail` VARCHAR(190) NOT NULL,
    `contactPhone` VARCHAR(32) NOT NULL,
    `contactDialCode` VARCHAR(8) NOT NULL,
    `nationality` CHAR(2) NOT NULL,
    `destinationSlug` VARCHAR(80) NULL,
    `tourSlug` VARCHAR(80) NULL,
    `customTitle` VARCHAR(120) NULL,
    `requestedAddOns` TEXT NOT NULL DEFAULT '[]',
    `timeMode` ENUM('EXACT', 'APPROX', 'UNSURE') NOT NULL DEFAULT 'EXACT',
    `preferredFrom` DATE NULL,
    `preferredTo` DATE NULL,
    `adults` INTEGER NOT NULL DEFAULT 1,
    `children` INTEGER NOT NULL DEFAULT 0,
    `infants` INTEGER NOT NULL DEFAULT 0,
    `budgetMin` INTEGER NOT NULL DEFAULT 0,
    `budgetMax` INTEGER NOT NULL DEFAULT 0,
    `budgetCurrency` CHAR(3) NOT NULL DEFAULT 'USD',
    `flightOffer` BOOLEAN NOT NULL DEFAULT false,
    `notes` TEXT NULL,
    `status` ENUM('NEW', 'REVIEWING', 'PROPOSAL_READY', 'APPROVED', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'NEW',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `trip_requests_reference_key`(`reference`),
    INDEX `trip_requests_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `trip_requests_status_createdAt_idx`(`status`, `createdAt`),
    INDEX `trip_requests_contactEmail_idx`(`contactEmail`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `trip_request_activities` (
    `id` VARCHAR(191) NOT NULL,
    `requestId` VARCHAR(191) NOT NULL,
    `actorRole` VARCHAR(16) NOT NULL,
    `action` VARCHAR(160) NOT NULL,
    `note` TEXT NULL,
    `isInternal` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `trip_request_activities_requestId_createdAt_idx`(`requestId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `trip_request_attempts` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(190) NOT NULL,
    `ipAddress` VARCHAR(64) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `trip_request_attempts_email_createdAt_idx`(`email`, `createdAt`),
    INDEX `trip_request_attempts_ipAddress_createdAt_idx`(`ipAddress`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `trip_requests` ADD CONSTRAINT `trip_requests_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trip_request_activities` ADD CONSTRAINT `trip_request_activities_requestId_fkey` FOREIGN KEY (`requestId`) REFERENCES `trip_requests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
