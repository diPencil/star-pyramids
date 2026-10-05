-- CreateTable
CREATE TABLE `event_requests` (
    `id` VARCHAR(191) NOT NULL,
    `reference` VARCHAR(16) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `eventSlug` VARCHAR(80) NOT NULL,
    `eventTitle` VARCHAR(160) NOT NULL,
    `eventDate` VARCHAR(120) NOT NULL,
    `eventLocation` VARCHAR(160) NOT NULL,
    `attendees` INTEGER NOT NULL DEFAULT 1,
    `contactName` VARCHAR(80) NOT NULL,
    `contactEmail` VARCHAR(190) NOT NULL,
    `contactPhone` VARCHAR(32) NOT NULL,
    `contactDialCode` VARCHAR(8) NOT NULL,
    `nationality` CHAR(2) NOT NULL,
    `notes` TEXT NULL,
    `status` ENUM('NEW', 'REVIEWING', 'APPROVED', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'NEW',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `event_requests_reference_key`(`reference`),
    INDEX `event_requests_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `event_requests_status_createdAt_idx`(`status`, `createdAt`),
    INDEX `event_requests_contactEmail_idx`(`contactEmail`),
    INDEX `event_requests_eventSlug_idx`(`eventSlug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `event_request_activities` (
    `id` VARCHAR(191) NOT NULL,
    `requestId` VARCHAR(191) NOT NULL,
    `actorRole` VARCHAR(16) NOT NULL,
    `action` VARCHAR(160) NOT NULL,
    `note` TEXT NULL,
    `isInternal` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `event_request_activities_requestId_createdAt_idx`(`requestId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `event_request_attempts` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(190) NOT NULL,
    `ipAddress` VARCHAR(64) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `event_request_attempts_email_createdAt_idx`(`email`, `createdAt`),
    INDEX `event_request_attempts_ipAddress_createdAt_idx`(`ipAddress`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `event_requests` ADD CONSTRAINT `event_requests_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `event_request_activities` ADD CONSTRAINT `event_request_activities_requestId_fkey` FOREIGN KEY (`requestId`) REFERENCES `event_requests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
