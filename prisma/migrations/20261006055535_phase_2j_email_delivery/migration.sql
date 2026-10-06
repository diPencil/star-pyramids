-- CreateTable
CREATE TABLE `email_deliveries` (
    `id` VARCHAR(191) NOT NULL,
    `recipient` VARCHAR(190) NOT NULL,
    `recipientType` VARCHAR(16) NOT NULL,
    `eventType` VARCHAR(48) NOT NULL,
    `subject` VARCHAR(200) NOT NULL,
    `relatedReference` VARCHAR(64) NULL,
    `status` ENUM('PENDING', 'SENT', 'FAILED', 'SKIPPED') NOT NULL DEFAULT 'PENDING',
    `providerMessageId` VARCHAR(128) NULL,
    `attempt` INTEGER NOT NULL DEFAULT 0,
    `errorSummary` VARCHAR(500) NULL,
    `idempotencyKey` VARCHAR(64) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `sentAt` DATETIME(3) NULL,
    `failedAt` DATETIME(3) NULL,

    UNIQUE INDEX `email_deliveries_idempotencyKey_key`(`idempotencyKey`),
    INDEX `email_deliveries_recipient_createdAt_idx`(`recipient`, `createdAt`),
    INDEX `email_deliveries_eventType_createdAt_idx`(`eventType`, `createdAt`),
    INDEX `email_deliveries_status_createdAt_idx`(`status`, `createdAt`),
    INDEX `email_deliveries_relatedReference_idx`(`relatedReference`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
