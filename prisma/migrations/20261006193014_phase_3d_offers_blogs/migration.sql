-- CreateTable
CREATE TABLE `offers` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(80) NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `image` VARCHAR(2000) NOT NULL,
    `badge` VARCHAR(120) NOT NULL,
    `copy` VARCHAR(2000) NOT NULL,
    `duration` VARCHAR(80) NULL,
    `rating` DOUBLE NULL,
    `price` DOUBLE NULL,
    `originalPrice` DOUBLE NULL,
    `deadline` VARCHAR(120) NULL,
    `isPublished` BOOLEAN NOT NULL DEFAULT true,
    `displayOrder` INTEGER NOT NULL DEFAULT 999,
    `content` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `offers_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `blogs` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(80) NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `image` VARCHAR(2000) NOT NULL,
    `category` VARCHAR(120) NOT NULL,
    `date` VARCHAR(120) NOT NULL,
    `excerpt` VARCHAR(2000) NOT NULL,
    `isPublished` BOOLEAN NOT NULL DEFAULT true,
    `displayOrder` INTEGER NOT NULL DEFAULT 999,
    `content` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `blogs_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
