-- Journey Gallery: centralized photo/video records for the homepage
-- rows and the tour-detail video carousel.
--
-- ADDITIVE AND NON-DESTRUCTIVE: creates two new tables only. Existing
-- tables, tour `journeyVideos` JSON, homepage content and media rows are
-- untouched. DO NOT APPLY without explicit authorization — run
-- `prisma migrate deploy` only when approved, then run
-- `scripts/import-journey-gallery.ts` (idempotent) to seed legacy photos.

-- CreateTable
CREATE TABLE `journey_gallery_items` (
    `id` VARCHAR(191) NOT NULL,
    `mediaType` ENUM('IMAGE', 'VIDEO') NOT NULL,
    `mediaUrl` VARCHAR(2000) NOT NULL,
    `mediaHash` VARCHAR(64) NOT NULL,
    `platform` VARCHAR(32) NULL,
    `title` VARCHAR(200) NOT NULL,
    `titleAr` VARCHAR(200) NULL,
    `caption` VARCHAR(500) NULL,
    `thumbnail` VARCHAR(2000) NULL,
    `showOnHomepage` BOOLEAN NOT NULL DEFAULT false,
    `showOnTours` BOOLEAN NOT NULL DEFAULT false,
    `tourScope` ENUM('ALL_TOURS', 'SELECTED_TOURS') NOT NULL DEFAULT 'SELECTED_TOURS',
    `isPublished` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 999,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `journey_gallery_items_mediaHash_key`(`mediaHash`),
    INDEX `journey_gallery_items_mediaType_isPublished_sortOrder_idx`(`mediaType`, `isPublished`, `sortOrder`),
    INDEX `journey_gallery_items_showOnHomepage_isPublished_idx`(`showOnHomepage`, `isPublished`),
    INDEX `journey_gallery_items_showOnTours_isPublished_idx`(`showOnTours`, `isPublished`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `journey_gallery_tours` (
    `id` VARCHAR(191) NOT NULL,
    `itemId` VARCHAR(191) NOT NULL,
    `tourSlug` VARCHAR(80) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `journey_gallery_tours_itemId_tourSlug_key`(`itemId`, `tourSlug`),
    INDEX `journey_gallery_tours_tourSlug_idx`(`tourSlug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `journey_gallery_tours` ADD CONSTRAINT `journey_gallery_tours_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `journey_gallery_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `journey_gallery_tours` ADD CONSTRAINT `journey_gallery_tours_tourSlug_fkey` FOREIGN KEY (`tourSlug`) REFERENCES `tours`(`slug`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Journey Gallery permissions (canonical catalog additions, module `gallery`)
INSERT INTO `permissions` (`id`, `key`, `module`, `action`, `label`) VALUES
('perm_gallery_view', 'gallery.view', 'gallery', 'view', 'View journey gallery items'),
('perm_gallery_create', 'gallery.create', 'gallery', 'create', 'Create journey gallery items'),
('perm_gallery_edit', 'gallery.edit', 'gallery', 'edit', 'Edit journey gallery items'),
('perm_gallery_delete', 'gallery.delete', 'gallery', 'delete', 'Delete journey gallery items');

-- SUPER_ADMIN: full catalog (enforced in code as a bypass as well).
INSERT INTO `role_permissions` (`id`, `roleId`, `permissionId`, `grantedBy`)
SELECT CONCAT('rp_super_gallery_', p.`id`), r.`id`, p.`id`, 'journey-gallery-backfill'
FROM `roles` r CROSS JOIN `permissions` p
WHERE r.`key` = 'SUPER_ADMIN' AND p.`key` IN ('gallery.view', 'gallery.create', 'gallery.edit', 'gallery.delete');

-- ADMIN: everything except roles.manage (mirrors today's ADMIN gates)
INSERT INTO `role_permissions` (`id`, `roleId`, `permissionId`, `grantedBy`)
SELECT CONCAT('rp_admin_gallery_', p.`id`), r.`id`, p.`id`, 'journey-gallery-backfill'
FROM `roles` r CROSS JOIN `permissions` p
WHERE r.`key` = 'ADMIN' AND p.`key` IN ('gallery.view', 'gallery.create', 'gallery.edit', 'gallery.delete');

-- STAFF: catalogue R/W (mirrors today's STAFF gates)
INSERT INTO `role_permissions` (`id`, `roleId`, `permissionId`, `grantedBy`)
SELECT CONCAT('rp_staff_gallery_', p.`id`), r.`id`, p.`id`, 'journey-gallery-backfill'
FROM `roles` r CROSS JOIN `permissions` p
WHERE r.`key` = 'STAFF' AND p.`key` IN ('gallery.view', 'gallery.create', 'gallery.edit', 'gallery.delete');
