-- CreateTable
CREATE TABLE `destinations` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(80) NOT NULL,
    `title` VARCHAR(120) NOT NULL,
    `nameAr` VARCHAR(120) NULL,
    `image` VARCHAR(2000) NOT NULL,
    `copy` VARCHAR(2000) NOT NULL,
    `copyAr` VARCHAR(2000) NULL,
    `showInOneDayTours` BOOLEAN NOT NULL DEFAULT false,
    `showInDestinations` BOOLEAN NOT NULL DEFAULT true,
    `isPublished` BOOLEAN NOT NULL DEFAULT true,
    `displayOrder` INTEGER NOT NULL DEFAULT 999,
    `detail` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `destinations_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `multi_day_categories` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(80) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `nameAr` VARCHAR(120) NOT NULL,
    `copy` VARCHAR(2000) NOT NULL,
    `copyAr` VARCHAR(2000) NOT NULL,
    `image` VARCHAR(2000) NOT NULL,
    `order` INTEGER NOT NULL DEFAULT 999,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `multi_day_categories_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
