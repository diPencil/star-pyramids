-- AlterTable
ALTER TABLE `roles` ADD COLUMN `isSystem` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE `permissions` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(100) NOT NULL,
    `module` VARCHAR(64) NOT NULL,
    `action` VARCHAR(32) NOT NULL,
    `label` VARCHAR(120) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `permissions_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `role_permissions` (
    `id` VARCHAR(191) NOT NULL,
    `roleId` VARCHAR(191) NOT NULL,
    `permissionId` VARCHAR(191) NOT NULL,
    `grantedBy` VARCHAR(64) NULL,
    `grantedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `role_permissions_roleId_idx`(`roleId`),
    INDEX `role_permissions_permissionId_idx`(`permissionId`),
    UNIQUE INDEX `role_permissions_roleId_permissionId_key`(`roleId`, `permissionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `roles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_permissionId_fkey` FOREIGN KEY (`permissionId`) REFERENCES `permissions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill Phase 4A RBAC. System flags first: SUPER_ADMIN is immutable
-- full access, CUSTOMER stays storefront-only under Customers.
UPDATE `roles` SET `isSystem` = true WHERE `key` IN ('SUPER_ADMIN', 'CUSTOMER');

-- Canonical permission catalog: `<module>.<action>`.
INSERT INTO `permissions` (`id`, `key`, `module`, `action`, `label`) VALUES
('perm_users_view', 'users.view', 'users', 'view', 'View team directory'),
('perm_users_manage', 'users.manage', 'users', 'manage', 'Invite, edit and suspend members'),
('perm_roles_view', 'roles.view', 'roles', 'view', 'View roles and matrix'),
('perm_roles_manage', 'roles.manage', 'roles', 'manage', 'Create roles and edit permissions'),
('perm_tours_view', 'tours.view', 'tours', 'view', 'View tours'),
('perm_tours_create', 'tours.create', 'tours', 'create', 'Create tours'),
('perm_tours_edit', 'tours.edit', 'tours', 'edit', 'Edit tours'),
('perm_tours_delete', 'tours.delete', 'tours', 'delete', 'Delete tours'),
('perm_destinations_view', 'destinations.view', 'destinations', 'view', 'View destinations'),
('perm_destinations_create', 'destinations.create', 'destinations', 'create', 'Create destinations'),
('perm_destinations_edit', 'destinations.edit', 'destinations', 'edit', 'Edit destinations'),
('perm_destinations_delete', 'destinations.delete', 'destinations', 'delete', 'Delete destinations'),
('perm_categories_view', 'categories.view', 'categories', 'view', 'View categories'),
('perm_categories_create', 'categories.create', 'categories', 'create', 'Create categories'),
('perm_categories_edit', 'categories.edit', 'categories', 'edit', 'Edit categories'),
('perm_categories_delete', 'categories.delete', 'categories', 'delete', 'Delete categories'),
('perm_events_view', 'events.view', 'events', 'view', 'View events'),
('perm_events_create', 'events.create', 'events', 'create', 'Create events'),
('perm_events_edit', 'events.edit', 'events', 'edit', 'Edit events'),
('perm_events_delete', 'events.delete', 'events', 'delete', 'Delete events'),
('perm_cars_view', 'cars.view', 'cars', 'view', 'View cars'),
('perm_cars_create', 'cars.create', 'cars', 'create', 'Create cars'),
('perm_cars_edit', 'cars.edit', 'cars', 'edit', 'Edit cars'),
('perm_cars_delete', 'cars.delete', 'cars', 'delete', 'Delete cars'),
('perm_offers_view', 'offers.view', 'offers', 'view', 'View offers'),
('perm_offers_create', 'offers.create', 'offers', 'create', 'Create offers'),
('perm_offers_edit', 'offers.edit', 'offers', 'edit', 'Edit offers'),
('perm_offers_delete', 'offers.delete', 'offers', 'delete', 'Delete offers'),
('perm_blogs_view', 'blogs.view', 'blogs', 'view', 'View blogs'),
('perm_blogs_create', 'blogs.create', 'blogs', 'create', 'Create blogs'),
('perm_blogs_edit', 'blogs.edit', 'blogs', 'edit', 'Edit blogs'),
('perm_blogs_delete', 'blogs.delete', 'blogs', 'delete', 'Delete blogs'),
('perm_bookings_view', 'bookings.view', 'bookings', 'view', 'View bookings'),
('perm_bookings_edit', 'bookings.edit', 'bookings', 'edit', 'Update bookings'),
('perm_requests_view', 'requests.view', 'requests', 'view', 'View trip, car and event requests'),
('perm_requests_edit', 'requests.edit', 'requests', 'edit', 'Update trip, car and event requests'),
('perm_payments_view', 'payments.view', 'payments', 'view', 'View payments'),
('perm_emails_view', 'emails.view', 'emails', 'view', 'View email deliveries'),
('perm_settings_view', 'settings.view', 'settings', 'view', 'View settings'),
('perm_settings_edit', 'settings.edit', 'settings', 'edit', 'Edit settings'),
('perm_support_view', 'support.view', 'support', 'view', 'View support inbox'),
('perm_support_edit', 'support.edit', 'support', 'edit', 'Reply in support inbox');

-- SUPER_ADMIN: full catalog (enforced in code as a bypass as well).
INSERT INTO `role_permissions` (`id`, `roleId`, `permissionId`, `grantedBy`)
SELECT CONCAT('rp_super_', p.`id`), r.`id`, p.`id`, 'phase-4a-backfill'
FROM `roles` r CROSS JOIN `permissions` p WHERE r.`key` = 'SUPER_ADMIN';

-- ADMIN: everything except roles.manage (mirrors today's ADMIN gates:
-- settings.edit and users.manage stay, role/permission design stays super-only).
INSERT INTO `role_permissions` (`id`, `roleId`, `permissionId`, `grantedBy`)
SELECT CONCAT('rp_admin_', p.`id`), r.`id`, p.`id`, 'phase-4a-backfill'
FROM `roles` r CROSS JOIN `permissions` p
WHERE r.`key` = 'ADMIN' AND p.`key` <> 'roles.manage';

-- STAFF: today's isStaff surface (catalogue/requests/bookings/support R/W,
-- settings/users/roles directories readable) minus users.manage and
-- settings.edit, which are ADMIN+ today.
INSERT INTO `role_permissions` (`id`, `roleId`, `permissionId`, `grantedBy`)
SELECT CONCAT('rp_staff_', p.`id`), r.`id`, p.`id`, 'phase-4a-backfill'
FROM `roles` r CROSS JOIN `permissions` p
WHERE r.`key` = 'STAFF' AND p.`key` NOT IN ('roles.manage', 'users.manage', 'settings.edit');
