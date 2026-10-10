-- CreateTable
CREATE TABLE `media_assets` (
    `id` VARCHAR(191) NOT NULL,
    `publicId` VARCHAR(64) NOT NULL,
    `storageKey` VARCHAR(255) NOT NULL,
    `url` VARCHAR(500) NOT NULL,
    `mimeType` VARCHAR(100) NOT NULL,
    `extension` VARCHAR(16) NOT NULL,
    `byteSize` INTEGER NOT NULL,
    `scope` VARCHAR(32) NOT NULL DEFAULT 'catalogue',
    `uploaderId` VARCHAR(64) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `media_assets_publicId_key`(`publicId`),
    UNIQUE INDEX `media_assets_storageKey_key`(`storageKey`),
    INDEX `media_assets_scope_createdAt_idx`(`scope`, `createdAt`),
    INDEX `media_assets_uploaderId_createdAt_idx`(`uploaderId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;