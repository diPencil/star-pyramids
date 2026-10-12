-- Phase D: complete commercial documents (invoice, voucher, refund note).
-- Additive only: NULL columns on two existing tables plus one unique
-- index. No existing column is altered, renamed, backfilled, or
-- removed; no rows are seeded or rewritten.
--
-- - `payment_events`: per-refund evidence (amount, method, external
--   reference of a completed offline refund). Written only by new
--   refunds going forward; NULL on every historical row, which keeps
--   old refunds ineligible for refund notes instead of reinterpreting
--   them.
-- - `booking_documents`: voucher verification token (raw opaque token,
--   set only on BOOKING_VOUCHER rows; the QR encodes the verification
--   URL carrying it) and the refund-note snapshot (event linkage plus
--   frozen amount/method/reference/date, set only on REFUND_NOTE rows).
--   MySQL unique indexes admit multiple NULLs, so all other document
--   rows are unaffected.

-- AlterTable
ALTER TABLE `booking_documents` ADD COLUMN `refundAmountCents` INTEGER NULL,
    ADD COLUMN `refundDate` DATETIME(3) NULL,
    ADD COLUMN `refundEventId` VARCHAR(64) NULL,
    ADD COLUMN `refundExternalReference` VARCHAR(255) NULL,
    ADD COLUMN `refundMethod` VARCHAR(32) NULL,
    ADD COLUMN `verificationToken` VARCHAR(64) NULL;

-- AlterTable
ALTER TABLE `payment_events` ADD COLUMN `amountCents` INTEGER NULL,
    ADD COLUMN `externalReference` VARCHAR(255) NULL,
    ADD COLUMN `method` VARCHAR(32) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `booking_documents_verificationToken_key` ON `booking_documents`(`verificationToken`);
