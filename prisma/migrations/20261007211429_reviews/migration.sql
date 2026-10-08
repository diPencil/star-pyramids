-- CreateTable
CREATE TABLE `reviews` (
    `id` VARCHAR(191) NOT NULL,
    `publicId` VARCHAR(64) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `tourSlug` VARCHAR(80) NOT NULL,
    `title` VARCHAR(160) NULL,
    `rating` TINYINT NOT NULL,
    `text` TEXT NOT NULL,
    `status` ENUM('PENDING', 'PUBLISHED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `publishedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `reviews_publicId_key`(`publicId`),
    INDEX `reviews_tourSlug_status_createdAt_idx`(`tourSlug`, `status`, `createdAt`),
    INDEX `reviews_status_createdAt_idx`(`status`, `createdAt`),
    INDEX `reviews_userId_createdAt_idx`(`userId`, `createdAt`),
    UNIQUE INDEX `reviews_userId_tourSlug_key`(`userId`, `tourSlug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `review_attempts` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `ipAddress` VARCHAR(64) NOT NULL,
    `tourSlug` VARCHAR(80) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `review_attempts_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `review_attempts_ipAddress_createdAt_idx`(`ipAddress`, `createdAt`),
    INDEX `review_attempts_tourSlug_createdAt_idx`(`tourSlug`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
