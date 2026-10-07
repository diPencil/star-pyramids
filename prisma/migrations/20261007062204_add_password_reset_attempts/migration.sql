-- CreateTable
CREATE TABLE `password_reset_attempts` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(190) NOT NULL,
    `ipAddress` VARCHAR(64) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `password_reset_attempts_email_createdAt_idx`(`email`, `createdAt`),
    INDEX `password_reset_attempts_ipAddress_createdAt_idx`(`ipAddress`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
