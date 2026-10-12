-- Phase D follow-up: frozen invoice service lines.
-- Additive only: one NULL LONGTEXT column on `booking_documents`.
-- No existing column is altered, renamed, backfilled, or removed; no
-- rows are seeded or rewritten. Set only on INVOICE rows at issuance;
-- all other rows keep NULL.

-- AlterTable
ALTER TABLE `booking_documents` ADD COLUMN `lineSnapshot` LONGTEXT NULL;
