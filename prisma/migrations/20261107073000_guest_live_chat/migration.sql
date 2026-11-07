-- AlterTable
ALTER TABLE `support_conversations` ADD COLUMN `agentRequestedAt` DATETIME(3) NULL,
    ADD COLUMN `channel` VARCHAR(16) NOT NULL DEFAULT 'account',
    ADD COLUMN `guestName` VARCHAR(120) NULL,
    ADD COLUMN `guestPhone` VARCHAR(32) NULL,
    ADD COLUMN `guestSessionId` VARCHAR(191) NULL,
    ADD COLUMN `needsStaffReply` BOOLEAN NOT NULL DEFAULT true,
    MODIFY `customerId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `support_messages` ADD COLUMN `requestHash` CHAR(64) NULL,
    ADD COLUMN `requestId` VARCHAR(48) NULL,
    MODIFY `senderId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `chat_guest_sessions` (
    `id` VARCHAR(191) NOT NULL,
    `tokenHash` CHAR(64) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `chat_guest_sessions_tokenHash_key`(`tokenHash`),
    INDEX `chat_guest_sessions_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chat_rate_buckets` (
    `key` CHAR(64) NOT NULL,
    `count` INTEGER NOT NULL DEFAULT 1,
    `expiresAt` DATETIME(3) NOT NULL,

    INDEX `chat_rate_buckets_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `support_conversations_guestSessionId_updatedAt_idx` ON `support_conversations`(`guestSessionId`, `updatedAt`);

-- CreateIndex
CREATE INDEX `support_conversations_channel_needsStaffReply_idx` ON `support_conversations`(`channel`, `needsStaffReply`);

-- CreateIndex
CREATE UNIQUE INDEX `support_messages_requestId_key` ON `support_messages`(`requestId`);

-- AddForeignKey
ALTER TABLE `support_conversations` ADD CONSTRAINT `support_conversations_guestSessionId_fkey` FOREIGN KEY (`guestSessionId`) REFERENCES `chat_guest_sessions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

