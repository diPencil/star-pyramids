-- Phase A: booking documents foundation (numbering + issuance only).
-- Additive only: two NEW tables and one NEW enum-backed column set.
-- No existing booking, payment, or financial column is altered, renamed,
-- backfilled, or removed. Booking references (SP-BK-*) and payment
-- references (SP-PAY-*) are untouched; document numbers live in their
-- own namespace. No rows are seeded — nothing issues documents until
-- explicit service calls exist, and no invoice, voucher, tax, or legal
-- data is invented here.

-- CreateTable
CREATE TABLE `document_sequences` (
    `key` VARCHAR(64) NOT NULL,
    `lastValue` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `booking_documents` (
    `id` VARCHAR(191) NOT NULL,
    `number` VARCHAR(32) NOT NULL,
    `type` ENUM('BOOKING_REQUEST', 'BOOKING_CONFIRMATION', 'PAYMENT_RECEIPT', 'INVOICE', 'REFUND_NOTE', 'BOOKING_VOUCHER') NOT NULL,
    `bookingId` VARCHAR(191) NOT NULL,
    `paymentId` VARCHAR(191) NULL,
    `amountCents` INTEGER NOT NULL,
    `currency` CHAR(3) NOT NULL DEFAULT 'USD',
    `idempotencyKey` VARCHAR(120) NULL,
    `issuedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `booking_documents_number_key`(`number`),
    UNIQUE INDEX `booking_documents_idempotencyKey_key`(`idempotencyKey`),
    INDEX `booking_documents_bookingId_type_idx`(`bookingId`, `type`),
    INDEX `booking_documents_paymentId_idx`(`paymentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `booking_documents` ADD CONSTRAINT `booking_documents_bookingId_fkey` FOREIGN KEY (`bookingId`) REFERENCES `bookings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `booking_documents` ADD CONSTRAINT `booking_documents_paymentId_fkey` FOREIGN KEY (`paymentId`) REFERENCES `payments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
