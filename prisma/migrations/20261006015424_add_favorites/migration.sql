-- CreateTable
CREATE TABLE `favorite_items` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `itemType` VARCHAR(32) NOT NULL DEFAULT 'tour',
    `itemSlug` VARCHAR(120) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `favorite_items_userId_createdAt_idx`(`userId`, `createdAt`),
    UNIQUE INDEX `favorite_items_userId_itemType_itemSlug_key`(`userId`, `itemType`, `itemSlug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `favorite_items` ADD CONSTRAINT `favorite_items_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
